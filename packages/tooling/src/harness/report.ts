import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { MINIMUM_SAMPLE } from './sample'

/**
 * O relatório de linha de base.
 *
 * É o comparativo obrigatório de toda entrega futura (Portão 4 da
 * constituição): legível por máquina para comparação automática, e por humano
 * para revisão. Duas saídas, mesmo conteúdo.
 *
 * ⚠️ E é o arquivo onde o corpus mais facilmente vazaria para dentro do
 * repositório. Nenhum caminho, nenhum trecho de fonte, nenhum nome de programa
 * — a conferência roda na construção E na gravação.
 */

export const SCHEMA_VERSION = 1

const CORPUS_NOTE = 'corpus externo, local, NÃO versionado'

export type PercentileName = 'p50' | 'p90' | 'p95' | 'p99' | 'max'

export interface ReportEnvironment {
  readonly node: string
  readonly cpus: number
  readonly os: string
  readonly extensionVersion: string
}

export interface ReportCorpusInput {
  readonly totalFiles: number
  readonly sampledFiles: number
  readonly sampling: string
  readonly repetitions: number
}

export interface ReportCorpus extends ReportCorpusInput {
  readonly note: string
}

export interface PercentileMeasurement {
  readonly percentile: PercentileName
  readonly lines: number
  readonly analysisMs: number
}

export interface RuleCost {
  readonly ruleId: string
  readonly incrementalMs: { readonly p50: number; readonly p95: number; readonly max: number }
}

export interface FalsePositiveAggregate {
  readonly ruleId: string
  readonly hits: number
  readonly reviewed: number
  readonly falsePositives: number
  readonly rate: number
}

export interface BaselineReportInput {
  readonly measuredAt: string
  readonly environment: ReportEnvironment
  readonly corpus: ReportCorpusInput
  readonly percentiles: readonly PercentileMeasurement[]
  readonly ruleCost: readonly RuleCost[]
  readonly falsePositives: readonly FalsePositiveAggregate[]
  readonly activationMs: number
  readonly cancellationStopMs: number
}

export interface BaselineReport extends Omit<BaselineReportInput, 'corpus'> {
  readonly schemaVersion: number
  readonly corpus: ReportCorpus
}

/**
 * Sinais de que material do corpus entrou onde não devia.
 *
 * Os três são independentes de propósito: um caminho denuncia a máquina de
 * quem mediu, uma extensão de fonte denuncia o nome do programa, e uma
 * construção de ADVPL denuncia o código em si.
 */
const PATH_LIKE = /[\\/]/
const SOURCE_NAME = /\.(prw|prx|prg|apw|apl|tlpp|ch)\b/i
const ADVPL_CODE = /(user\s+function|static\s+function|#\s*include|endclass|wsmethod|wsrestful)/i

export function findCorpusLeak(value: unknown, path = ''): string | null {
  if (typeof value === 'string') {
    if (PATH_LIKE.test(value) || SOURCE_NAME.test(value) || ADVPL_CODE.test(value)) return path || '(raiz)'
    return null
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findCorpusLeak(value[index], `${path}[${index}]`)
      if (found !== null) return found
    }
    return null
  }

  if (typeof value === 'object' && value !== null) {
    for (const [key, nested] of Object.entries(value)) {
      const found = findCorpusLeak(nested, path === '' ? key : `${path}.${key}`)
      if (found !== null) return found
    }
  }

  return null
}

function assertNoLeak(report: unknown): void {
  const leak = findCorpusLeak(report)
  if (leak !== null) {
    throw new Error(`vazamento de corpus no relatório, em "${leak}" — nenhum caminho, trecho ou nome de programa`)
  }
}

export function buildReport(input: BaselineReportInput): BaselineReport {
  const { totalFiles, sampledFiles } = input.corpus

  // A amostra precisa atingir o piso de SC-006 — ou ser o inventário inteiro,
  // que é o caso do corpus pequeno. Um relatório que diz "linha de base" sobre
  // uma dúzia de arquivos não é comparável com nada, e comparar com ele daria
  // alarme falso.
  const required = Math.min(MINIMUM_SAMPLE, totalFiles)
  if (sampledFiles < required) {
    throw new Error(
      `amostra de ${sampledFiles} fontes está abaixo do mínimo de ${required} exigido para uma linha de base`,
    )
  }

  // JSON.stringify transforma NaN e Infinity em `null`, e um campo numérico
  // valendo `null` no relatório passa por medição em vez de denunciar que a
  // medição NÃO aconteceu. Recusar aqui é a diferença entre um erro que se lê e
  // um número que se acredita.
  for (const [name, value] of [
    ['activationMs', input.activationMs],
    ['cancellationStopMs', input.cancellationStopMs],
  ] as const) {
    if (!Number.isFinite(value)) {
      throw new Error(`${name} não foi medido: valor não finito. Um relatório não publica o que não mediu.`)
    }
  }

  for (const fp of input.falsePositives) {
    if (fp.reviewed > fp.hits || fp.falsePositives > fp.reviewed) {
      throw new Error(
        `contagem de falso positivo incoerente em ${fp.ruleId}: ` +
          `${fp.hits} disparos, ${fp.reviewed} revisados, ${fp.falsePositives} falsos positivos`,
      )
    }
  }

  const report: BaselineReport = {
    schemaVersion: SCHEMA_VERSION,
    measuredAt: input.measuredAt,
    environment: input.environment,
    corpus: { ...input.corpus, note: CORPUS_NOTE },
    percentiles: input.percentiles,
    ruleCost: input.ruleCost,
    falsePositives: input.falsePositives,
    activationMs: input.activationMs,
    cancellationStopMs: input.cancellationStopMs,
  }

  assertNoLeak(report)

  return report
}

