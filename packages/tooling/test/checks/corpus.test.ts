import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  AUTHORSHIP_MARKER,
  MAX_FIXTURE_LINES,
  SOURCE_EXTENSIONS,
  findCorpusProblems,
  isFixturePath,
  listVersionedFiles,
} from '../../src/checks/corpus'

// __dirname aponta para packages/tooling/out/test/checks — cinco níveis até a raiz.
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..')

const CABECALHO = [
  `// ${AUTHORSHIP_MARKER} - advpl-lint - NAO e copia de fonte padrao do Protheus.`,
  '// Proposito: exercitar alguma coisa',
].join('\n')

/** Leitor de mentira: devolve o que o teste combinou para cada caminho. */
function reader(conteudo: Record<string, string>) {
  return async (file: string): Promise<string> => {
    const texto = conteudo[file]
    if (texto === undefined) throw new Error(`arquivo não combinado no teste: ${file}`)
    return texto
  }
}

describe('Vazamento de corpus — o repositório de verdade (FR-027)', () => {
  it('nenhum fonte do corpus está versionado', async () => {
    // A mitigação existe porque fonte padrão do Protheus dentro do repositório
    // é problema de licença e de exposição — e o jeito como isso acontece na
    // prática é sem ninguém decidir que aconteceria.
    const files = await listVersionedFiles(REPO_ROOT)
    const problems = await findCorpusProblems({
      files,
      readText: (file) => readFile(join(REPO_ROOT, file), 'latin1'),
    })

    assert.deepEqual(problems, [], `vazamento de corpus:\n${problems.join('\n')}`)
  })

  it('enxerga os arquivos versionados de verdade', async () => {
    const files = await listVersionedFiles(REPO_ROOT)

    assert.ok(files.length > 50, `só ${files.length} arquivos — a listagem falhou?`)
    assert.ok(files.includes('package.json'))
    // Nada de `node_modules` nem de saída de compilação: são ignorados, e
    // portanto não são versionados.
    assert.ok(!files.some((f) => f.includes('node_modules')))
  })
})

describe('Vazamento de corpus — onde o fonte pode estar', () => {
  it('reconhece o único lugar permitido', () => {
    assert.equal(isFixturePath('packages/server/test/fixtures/a.prw'), true)
    assert.equal(isFixturePath('packages/extension/test/fixtures/workspace/a.prw'), true)
  })

  it('recusa fonte em qualquer outro lugar', () => {
    assert.equal(isFixturePath('src/a.prw'), false)
    assert.equal(isFixturePath('packages/server/src/a.prw'), false)
    assert.equal(isFixturePath('fixtures/a.prw'), false)
    assert.equal(isFixturePath('packages/server/test/a.prw'), false)
  })

  it('acusa fonte ADVPL versionado fora das fixtures', async () => {
    const problems = await findCorpusProblems({
      files: ['docs/MATA410.prw'],
      readText: reader({ 'docs/MATA410.prw': CABECALHO }),
    })

    assert.ok(problems.some((p) => p.includes('MATA410.prw') && /fora de/i.test(p)))
  })

  it('vale para todas as extensões de fonte, incluindo include', async () => {
    for (const ext of SOURCE_EXTENSIONS) {
      const file = `docs/vazou${ext}`
      const problems = await findCorpusProblems({ files: [file], readText: reader({ [file]: '' }) })

      assert.ok(problems.length > 0, `${ext} passou batido`)
    }
  })

  it('não confunde extensão parecida', async () => {
    const problems = await findCorpusProblems({
      files: ['docs/leia.md', 'src/app.ts', 'notas.prwx'],
      readText: reader({}),
    })

    assert.deepEqual(problems, [])
  })

  it('reconhece a extensão em caixa alta', async () => {
    // Boa parte do corpus real usa `.PRW` e `.PRX` maiúsculos. Uma verificação
    // sensível à caixa deixaria passar justamente o material mais comum.
    const problems = await findCorpusProblems({
      files: ['docs/MATA410.PRW'],
      readText: reader({ 'docs/MATA410.PRW': '' }),
    })

    assert.ok(problems.length > 0)
  })
})

