import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DiagnosticSeverity, type Diagnostic, type TextEdit } from 'vscode-languageserver-types'

import { ca3001Fix } from '../../../src/actions/ca3001-fix'
import { createAnalyzedDocument, type AnalyzedDocument } from '../../../src/document/analyzed-document'
import { decodeCp1252, encodeCp1252 } from '../../../src/text/cp1252'

const FIXTURES = join(__dirname, '..', '..', '..', '..', 'test', 'fixtures')

function doc(text: string, version = 1): AnalyzedDocument {
  return createAnalyzedDocument({ uri: 'file:///fonte.prw', languageId: 'advpl', version, text })
}

/** O diagnóstico que `CA3001` emite: do `#` ao fim da palavra da diretiva. */
function ca3001At(line: number, start: number, end: number): Diagnostic {
  return {
    code: 'CA3001',
    severity: DiagnosticSeverity.Information,
    range: { start: { line, character: start }, end: { line, character: end } },
    message: 'a diretiva deve estar em caixa baixa',
    source: 'advpl-lint',
  }
}

/** Aplica as edições ao texto, da última para a primeira, como o editor faz. */
function applyEdits(document: AnalyzedDocument, edits: readonly TextEdit[]): string {
  const lines = document.text.split(/(?<=\n)/)
  const ordered = [...edits].sort(
    (a, b) => b.range.start.line - a.range.start.line || b.range.start.character - a.range.start.character,
  )

  for (const edit of ordered) {
    assert.equal(edit.range.start.line, edit.range.end.line, 'edição atravessando linha')
    const line = lines[edit.range.start.line]!
    lines[edit.range.start.line] =
      line.slice(0, edit.range.start.character) + edit.newText + line.slice(edit.range.end.character)
  }
  return lines.join('')
}

describe('Correção de CA3001 — o que ela toca', () => {
  it('a edição cobre SÓ os caracteres que mudam de caixa (FR-005)', () => {
    // "Menor conjunto possível" não é "a linha", nem "o token": é o trecho que
    // realmente difere. Em `#INCLUDE` o `#` já está certo e nunca entra na
    // edição — substituir o token inteiro reescreveria um caractere idêntico e
    // alargaria o intervalo à toa.
    const documento = doc('#INCLUDE "TOTVS.CH"\r\n')
    const edits = ca3001Fix.computeEdits(documento, ca3001At(0, 0, 8))

    assert.equal(edits.length, 1, 'a correção deveria ser UMA edição')
    assert.deepEqual(edits[0]!.range, {
      start: { line: 0, character: 1 },
      end: { line: 0, character: 8 },
    })
    assert.equal(edits[0]!.newText, 'include')
  })

  it('o texto resultante é a diretiva em caixa baixa, e nada mais mudou (SC-002)', () => {
    const documento = doc('// topo\r\n#INCLUDE "TOTVS.CH"\r\nLocal x := 1\r\n')
    const depois = applyEdits(documento, ca3001Fix.computeEdits(documento, ca3001At(1, 0, 8)))

    assert.equal(depois, '// topo\r\n#include "TOTVS.CH"\r\nLocal x := 1\r\n')
  })

  it('o nome do arquivo continua byte a byte, INCLUSIVE a caixa (FR-011)', () => {
    // A assimetria é medida, não estética: baixar a caixa da diretiva é inerte
    // — 71,9% do corpus usa caixa alta e compila. Baixar a caixa do NOME
    // quebraria 706 referências que hoje resolvem no AppServer Linux.
    const documento = doc('#INCLUDE "ACADEF.CH"\r\n')
    const depois = applyEdits(documento, ca3001Fix.computeEdits(documento, ca3001At(0, 0, 8)))

    assert.match(depois, /"ACADEF\.CH"/)
    assert.equal(depois, '#include "ACADEF.CH"\r\n')
  })

  it('não toca nas aspas nem no espaçamento da linha', () => {
    const documento = doc('\t  #INCLUDE   "TOTVS.CH"   \r\n')
    const depois = applyEdits(documento, ca3001Fix.computeEdits(documento, ca3001At(0, 3, 11)))

    assert.equal(depois, '\t  #include   "TOTVS.CH"   \r\n')
  })

  it('corrige caixa mista, e só onde ela difere (FR-010)', () => {
    const documento = doc('#InClUdE "a.ch"\r\n')
    const edits = ca3001Fix.computeEdits(documento, ca3001At(0, 0, 8))

    assert.equal(applyEdits(documento, edits), '#include "a.ch"\r\n')
  })

  it('corrige só o sufixo quando o prefixo já está certo', () => {
    // `#incLUDE`: os quatro primeiros caracteres já batem. A edição começa onde
    // a divergência começa.
    const documento = doc('#incLUDE "a.ch"\r\n')
    const edits = ca3001Fix.computeEdits(documento, ca3001At(0, 0, 8))

    assert.equal(edits.length, 1)
    assert.deepEqual(edits[0]!.range, {
      start: { line: 0, character: 4 },
      end: { line: 0, character: 8 },
    })
    assert.equal(edits[0]!.newText, 'lude')
  })
})

