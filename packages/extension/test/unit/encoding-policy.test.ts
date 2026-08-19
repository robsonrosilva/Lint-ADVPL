import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  isAcceptableEncoding,
  shouldWarnAboutEncoding,
  REQUIRED_ENCODING,
} from '../../src/encoding-policy'

describe('Política de codificação — o que é aceitável', () => {
  it('aceita windows1252, que é o único code page que o Protheus compila', () => {
    assert.equal(REQUIRED_ENCODING, 'windows1252')
    assert.equal(isAcceptableEncoding('windows1252'), true)
  })

  it('aceita variações de caixa e separador do mesmo nome', () => {
    // `Windows-1252` e `windows1252` são a mesma coisa; tratá-las como
    // diferentes produziria um aviso falso a cada arquivo aberto.
    for (const variant of ['Windows-1252', 'WINDOWS_1252', 'windows-1252']) {
      assert.equal(isAcceptableEncoding(variant), true, `${variant} deveria ser aceito`)
    }
  })

  it('recusa utf8 — é onde o diagnóstico começa a sair na coluna errada', () => {
    assert.equal(isAcceptableEncoding('utf8'), false)
    assert.equal(isAcceptableEncoding('utf8bom'), false)
  })

  it('recusa iso88591, que NÃO é equivalente a CP1252', () => {
    // Divergem em 0x80-0x9F — travessão, aspas tipográficas e euro. Era o
    // defeito do legado.
    assert.equal(isAcceptableEncoding('iso88591'), false)
  })

  it('trata codificação ausente como inaceitável', () => {
    assert.equal(isAcceptableEncoding(undefined), false)
    assert.equal(isAcceptableEncoding(''), false)
  })
})

describe('Política de codificação — quando avisar', () => {
  it('avisa quando a codificação está errada e ainda não avisamos', () => {
    assert.equal(shouldWarnAboutEncoding({ warned: false }, 'utf8'), true)
  })

  it('NÃO avisa de novo na mesma sessão', () => {
    // Um aviso por arquivo viraria ruído em minutos, e o usuário aprenderia a
    // fechar sem ler.
    assert.equal(shouldWarnAboutEncoding({ warned: true }, 'utf8'), false)
  })

  it('não avisa quando a codificação está correta', () => {
    assert.equal(shouldWarnAboutEncoding({ warned: false }, 'windows1252'), false)
  })
})
