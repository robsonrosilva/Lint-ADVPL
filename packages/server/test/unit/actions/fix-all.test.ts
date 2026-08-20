import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CancellationTokenSource } from 'vscode-languageserver'
import {
  CodeActionKind,
  DiagnosticSeverity,
  type CodeAction,
  type Diagnostic,
  type TextEdit,
} from 'vscode-languageserver-types'

import { ca3001Fix } from '../../../src/actions/ca3001-fix'
import { computeCodeActions, orderAndDisjoin, type CodeActionRequest, type RuleFix } from '../../../src/actions/provider'
import { createAnalyzedDocument, type AnalyzedDocument } from '../../../src/document/analyzed-document'

const NEVER_CANCELLED = new CancellationTokenSource().token

const TRES_DIRETIVAS = '#INCLUDE "A.CH"\r\n#INCLUDE "B.CH"\r\n#INCLUDE "C.CH"\r\n'

function doc(text: string, version = 3): AnalyzedDocument {
  return createAnalyzedDocument({ uri: 'file:///fonte.prw', languageId: 'advpl', version, text })
}

function diagnostic(ruleId: string, line: number, start = 0, end = 8): Diagnostic {
  return {
    code: ruleId,
    severity: DiagnosticSeverity.Information,
    range: { start: { line, character: start }, end: { line, character: end } },
    message: `mensagem de ${ruleId}`,
    source: 'advpl-lint',
  }
}

function request(overrides: Partial<CodeActionRequest> = {}): CodeActionRequest {
  return {
    document: doc(TRES_DIRETIVAS),
    diagnostics: [],
    documentDiagnostics: [0, 1, 2].map((line) => diagnostic('CA3001', line)),
    fixes: [ca3001Fix],
    isEnabled: () => true,
    participatesInFixAll: () => true,
    translate: (key) => `traduzido:${key}`,
    token: NEVER_CANCELLED,
    ...overrides,
  }
}

function fixAllOf(actions: readonly CodeAction[]): CodeAction | undefined {
  return actions.find((a) => a.kind === CodeActionKind.SourceFixAll)
}

function editsOf(action: CodeAction | undefined): TextEdit[] {
  const change = action?.edit?.documentChanges?.[0]
  return change && 'edits' in change ? (change.edits as TextEdit[]) : []
}