describe('Correção de CA3001 — idempotência (FR-012)', () => {
  it('texto já correto produz ZERO edições', () => {
    // A garantia que faz "corrigir tudo" não marcar o documento como
    // modificado quando não há nada a fazer (FR-015).
    const documento = doc('#include "totvs.ch"\r\n')

    assert.deepEqual(ca3001Fix.computeEdits(documento, ca3001At(0, 0, 8)), [])
  })

  it('aplicar duas vezes não muda nada na segunda', () => {
    const documento = doc('#INCLUDE "TOTVS.CH"\r\n')
    const uma = applyEdits(documento, ca3001Fix.computeEdits(documento, ca3001At(0, 0, 8)))
    const outraVez = doc(uma)

    assert.deepEqual(ca3001Fix.computeEdits(outraVez, ca3001At(0, 0, 8)), [])
    assert.equal(uma, '#include "TOTVS.CH"\r\n')
  })

  it('intervalo que não contém uma diretiva produz ZERO edições', () => {
    // Guarda contra diagnóstico obsoleto: o texto mudou entre a análise e o
    // pedido da ação, e o intervalo agora aponta para outra coisa. Editar às
    // cegas por deslocamento corromperia o arquivo em silêncio.
    const documento = doc('Local x := 1\r\n')

    assert.deepEqual(ca3001Fix.computeEdits(documento, ca3001At(0, 0, 8)), [])
  })

  it('intervalo fora do documento produz ZERO edições', () => {
    const documento = doc('#INCLUDE "A.CH"\r\n')

    assert.deepEqual(ca3001Fix.computeEdits(documento, ca3001At(50, 0, 8)), [])
  })
})

describe('Correção de CA3001 — preservação (FR-007)', () => {
  it('fixture CP1252 com CRLF continua CP1252 com CRLF, e só a diretiva muda', async () => {
    // O fim de linha e os bytes da faixa 0x80-0x9F são o objeto do teste. Uma
    // correção que reescrevesse a linha — ou o documento — normalizaria os dois
    // sem que ninguém percebesse, e o compilador Protheus recusaria o arquivo.
    const bytes = await readFile(join(FIXTURES, 'ca3001-cp1252-highrange.prw'))
    const texto = decodeCp1252(bytes)
    const documento = doc(texto)

    const linha = texto.split('\r\n').findIndex((l) => /^#INCLUDE\b/.test(l))
    assert.ok(linha >= 0, 'a fixture deveria ter uma diretiva em caixa alta')

    const depois = applyEdits(documento, ca3001Fix.computeEdits(documento, ca3001At(linha, 0, 8)))

    // Fim de linha: a contagem de CRLF e de LF solto não pode mudar.
    assert.equal((depois.match(/\r\n/g) ?? []).length, (texto.match(/\r\n/g) ?? []).length)
    assert.equal((depois.match(/(?<!\r)\n/g) ?? []).length, (texto.match(/(?<!\r)\n/g) ?? []).length)

    // Encoding: os bytes voltam a CP1252 sem nenhuma substituição por '?'.
    const reencoded = encodeCp1252(depois)
    assert.equal(reencoded.length, depois.length)
    assert.equal(decodeCp1252(reencoded), depois, 'a ida e volta por CP1252 perdeu caractere')

    // Nenhuma outra linha mudou.
    const antesLinhas = texto.split('\r\n')
    const depoisLinhas = depois.split('\r\n')
    assert.equal(depoisLinhas.length, antesLinhas.length)
    for (let i = 0; i < antesLinhas.length; i += 1) {
      if (i === linha) continue
      assert.equal(depoisLinhas[i], antesLinhas[i], `a linha ${i + 1} mudou sem precisar`)
    }
    assert.equal(depoisLinhas[linha], antesLinhas[linha]!.replace('#INCLUDE', '#include'))
  })
})

describe('Correção de CA3001 — identidade', () => {
  it('declara a regra que conserta e a chave de tradução do título (FR-009)', () => {
    assert.equal(ca3001Fix.ruleId, 'CA3001')
    assert.equal(ca3001Fix.titleKey, 'action.CA3001.title')
  })
})
