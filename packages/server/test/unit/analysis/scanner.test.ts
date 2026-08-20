import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { scanDocument } from '../../../src/analysis/scanner'

/** Quebra de linha. */
const NL = String.fromCharCode(10)

/** Ajuda a apontar um deslocamento pelo trecho de texto que se quer testar. */
function offsetOf(text: string, needle: string, occurrence = 1): number {
  let index = -1
  for (let n = 0; n < occurrence; n += 1) index = text.indexOf(needle, index + 1)
  assert.ok(index >= 0, `trecho não encontrado: ${needle}`)
  return index
}

describe('Varredura — comentário de linha', () => {
  it('marca tudo depois de // até o fim da linha', () => {
    const text = 'Local x := 1 // #INCLUDE citado\nLocal y := 2'
    const scan = scanDocument(text)
    assert.equal(scan.isCode(offsetOf(text, 'Local x')), true)
    assert.equal(scan.isCode(offsetOf(text, '#INCLUDE')), false)
    assert.equal(scan.isCode(offsetOf(text, 'Local y')), true, 'a linha seguinte voltou a ser código')
  })

  it('reconhece && como comentário de linha (herança xBase)', () => {
    const text = 'Local x := 1 && #INCLUDE aqui\nLocal y := 2'
    const scan = scanDocument(text)
    assert.equal(scan.isCode(offsetOf(text, '#INCLUDE')), false)
    assert.equal(scan.isCode(offsetOf(text, 'Local y')), true)
  })

  it('reconhece * no início da linha como comentário (herança xBase)', () => {
    const text = 'Local x := 1\n   * #INCLUDE comentado\nLocal y := 2'
    const scan = scanDocument(text)
    assert.equal(scan.isCode(offsetOf(text, '#INCLUDE')), false)
    assert.equal(scan.isCode(offsetOf(text, 'Local y')), true)
  })

  it('NÃO trata * no meio da linha como comentário — ali é multiplicação', () => {
    const text = 'Local x := 2 * 3\n'
    const scan = scanDocument(text)
    assert.equal(scan.isCode(offsetOf(text, '3')), true)
  })
})

describe('Varredura — comentário de bloco', () => {
  it('marca do /* ao */, atravessando linhas', () => {
    const text = 'Local a := 1\n/*\n  #INCLUDE "TOTVS.CH"\n*/\nLocal b := 2'
    const scan = scanDocument(text)
    assert.equal(scan.isCode(offsetOf(text, 'Local a')), true)
    assert.equal(scan.isCode(offsetOf(text, '#INCLUDE')), false)
    assert.equal(scan.isCode(offsetOf(text, 'Local b')), true)
  })

  it('bloco sem fechamento consome o resto do arquivo', () => {
    const text = 'Local a := 1\n/* esqueci de fechar\n#INCLUDE "TOTVS.CH"\n'
    const scan = scanDocument(text)
    assert.equal(scan.isCode(offsetOf(text, '#INCLUDE')), false)
  })
})

describe('Varredura — literal de texto', () => {
  it('marca conteúdo entre aspas duplas', () => {
    const text = 'Local c := "#INCLUDE dentro de aspas"\nLocal d := 1'
    const scan = scanDocument(text)
    assert.equal(scan.isCode(offsetOf(text, '#INCLUDE')), false)
    assert.equal(scan.isCode(offsetOf(text, 'Local d')), true)
  })

  it('marca conteúdo entre aspas simples', () => {
    const text = "Local c := '#INCLUDE aqui'\nLocal d := 1"
    const scan = scanDocument(text)
    assert.equal(scan.isCode(offsetOf(text, '#INCLUDE')), false)
    assert.equal(scan.isCode(offsetOf(text, 'Local d')), true)
  })

  it('literal não fechado termina no fim da linha, não engole o arquivo', () => {
    // Fonte com aspas desbalanceadas existe. Se o literal engolisse o resto do
    // arquivo, uma aspa perdida desligaria todas as regras dali para baixo — e
    // o usuário veria o painel esvaziar sem entender por quê.
    const text = 'Local c := "esqueci de fechar\n#INCLUDE "TOTVS.CH"\n'
    const scan = scanDocument(text)
    assert.equal(scan.isCode(offsetOf(text, '#INCLUDE')), true)
  })

  it('// dentro de literal não inicia comentário', () => {
    const text = 'Local url := "http://servidor" \nLocal d := 1'
    const scan = scanDocument(text)
    assert.equal(scan.isCode(offsetOf(text, 'Local d')), true)
    assert.equal(scan.isCode(offsetOf(text, 'http')), false, 'o conteúdo do literal não é código')
  })

  it('aspas dentro de comentário não iniciam literal', () => {
    const text = '// aspas " soltas no comentario\nLocal d := 1'
    const scan = scanDocument(text)
    assert.equal(scan.isCode(offsetOf(text, 'Local d')), true)
  })
})

