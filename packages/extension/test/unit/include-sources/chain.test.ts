import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  directoryExists,
  describeResolution,
  resolveIncludeSources,
  type IncludeSource,
} from '../../../src/include-sources/chain'
import { normalizeIncludePaths } from '../../../src/include-sources/own-setting'
import { workspaceIncludeDirectories } from '../../../src/include-sources/workspace-scan'

/** Uma fonte de mentira, com o nome e o que ela devolve. */
function fonte(order: 1 | 2 | 3 | 4, name: string, paths: readonly string[]): IncludeSource {
  return { order, name, resolve: async () => paths }
}

/** Sonda de existência de mentira: só os caminhos declarados existem. */
function existem(...caminhos: readonly string[]): (path: string) => Promise<boolean> {
  const conjunto = new Set(caminhos)
  return async (path) => conjunto.has(path)
}

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'advpl-lint-chain-'))
}

describe('A cadeia para na primeira fonte UTILIZÁVEL (FR-027a)', () => {
  it('para na fonte 1 quando ela produz diretório existente', async () => {
    const resultado = await resolveIncludeSources(
      [fonte(1, 'tds-vscode', ['/tds']), fonte(2, 'advpl-vscode', ['/advpl'])],
      existem('/tds', '/advpl'),
    )

    assert.equal(resultado.winner, 'tds-vscode')
    assert.deepEqual(resultado.directories, ['/tds'])
  })

  it('fonte PRESENTE e VAZIA faz RECUAR — presença não é utilidade', async () => {
    // A distinção que dá nome ao requisito. Uma cadeia que parasse na presença
    // da chave deixaria a regra muda para sempre na máquina de referência.
    const resultado = await resolveIncludeSources(
      [fonte(1, 'tds-vscode', []), fonte(2, 'advpl-vscode', ['/advpl'])],
      existem('/advpl'),
    )

    assert.equal(resultado.winner, 'advpl-vscode')
  })

  it('entrada vazia ou só espaço é descartada ANTES de contar', async () => {
    // `includes: [""]` é o valor real da fonte 1 na máquina de referência,
    // medido em 2026-08-19. Contá-lo como um diretório faria a cadeia parar na
    // fonte 1 e nunca chegar a nenhuma árvore.
    const resultado = await resolveIncludeSources(
      [fonte(1, 'tds-vscode', ['', '   ']), fonte(3, 'chave própria', ['/meu'])],
      existem('/meu'),
    )

    assert.equal(resultado.winner, 'chave própria')
    assert.deepEqual(resultado.directories, ['/meu'])
  })

  it('diretório INEXISTENTE é descartado antes de contar', async () => {
    // Um caminho apontando para uma unidade de rede fora do ar não é uma fonte
    // utilizável — é uma fonte que parece configurada e não serve. Parar nela
    // deixaria a regra muda sem que nada explicasse por quê.
    const resultado = await resolveIncludeSources(
      [fonte(1, 'tds-vscode', ['/Z/sumiu']), fonte(4, 'workspace', ['/ws'])],
      existem('/ws'),
    )

    assert.equal(resultado.winner, 'workspace')
  })

  it('a fonte utilizável leva SÓ os diretórios que existem', async () => {
    const resultado = await resolveIncludeSources(
      [fonte(1, 'tds-vscode', ['/existe', '/nao-existe', '/existe2'])],
      existem('/existe', '/existe2'),
    )

    assert.deepEqual(resultado.directories, ['/existe', '/existe2'])
  })

  it('diretório repetido entra uma vez só', async () => {
    // Repetido custaria uma varredura a mais e produziria "ambíguo" para todo
    // arquivo daquela árvore — a regra calaria justamente onde deveria falar.
    const resultado = await resolveIncludeSources(
      [fonte(1, 'tds-vscode', ['/a', '/a', '/b'])],
      existem('/a', '/b'),
    )

    assert.deepEqual(resultado.directories, ['/a', '/b'])
  })

  it('nenhuma fonte utilizável devolve vencedor nulo e lista vazia', async () => {
    const resultado = await resolveIncludeSources(
      [fonte(1, 'tds-vscode', []), fonte(2, 'advpl-vscode', []), fonte(4, 'workspace', [])],
      existem(),
    )

    assert.equal(resultado.winner, null)
    assert.deepEqual(resultado.directories, [])
  })

  it('a ordem declarada é respeitada, não a ordem do vetor', async () => {
    // A precedência é do requisito, não de quem montou a lista.
    const resultado = await resolveIncludeSources(
      [fonte(4, 'workspace', ['/ws']), fonte(1, 'tds-vscode', ['/tds'])],
      existem('/ws', '/tds'),
    )

    assert.equal(resultado.winner, 'tds-vscode')
  })

  it('fonte que LANÇA é tratada como vazia e a cadeia recua (FR-027d)', async () => {
    // Formato de terceiro pode mudar sem aviso. Uma exceção vinda de lá não
    // pode derrubar a resolução inteira.
    const quebrada: IncludeSource = {
      order: 1,
      name: 'tds-vscode',
      resolve: () => Promise.reject(new Error('formato mudou')),
    }

    const resultado = await resolveIncludeSources([quebrada, fonte(3, 'chave própria', ['/meu'])], existem('/meu'))

    assert.equal(resultado.winner, 'chave própria')
  })

  it('sonda de existência que lança não derruba a cadeia', async () => {
    const resultado = await resolveIncludeSources([fonte(1, 'tds-vscode', ['/x']), fonte(4, 'workspace', ['/ws'])], async (p) => {
      if (p === '/x') throw new Error('unidade fora do ar')
      return true
    })

    assert.equal(resultado.winner, 'workspace')
  })
})

