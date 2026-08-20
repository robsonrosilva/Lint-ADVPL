import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CORPUS_ENV_VAR } from '../../src/harness/corpus-config'
import {
  costOf,
  hitsForRule,
  measureIndexing,
  runBaseline,
  shouldReportProgress,
} from '../../src/harness/run'

describe('Aviso de progresso', () => {
  it('avisa a cada fatia de 10%', () => {
    assert.equal(shouldReportProgress(10, 0, 100), true)
    assert.equal(shouldReportProgress(9, 0, 100), false)
  })

  it('sempre avisa no último arquivo, mesmo sem completar a fatia', () => {
    // Terminar sem dizer que terminou é pior que avisar demais.
    assert.equal(shouldReportProgress(100, 99, 100), true)
  })

  it('em corpus pequeno avisa a cada arquivo', () => {
    assert.equal(shouldReportProgress(1, 0, 3), true)
  })

  it('não avisa duas vezes o mesmo ponto', () => {
    assert.equal(shouldReportProgress(50, 50, 100), false)
  })
})

describe('Medição sem corpus — avisa e encerra COM SUCESSO (FR-024)', () => {
  it('não falha a execução quando o corpus não está configurado', async () => {
    // Quem clona o repositório sem o corpus precisa conseguir rodar tudo. Se a
    // medição saísse com erro, o portão de verificação ficaria vermelho por uma
    // razão que não é defeito nenhum — e portão que fica vermelho à toa para de
    // ser levado a sério.
    const repoRoot = await mkdtemp(join(tmpdir(), 'advpl-run-'))
    const linhas: string[] = []
    try {
      const result = await runBaseline({
        repoRoot,
        env: {},
        out: (line) => linhas.push(line),
      })

      assert.equal(result.status, 'skipped')
      assert.equal(result.exitCode, 0)
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('funciona sem receber ambiente nem canal de saída', async () => {
    // É a forma como `npm run baseline` chama de verdade: só a raiz.
    const repoRoot = await mkdtemp(join(tmpdir(), 'advpl-run-'))
    const original = console.info
    const capturado: string[] = []
    try {
      console.info = (...args: unknown[]): void => {
        capturado.push(args.join(' '))
      }

      const result = await runBaseline({ repoRoot })

      assert.equal(result.status, 'skipped')
      assert.equal(result.exitCode, 0)
      assert.ok(capturado.length > 0)
    } finally {
      console.info = original
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('diz ao mantenedor por que não mediu e como configurar', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'advpl-run-'))
    const linhas: string[] = []
    try {
      await runBaseline({ repoRoot, env: {}, out: (line) => linhas.push(line) })
      const saida = linhas.join('\n')

      assert.match(saida, /corpus/i)
      assert.match(saida, new RegExp(CORPUS_ENV_VAR))
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('não grava relatório nenhum quando não mediu', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'advpl-run-'))
    const baselineDir = join(repoRoot, 'baseline')
    try {
      await mkdir(baselineDir)
      await runBaseline({ repoRoot, env: {}, out: () => {}, baselineDir })

      assert.deepEqual(await readdir(baselineDir), [])
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })
})

describe('Medição sem material para medir — também não é falha (FR-024)', () => {
  it('avisa e encerra com sucesso quando o corpus não tem nenhum fonte', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'advpl-run-'))
    const corpus = join(repoRoot, 'vazio')
    const linhas: string[] = []
    try {
      await mkdir(corpus)
      await writeFile(join(corpus, 'leia-me.txt'), 'nada aqui', 'utf8')

      const result = await runBaseline({
        repoRoot,
        env: { [CORPUS_ENV_VAR]: corpus },
        out: (line) => linhas.push(line),
      })

      assert.equal(result.status, 'skipped')
      assert.equal(result.exitCode, 0)
      assert.match(linhas.join('\n'), /nenhum fonte/i)
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('avisa e encerra com sucesso quando nenhum fonte da amostra pôde ser lido', async () => {
    // O inventário vem do cache e os arquivos sumiram do disco desde então —
    // acontece com corpus que é atualizado por fora.
    const repoRoot = await mkdtemp(join(tmpdir(), 'advpl-run-'))
    const corpus = join(repoRoot, 'fontes')
    const linhas: string[] = []
    try {
      await mkdir(corpus)
      const fonte = join(corpus, 'some.prw')
      await writeFile(fonte, '#INCLUDE "T.CH"\r\n', 'latin1')

      // Primeira passada só para criar o cache do inventário.
      await runBaseline({
        repoRoot,
        env: { [CORPUS_ENV_VAR]: corpus },
        out: () => {},
        baselineDir: join(repoRoot, 'baseline'),
        repetitions: 1,
        minimumSample: 1,
        reviewSampleSize: 1,
      })

      await rm(fonte)

      const result = await runBaseline({
        repoRoot,
        env: { [CORPUS_ENV_VAR]: corpus },
        out: (line) => linhas.push(line),
        baselineDir: join(repoRoot, 'baseline'),
        repetitions: 1,
        minimumSample: 1,
      })

      assert.equal(result.status, 'skipped')
      assert.equal(result.exitCode, 0)
      assert.match(linhas.join('\n'), /nenhum fonte/i)
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })
})

describe('Medição com corpus — o encadeamento (T059)', () => {
  it('percorre inventário, amostra, medição e relatório', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'advpl-run-'))
    const corpus = join(repoRoot, 'fontes')
    const baselineDir = join(repoRoot, 'baseline')
    const linhas: string[] = []
    try {
      await mkdir(corpus)
      await mkdir(baselineDir)
      for (let i = 0; i < 6; i += 1) {
        const conteudo = [`#INCLUDE "TOTVS.CH"`, `User Function Teste${i}()`, 'Return', ''].join('\r\n')
        await writeFile(join(corpus, `fonte-${i}.prw`), conteudo, 'latin1')
      }

      const result = await runBaseline({
        repoRoot,
        env: { [CORPUS_ENV_VAR]: corpus },
        out: (line) => linhas.push(line),
        baselineDir,
        // Uma repetição e amostra mínima pequena: o teste prova o encadeamento,
        // não a estatística — que é o que a execução real sobre o corpus faz.
        repetitions: 1,
        minimumSample: 1,
        reviewSampleSize: 2,
      })

      assert.equal(result.status, 'measured')
      assert.equal(result.exitCode, 0)

      const arquivos = (await readdir(baselineDir)).sort()
      assert.equal(arquivos.length, 2)
      assert.ok(arquivos[0]?.endsWith('.json'))
      assert.ok(arquivos[1]?.endsWith('.md'))
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('registra no relatório a versão da extensão que estava no repositório', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'advpl-run-'))
    const corpus = join(repoRoot, 'fontes')
    const baselineDir = join(repoRoot, 'baseline')
    try {
      await mkdir(join(repoRoot, 'packages', 'extension'), { recursive: true })
      await writeFile(
        join(repoRoot, 'packages', 'extension', 'package.json'),
        JSON.stringify({ version: '9.9.9' }),
        'utf8',
      )
      await mkdir(corpus)
      await writeFile(join(corpus, 'a.prw'), '#INCLUDE "T.CH"\r\n', 'latin1')

      const result = await runBaseline({
        repoRoot,
        env: { [CORPUS_ENV_VAR]: corpus },
        out: () => {},
        baselineDir,
        repetitions: 1,
        minimumSample: 1,
        reviewSampleSize: 1,
        refresh: true,
      })

      const { readFile } = await import('node:fs/promises')
      const json = JSON.parse(await readFile(result.jsonPath!, 'utf8')) as {
        environment: { extensionVersion: string }
      }
      assert.equal(json.environment.extensionVersion, '9.9.9')
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('não inventa versão quando não consegue lê-la', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'advpl-run-'))
    const corpus = join(repoRoot, 'fontes')
    const baselineDir = join(repoRoot, 'baseline')
    try {
      await mkdir(join(repoRoot, 'packages', 'extension'), { recursive: true })
      await writeFile(join(repoRoot, 'packages', 'extension', 'package.json'), '{ quebrado', 'utf8')
      await mkdir(corpus)
      await writeFile(join(corpus, 'a.prw'), '#include "t.ch"\r\n', 'latin1')

      const result = await runBaseline({
        repoRoot,
        env: { [CORPUS_ENV_VAR]: corpus },
        out: () => {},
        baselineDir,
        repetitions: 1,
        minimumSample: 1,
      })

      const { readFile } = await import('node:fs/promises')
      const json = JSON.parse(await readFile(result.jsonPath!, 'utf8')) as {
        environment: { extensionVersion: string }
        falsePositives: { hits: number }[]
      }
      assert.equal(json.environment.extensionVersion, 'desconhecida')
      // Fonte já correto: nenhum disparo, e nenhum material de revisão a gerar.
      assert.equal(json.falsePositives[0]?.hits, 0)
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('grava no lugar padrão quando nenhum diretório é indicado', async () => {
    // É onde a linha de base é versionada, e é o caminho que `npm run baseline`
    // exercita de verdade.
    const repoRoot = await mkdtemp(join(tmpdir(), 'advpl-run-'))
    const corpus = join(repoRoot, 'fontes')
    try {
      await mkdir(corpus)
      await writeFile(join(corpus, 'a.prw'), '#INCLUDE "T.CH"\r\n', 'latin1')

      // Sem baselineDir, sem repetitions, sem minimumSample: exatamente como
      // `npm run baseline` chama.
      const result = await runBaseline({
        repoRoot,
        env: { [CORPUS_ENV_VAR]: corpus },
        out: () => {},
      })

      assert.equal(result.status, 'measured')
      assert.ok(result.jsonPath?.includes(join('specs', '001-esqueleto-lsp-harness', 'baseline')))
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('leva ao relatório o veredito da revisão humana, quando existe', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'advpl-run-'))
    const corpus = join(repoRoot, 'fontes')
    const baselineDir = join(repoRoot, 'baseline')
    const linhas: string[] = []
    try {
      await mkdir(corpus)
      await mkdir(join(repoRoot, '.fp-review'), { recursive: true })
      await writeFile(
        join(repoRoot, '.fp-review', 'CA3001.verdict.json'),
        JSON.stringify({ reviewed: 2, falsePositives: 1 }),
        'utf8',
      )
      await writeFile(join(corpus, 'a.prw'), ['#INCLUDE "T.CH"', '#INCLUDE "U.CH"', ''].join('\r\n'), 'latin1')

      const result = await runBaseline({
        repoRoot,
        env: { [CORPUS_ENV_VAR]: corpus },
        out: (line) => linhas.push(line),
        baselineDir,
        repetitions: 1,
        minimumSample: 1,
        reviewSampleSize: 4,
      })

      const { readFile } = await import('node:fs/promises')
      const json = JSON.parse(await readFile(result.jsonPath!, 'utf8')) as {
        falsePositives: { reviewed: number; falsePositives: number; rate: number }[]
      }
      assert.equal(json.falsePositives[0]?.reviewed, 2)
      assert.equal(json.falsePositives[0]?.falsePositives, 1)
      assert.equal(json.falsePositives[0]?.rate, 0.5)
      assert.match(linhas.join('\n'), /Veredito/)
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('descarta veredito apurado sobre outra medição, em vez de publicá-lo', async () => {
    // Corpus mudou, amostra mudou, regra mudou: a taxa antiga fala de material
    // que já não é este. Descartar dizendo por quê é o único caminho que não
    // mente — e derrubar a medição inteira puniria o mantenedor por um arquivo
    // local que ele pode simplesmente refazer.
    const repoRoot = await mkdtemp(join(tmpdir(), 'advpl-run-'))
    const corpus = join(repoRoot, 'fontes')
    const baselineDir = join(repoRoot, 'baseline')
    const linhas: string[] = []
    try {
      await mkdir(corpus)
      await mkdir(join(repoRoot, '.fp-review'), { recursive: true })
      await writeFile(
        join(repoRoot, '.fp-review', 'CA3001.verdict.json'),
        JSON.stringify({ reviewed: 500, falsePositives: 3 }),
        'utf8',
      )
      await writeFile(join(corpus, 'a.prw'), '#INCLUDE "T.CH"\r\n', 'latin1')

      const result = await runBaseline({
        repoRoot,
        env: { [CORPUS_ENV_VAR]: corpus },
        out: (line) => linhas.push(line),
        baselineDir,
        repetitions: 1,
        minimumSample: 1,
        reviewSampleSize: 1,
      })

      assert.equal(result.status, 'measured')
      assert.match(linhas.join('\n'), /descartado/i)

      const { readFile } = await import('node:fs/promises')
      const json = JSON.parse(await readFile(result.jsonPath!, 'utf8')) as {
        falsePositives: { reviewed: number }[]
      }
      assert.equal(json.falsePositives[0]?.reviewed, 0)
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('o relatório gravado não contém nada do corpus (FR-023)', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'advpl-run-'))
    const corpus = join(repoRoot, 'fontes')
    const baselineDir = join(repoRoot, 'baseline')
    try {
      await mkdir(corpus)
      await mkdir(baselineDir)
      await writeFile(
        join(corpus, 'MATA410.prw'),
        ['#INCLUDE "TOTVS.CH"', 'User Function MATA410()', 'Return', ''].join('\r\n'),
        'latin1',
      )

      await runBaseline({
        repoRoot,
        env: { [CORPUS_ENV_VAR]: corpus },
        out: () => {},
        baselineDir,
        repetitions: 1,
        minimumSample: 1,
        reviewSampleSize: 1,
      })

      const { readFile } = await import('node:fs/promises')
      for (const arquivo of await readdir(baselineDir)) {
        const raw = await readFile(join(baselineDir, arquivo), 'utf8')
        assert.ok(!raw.includes('MATA410'), `${arquivo} vazou nome de programa do corpus`)
        assert.ok(!raw.includes('User Function'), `${arquivo} vazou trecho de fonte`)
        assert.ok(!raw.includes(corpus), `${arquivo} vazou caminho do corpus`)
      }
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })
})

describe('Custo da indexação, medido em separado (R8, FR-042)', () => {
  it('conta diretórios, arquivos e tempo, e devolve o que leu', async () => {
    // Uma varredura só, servindo a duas coisas: o número do relatório e o
    // índice que os trabalhadores usam para medir PJ0001. Varrer duas vezes
    // mediria o cache do sistema de arquivos na segunda.
    const raiz = await mkdtemp(join(tmpdir(), 'advpl-idx-'))
    try {
      await mkdir(join(raiz, 'sub'), { recursive: true })
      await writeFile(join(raiz, 'ACADEF.CH'), '// include\r\n', 'latin1')
      await writeFile(join(raiz, 'sub', 'totvs.ch'), '// include\r\n', 'latin1')
      await writeFile(join(raiz, 'programa.prw'), 'Return\r\n', 'latin1')

      const { measurement, entries } = await measureIndexing(raiz)

      assert.equal(measurement.files, 2, 'contou arquivo que não é include')
      assert.equal(measurement.directories, 2)
      assert.ok(Number.isFinite(measurement.scanMs) && measurement.scanMs >= 0)

      // As entradas levam o nome REAL, que é o valor inteiro da varredura.
      assert.deepEqual(
        entries.map((e) => e.realName).sort(),
        ['ACADEF.CH', 'totvs.ch'],
      )
    } finally {
      await rm(raiz, { recursive: true, force: true })
    }
  })

  it('árvore sem include nenhum devolve zero, não falha', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'advpl-idx-'))
    try {
      const { measurement, entries } = await measureIndexing(raiz)

      assert.equal(measurement.files, 0)
      assert.deepEqual(entries, [])
    } finally {
      await rm(raiz, { recursive: true, force: true })
    }
  })

  it('o relatório publica a indexação, e ela NÃO entra no custo por documento', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'advpl-run-'))
    const corpus = join(repoRoot, 'fontes')
    const baselineDir = join(repoRoot, 'baseline')
    try {
      await mkdir(corpus)
      await mkdir(baselineDir)
      await writeFile(join(corpus, 'ACADEF.CH'), '// include\r\n', 'latin1')
      await writeFile(
        join(corpus, 'a.prw'),
        ['#INCLUDE "acadef.ch"', 'Return', ''].join('\r\n'),
        'latin1',
      )

      const result = await runBaseline({
        repoRoot,
        env: { [CORPUS_ENV_VAR]: corpus },
        baselineDir,
        out: () => {},
        repetitions: 1,
        minimumSample: 1,
        reviewSampleSize: 2,
      })

      const { readFile } = await import('node:fs/promises')
      const json = JSON.parse(await readFile(result.jsonPath!, 'utf8')) as {
        schemaVersion: number
        indexing: { files: number; directories: number; scanMs: number } | null
        ruleCost: { ruleId: string }[]
        falsePositives: { ruleId: string; hits: number }[]
      }

      assert.equal(json.schemaVersion, 2)
      assert.equal(json.indexing?.files, 1)
      assert.ok(json.indexing!.scanMs >= 0)

      // As duas regras aparecem, cada uma com o SEU custo.
      assert.deepEqual(json.ruleCost.map((r) => r.ruleId), ['CA3001', 'PJ0001'])
      assert.deepEqual(json.falsePositives.map((f) => f.ruleId), ['CA3001', 'PJ0001'])

      // Com o índice pronto, PJ0001 enxerga a divergência de caixa: o fonte
      // referencia `acadef.ch` e o disco guarda `ACADEF.CH`.
      const pj = json.falsePositives.find((f) => f.ruleId === 'PJ0001')
      assert.equal(pj?.hits, 1, 'PJ0001 não disparou — o índice não chegou aos trabalhadores')
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('leva ao relatório o veredito de PJ0001, quando existe', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'advpl-run-'))
    const corpus = join(repoRoot, 'fontes')
    const baselineDir = join(repoRoot, 'baseline')
    try {
      await mkdir(corpus)
      await mkdir(join(repoRoot, '.fp-review'), { recursive: true })
      await writeFile(
        join(repoRoot, '.fp-review', 'PJ0001.verdict.json'),
        JSON.stringify({ reviewed: 1, falsePositives: 0 }),
        'utf8',
      )
      await writeFile(join(corpus, 'ACADEF.CH'), '// include\r\n', 'latin1')
      await writeFile(join(corpus, 'a.prw'), ['#include "acadef.ch"', ''].join('\r\n'), 'latin1')

      const result = await runBaseline({
        repoRoot,
        env: { [CORPUS_ENV_VAR]: corpus },
        baselineDir,
        out: () => {},
        repetitions: 1,
        minimumSample: 1,
        reviewSampleSize: 2,
      })

      const { readFile } = await import('node:fs/promises')
      const json = JSON.parse(await readFile(result.jsonPath!, 'utf8')) as {
        falsePositives: { ruleId: string; reviewed: number; rate: number }[]
      }
      const pj = json.falsePositives.find((f) => f.ruleId === 'PJ0001')

      assert.equal(pj?.reviewed, 1)
      assert.equal(pj?.rate, 0)
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('descarta veredito de PJ0001 apurado sobre outra medição', async () => {
    // A mesma regra que já vale para CA3001: taxa apurada sobre mais disparos
    // do que esta medição encontrou fala de outro material.
    const repoRoot = await mkdtemp(join(tmpdir(), 'advpl-run-'))
    const corpus = join(repoRoot, 'fontes')
    const baselineDir = join(repoRoot, 'baseline')
    try {
      await mkdir(corpus)
      await mkdir(join(repoRoot, '.fp-review'), { recursive: true })
      await writeFile(
        join(repoRoot, '.fp-review', 'PJ0001.verdict.json'),
        JSON.stringify({ reviewed: 999, falsePositives: 12 }),
        'utf8',
      )
      await writeFile(join(corpus, 'ACADEF.CH'), '// include\r\n', 'latin1')
      await writeFile(join(corpus, 'a.prw'), ['#include "acadef.ch"', ''].join('\r\n'), 'latin1')

      const result = await runBaseline({
        repoRoot,
        env: { [CORPUS_ENV_VAR]: corpus },
        baselineDir,
        out: () => {},
        repetitions: 1,
        minimumSample: 1,
        reviewSampleSize: 2,
      })

      const { readFile } = await import('node:fs/promises')
      const json = JSON.parse(await readFile(result.jsonPath!, 'utf8')) as {
        falsePositives: { ruleId: string; reviewed: number; falsePositives: number }[]
      }
      const pj = json.falsePositives.find((f) => f.ruleId === 'PJ0001')

      assert.equal(pj?.reviewed, 0, 'publicou uma taxa apurada sobre outro material')
      assert.equal(pj?.falsePositives, 0)
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })
})

describe('Custo e disparos por regra — o zero deliberado', () => {
  function medicao(overrides: Record<string, unknown> = {}) {
    return {
      path: '/corpus/x.prw',
      lines: 10,
      bytes: 100,
      withRuleMs: 2,
      withoutRuleMs: 1,
      incrementalMs: 1,
      hits: 1,
      perRuleMs: { CA3001: 0.5 },
      hitsByRule: { CA3001: 3 },
      ...overrides,
    }
  }

  it('devolve o custo medido daquela regra', () => {
    assert.equal(costOf(medicao(), 'CA3001'), 0.5)
  })

  it('devolve ZERO para regra que a medição não traz', () => {
    // Acontece quando a lista de regras do relatório cita uma que o motor ainda
    // não registra. Derrubar a medição inteira por isso puniria quem está
    // justamente preparando a coluna do relatório para a regra que vem.
    assert.equal(costOf(medicao(), 'PJ9999'), 0)
  })

  it('soma os disparos daquela regra em toda a amostra', () => {
    assert.equal(hitsForRule([medicao(), medicao()], 'CA3001'), 6)
  })

  it('conta zero para regra ausente de alguns fontes', () => {
    assert.equal(hitsForRule([medicao(), medicao({ hitsByRule: {} })], 'CA3001'), 3)
    assert.equal(hitsForRule([medicao()], 'PJ9999'), 0)
  })
})