describe('Varredura — limites', () => {
  it('trata texto vazio sem estourar', () => {
    const scan = scanDocument('')
    assert.equal(scan.isCode(0), true)
  })

  it('deslocamento fora do texto é tratado como código', () => {
    const scan = scanDocument('Local x := 1')
    assert.equal(scan.isCode(9999), true)
    assert.equal(scan.isCode(-1), true)
  })
})

describe('Varredura — custo', () => {
  it('cresce linearmente com o tamanho, não quadraticamente', () => {
    // FR-008 e Princípio I. O legado varria TODAS as linhas dentro do laço por
    // linha (validaAdvpl.ts:459) — O(n²). Num fonte de 24.636 linhas isso é a
    // diferença entre milissegundos e o editor travar.
    //
    // Oito vezes a entrada em desenho linear custa ~8x; em desenho quadrático,
    // ~64x. O limite de 20x deixa folga larga para variação de agendamento e
    // ainda reprova o quadrático sem ambiguidade.
    //
    // ⚠️ ESTE TESTE JÁ FOI INSTÁVEL, e a correção está no MÉTODO, não no limite.
    //
    // A primeira versão media 500 unidades contra 4.000 e protegia o lado
    // pequeno com um piso de 0,05 ms. Numa máquina rápida o lado pequeno CAÍA no
    // piso — ele não era medição, era o piso — enquanto o lado grande absorvia a
    // contenção da suíte. A razão passava a comparar um número real com uma
    // constante, e em 2026-08-20, com a suíte crescendo de 355 para 613 testes
    // em processos paralelos, ela acusou 32x sobre um código que não mudou.
    //
    // É a mesma armadilha registrada em memoria/armadilhas-do-ambiente.md:
    // teto absoluto — e piso absoluto — medem a MÁQUINA, não o desenho.
    //
    // Duas correções, e as duas importam:
    //
    //   1. os DOIS lados são grandes o bastante para ficar bem acima do ruído do
    //      relógio, e nenhum precisa de piso;
    //   2. cada lado é a MEDIANA de cinco passagens, para que uma pausa de
    //      coleta de lixo não vire "regressão de desempenho" — a mesma decisão
    //      que o harness de medição já tinha tomado.
    const unit =
      'Local x := 1 // comentario com "aspas" e /* bloco */' +
      NL +
      'Local y := "texto"' +
      NL
    const small = unit.repeat(4_000)
    const large = unit.repeat(32_000)

    const medianTimeOf = (text: string): number => {
      const samples: number[] = []
      for (let round = 0; round < 5; round += 1) {
        const started = performance.now()
        scanDocument(text)
        samples.push(performance.now() - started)
      }
      samples.sort((a, b) => a - b)
      return samples[2]!
    }

    // Aquece os dois, para não medir a primeira compilação do JIT em nenhum lado.
    scanDocument(small)
    scanDocument(large)

    const tSmall = medianTimeOf(small)
    const tLarge = medianTimeOf(large)

    assert.ok(
      tSmall > 0.2,
      `o lado pequeno levou ${tSmall.toFixed(3)} ms — perto demais do ruído do relógio ` +
        'para servir de referência; aumente o tamanho em vez de pôr um piso',
    )
    assert.ok(
      tLarge / tSmall < 20,
      `8x a entrada custou ${(tLarge / tSmall).toFixed(1)}x o tempo ` +
        `(${tSmall.toFixed(2)} ms contra ${tLarge.toFixed(2)} ms) — cheira a passagem quadrática`,
    )
  })
})
