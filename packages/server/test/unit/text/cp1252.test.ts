import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { decodeCp1252, encodeCp1252, CP1252_UNDEFINED_BYTES } from '../../../src/text/cp1252'

// A faixa 0x80-0x9F é a ÚNICA em que CP1252 difere de ISO-8859-1 (latin1), e é
// exatamente onde vivem travessão, aspas tipográficas, reticências e o símbolo
// de euro — os caracteres que mais aparecem em comentário de fonte Protheus.
//
// O legado lia como latin1. Este bloco é a prova de que não repetimos isso.
const HIGH_RANGE: ReadonlyArray<readonly [number, string]> = [
  [0x80, '€'], // €
  [0x81, ''], // sem definição em CP1252 → ponto de controle C1
  [0x82, '‚'], // ‚
  [0x83, 'ƒ'], // ƒ
  [0x84, '„'], // „
  [0x85, '…'], // …
  [0x86, '†'], // †
  [0x87, '‡'], // ‡
  [0x88, 'ˆ'], // ˆ
  [0x89, '‰'], // ‰
  [0x8a, 'Š'], // Š
  [0x8b, '‹'], // ‹
  [0x8c, 'Œ'], // Œ
  [0x8d, ''], // sem definição
  [0x8e, 'Ž'], // Ž
  [0x8f, ''], // sem definição
  [0x90, ''], // sem definição
  [0x91, '‘'], // '
  [0x92, '’'], // '
  [0x93, '“'], // "
  [0x94, '”'], // "
  [0x95, '•'], // •
  [0x96, '–'], // – travessão curto
  [0x97, '—'], // — travessão longo
  [0x98, '˜'], // ˜
  [0x99, '™'], // ™
  [0x9a, 'š'], // š
  [0x9b, '›'], // ›
  [0x9c, 'œ'], // œ
  [0x9d, ''], // sem definição
  [0x9e, 'ž'], // ž
  [0x9f, 'Ÿ'], // Ÿ
]

describe('CP1252 — decodificação', () => {
  it('decodifica os 256 bytes, um a um, sem lacuna', () => {
    for (let byte = 0; byte <= 0xff; byte += 1) {
      const decoded = decodeCp1252(Buffer.from([byte]))
      assert.equal(decoded.length, 1, `byte 0x${byte.toString(16)} produziu ${decoded.length} caracteres`)
    }
  })

  it('mantém ASCII e a faixa 0xA0-0xFF idênticos a Latin-1', () => {
    for (let byte = 0; byte <= 0x7f; byte += 1) {
      assert.equal(decodeCp1252(Buffer.from([byte])), String.fromCharCode(byte))
    }
    for (let byte = 0xa0; byte <= 0xff; byte += 1) {
      assert.equal(decodeCp1252(Buffer.from([byte])), String.fromCharCode(byte))
    }
  })

  it('mapeia a faixa 0x80-0x9F conforme o padrão, ponto a ponto', () => {
    for (const [byte, expected] of HIGH_RANGE) {
      assert.equal(
        decodeCp1252(Buffer.from([byte])),
        expected,
        `byte 0x${byte.toString(16)} deveria decodificar para U+${expected
          .charCodeAt(0)
          .toString(16)
          .toUpperCase()
          .padStart(4, '0')}`,
      )
    }
  })

  it('mapeia os cinco bytes sem definição para os pontos de controle C1', () => {
    // Comportamento do padrão de codificação da WHATWG, que é o que navegador
    // e VS Code adotam. Decisão registrada, não acidente.
    assert.deepEqual([...CP1252_UNDEFINED_BYTES].sort((a, b) => a - b), [0x81, 0x8d, 0x8f, 0x90, 0x9d])
    for (const byte of CP1252_UNDEFINED_BYTES) {
      assert.equal(decodeCp1252(Buffer.from([byte])), String.fromCharCode(byte))
    }
  })

  it('difere de latin1 em exatamente 27 dos 256 bytes', () => {
    // 32 posições na faixa 0x80-0x9F, menos os 5 sem definição que coincidem
    // com latin1 por mapearem para o próprio ponto de código.
    const divergent: number[] = []
    for (let byte = 0; byte <= 0xff; byte += 1) {
      const buf = Buffer.from([byte])
      if (decodeCp1252(buf) !== buf.toString('latin1')) {
        divergent.push(byte)
      }
    }
    assert.equal(divergent.length, 27)
    assert.ok(divergent.every((b) => b >= 0x80 && b <= 0x9f))
  })
})

describe('CP1252 — codificação', () => {
  it('faz ida e volta exaustiva nos 256 bytes', () => {
    // A prova mais forte que este módulo pode dar: todo byte decodifica para um
    // caractere que recodifica para o MESMO byte. Sem isso, formatar um fonte
    // (Princípio II) poderia corromper caracteres silenciosamente.
    const all = Buffer.from(Array.from({ length: 256 }, (_, i) => i))
    assert.deepEqual(encodeCp1252(decodeCp1252(all)), all)
  })

  it('codifica cada byte isoladamente de volta ao original', () => {
    for (let byte = 0; byte <= 0xff; byte += 1) {
      const original = Buffer.from([byte])
      assert.deepEqual(
        encodeCp1252(decodeCp1252(original)),
        original,
        `byte 0x${byte.toString(16)} não sobreviveu à ida e volta`,
      )
    }
  })

  it('substitui caractere sem representação em CP1252 sem estourar', () => {
    // '中' (中) não existe em CP1252. O compilador Protheus não aceitaria
    // esse caractere de qualquer forma; o importante é não lançar exceção nem
    // deslocar as posições dos caracteres seguintes.
    const encoded = encodeCp1252('a中b')
    assert.equal(encoded.length, 3, 'a substituição precisa ocupar exatamente 1 byte')
    assert.equal(encoded[0], 0x61)
    assert.equal(encoded[2], 0x62)
  })

  it('preserva o comprimento: 1 caractere vira exatamente 1 byte', () => {
    // Propriedade da qual toda a aritmética de coluna depende. Ver
    // contracts/diagnostico.md.
    const text = 'Saída — "aspas" € 100'
    assert.equal(encodeCp1252(text).length, text.length)
  })
})
