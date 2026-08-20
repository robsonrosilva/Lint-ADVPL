import { readFile } from 'node:fs/promises'

import { analyze } from '@advpl-lint/server/out/src/analysis/analyze'
import { createAnalyzedDocument } from '@advpl-lint/server/out/src/document/analyzed-document'
import {
  EMPTY_INCLUDE_INDEX,
  type IncludeEntry,
  type IncludeIndexReader,
  type IncludeLookup,
} from '@advpl-lint/server/out/src/includes/index-store'
import { ca3001 } from '@advpl-lint/server/out/src/rules/ca3001'
import { pj0001 } from '@advpl-lint/server/out/src/rules/pj0001'
import { RuleRegistry } from '@advpl-lint/server/out/src/rules/registry'
import { decodeCp1252 } from '@advpl-lint/server/out/src/text/cp1252'

import type { RuleHit } from './false-positives'
import { createControllableToken, neverCancelled } from './tokens'

/**
 * Medição do custo da análise.
 *
 * Três regras do contrato do relatório mandam neste arquivo:
 *
 * 1. O cronômetro cobre **apenas a análise** — a leitura de disco fica fora,
 *    senão a linha de base mediria o disco da máquina e não o código.
 * 2. Cada fonte é medido em **várias repetições** e o resultado é a **mediana**,
 *    para que uma pausa de coleta de lixo não vire "regressão de desempenho".
 * 3. O custo de uma regra é a **diferença** entre rodar com ela e sem ela.
 *
 * O motor vem do workspace vizinho pelo caminho compilado: o npm liga
 * `node_modules/@advpl-lint/server` a `packages/server`, então o mesmo
 * especificador resolve em compilação (pelo `.d.ts`) e em execução (pelo `.js`).
 */

/** Teto de trabalhadores. Acima disso o ganho some e a disputa atrapalha a medição. */
export const MAX_WORKERS = 12

/** Repetições por fonte, quando não se pede outra coisa. */
export const DEFAULT_REPETITIONS = 5

const registry = new RuleRegistry()
registry.register(ca3001)
registry.register(pj0001)

/** As regras ligadas na medição "com regra". */
const RULES = registry.all()

/** Nenhuma regra: é a metade "sem regra" da subtração do FR-021. */
const NO_RULES: typeof RULES = []

/** A regra pedida, sozinha — é a outra metade da subtração POR REGRA. */
function onlyRule(ruleId: string): typeof RULES {
  return RULES.filter((rule) => rule.id === ruleId)
}

/**
 * O índice de includes usado na medição.
 *
 * Começa VAZIO, e com ele `PJ0001` cala — que é o comportamento previsto quando
 * não há diretório utilizável. Quem quiser medir a regra monta um índice com
 * `buildStaticIndex` e o instala com `useMeasurementIndex`.
 */
let measurementIndex: IncludeIndexReader = EMPTY_INCLUDE_INDEX

/**
 * Um índice PRONTO, montado a partir de entradas já lidas — sem tocar no disco.
 *
 * Existe porque o custo da varredura é medido **uma vez, em separado** (R8,
 * FR-042). Construir um índice de verdade dentro de cada trabalhador
 * significaria varrer a árvore de 35 mil arquivos uma vez por trabalhador, e o
 * número resultante não seria nem o custo por documento nem o custo de
 * indexação — seria os dois embaralhados.
 */
export function buildStaticIndex(entries: readonly IncludeEntry[]): IncludeIndexReader {
  const bySpelling = new Map<string, Map<string, IncludeEntry>>()

  for (const entry of entries) {
    const key = entry.realName.toLowerCase()
    let bucket = bySpelling.get(key)
    if (!bucket) {
      bucket = new Map()
      bySpelling.set(key, bucket)
    }
    if (!bucket.has(entry.realName)) bucket.set(entry.realName, entry)
  }

  return {
    state: 'pronto',
    ensureBuilt: () => {},
    lookup: (fileName: string): IncludeLookup => {
      const bucket = bySpelling.get(fileName.toLowerCase())
      if (!bucket) return { kind: 'ausente' }
      const spellings = [...bucket.values()]
      if (spellings.length === 1) return { kind: 'encontrado', entry: spellings[0]! }
      return { kind: 'ambíguo', candidates: spellings }
    },
  }
}

/** Instala o índice que a medição vai usar. Injeção, não estado global escondido. */
export function useMeasurementIndex(index: IncludeIndexReader): void {
  measurementIndex = index
}

/**
 * Quebra de linha em qualquer das três formas: CRLF, LF ou CR solto.
 *
 * Fonte Protheus costuma ser CRLF, mas arquivos com os dois misturados existem
 * — e o trecho da revisão precisa sair na linha certa nos três casos.
 */
