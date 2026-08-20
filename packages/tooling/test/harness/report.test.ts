import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  SCHEMA_VERSION,
  buildReport,
  findCorpusLeak,
  renderMarkdown,
  reportBaseName,
  writeReport,
  type BaselineReportInput,
} from '../../src/harness/report'

function input(): BaselineReportInput {
  return {
    measuredAt: '2026-08-19T14:32:00-03:00',
    environment: { node: 'v24.18.0', cpus: 16, os: 'win32 10.0.26200', extensionVersion: '0.1.0' },
    corpus: {
      totalFiles: 35_599,
      sampledFiles: 1200,
      sampling: 'estratificada por tamanho em bytes, N por faixa',
      repetitions: 5,
    },
    percentiles: [
      { percentile: 'p50', lines: 309, analysisMs: 0.4 },
      { percentile: 'p90', lines: 1699, analysisMs: 1.9 },
      { percentile: 'p95', lines: 2933, analysisMs: 3.2 },
      { percentile: 'p99', lines: 7951, analysisMs: 8.7 },
      { percentile: 'max', lines: 24_636, analysisMs: 27.5 },
    ],
    ruleCost: [{ ruleId: 'CA3001', incrementalMs: { p50: 0.1, p95: 0.8, max: 6.4 } }],
    falsePositives: [{ ruleId: 'CA3001', hits: 11_006, reviewed: 120, falsePositives: 0, rate: 0 }],
    activationMs: 84.2,
    cancellationStopMs: 1.3,
    indexing: { directories: 412, files: 35_103, scanMs: 1840.5 },
  }
}

describe('Relatório — esquema (contracts/relatorio-baseline.md)', () => {
  it('carrega a versão de esquema, para mudança de formato não virar alarme falso', () => {
    const report = buildReport(input())

    assert.equal(report.schemaVersion, SCHEMA_VERSION)
    assert.equal(SCHEMA_VERSION, 2)
  })

  it('é datado e registra o ambiente da medição (FR-025)', () => {
    const report = buildReport(input())

    assert.equal(report.measuredAt, '2026-08-19T14:32:00-03:00')
    assert.equal(report.environment.node, 'v24.18.0')
    assert.equal(report.environment.cpus, 16)
    assert.ok(report.environment.os.length > 0)
    assert.ok(report.environment.extensionVersion.length > 0)
  })

  it('declara quantos arquivos foram medidos e que houve amostragem (FR-025)', () => {
    const report = buildReport(input())

    assert.equal(report.corpus.totalFiles, 35_599)
    assert.equal(report.corpus.sampledFiles, 1200)
    assert.match(report.corpus.sampling, /estratificada/i)
    assert.equal(report.corpus.repetitions, 5)
    assert.match(report.corpus.note, /n[ãa]o versionado/i)
  })

  it('traz os quatro percentis mais o maior arquivo (FR-020)', () => {
    const report = buildReport(input())

    assert.deepEqual(
      report.percentiles.map((p) => p.percentile),
      ['p50', 'p90', 'p95', 'p99', 'max'],
    )
  })

  it('traz o custo incremental por regra (FR-021)', () => {
    const report = buildReport(input())

    assert.equal(report.ruleCost[0]?.ruleId, 'CA3001')
    assert.equal(report.ruleCost[0]?.incrementalMs.p95, 0.8)
  })

  it('recusa relatório cuja amostra fica abaixo do mínimo declarado', () => {
    // Um relatório que diz "1.000 fontes" sobre 12 não é comparável com nada.
    const abaixo = { ...input(), corpus: { ...input().corpus, sampledFiles: 12 } }

    assert.throws(() => buildReport(abaixo), /amostra/i)
  })

  it('recusa número que não é número', () => {
    // `JSON.stringify` transforma NaN em `null`, e um campo numérico valendo
    // `null` no relatório passaria por medição em vez de denunciar que a
    // medição não aconteceu. Foi o que aconteceu na primeira execução real:
    // a análise terminava antes de haver o que cancelar, e o relatório saiu
    // com `cancellationStopMs: null`.
    assert.throws(() => buildReport({ ...input(), cancellationStopMs: Number.NaN }), /n[ãa]o foi medido|NaN|finito/i)
    assert.throws(() => buildReport({ ...input(), activationMs: Number.NaN }), /n[ãa]o foi medido|NaN|finito/i)
  })

  it('recusa taxa de falso positivo incoerente com os números que a compõem', () => {
    const incoerente = {
      ...input(),
      falsePositives: [{ ruleId: 'CA3001', hits: 100, reviewed: 10, falsePositives: 40, rate: 0 }],
    }

    assert.throws(() => buildReport(incoerente), /falso positivo/i)
  })
})

describe('Relatório — o que ele NUNCA pode conter (FR-022, FR-023)', () => {
  it('não deixa passar caminho de arquivo do corpus', () => {
    const leak = findCorpusLeak({ nota: 'medido em D:\\Workspace\\FONTES\\MATA410.PRW' })

    assert.ok(leak !== null)
  })

  it('não deixa passar trecho de fonte ADVPL', () => {
    const leak = findCorpusLeak({ exemplo: 'User Function MATA410()' })

    assert.ok(leak !== null)
  })

  it('não deixa passar nome de programa do corpus', () => {
    const leak = findCorpusLeak({ arquivo: 'MATA410.PRW' })

    assert.ok(leak !== null)
  })

  it('encontra vazamento em qualquer profundidade da estrutura', () => {
    const leak = findCorpusLeak({ a: { b: { c: ['tudo bem', '#include "TOTVS.CH"'] } } })

    assert.ok(leak !== null)
    assert.match(leak, /a\.b\.c/)
  })

  it('aprova um relatório legítimo', () => {
    assert.equal(findCorpusLeak(buildReport(input())), null)
  })

  it('a construção do relatório recusa entrada contaminada', () => {
    const contaminado = {
      ...input(),
      corpus: { ...input().corpus, sampling: 'amostra de D:\\Workspace\\FONTES' },
    }

    assert.throws(() => buildReport(contaminado), /vazamento|corpus/i)
  })

  it('o agregado de falso positivo carrega só números', () => {
    const report = buildReport(input())

    for (const fp of report.falsePositives) {
      assert.deepEqual(Object.keys(fp).sort(), ['falsePositives', 'hits', 'rate', 'reviewed', 'ruleId'])
      assert.equal(typeof fp.hits, 'number')
      assert.equal(typeof fp.rate, 'number')
    }
  })
})

