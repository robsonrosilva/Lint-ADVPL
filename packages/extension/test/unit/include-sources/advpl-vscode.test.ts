import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  ADVPL_INCLUDE_SEPARATOR,
  extractAdvplIncludeList,
} from '../../../src/include-sources/advpl-vscode'

/** Um ambiente como a extensão `killerall.advpl-vscode` v0.18.1 o grava. */
function ambiente(name: string, includeList: unknown): Record<string, unknown> {
  return { name, server: '127.0.0.1', port: 1234, environment: 'P12', includeList }
}

describe('Fonte 2 — o ambiente selecionado do advpl-vscode (FR-027)', () => {
  it('lê o includeList do ambiente apontado por advpl.selectedEnvironment', async () => {
    const environments = [
      ambiente('homologacao', 'C:/homolog/includes'),
      ambiente('producao', 'C:/prod/includes;C:/prod/includes2'),
    ]

    assert.deepEqual(extractAdvplIncludeList(environments, 'producao'), [
      'C:/prod/includes',
      'C:/prod/includes2',
    ])
  })

  it('o separador é o ponto e vírgula, como o formato de terceiro declara', () => {
    // Verificado no manifesto da v0.18.1 em 2026-08-19: `includeList` é UM
    // TEXTO — "separate each directory with ;" —, não uma lista. Tratá-lo como
    // lista devolveria o texto inteiro como se fosse um único diretório, que
    // não existe, e a fonte recuaria sempre.
    assert.equal(ADVPL_INCLUDE_SEPARATOR, ';')
  })

  it('descarta entradas vazias e espaço em volta', async () => {
    const environments = [ambiente('p', ' C:/a ;; C:/b ;   ')]

    assert.deepEqual(extractAdvplIncludeList(environments, 'p'), ['C:/a', 'C:/b'])
  })

  it('ambiente inexistente devolve vazio', async () => {
    // Não é erro: o usuário pode ter apagado o ambiente e esquecido a chave.
    const environments = [ambiente('homologacao', 'C:/homolog/includes')]

    assert.deepEqual(extractAdvplIncludeList(environments, 'producao'), [])
  })

  it('nenhum ambiente selecionado devolve vazio', async () => {
    const environments = [ambiente('homologacao', 'C:/homolog/includes')]

    assert.deepEqual(extractAdvplIncludeList(environments, ''), [])
    assert.deepEqual(extractAdvplIncludeList(environments, undefined), [])
  })

  it('lista de ambientes vazia devolve vazio', async () => {
    // ⚠️ Este é o estado REAL da máquina de referência, medido em 2026-08-19:
    // `advpl.environments` vale `[]`. Uma cadeia que parasse na presença da
    // chave deixaria PJ0001 muda exatamente onde ela foi medida (FR-027a).
    assert.deepEqual(extractAdvplIncludeList([], 'producao'), [])
  })

  it('includeList vazio ou ausente devolve vazio', async () => {
    assert.deepEqual(extractAdvplIncludeList([ambiente('p', '')], 'p'), [])
    assert.deepEqual(extractAdvplIncludeList([ambiente('p', undefined)], 'p'), [])
  })

  it('forma inesperada devolve vazio, sem lançar (FR-027d)', async () => {
    // Formato de terceiro pode mudar sem aviso. Recuar é o comportamento
    // correto; quebrar não é.
    const casos: [unknown, unknown][] = [
      ['não é lista', 'p'],
      [null, 'p'],
      [undefined, 'p'],
      [[null, 42, 'texto'], 'p'],
      [[{ semNome: true, includeList: 'C:/x' }], 'p'],
      [[ambiente('p', 42)], 'p'],
      [[ambiente('p', ['C:/a'])], 'p'],
    ]

    for (const [environments, selected] of casos) {
      assert.deepEqual(
        extractAdvplIncludeList(environments, selected),
        [],
        `com environments=${JSON.stringify(environments)}`,
      )
    }
  })

  it('o primeiro ambiente de mesmo nome vence, sem juntar os dois', async () => {
    // Nome duplicado é configuração malformada do usuário. Juntar as listas
    // inventaria uma árvore que ele não pediu.
    const environments = [ambiente('p', 'C:/primeiro'), ambiente('p', 'C:/segundo')]

    assert.deepEqual(extractAdvplIncludeList(environments, 'p'), ['C:/primeiro'])
  })
})