const LINE_BREAK = new RegExp('\\r\\n|\\n|\\r')

export interface MeasureAnalysisParams {
  readonly text: string
  readonly repetitions?: number
  /** Relógio injetável — os testes precisam de tempo determinístico. */
  readonly now?: () => number
  /** Quando falso, a análise roda sem nenhuma regra ligada. */
  readonly withRule?: boolean
  /** Quando presente, roda SÓ aquela regra — a metade "com" da subtração por regra. */
  readonly onlyRule?: string
}

export interface SourceMeasurement {
  readonly path: string
  readonly lines: number
  readonly bytes: number
  readonly withRuleMs: number
  readonly withoutRuleMs: number
  readonly incrementalMs: number
  readonly hits: number
  /**
   * O custo incremental de CADA regra, medida sozinha contra a análise vazia.
   *
   * Com mais de uma regra registrada, um número único mediria todas juntas e o
   * relatório atribuiria o custo somado a uma delas. O Portão 4 compara regra a
   * regra.
   */
  readonly perRuleMs: Readonly<Record<string, number>>
  /** Quantas vezes cada regra disparou. A taxa de falso positivo é POR REGRA. */
  readonly hitsByRule: Readonly<Record<string, number>>
}

export interface MeasureSourceParams {
  readonly path: string
  readonly repetitions?: number
  readonly now?: () => number
  readonly readSource?: (path: string) => Promise<string>
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  // Mediana e não média: uma pausa de coleta de lixo no meio de uma repetição
  // não pode virar "regressão de desempenho" no Portão 4.
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

export function workerCount(cpus: number): number {
  // Menos dois: um núcleo para o sistema operacional e outro para o processo
  // que coordena. Medir com a máquina saturada mede a máquina, não o código.
  return Math.max(1, Math.min(MAX_WORKERS, cpus - 2))
}

interface RunOutcome {
  readonly ms: number
  readonly diagnostics: number
}

/** Uma passagem cronometrada. Só o que está entre as duas leituras do relógio conta. */
async function runOnce(text: string, rules: typeof RULES, now: () => number): Promise<RunOutcome> {
  const document = createAnalyzedDocument({
    uri: 'file:///medicao.prw',
    languageId: 'advpl',
    version: 1,
    text,
  })

  const startedAt = now()
  const result = await analyze({
    document,
    rules,
    isEnabled: () => true,
    severityOf: (rule) => rule.defaultSeverity,
    // Mensagem e endereço de documentação são constantes: o que se mede é a
    // análise, e montar texto de usuário não faz parte dela.
    translate: () => '',
    docHrefOf: () => '',
    includes: measurementIndex,
    token: neverCancelled,
  })
  const elapsed = now() - startedAt

  return { ms: elapsed, diagnostics: result.diagnostics.length }
}

async function repeat(params: MeasureAnalysisParams): Promise<{ ms: number; hits: number }> {
  const repetitions = params.repetitions ?? DEFAULT_REPETITIONS
  const now = params.now ?? ((): number => performance.now())
  const rules =
    params.onlyRule !== undefined
      ? onlyRule(params.onlyRule)
      : params.withRule === false
        ? NO_RULES
        : RULES

  const samples: number[] = []
  let hits = 0
  for (let round = 0; round < repetitions; round += 1) {
    const outcome = await runOnce(params.text, rules, now)
    samples.push(outcome.ms)
    hits = outcome.diagnostics
  }

  return { ms: median(samples), hits }
}

export async function measureAnalysisMs(params: MeasureAnalysisParams): Promise<number> {
  return (await repeat(params)).ms
}

/** Leitura padrão de um fonte do corpus: bytes CP1252, nunca `latin1`. */
async function readCp1252(path: string): Promise<string> {
  return decodeCp1252(await readFile(path))
}

export async function measureSource(params: MeasureSourceParams): Promise<SourceMeasurement> {
  const read = params.readSource ?? readCp1252

  // FORA do cronômetro, e é o ponto inteiro desta função: com a leitura dentro,
  // a linha de base diria mais sobre o disco da máquina que sobre o código.
  const text = await read(params.path)

  const repetitions = params.repetitions ?? DEFAULT_REPETITIONS
  const clock = params.now

  const withRule = await repeat(
    clock === undefined
      ? { text, repetitions, withRule: true }
      : { text, repetitions, withRule: true, now: clock },
  )
  const withoutRule = await repeat(
    clock === undefined
      ? { text, repetitions, withRule: false }
      : { text, repetitions, withRule: false, now: clock },
  )

  const document = createAnalyzedDocument({
    uri: 'file:///medicao.prw',
    languageId: 'advpl',
    version: 1,
    text,
  })

  // O custo de cada regra, medida SOZINHA contra a análise vazia. É a mesma
  // subtração do FR-021, feita uma vez por regra em vez de uma vez para o
  // conjunto — sem isso, o relatório atribuiria a uma regra o custo de todas.
  const perRuleMs: Record<string, number> = {}
  for (const rule of RULES) {
    const somenteEla = await repeat(
      clock === undefined
        ? { text, repetitions, onlyRule: rule.id }
        : { text, repetitions, onlyRule: rule.id, now: clock },
    )
    perRuleMs[rule.id] = somenteEla.ms - withoutRule.ms
  }

  const hitsByRule = await countHitsByRule(text)

  return {
    path: params.path,
    lines: document.lineOffsets.length,
    bytes: Buffer.byteLength(text, 'latin1'),
    withRuleMs: withRule.ms,
    withoutRuleMs: withoutRule.ms,
    // A subtração É o custo da regra (FR-021). Estimar por outro caminho seria
    // inventar um número que ninguém consegue conferir.
    incrementalMs: withRule.ms - withoutRule.ms,
    hits: withRule.hits,
    perRuleMs,
    hitsByRule,
  }
}

/**
 * Quantas vezes cada regra disparou neste fonte.
 *
 * Quem diz é o próprio motor, e não um segundo reconhecedor escrito aqui: uma
 * regex paralela divergiria da regra no primeiro caso de borda, e a taxa
 * apurada passaria a falar de outra coisa.
 */
async function countHitsByRule(text: string): Promise<Record<string, number>> {
  const document = createAnalyzedDocument({
    uri: 'file:///medicao.prw',
    languageId: 'advpl',
    version: 1,
    text,
  })
  const result = await analyze({
    document,
    rules: RULES,
    isEnabled: () => true,
    severityOf: (rule) => rule.defaultSeverity,
    translate: () => '',
    docHrefOf: () => '',
    includes: measurementIndex,
    token: neverCancelled,
  })

  const byRule: Record<string, number> = {}
  for (const rule of RULES) byRule[rule.id] = 0
  for (const diagnostic of result.diagnostics) {
    const ruleId = String(diagnostic.code)
    byRule[ruleId] = (byRule[ruleId] ?? 0) + 1
  }
  return byRule
}

/**
 * Os trechos que dispararam, para a revisão humana de falso positivo.
 *
 * Sai daqui e vai direto para o diretório LOCAL de revisão — nunca para o
 * relatório versionado (FR-022, FR-023).
 *
 * Quem diz onde houve disparo é o próprio motor, não um segundo reconhecedor
 * escrito aqui: uma regex paralela divergiria da regra no primeiro caso de
 * borda, e a taxa apurada passaria a falar de outra coisa.
 */
export async function collectHits(
  path: string,
  readSource?: (path: string) => Promise<string>,
): Promise<RuleHit[]> {
  const read = readSource ?? readCp1252
  const text = await read(path)

  const document = createAnalyzedDocument({ uri: 'file:///medicao.prw', languageId: 'advpl', version: 1, text })
  const result = await analyze({
    document,
    rules: RULES,
    isEnabled: () => true,
    severityOf: (rule) => rule.defaultSeverity,
    translate: () => '',
    docHrefOf: () => '',
    includes: measurementIndex,
    token: neverCancelled,
  })

  const lines = text.split(LINE_BREAK)

  return result.diagnostics.map((diagnostic) => ({
    ruleId: String(diagnostic.code),
    path,
    line: diagnostic.range.start.line + 1,
    // A linha vem do próprio motor, sobre este mesmo texto: ela existe.
    excerpt: lines[diagnostic.range.start.line]!,
  }))
}

/**
 * Quanto tempo a análise leva para PARAR depois de cancelada (SC-009).
 *
 * O número que interessa não é "quanto ela demoraria": é quanto tempo ela ainda
 * gasta depois de o usuário ter digitado. O legado descartava o resultado no
 * fim, tendo gasto o tempo inteiro — que é o oposto de parar.
 */
export async function measureCancellationStopMs(text: string): Promise<number> {
  const token = createControllableToken()

  const document = createAnalyzedDocument({ uri: 'file:///medicao.prw', languageId: 'advpl', version: 1, text })

  const running = analyze({
    document,
    rules: RULES,
    isEnabled: () => true,
    severityOf: (rule) => rule.defaultSeverity,
    translate: () => '',
    docHrefOf: () => '',
    token,
  })

  // Cede uma vez para a análise começar de verdade antes do cancelamento.
  await new Promise((resolve) => setImmediate(resolve))

  const startedAt = performance.now()
  token.cancel()
  const result = await running
  const elapsed = performance.now() - startedAt

  return result.cancelled ? elapsed : Number.NaN
}