describe('O caso medido na máquina de referência (FR-027a, SC-014)', () => {
  it('fonte 1 valendo [""] e fonte 2 valendo [] recuam até a chave própria', async () => {
    // Medido em 2026-08-19: é exatamente o estado desta máquina. Este teste
    // existe para que a cadeia continue funcionando ONDE ELA FOI MEDIDA.
    const dirProprio = await tempDir()

    const resultado = await resolveIncludeSources(
      [
        fonte(1, 'tds-vscode', ['']),
        fonte(2, 'advpl-vscode', []),
        fonte(3, 'advplLint.includePaths', [dirProprio]),
        fonte(4, 'workspace', ['/ws']),
      ],
      directoryExists,
    )

    assert.equal(resultado.winner, 'advplLint.includePaths')
    assert.deepEqual(resultado.directories, [dirProprio])
  })

  it('sem a chave própria, o mesmo estado cai no workspace', async () => {
    const dirWorkspace = await tempDir()

    const resultado = await resolveIncludeSources(
      [
        fonte(1, 'tds-vscode', ['']),
        fonte(2, 'advpl-vscode', []),
        fonte(3, 'advplLint.includePaths', []),
        fonte(4, 'workspace', [dirWorkspace]),
      ],
      directoryExists,
    )

    assert.equal(resultado.winner, 'workspace')
  })
})

describe('A sonda de existência olha DIRETÓRIO, não arquivo', () => {
  it('diretório de verdade responde sim', async () => {
    const dir = await tempDir()
    const filho = join(dir, 'includes')
    await mkdir(filho)

    assert.equal(await directoryExists(filho), true)
  })

  it('caminho inexistente responde não, sem lançar', async () => {
    assert.equal(await directoryExists(join(tmpdir(), 'advpl-lint-jamais-existiu')), false)
  })

  it('ARQUIVO não é diretório utilizável', async () => {
    // Apontar um arquivo é erro de configuração comum, e a varredura do índice
    // faria `opendir` nele e falharia. Melhor recusar aqui, em silêncio.
    const { writeFile } = await import('node:fs/promises')
    const dir = await tempDir()
    const arquivo = join(dir, 'nao-e-diretorio.txt')
    await writeFile(arquivo, 'x')

    assert.equal(await directoryExists(arquivo), false)
  })
})

describe('Fonte 3 — a chave própria (FR-027e)', () => {
  it('aceita mais de um diretório', async () => {
    assert.deepEqual(normalizeIncludePaths(['C:/a', 'C:/b']), ['C:/a', 'C:/b'])
  })

  it('descarta entrada vazia, espaço em volta e o que não é texto', async () => {
    assert.deepEqual(normalizeIncludePaths(['  C:/a  ', '', '   ', 42, null, 'C:/b']), ['C:/a', 'C:/b'])
  })

  it('valor que não é lista devolve vazio, sem lançar', async () => {
    for (const caso of ['C:/a', null, undefined, 42, { paths: [] }]) {
      assert.deepEqual(normalizeIncludePaths(caso), [], `com ${JSON.stringify(caso)}`)
    }
  })
})

describe('Fonte 4 — as pastas do workspace, último recurso', () => {
  it('usa as pastas abertas como estão', async () => {
    assert.deepEqual(workspaceIncludeDirectories(['C:/proj', 'C:/lib']), ['C:/proj', 'C:/lib'])
  })

  it('descarta repetidas e vazias', async () => {
    assert.deepEqual(workspaceIncludeDirectories(['C:/proj', 'C:/proj', '', '  ']), ['C:/proj'])
  })

  it('sem pasta aberta devolve vazio', async () => {
    assert.deepEqual(workspaceIncludeDirectories([]), [])
  })
})

describe('O relato ao usuário (FR-027c, SC-015)', () => {
  /** Tradutor de mentira: devolve a chave e os argumentos, para o teste ver os dois. */
  const t = (key: string, args?: Record<string, string | number>): string =>
    args ? `${key}|${JSON.stringify(args)}` : key

  it('diz QUAL fonte venceu e QUAIS diretórios ela produziu', async () => {
    // Sem isso, "a regra não dispara" e "a regra dispara sobre a árvore errada"
    // são indistinguíveis para quem usa — e é a única defesa prática contra o
    // formato de terceiro mudar sem aviso.
    const relato = describeResolution({ winner: 'tds-vscode', directories: ['/tds/a', '/tds/b'] }, t)

    assert.match(relato, /includeSources\.inUse/)
    assert.match(relato, /tds-vscode/)
    assert.match(relato, /\/tds\/a/)
    assert.match(relato, /\/tds\/b/)
  })

  it('o texto passa pelo NLS: nenhuma frase é montada no código (Princípio V)', async () => {
    // O que o código monta é o DADO — nome da fonte e lista de diretórios. A
    // frase em volta vem do pacote de tradução, nos quatro idiomas.
    const relato = describeResolution({ winner: 'x', directories: ['/a'] }, () => 'FRASE TRADUZIDA')

    assert.equal(relato, 'FRASE TRADUZIDA')
  })

  it('sem fonte utilizável, o relato diz isso — e não fica em branco', async () => {
    const relato = describeResolution({ winner: null, directories: [] }, t)

    assert.match(relato, /includeSources\.none/)
    assert.doesNotMatch(relato, /undefined|null/)
  })
})
