import { mkdir, readFile } from 'node:fs/promises'
import { availableParallelism, version as osVersion, platform } from 'node:os'
import { join } from 'node:path'

import { CORPUS_CONFIG_FILE, CORPUS_ENV_VAR, resolveCorpus } from './corpus-config'
import { CACHE_FILE, loadInventory } from './inventory'
import { MINIMUM_SAMPLE, stratifiedSample } from './sample'
import {
  buildStaticIndex,
  collectHits,
  measureCancellationStopMs,
  useMeasurementIndex,
  type SourceMeasurement,
} from './measure'
import { measureAll, measureEngineStartupMs } from './measure-pool'
import {
  REVIEW_DIR,
  aggregateHits,
  readVerdict,
  writeReviewMaterial,
  type RuleHit,
} from './false-positives'
import { scanIncludeDirectories } from '@advpl-lint/server/out/src/includes/scan'
import type { IncludeEntry } from '@advpl-lint/server/out/src/includes/index-store'

import { neverCancelled } from './tokens'
import {
  buildReport,
  writeReport,
  type IndexMeasurement,
  type PercentileMeasurement,
  type PercentileName,
} from './report'

/**
 * O encadeamento da medição: inventário → amostra → medição → relatório.
 *
 * É o que `npm run baseline` executa.
 *
 * Regra que manda no desenho (FR-024): **corpus ausente não é falha**. Quem
 * clona o repositório sem o corpus roda tudo; a medição avisa, explica como
 * configurar e encerra com sucesso. Portão que fica vermelho à toa para de ser
 * levado a sério.
 */

export type RunStatus = 'measured' | 'skipped'

/** Onde a linha de base é versionada, quando não se pede outro lugar. */
export const DEFAULT_BASELINE_DIR = join('specs', '001-esqueleto-lsp-harness', 'baseline')

/** Quantos disparos entram no material de revisão de falso positivo. */
export const DEFAULT_REVIEW_SAMPLE = 120

/**
 * As regras cujo custo o relatório publica.
 *
 * Escrito aqui e não derivado do registro de propósito: cada linha desta lista
 * é uma coluna do relatório que a comparação do Portão 4 vai acompanhar ao
 * longo das entregas, e acrescentar uma é decisão, não consequência.
 */
const REPORTED_RULES: readonly string[] = ['CA3001', 'PJ0001']

/**
 * O custo daquela regra naquele fonte.
 *
 * Zero quando a medição não traz a regra — e o zero é deliberado, não descuido:
 * acontece quando `REPORTED_RULES` cita uma regra que o motor ainda não
 * registra. Derrubar a medição inteira por isso puniria quem está justamente
 * preparando a coluna do relatório para a regra que vem.
 */
export function costOf(measurement: SourceMeasurement, ruleId: string): number {
  return measurement.perRuleMs[ruleId] ?? 0
}

/** Disparos daquela regra em toda a amostra — a taxa de falso positivo é POR REGRA. */
export function hitsForRule(
  measurements: readonly SourceMeasurement[],
  ruleId: string,
): number {
  return measurements.reduce((total, measurement) => total + (measurement.hitsByRule[ruleId] ?? 0), 0)
}

/**
 * Mede o custo de construir o índice de includes, e devolve o que ele leu.
 *
 * Duas coisas de uma vez, e é de propósito: a varredura acontece **uma vez** e
 * serve tanto ao número do relatório (FR-042) quanto ao índice que os
 * trabalhadores usam para medir `PJ0001`. Varrer duas vezes mediria o cache do
 * sistema de arquivos na segunda.
 *
 * A raiz do corpus é usada como diretório de includes: é onde os `.ch` estão, e
 * é a árvore sobre a qual a medição faz sentido.
 */
