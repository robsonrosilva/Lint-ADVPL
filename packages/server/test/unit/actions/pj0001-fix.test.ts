import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DiagnosticSeverity, type Diagnostic, type TextEdit } from 'vscode-languageserver-types'

import { createPj0001Fix } from '../../../src/actions/pj0001-fix'
import { createAnalyzedDocument, type AnalyzedDocument } from '../../../src/document/analyzed-document'
import type {
  IncludeIndexReader,
  IncludeIndexState,
  IncludeLookup,
} from '../../../src/includes/index-store'

function doc(text: string, version = 1): AnalyzedDocument {
  return createAnalyzedDocument({ uri: 'file:///fonte.prw', languageId: 'advpl', version, text })
}

function indice(
  respostas: Readonly<Record<string, IncludeLookup>>,
  state: IncludeIndexState = 'pronto',
): IncludeIndexReader {
  return {
    state,
    lookup: (name) => respostas[name.toLowerCase()] ?? { kind: 'ausente' },
    ensureBuilt: () => {},
  }
}

function encontrado(realName: string, directory = '/inc'): IncludeLookup {
  return { kind: 'encontrado', entry: { realName, directory } }
}

/** O diagnóstico que `PJ0001` emite: cobre SÓ o nome, e carrega o nome real. */
function pj0001At(line: number, start: number, end: number, realName?: string): Diagnostic {
  return {
    code: 'PJ0001',
    severity: DiagnosticSeverity.Warning,
    range: { start: { line, character: start }, end: { line, character: end } },
    message: 'a caixa diverge do disco',
    source: 'advpl-lint',
    ...(realName === undefined ? {} : { data: { realName } }),
  }
}

function aplicar(document: AnalyzedDocument, edits: readonly TextEdit[]): string {
  const linhas = document.text.split(/(?<=\n)/)
  for (const edit of [...edits].reverse()) {
    const linha = linhas[edit.range.start.line]!
    linhas[edit.range.start.line] =
      linha.slice(0, edit.range.start.character) + edit.newText + linha.slice(edit.range.end.character)
  }
  return linhas.join('')
}