describe('Relatório — as duas saídas (FR-025)', () => {
  it('nomeia os arquivos pela data da medição', () => {
    assert.equal(reportBaseName('2026-08-19T14:32:00-03:00'), '2026-08-19')
  })

  it('grava JSON e markdown com o mesmo conteúdo', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'advpl-report-'))
    try {
      const report = buildReport(input())
      const written = await writeReport(report, dir)

      const files = (await readdir(dir)).sort()
      assert.deepEqual(files, ['2026-08-19.json', '2026-08-19.md'])

      const json = JSON.parse(await readFile(written.jsonPath, 'utf8')) as { schemaVersion: number }
      assert.equal(json.schemaVersion, SCHEMA_VERSION)

      const md = await readFile(written.mdPath, 'utf8')
      assert.match(md, /2933/)
      assert.match(md, /CA3001/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('a versão em markdown é legível por humano e cita a amostragem', () => {
    const md = renderMarkdown(buildReport(input()))

    assert.match(md, /^# /m)
    assert.match(md, /estratificada/i)
    assert.match(md, /p95/)
  })

  it('recusa gravar relatório com vazamento de corpus', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'advpl-report-'))
    try {
      // A conferência roda também na gravação: é a última porta antes de o
      // material entrar no repositório versionado.
      const report = { ...buildReport(input()), measuredAt: '2026-08-19T14:32:00-03:00' }
      const contaminado = { ...report, corpus: { ...report.corpus, note: 'D:\\Workspace\\FONTES' } }

      await assert.rejects(() => writeReport(contaminado, dir), /vazamento|corpus/i)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})


describe('Relatório — o custo da INDEXAÇÃO, medido em separado (R8, FR-042)', () => {
  it('o esquema subiu para 2 porque o formato mudou', () => {
    // O `schemaVersion` existe exatamente para isto: uma mudança de formato não
    // pode ser lida como regressão de desempenho na comparação do Portão 4.
    // Comparar campos que mudaram de significado produz alarme falso, e alarme
    // falso é como um portão deixa de ser levado a sério.
    assert.equal(SCHEMA_VERSION, 2)
  })

  it('grava o custo da varredura ao lado do que ela varreu', () => {
    // Um tempo sozinho não é comparável entre duas medições: a árvore pode ter
    // crescido. Guardar quantos diretórios e quantos arquivos foi preciso ler
    // é o que torna o número interpretável na comparação seguinte.
    const report = buildReport(input())

    assert.equal(report.indexing?.scanMs, 1840.5)
    assert.equal(report.indexing?.files, 35_103)
    assert.equal(report.indexing?.directories, 412)
  })

  it('NÃO soma a indexação ao custo por documento', () => {
    // São orçamentos diferentes: a indexação acontece uma vez por sessão; a
    // análise, por documento. Somar os dois esconderia o caro dentro do barato
    // — que é exatamente o erro que o `activationMs` da spec 001 quase cometeu
    // ao misturar carregamento de módulo com trabalho próprio.
    const report = buildReport(input())

    for (const percentil of report.percentiles) {
      assert.ok(
        percentil.analysisMs < report.indexing!.scanMs,
        `o percentil ${percentil.percentile} carregou o custo da indexação junto`,
      )
    }
    for (const custo of report.ruleCost) {
      assert.ok(custo.incrementalMs.max < report.indexing!.scanMs)
    }
  })

  it('aceita NULO quando a indexação não foi medida, e não inventa zero', () => {
    // Zero seria um número que ninguém mediu, e ele entraria na comparação do
    // Portão 4 como se fosse medição. "Não medido" precisa ser dizível.
    const report = buildReport({ ...input(), indexing: null })

    assert.equal(report.indexing, null)
    assert.match(renderMarkdown(report), /n[ãa]o medid/i)
  })

  it('RECUSA custo de indexação não finito, como já recusa os outros', () => {
    // `JSON.stringify` transforma NaN e Infinity em `null`, e um campo numérico
    // valendo `null` passa por medição em vez de denunciar que ela não
    // aconteceu.
    assert.throws(
      () => buildReport({ ...input(), indexing: { directories: 1, files: 1, scanMs: Number.NaN } }),
      /não foi medid/i,
    )
    assert.throws(
      () => buildReport({ ...input(), indexing: { directories: 1, files: 1, scanMs: Infinity } }),
      /não foi medid/i,
    )
  })

  it('o relatório humano mostra a indexação em seção própria', () => {
    const markdown = renderMarkdown(buildReport(input()))

    assert.match(markdown, /Indexa[çc][ãa]o/i)
    assert.match(markdown, /1840\.50/)
    assert.match(markdown, /35103|35\.103/)
  })

  it('a indexação NÃO vaza caminho do corpus para o relatório', () => {
    // Contagem e tempo, nunca caminho. É a mesma porta que o resto do relatório
    // já fecha — e a indexação é justamente o campo mais tentador de anotar
    // "qual diretório demorou".
    const report = buildReport(input())

    assert.equal(findCorpusLeak(report), null)
  })
})