export async function measureIndexing(root: string): Promise<{
  readonly measurement: IndexMeasurement
  readonly entries: readonly IncludeEntry[]
}> {
  let directories = 0
  const startedAt = performance.now()
  const result = await scanIncludeDirectories({
    directories: [root],
    token: neverCancelled,
    onDirectory: () => {
      directories += 1
    },
  })
  const scanMs = performance.now() - startedAt

  return {
    measurement: { directories, files: result.files.length, scanMs },
    entries: result.files.map((file) => ({ realName: file.realName, directory: file.directory })),
  }
}

export interface RunBaselineOptions {
  readonly repoRoot: string
  readonly env?: NodeJS.ProcessEnv
  readonly out?: (line: string) => void
  readonly baselineDir?: string
  readonly repetitions?: number
  readonly minimumSample?: number
  readonly reviewSampleSize?: number
  readonly refresh?: boolean
}

export interface RunBaselineResult {
  readonly status: RunStatus
  readonly exitCode: number
  readonly reason?: string
  readonly jsonPath?: string
  readonly mdPath?: string
}

const PERCENTILES: readonly { readonly name: PercentileName; readonly at: number }[] = [
  { name: 'p50', at: 50 },
  { name: 'p90', at: 90 },
  { name: 'p95', at: 95 },
  { name: 'p99', at: 99 },
  { name: 'max', at: 100 },
]

/**
 * Vale a pena avisar o mantenedor agora?
 *
 * Um aviso a cada 10%: silêncio total numa medição de minutos parece
 * travamento, e uma linha por arquivo afogaria o terminal. O último arquivo
 * sempre é anunciado, mesmo que não complete uma fatia de 10% — terminar sem
 * dizer que terminou é a pior das duas falhas.
 */
export function shouldReportProgress(done: number, reported: number, total: number): boolean {
  const step = Math.max(1, Math.floor(total / 10))
  if (done - reported >= step) return true
  return done === total
}

/** O item de um percentil sobre uma lista já ordenada. */
function at<T>(sorted: readonly T[], percentile: number): T {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1))
  return sorted[index]!
}

async function readExtensionVersion(repoRoot: string): Promise<string> {
  try {
    const raw = await readFile(join(repoRoot, 'packages', 'extension', 'package.json'), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      const version = (parsed as { version?: unknown }).version
      if (typeof version === 'string') return version
    }
  } catch {
    // Rodar fora do repositório é caso legítimo em teste; o relatório registra
    // o que sabe, e não inventa uma versão.
  }
  return 'desconhecida'
}