describe('Correção de PJ0001 — o que ela toca (FR-037, FR-038)', () => {
  it('troca o nome pelo REAL lido do disco', () => {
    const fix = createPj0001Fix(indice({ 'acadef.ch': encontrado('ACADEF.CH') }))
    const documento = doc('#include "acadef.ch"\r\n')

    const depois = aplicar(documento, fix.computeEdits(documento, pj0001At(0, 10, 19, 'ACADEF.CH')))

    assert.equal(depois, '#include "ACADEF.CH"\r\n')
  })

  it('NÃO baixa a caixa do nome: ela sobe, se o disco mandar', () => {
    // O ponto do FR-038. Baixar a caixa quebraria 706 referências que hoje
    // resolvem — 7% dos includes do disco têm maiúscula no nome real, e o
    // AppServer roda em Linux.
    const fix = createPj0001Fix(indice({ 'acadef.ch': encontrado('ACADEF.CH') }))
    const documento = doc('#include "acadef.ch"\r\n')

    const [edit] = fix.computeEdits(documento, pj0001At(0, 10, 19, 'ACADEF.CH'))

    assert.ok(edit)
    assert.equal(edit.newText, 'ACADEF.CH')
  })

  it('e baixa a caixa quando é o disco que está em caixa baixa', () => {
    const fix = createPj0001Fix(indice({ 'totvs.ch': encontrado('totvs.ch') }))
    const documento = doc('#INCLUDE "TOTVS.CH"\r\n')

    const depois = aplicar(documento, fix.computeEdits(documento, pj0001At(0, 10, 18, 'totvs.ch')))

    // A DIRETIVA continua em caixa alta: consertá-la é da outra regra.
    assert.equal(depois, '#INCLUDE "totvs.ch"\r\n')
  })

  it('NÃO toca na diretiva', () => {
    const fix = createPj0001Fix(indice({ 'acadef.ch': encontrado('ACADEF.CH') }))
    const documento = doc('#INCLUDE "acadef.ch"\r\n')

    const depois = aplicar(documento, fix.computeEdits(documento, pj0001At(0, 10, 19, 'ACADEF.CH')))

    assert.match(depois, /^#INCLUDE /, 'a correção mexeu na diretiva, que é de outra regra')
  })

  it('NÃO toca no caminho antes do nome', () => {
    // O caminho está fora do escopo por decisão registrada (R9). Mexer nele
    // seria aplicar uma regra que não existe.
    const fix = createPj0001Fix(indice({ 'acadef.ch': encontrado('ACADEF.CH') }))
    const documento = doc('#include "..\\INCLUDES\\acadef.ch"\r\n')

    const depois = aplicar(documento, fix.computeEdits(documento, pj0001At(0, 22, 31, 'ACADEF.CH')))

    assert.equal(depois, '#include "..\\INCLUDES\\ACADEF.CH"\r\n')
  })

  it('NÃO toca nas aspas', () => {
    const fix = createPj0001Fix(indice({ 'acadef.ch': encontrado('ACADEF.CH') }))
    const documento = doc("#include 'acadef.ch'\r\n")

    const depois = aplicar(documento, fix.computeEdits(documento, pj0001At(0, 10, 19, 'ACADEF.CH')))

    assert.equal(depois, "#include 'ACADEF.CH'\r\n")
  })

  it('a edição é o menor conjunto possível (FR-005)', () => {
    // `acadef.ch` → `acadef.CH`: os sete primeiros caracteres já batem, e só o
    // `ch` final é reescrito. Substituir o nome inteiro alargaria o intervalo
    // sem nenhum ganho — é o mesmo princípio que impede reescrever a linha.
    const fix = createPj0001Fix(indice({ 'acadef.ch': encontrado('acadef.CH') }))
    const documento = doc('#include "acadef.ch"\r\n')

    const [edit] = fix.computeEdits(documento, pj0001At(0, 10, 19, 'acadef.CH'))

    assert.ok(edit)
    assert.equal(edit.newText, 'CH')
    assert.equal(edit.range.start.character, 17)
  })

  it('nada a fazer quando o texto já está com a grafia real', () => {
    const fix = createPj0001Fix(indice({ 'acadef.ch': encontrado('ACADEF.CH') }))
    const documento = doc('#include "ACADEF.CH"\r\n')

    assert.deepEqual(fix.computeEdits(documento, pj0001At(0, 10, 19, 'ACADEF.CH')), [])
  })

  it('declara a regra que conserta e a chave de tradução do título', () => {
    const fix = createPj0001Fix(indice({}))

    assert.equal(fix.ruleId, 'PJ0001')
    assert.equal(fix.titleKey, 'action.PJ0001.title')
  })
})

describe('Correção de PJ0001 — recusa quando o índice mudou (FR-039)', () => {
  it('RECUSA se o arquivo saiu do índice entre o diagnóstico e a aplicação', () => {
    // O caminho de correção é assíncrono por natureza: o usuário pede as ações,
    // pensa, e clica. Nesse meio-tempo o arquivo pode ter sido apagado ou
    // renomeado — e escrever o nome antigo criaria uma referência que não
    // resolve mais.
    const fix = createPj0001Fix(indice({}))
    const documento = doc('#include "acadef.ch"\r\n')

    assert.deepEqual(fix.computeEdits(documento, pj0001At(0, 10, 19, 'ACADEF.CH')), [])
  })

  it('RECUSA se a grafia no disco mudou desde o diagnóstico', () => {
    // O índice agora diz `AcaDef.Ch`; o diagnóstico foi calculado sobre
    // `ACADEF.CH`. Aplicar o nome velho gravaria no fonte uma grafia que já não
    // existe.
    const fix = createPj0001Fix(indice({ 'acadef.ch': encontrado('AcaDef.Ch') }))
    const documento = doc('#include "acadef.ch"\r\n')

    assert.deepEqual(fix.computeEdits(documento, pj0001At(0, 10, 19, 'ACADEF.CH')), [])
  })

  it('RECUSA se a referência virou AMBÍGUA', () => {
    const fix = createPj0001Fix(
      indice({
        'acadef.ch': {
          kind: 'ambíguo',
          candidates: [
            { realName: 'ACADEF.CH', directory: '/a' },
            { realName: 'acadef.ch', directory: '/b' },
          ],
        },
      }),
    )
    const documento = doc('#include "acadef.ch"\r\n')

    assert.deepEqual(fix.computeEdits(documento, pj0001At(0, 10, 19, 'ACADEF.CH')), [])
  })

  it('RECUSA quando o índice deixou de estar pronto', () => {
    const fix = createPj0001Fix(indice({ 'acadef.ch': encontrado('ACADEF.CH') }, 'construindo'))
    const documento = doc('#include "acadef.ch"\r\n')

    assert.deepEqual(fix.computeEdits(documento, pj0001At(0, 10, 19, 'ACADEF.CH')), [])
  })

  it('RECUSA diagnóstico sem o nome real anexado', () => {
    // Diagnóstico de uma versão anterior da extensão, ou forjado. Sem o dado, a
    // correção não tem o que escrever — e adivinhar pelo índice mascararia a
    // inconsistência.
    const fix = createPj0001Fix(indice({ 'acadef.ch': encontrado('ACADEF.CH') }))
    const documento = doc('#include "acadef.ch"\r\n')

    assert.deepEqual(fix.computeEdits(documento, pj0001At(0, 10, 19)), [])
  })

  it('RECUSA quando o dado anexado tem forma inesperada', () => {
    const fix = createPj0001Fix(indice({ 'acadef.ch': encontrado('ACADEF.CH') }))
    const documento = doc('#include "acadef.ch"\r\n')

    for (const data of [null, 'ACADEF.CH', 42, {}, { realName: 7 }]) {
      const diagnostico = { ...pj0001At(0, 10, 19), data }
      assert.deepEqual(fix.computeEdits(documento, diagnostico), [], `com data=${JSON.stringify(data)}`)
    }
  })

  it('RECUSA quando o intervalo já não aponta para o nome referenciado', () => {
    // O texto mudou entre a análise e o pedido da ação. Editar às cegas por
    // deslocamento corromperia o arquivo em silêncio.
    const fix = createPj0001Fix(indice({ 'acadef.ch': encontrado('ACADEF.CH') }))
    const documento = doc('Local x := 1\r\n')

    assert.deepEqual(fix.computeEdits(documento, pj0001At(0, 10, 19, 'ACADEF.CH')), [])
  })
})

describe('Correção de PJ0001 — dado anexado degenerado', () => {
  it('RECUSA nome real vazio', () => {
    // Texto vazio passaria pelo `typeof === "string"` e produziria uma edição
    // que APAGA a referência. Recusar é a única resposta segura.
    const fix = createPj0001Fix(indice({ 'acadef.ch': encontrado('ACADEF.CH') }))
    const documento = doc('#include "acadef.ch"\r\n')

    assert.deepEqual(fix.computeEdits(documento, { ...pj0001At(0, 10, 19), data: { realName: '' } }), [])
  })

  it('RECUSA intervalo degenerado, que não cobre caractere nenhum', () => {
    const fix = createPj0001Fix(indice({ 'acadef.ch': encontrado('ACADEF.CH') }))
    const documento = doc('#include "acadef.ch"\r\n')

    assert.deepEqual(fix.computeEdits(documento, pj0001At(0, 10, 10, 'ACADEF.CH')), [])
  })
})