describe('Corrigir tudo — uma operação só (FR-013)', () => {
  it('reúne TODAS as correções do documento numa WorkspaceEdit única', () => {
    // É a `WorkspaceEdit` única — e não um laço de aplicações — que faz o
    // editor agrupar tudo em UM desfazer. Se cada correção fosse uma alteração
    // separada, desfazer exigiria N vezes Ctrl+Z e o usuário desistiria no
    // meio, deixando o arquivo num estado que ele não escolheu.
    const acao = fixAllOf(computeCodeActions(request()))

    assert.ok(acao, 'nenhuma ação de "corrigir tudo" foi oferecida')
    assert.equal(acao.edit?.documentChanges?.length, 1, 'as correções vieram em mais de uma alteração')
    assert.equal(editsOf(acao).length, 3, 'as três diretivas deveriam entrar na mesma edição')
  })

  it('as edições saem ORDENADAS por posição (FR-016)', () => {
    // Fora de ordem, o resultado passaria a depender de como o editor aplica —
    // e de como as regras foram registradas. Determinismo aqui é o requisito.
    const desordenados = [diagnostic('CA3001', 2), diagnostic('CA3001', 0), diagnostic('CA3001', 1)]
    const edits = editsOf(fixAllOf(computeCodeActions(request({ documentDiagnostics: desordenados }))))

    assert.deepEqual(
      edits.map((e) => e.range.start.line),
      [0, 1, 2],
    )
  })

  it('o resultado independe da ordem em que as regras foram registradas (FR-016)', () => {
    const outroConserto: RuleFix = {
      ruleId: 'ZZ0001',
      titleKey: 'action.ZZ0001.title',
      computeEdits: (_d, diag) => [{ range: diag.range, newText: 'zz' }],
    }
    const diagnosticos = [diagnostic('CA3001', 0), diagnostic('ZZ0001', 1, 9, 15)]

    const numaOrdem = editsOf(
      fixAllOf(
        computeCodeActions(request({ documentDiagnostics: diagnosticos, fixes: [ca3001Fix, outroConserto] })),
      ),
    )
    const naOutra = editsOf(
      fixAllOf(
        computeCodeActions(request({ documentDiagnostics: diagnosticos, fixes: [outroConserto, ca3001Fix] })),
      ),
    )

    assert.deepEqual(numaOrdem, naOutra)
  })

  it('as edições são DISJUNTAS: a que se sobrepõe é descartada (FR-016)', () => {
    // Duas edições disputando o mesmo trecho produziriam texto corrompido. Hoje
    // isso não acontece — `CA3001` toca a diretiva e `PJ0001` o nome —, e é
    // justamente por isso que a garantia precisa estar escrita: o dia em que
    // deixar de valer, ela cala em vez de estragar o arquivo.
    const sobrepostas: TextEdit[] = [
      { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 8 } }, newText: 'a' },
      { range: { start: { line: 0, character: 4 }, end: { line: 0, character: 12 } }, newText: 'b' },
      { range: { start: { line: 0, character: 12 }, end: { line: 0, character: 15 } }, newText: 'c' },
    ]

    const resultado = orderAndDisjoin(sobrepostas)

    assert.equal(resultado.length, 2)
    assert.deepEqual(
      resultado.map((e) => e.newText),
      ['a', 'c'],
    )
  })

  it('edições que apenas se tocam nas pontas NÃO se sobrepõem', () => {
    // `[0,8)` e `[8,12)` são adjacentes, não sobrepostas. Descartar a segunda
    // aqui perderia uma correção legítima — é a linha `#INCLUDE "a.ch"` com as
    // duas regras disparando lado a lado.
    const adjacentes: TextEdit[] = [
      { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 8 } }, newText: 'a' },
      { range: { start: { line: 0, character: 8 }, end: { line: 0, character: 12 } }, newText: 'b' },
    ]

    assert.equal(orderAndDisjoin(adjacentes).length, 2)
  })

  it('a ação vem com o tipo que o editor usa para corrigir ao salvar (FR-014)', () => {
    const acao = fixAllOf(computeCodeActions(request()))

    assert.equal(acao?.kind, CodeActionKind.SourceFixAll)
  })
})

describe('Corrigir tudo — documento sem violação (FR-015)', () => {
  it('produz ZERO edições, e nem sequer oferece a ação', () => {
    // Uma ação com zero edições oferecida ao salvamento marcaria o documento
    // como modificado sem ter mudado nada. Salvar um arquivo limpo não pode
    // sujá-lo.
    const acoes = computeCodeActions(request({ documentDiagnostics: [] }))

    assert.equal(fixAllOf(acoes), undefined)
  })

  it('não oferece a ação quando todos os consertos são inertes', () => {
    // Texto JÁ correto com diagnóstico obsoleto no painel: cada conserto
    // devolve lista vazia, e o total é zero.
    const acoes = computeCodeActions(
      request({
        document: doc('#include "a.ch"\r\n'),
        documentDiagnostics: [diagnostic('CA3001', 0)],
      }),
    )

    assert.equal(fixAllOf(acoes), undefined)
  })
})

