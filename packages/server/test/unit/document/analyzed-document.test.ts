import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  createAnalyzedDocument,
  offsetAt,
  positionAt,
  rangeAt,
} from '../../../src/document/analyzed-document'

function doc(text: string) {
  return createAnalyzedDocument({ uri: 'file:///p.prw', languageId: 'advpl', version: 1, text })
}

describe('Deslocamento a partir da posição (offsetAt)', () => {
  it('leva a posição do protocolo de volta ao índice do texto', () => {
    // O caminho de ida já existia; a volta chegou com as correções, que
    // precisam LER o texto dentro do intervalo de um diagnóstico.
    const documento = doc('#INCLUDE "A.CH"\r\nLocal x := 1\r\n')

    assert.equal(offsetAt(documento, { line: 0, character: 0 }), 0)
    assert.equal(offsetAt(documento, { line: 0, character: 8 }), 8)
    assert.equal(offsetAt(documento, { line: 1, character: 0 }), 17)
    assert.equal(offsetAt(documento, { line: 1, character: 5 }), 22)
  })

  it('é o inverso exato de positionAt em todo deslocamento válido', () => {
    // A propriedade que importa: os dois caminhos concordam. Um erro de um
    // caractere aqui desloca a coluna de toda correção.
    const texto = 'Local a := 1\nLocal b := 2\r\nLocal c := 3'
    const documento = doc(texto)

    for (let offset = 0; offset <= texto.length; offset += 1) {
      assert.equal(offsetAt(documento, positionAt(documento, offset)), offset, `no deslocamento ${offset}`)
    }
  })

  it('grampeia posição fora da faixa em vez de lançar', () => {
    // A posição pode vir do editor, sobre um texto que já mudou. Uma edição
    // recusada é resposta melhor que uma exceção no meio do cálculo da lâmpada.
    const documento = doc('abc\r\ndef\r\n')

    assert.equal(offsetAt(documento, { line: -1, character: 0 }), 0)
    assert.equal(offsetAt(documento, { line: 99, character: 0 }), documento.text.length)
    assert.equal(offsetAt(documento, { line: 0, character: -5 }), 0)
  })

  it('não atravessa a quebra de linha quando a coluna passa do fim', () => {
    // Sem o grampo por linha, uma coluna grande demais escorregaria para a
    // linha seguinte e a correção comeria a quebra — que é justamente o que o
    // FR-007 proíbe.
    const documento = doc('ab\r\ncdef\r\n')

    assert.equal(offsetAt(documento, { line: 0, character: 999 }), 4)
    assert.equal(offsetAt(documento, { line: 1, character: 999 }), 10)
  })
})

describe('Intervalo a partir de deslocamentos (rangeAt)', () => {
  it('cobre exatamente o trecho pedido', () => {
    const documento = doc('#INCLUDE "A.CH"\r\n')

    assert.deepEqual(rangeAt(documento, 0, 8), {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 8 },
    })
  })
})