describe('Vazamento de corpus — o cabeçalho de autoria', () => {
  it('acusa fixture sem a declaração de autoria', async () => {
    // Nenhuma verificação automática julga se a fixture foi ESCRITA ou COPIADA.
    // O cabeçalho não prova autoria — ele força a declaração no momento em que
    // a cópia seria feita, que é quando a decisão é tomada.
    const file = 'packages/server/test/fixtures/sem-cabecalho.prw'
    const problems = await findCorpusProblems({
      files: [file],
      readText: reader({ [file]: '#INCLUDE "TOTVS.CH"\n' }),
    })

    assert.ok(problems.some((p) => p.includes('sem-cabecalho.prw') && /autoria|autoral/i.test(p)))
  })

  it('acusa fixture sem a declaração do que ela exercita', async () => {
    const file = 'packages/server/test/fixtures/sem-proposito.prw'
    const problems = await findCorpusProblems({
      files: [file],
      readText: reader({ [file]: `// ${AUTHORSHIP_MARKER}\n#INCLUDE "T.CH"\n` }),
    })

    assert.ok(problems.some((p) => p.includes('sem-proposito.prw') && /prop[oó]sito/i.test(p)))
  })

  it('aceita fixture com o cabeçalho completo', async () => {
    const file = 'packages/server/test/fixtures/ok.prw'
    const problems = await findCorpusProblems({
      files: [file],
      readText: reader({ [file]: `${CABECALHO}\n#INCLUDE "T.CH"\n` }),
    })

    assert.deepEqual(problems, [])
  })

  it('exige o cabeçalho nas primeiras linhas, não perdido no meio', async () => {
    // Enterrado na linha 400, o cabeçalho deixa de ser declaração e vira
    // decoração — ninguém o lê no momento de copiar.
    const file = 'packages/server/test/fixtures/tarde-demais.prw'
    const corpo = Array.from({ length: 20 }, () => 'Return').join('\n')
    const problems = await findCorpusProblems({
      files: [file],
      readText: reader({ [file]: `${corpo}\n${CABECALHO}\n` }),
    })

    assert.ok(problems.some((p) => p.includes('tarde-demais.prw')))
  })
})

describe('Vazamento de corpus — o limite de tamanho', () => {
  it('o limite é 300 linhas', () => {
    // A mediana do corpus é 309 linhas: fixture autoral que passe de 300 quase
    // certamente foi colada.
    assert.equal(MAX_FIXTURE_LINES, 300)
  })

  it('acusa fixture acima do limite', async () => {
    const file = 'packages/server/test/fixtures/gigante.prw'
    const corpo = Array.from({ length: MAX_FIXTURE_LINES + 1 }, () => 'Return').join('\n')
    const problems = await findCorpusProblems({
      files: [file],
      readText: reader({ [file]: `${CABECALHO}\n${corpo}` }),
    })

    assert.ok(problems.some((p) => p.includes('gigante.prw') && /linhas/i.test(p)))
  })

  it('aceita fixture exatamente no limite', async () => {
    const file = 'packages/server/test/fixtures/no-limite.prw'
    const corpo = Array.from({ length: MAX_FIXTURE_LINES - 2 }, () => 'Return').join('\n')
    const problems = await findCorpusProblems({
      files: [file],
      readText: reader({ [file]: `${CABECALHO}\n${corpo}` }),
    })

    assert.deepEqual(problems, [])
  })

  it('fonte grande de propósito é GERADO, nunca versionado', async () => {
    // O teste do arquivo de 24 mil linhas usa geração em tempo de teste. Se ele
    // fosse versionado, cairia aqui — e é essa a intenção.
    const files = await listVersionedFiles(REPO_ROOT)

    assert.ok(!files.some((f) => f.includes('fixtures/generated')))
  })
})