export function reportBaseName(measuredAt: string): string {
  return measuredAt.slice(0, 10)
}

function ms(value: number): string {
  return value.toFixed(2)
}

export function renderMarkdown(report: BaselineReport): string {
  const linhas: string[] = [
    `# Linha de base — ${reportBaseName(report.measuredAt)}`,
    '',
    'Comparativo obrigatório de toda entrega futura (Portão 4 da constituição).',
    'Medido sobre corpus externo e local: **não é reproduzível por terceiros**, e por',
    'isso este relatório precisa se explicar sozinho.',
    '',
    '## Ambiente',
    '',
    '| Item | Valor |',
    '| ---- | ----- |',
    `| Node | ${report.environment.node} |`,
    `| Núcleos | ${report.environment.cpus} |`,
    `| Sistema | ${report.environment.os} |`,
    `| Versão da extensão | ${report.environment.extensionVersion} |`,
    `| Medido em | ${report.measuredAt} |`,
    `| Versão do esquema | ${report.schemaVersion} |`,
    '',
    '## Corpus',
    '',
    `- Fontes no inventário: **${report.corpus.totalFiles}**`,
    `- Fontes medidos: **${report.corpus.sampledFiles}**`,
    `- Amostragem: ${report.corpus.sampling}`,
    `- Repetições por fonte: ${report.corpus.repetitions} (o número usado é a mediana)`,
    `- ${report.corpus.note}`,
    '',
    '## Tempo de análise por percentil de tamanho',
    '',
    '| Percentil | Linhas | Análise (ms) |',
    '| --------- | ------ | ------------ |',
    ...report.percentiles.map((p) => `| ${p.percentile} | ${p.lines} | ${ms(p.analysisMs)} |`),
    '',
    '## Custo incremental por regra',
    '',
    'Diferença entre rodar com a regra e rodar sem ela.',
    '',
    '| Regra | p50 (ms) | p95 (ms) | máx (ms) |',
    '| ----- | -------- | -------- | -------- |',
    ...report.ruleCost.map(
      (r) => `| ${r.ruleId} | ${ms(r.incrementalMs.p50)} | ${ms(r.incrementalMs.p95)} | ${ms(r.incrementalMs.max)} |`,
    ),
    '',
    '## Falso positivo',
    '',
    'Apurado sobre amostra revisada. O material de revisão é local e não versionado.',
    '',
    '| Regra | Disparos | Revisados | Falsos positivos | Taxa |',
    '| ----- | -------- | --------- | ---------------- | ---- |',
    ...report.falsePositives.map(
      (f) => `| ${f.ruleId} | ${f.hits} | ${f.reviewed} | ${f.falsePositives} | ${(f.rate * 100).toFixed(2)}% |`,
    ),
    '',
    '## Outros números do Princípio I',
    '',
    `- Partida do motor — subir o thread e carregar o código: **${ms(report.activationMs)} ms**`,
    '',
    '  ⚠️ O campo se chama `activationMs` no esquema, mas **não** é a ativação da',
    '  extensão dentro do editor: essa envolve o VS Code e é medida pelo teste de',
    '  integração. Este número é o componente que pertence ao servidor — o pedaço',
    '  do orçamento que o código deste repositório controla.',
    '',
    `- Parada após cancelamento: **${ms(report.cancellationStopMs)} ms**`,
    '',
    '  Quanto tempo a análise ainda gasta DEPOIS de cancelada, sobre um fonte de',
    '  20.000 linhas. O legado gastava o tempo inteiro e descartava o resultado no',
    '  fim — que é o oposto de parar.',
    '',
  ]

  return linhas.join('\n')
}

export async function writeReport(
  report: BaselineReport,
  dir: string,
): Promise<{ jsonPath: string; mdPath: string }> {
  // Última porta antes de o material entrar no repositório versionado.
  assertNoLeak(report)

  const base = reportBaseName(report.measuredAt)
  const jsonPath = join(dir, `${base}.json`)
  const mdPath = join(dir, `${base}.md`)

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(mdPath, renderMarkdown(report), 'utf8')

  return { jsonPath, mdPath }
}
