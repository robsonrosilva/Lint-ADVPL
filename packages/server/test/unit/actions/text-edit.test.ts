import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { minimalReplacement, textInRange } from '../../../src/actions/text-edit'
import { createAnalyzedDocument, type AnalyzedDocument } from '../../../src/document/analyzed-document'

function doc(text: string): AnalyzedDocument {
  return createAnalyzedDocument({ uri: 'file:///p.prw', languageId: 'advpl', version: 1, text })
}

const LINHA_INTEIRA = (fim: number) => ({
  start: { line: 0, character: 0 },
  end: { line: 0, character: fim },
})

describe('Edição mínima — o menor conjunto possível (FR-005)', () => {
  it('texto idêntico produz ZERO edições', () => {
    // A idempotência do FR-012 cai daqui de graça: nenhuma regra precisa se
    // lembrar de conferir se já está certo.
    assert.deepEqual(minimalReplacement(doc('#include'), LINHA_INTEIRA(8), '#include'), [])
  })

  it('descarta o PREFIXO que já coincide', () => {
    const edits = minimalReplacement(doc('#incLUDE'), LINHA_INTEIRA(8), '#include')

    assert.equal(edits.length, 1)
    assert.equal(edits[0]!.range.start.character, 4)
    assert.equal(edits[0]!.newText, 'lude')
  })

  it('descarta o SUFIXO que já coincide', () => {
    // `#INCLUDe` → o `#` e o `e` final já batem. Reescrevê-los alargaria o
    // intervalo sem nenhum ganho.
    const edits = minimalReplacement(doc('#INCLUDe'), LINHA_INTEIRA(8), '#include')

    assert.equal(edits.length, 1)
    assert.equal(edits[0]!.range.start.character, 1)
    assert.equal(edits[0]!.range.end.character, 7)
    assert.equal(edits[0]!.newText, 'includ')
  })

  it('descarta prefixo E sufixo de uma vez', () => {
    const edits = minimalReplacement(doc('#inCLUde'), LINHA_INTEIRA(8), '#include')

    assert.equal(edits.length, 1)
    assert.equal(edits[0]!.range.start.character, 3)
    assert.equal(edits[0]!.range.end.character, 6)
    assert.equal(edits[0]!.newText, 'clu')
  })

  it('devolve UMA edição, não uma por caractere divergente', () => {
    // `#InClUdE` tem seis caracteres divergentes intercalados. Seis edições
    // minúsculas seriam mais caras de calcular, de transmitir e de desfazer,
    // para economizar dois caracteres reescritos.
    const edits = minimalReplacement(doc('#InClUdE'), LINHA_INTEIRA(8), '#include')

    assert.equal(edits.length, 1)
  })

  it('substituição por texto MAIOR também é mínima', () => {
    const edits = minimalReplacement(doc('#inc'), LINHA_INTEIRA(4), '#include')

    assert.equal(edits.length, 1)
    assert.equal(edits[0]!.range.start.character, 4)
    assert.equal(edits[0]!.range.end.character, 4)
    assert.equal(edits[0]!.newText, 'lude')
  })

  it('substituição por texto MENOR também é mínima', () => {
    const edits = minimalReplacement(doc('#includes'), LINHA_INTEIRA(9), '#include')

    assert.equal(edits.length, 1)
    assert.equal(edits[0]!.newText, '')
    assert.equal(edits[0]!.range.start.character, 8)
    assert.equal(edits[0]!.range.end.character, 9)
  })

  it('substituição por texto vazio apaga só o trecho', () => {
    const edits = minimalReplacement(doc('abcd'), LINHA_INTEIRA(4), '')

    assert.equal(edits.length, 1)
    assert.equal(edits[0]!.newText, '')
    assert.deepEqual(edits[0]!.range, LINHA_INTEIRA(4))
  })

  it('não atravessa a linha: um intervalo de uma linha edita uma linha', () => {
    const documento = doc('#INCLUDE "A.CH"\r\nLocal x := 1\r\n')
    const edits = minimalReplacement(documento, LINHA_INTEIRA(8), '#include')

    assert.equal(edits[0]!.range.start.line, 0)
    assert.equal(edits[0]!.range.end.line, 0)
  })
})

describe('Leitura do trecho (textInRange)', () => {
  it('devolve exatamente o que o intervalo cobre', () => {
    const documento = doc('#INCLUDE "TOTVS.CH"\r\n')

    assert.equal(textInRange(documento, LINHA_INTEIRA(8)), '#INCLUDE')
    assert.equal(
      textInRange(documento, { start: { line: 0, character: 10 }, end: { line: 0, character: 18 } }),
      'TOTVS.CH',
    )
  })

  it('intervalo fora do documento devolve texto vazio, sem lançar', () => {
    const documento = doc('curto\r\n')

    assert.equal(
      textInRange(documento, { start: { line: 40, character: 0 }, end: { line: 40, character: 8 } }),
      '',
    )
  })
})