describe('Participação por regra na correção em massa (FR-018, D9)', () => {
  it('regra fora da lista NÃO entra, mesmo estando LIGADA', () => {
    // As duas chaves são independentes de propósito: apontar e corrigir sem o
    // usuário olhar são atos de invasividade diferente. `PJ0001` nasce fora
    // porque trocar o nome do arquivo muda o que o compilador vai procurar.
    const acoes = computeCodeActions(
      request({
        isEnabled: () => true,
        participatesInFixAll: (ruleId) => ruleId !== 'CA3001',
      }),
    )

    assert.equal(fixAllOf(acoes), undefined, 'a regra excluída da lista foi corrigida em massa')
  })

  it('a lâmpada individual continua oferecendo o que a correção em massa não faz', () => {
    // O ponto do FR-040: fora do "corrigir tudo" NÃO é "sem correção". A ação
    // individual, com o usuário olhando, continua disponível.
    const acoes = computeCodeActions(
      request({
        diagnostics: [diagnostic('CA3001', 0)],
        participatesInFixAll: () => false,
      }),
    )

    assert.equal(acoes.filter((a) => a.kind === CodeActionKind.QuickFix).length, 1)
    assert.equal(fixAllOf(acoes), undefined)
  })

  it('regra desligada não entra na correção em massa nem estando na lista', () => {
    const acoes = computeCodeActions(request({ isEnabled: () => false, participatesInFixAll: () => true }))

    assert.equal(fixAllOf(acoes), undefined)
  })
})

describe('Corrigir tudo — cancelamento (FR-017)', () => {
  it('cancelado no meio, não oferece a ação — nada é aplicado pela metade', () => {
    const source = new CancellationTokenSource()
    let calculadasDepois = 0

    const conserto: RuleFix = {
      ruleId: 'CA3001',
      titleKey: 'action.CA3001.title',
      computeEdits: (_d, diag) => {
        if (source.token.isCancellationRequested) calculadasDepois += 1
        source.cancel()
        return [{ range: diag.range, newText: '#include' }]
      },
    }

    const muitos = Array.from({ length: 50 }, (_, i) => diagnostic('CA3001', i))
    const acoes = computeCodeActions(
      request({ documentDiagnostics: muitos, fixes: [conserto], token: source.token }),
    )

    assert.equal(calculadasDepois, 0, `${calculadasDepois} edições calculadas DEPOIS do cancelamento`)
    assert.deepEqual(acoes, [])
  })
})

describe('Corrigir tudo — o texto resultante', () => {
  it('as três diretivas viram caixa baixa e o resto do arquivo não muda', () => {
    const documento = doc(TRES_DIRETIVAS)
    const edits = editsOf(fixAllOf(computeCodeActions(request({ document: documento }))))

    // Aplica de trás para frente, como o editor faz com edições ordenadas.
    const linhas = documento.text.split(/(?<=\n)/)
    for (const edit of [...edits].reverse()) {
      const linha = linhas[edit.range.start.line]!
      linhas[edit.range.start.line] =
        linha.slice(0, edit.range.start.character) + edit.newText + linha.slice(edit.range.end.character)
    }

    assert.equal(linhas.join(''), '#include "A.CH"\r\n#include "B.CH"\r\n#include "C.CH"\r\n')
  })

  it('a ação lista os diagnósticos que ela cobre', () => {
    // É o que faz o editor riscar as marcas certas depois de aplicar.
    const acao = fixAllOf(computeCodeActions(request()))

    assert.equal(acao?.diagnostics?.length, 3)
  })
})

describe('Ordenação — edições em linhas diferentes nunca se sobrepõem', () => {
  it('duas edições em linhas distintas ficam as duas', () => {
    // O teste de sobreposição compara linha antes de coluna. Sem o primeiro
    // ramo, uma edição que termina na linha 3 "engoliria" outra que começa na
    // linha 1 por comparação só de coluna.
    const edits: TextEdit[] = [
      { range: { start: { line: 0, character: 10 }, end: { line: 0, character: 20 } }, newText: 'a' },
      { range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } }, newText: 'b' },
    ]

    assert.equal(orderAndDisjoin(edits).length, 2)
  })

  it('edição que ATRAVESSA a linha seguinte engole a que começa nela', () => {
    const edits: TextEdit[] = [
      { range: { start: { line: 0, character: 0 }, end: { line: 1, character: 5 } }, newText: 'a' },
      { range: { start: { line: 1, character: 0 }, end: { line: 1, character: 3 } }, newText: 'b' },
    ]

    assert.deepEqual(
      orderAndDisjoin(edits).map((e) => e.newText),
      ['a'],
    )
  })
})