export async function runBaseline(options: RunBaselineOptions): Promise<RunBaselineResult> {
  const out = options.out ?? ((line: string): void => console.info(line))

  const resolution = await resolveCorpus(
    options.env === undefined ? { repoRoot: options.repoRoot } : { repoRoot: options.repoRoot, env: options.env },
  )

  if (!resolution.available) {
    out(`Linha de base NÃO medida: ${resolution.reason}`)
    out(`Para medir, aponte o corpus: variável ${CORPUS_ENV_VAR} ou ${CORPUS_CONFIG_FILE} na raiz.`)
    out('Isto não é falha. A suíte de testes não depende do corpus (FR-024).')
    return { status: 'skipped', exitCode: 0, reason: resolution.reason }
  }

  const { root } = resolution.config
  out(`Corpus (${resolution.config.source}): inventariando…`)

  const inventory = await loadInventory({
    root,
    cachePath: join(options.repoRoot, CACHE_FILE),
    ...(options.refresh === undefined ? {} : { refresh: options.refresh }),
  })

  if (inventory.entries.length === 0) {
    const reason = 'o corpus configurado não tem nenhum fonte ADVPL/TLPP'
    out(`Linha de base NÃO medida: ${reason}`)
    return { status: 'skipped', exitCode: 0, reason }
  }

  out(`Inventário: ${inventory.entries.length} fontes${inventory.fromCache ? ' (do cache)' : ''}.`)

  const sample = stratifiedSample(inventory.entries, { minimum: options.minimumSample ?? MINIMUM_SAMPLE })
  out(`Amostra: ${sample.entries.length} fontes — ${sample.strategy}.`)

  const startupMs = await measureEngineStartupMs()

  // A INDEXAÇÃO, medida em separado (R8, FR-042). Ela acontece uma vez por
  // sessão; a análise, por documento. Somar os dois esconderia o caro dentro do
  // barato — o mesmo erro que o `activationMs` quase cometeu na spec 001.
  out('Indexando os arquivos de include do corpus…')
  const indexing = await measureIndexing(root)
  out(
    `Indexação: ${indexing.measurement.files} include(s) em ${indexing.measurement.directories} ` +
      `diretório(s), em ${indexing.measurement.scanMs.toFixed(0)} ms.`,
  )

  // O índice também vale NESTE processo: `collectHits` roda aqui, e sem ele
  // `PJ0001` calaria — o material de revisão sairia sem uma linha da regra que
  // esta spec existe para entregar.
  useMeasurementIndex(buildStaticIndex(indexing.entries))

  let reported = 0
  const measurements = await measureAll(
    sample.entries.map((entry) => entry.path),
    {
      // O índice vai PRONTO para os trabalhadores. Mandá-los construir o deles
      // significaria varrer a árvore uma vez por trabalhador, e o número
      // resultante não seria nem custo por documento nem custo de indexação.
      includeEntries: indexing.entries,
      ...(options.repetitions === undefined ? {} : { repetitions: options.repetitions }),
      onProgress: (done, total) => {
        if (shouldReportProgress(done, reported, total)) {
          reported = done
          out(`Medindo: ${done}/${total}`)
        }
      },
    },
  )

  if (measurements.length === 0) {
    const reason = 'nenhum fonte da amostra pôde ser medido'
    out(`Linha de base NÃO medida: ${reason}`)
    return { status: 'skipped', exitCode: 0, reason }
  }

  const bySize: SourceMeasurement[] = [...measurements].sort((a, b) => a.lines - b.lines)

  const percentiles: PercentileMeasurement[] = PERCENTILES.map(({ name, at: percentile }) => {
    const measurement = at(bySize, percentile)
    return { percentile: name, lines: measurement.lines, analysisMs: measurement.withRuleMs }
  })

  // O custo da regra é lido nos MESMOS fontes dos percentis de tamanho, para
  // que as duas tabelas do relatório falem dos mesmos arquivos. Ordenar os
  // incrementais por conta própria produziria dois recortes diferentes do
  // corpus na mesma página.
  const ruleCost = REPORTED_RULES.map((ruleId) => ({
    ruleId,
    incrementalMs: {
      p50: costOf(at(bySize, 50), ruleId),
      p95: costOf(at(bySize, 95), ruleId),
      max: costOf(at(bySize, 100), ruleId),
    },
  }))

  const hitsOf = (ruleId: string): number => hitsForRule(measurements, ruleId)
  const hits = hitsOf('CA3001')
  for (const ruleId of REPORTED_RULES) out(`Disparos de ${ruleId}: ${hitsOf(ruleId)}.`)

  // O material de revisão é LOCAL. Do relatório sobe apenas o agregado — e,
  // enquanto ninguém revisou, o agregado diz honestamente "zero revisados".
  const reviewDir = join(options.repoRoot, REVIEW_DIR)
  const reviewSampleSize = options.reviewSampleSize ?? DEFAULT_REVIEW_SAMPLE
  const comDisparo = measurements.filter((measurement) => measurement.hits > 0)
  if (comDisparo.length > 0) {
    // Percorre os fontes com passo uniforme e coleta TUDO o que cada um
    // disparou. O recorte por regra fica com `writeReviewMaterial`: cortar aqui
    // um total global faria a regra que dispara menos ficar sem material —
    // truncada justamente por ser a mais rara.
    const stride = Math.max(1, Math.floor(comDisparo.length / reviewSampleSize))
    const coletados: RuleHit[] = []
    let visitados = 0
    for (let index = 0; index < comDisparo.length && visitados < reviewSampleSize; index += stride) {
      coletados.push(...(await collectHits(comDisparo[index]!.path)))
      visitados += 1
    }
    const written = await writeReviewMaterial(coletados, {
      dir: reviewDir,
      sampleSize: reviewSampleSize,
    })
    out(`Material de revisão (LOCAL, não versionado): ${written.sampled} disparos em ${REVIEW_DIR}.`)
  }

  // O que o olho humano apurou, se já apurou. Sem veredito, o relatório diz
  // "0 revisados" — que é honesto, e diferente de uma taxa que ninguém mediu.
  let verdict = (await readVerdict(reviewDir, 'CA3001')) ?? { reviewed: 0, falsePositives: 0 }

  // Veredito que revisou mais disparos do que esta medição encontrou é de
  // OUTRA medição — corpus mudou, amostra mudou, regra mudou. Aproveitá-lo
  // publicaria uma taxa apurada sobre material que já não é este; e derrubar a
  // medição inteira por causa disso puniria o mantenedor por um arquivo local.
  // Descartar, dizendo por quê, é o único caminho que não mente.
  if (verdict.reviewed > hits) {
    out(
      `Veredito descartado: foi apurado sobre ${verdict.reviewed} disparos e esta medição ` +
        `encontrou ${hits}. Revise o material novamente.`,
    )
    verdict = { reviewed: 0, falsePositives: 0 }
  }

  if (verdict.reviewed > 0) {
    out(`Veredito da revisão: ${verdict.falsePositives} falsos positivos em ${verdict.reviewed} revisados.`)
  }

  // 100.000 linhas, e o número tem razão medida: o maior fonte do corpus tem
  // 27.832 linhas e é analisado em ~6 ms, abaixo dos 10 ms de orçamento de
  // fatia do motor. Um fonte que cabe numa fatia só NUNCA cede o laço — e sem
  // cessão não existe "meio da análise" onde cancelar. A primeira execução real
  // usava 20.000 linhas e devolveu "não mediu".
  const cancellationStopMs = await measureCancellationStopMs(
    Array.from({ length: 100_000 }, (_, i) => `#INCLUDE "T${i}.CH"`).join('\r\n'),
  )

  const report = buildReport({
    measuredAt: new Date().toISOString(),
    environment: {
      node: process.version,
      cpus: availableParallelism(),
      os: `${platform()} ${osVersion()}`,
      extensionVersion: await readExtensionVersion(options.repoRoot),
    },
    corpus: {
      totalFiles: inventory.entries.length,
      sampledFiles: measurements.length,
      sampling: sample.strategy,
      repetitions: options.repetitions ?? 5,
    },
    percentiles,
    ruleCost,
    falsePositives: await Promise.all(
      REPORTED_RULES.map(async (ruleId) => {
        const disparos = hitsOf(ruleId)
        if (ruleId === 'CA3001') {
          return aggregateHits(ruleId, {
            hits: disparos,
            reviewed: verdict.reviewed,
            falsePositives: verdict.falsePositives,
          })
        }
        // Sem veredito, o agregado diz honestamente "zero revisados" — que é
        // diferente de uma taxa que ninguém mediu.
        const outro = (await readVerdict(reviewDir, ruleId)) ?? { reviewed: 0, falsePositives: 0 }
        const coerente = outro.reviewed > disparos ? { reviewed: 0, falsePositives: 0 } : outro
        return aggregateHits(ruleId, {
          hits: disparos,
          reviewed: coerente.reviewed,
          falsePositives: coerente.falsePositives,
        })
      }),
    ),
    activationMs: startupMs,
    cancellationStopMs,
    indexing: indexing.measurement,
  })

  const dir = options.baselineDir ?? join(options.repoRoot, DEFAULT_BASELINE_DIR)
  await mkdir(dir, { recursive: true })
  const written = await writeReport(report, dir)

  out(`Linha de base gravada em ${written.jsonPath}`)

  return { status: 'measured', exitCode: 0, jsonPath: written.jsonPath, mdPath: written.mdPath }
}
