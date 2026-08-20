import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CancellationTokenSource } from 'vscode-languageserver'
import {
  CodeActionKind,
  DiagnosticSeverity,
  type CodeAction,
  type Diagnostic,
} from 'vscode-languageserver-types'

import { ca3001Fix } from '../../../src/actions/ca3001-fix'
import { computeCodeActions, type CodeActionRequest } from '../../../src/actions/provider'
import { createAnalyzedDocument, type AnalyzedDocument } from '../../../src/document/analyzed-document'

const NEVER_CANCELLED = new CancellationTokenSource().token

function doc(text = '#INCLUDE "TOTVS.CH"\r\n', version = 7): AnalyzedDocument {
  return createAnalyzedDocument({ uri: 'file:///fonte.prw', languageId: 'advpl', version, text })
}

function ca3001At(line = 0, start = 0, end = 8): Diagnostic {
  return {
    code: 'CA3001',
    severity: DiagnosticSeverity.Information,
    range: { start: { line, character: start }, end: { line, character: end } },
    message: 'a diretiva deve estar em caixa baixa',
    source: 'advpl-lint',
  }
}

function request(overrides: Partial<CodeActionRequest> = {}): CodeActionRequest {
  return {
    document: doc(),
    diagnostics: [ca3001At()],
    documentDiagnostics: [ca3001At()],
    fixes: [ca3001Fix],
    isEnabled: () => true,
    participatesInFixAll: () => true,
    translate: (key, args) => (args ? `traduzido:${key}:${JSON.stringify(args)}` : `traduzido:${key}`),
    token: NEVER_CANCELLED,
    ...overrides,
  }
}

function quickfixes(actions: readonly CodeAction[]): CodeAction[] {
  return actions.filter((a) => a.kind === CodeActionKind.QuickFix)
}

describe('A lâmpada (FR-004)', () => {
  it('oferece a correção com o tipo quickfix', () => {
    const acao = quickfixes(computeCodeActions(request()))[0]

    assert.ok(acao, 'nenhuma ação de correção foi oferecida')
    assert.equal(acao.kind, CodeActionKind.QuickFix)
  })

  it('vincula a ação ao diagnóstico que a originou', () => {
    // É o que faz o editor riscar a marca assim que a correção é aplicada — e é
    // como o usuário sabe QUAL problema aquela lâmpada resolve.
    const diagnostico = ca3001At(0, 0, 8)
    const acao = quickfixes(computeCodeActions(request({ diagnostics: [diagnostico] })))[0]

    assert.ok(acao)
    assert.deepEqual(acao.diagnostics, [diagnostico])
  })

  it('o identificador da regra fica visível na origem do título', () => {
    // FR-004: o usuário precisa saber QUAL regra está sendo corrigida. O
    // identificador viaja como argumento da tradução, e não colado no código —
    // Princípio V, nenhuma string literal.
    const acao = quickfixes(computeCodeActions(request()))[0]

    assert.ok(acao)
    assert.match(acao.title, /^traduzido:action\.CA3001\.title/)
    assert.match(acao.title, /CA3001/)
  })

  it('o título passa pelo NLS, nunca é montado no código', () => {
    const acao = quickfixes(
      computeCodeActions(request({ translate: () => 'Trocar por #include' })),
    )[0]

    assert.ok(acao)
    assert.equal(acao.title, 'Trocar por #include')
  })

  it('uma ação por diagnóstico, cada uma com a sua edição', () => {
    const texto = '#INCLUDE "A.CH"\r\n#INCLUDE "B.CH"\r\n'
    const diagnosticos = [ca3001At(0), ca3001At(1)]
    const acoes = quickfixes(
      computeCodeActions(request({ document: doc(texto), diagnostics: diagnosticos })),
    )

    assert.equal(acoes.length, 2)
    assert.equal(acoes[0]!.edit?.documentChanges?.length, 1)
    assert.deepEqual(acoes[0]!.diagnostics, [diagnosticos[0]])
    assert.deepEqual(acoes[1]!.diagnostics, [diagnosticos[1]])
  })

  it('respeita `only`: pedido restrito a source.fixAll não devolve quickfix', () => {
    const acoes = computeCodeActions(request({ only: [CodeActionKind.SourceFixAll] }))

    assert.equal(quickfixes(acoes).length, 0)
    assert.ok(acoes.every((a) => a.kind === CodeActionKind.SourceFixAll))
  })

  it('`only` genérico abrange o tipo específico', () => {
    // Hierarquia do protocolo: pedir `source` abrange `source.fixAll`.
    const acoes = computeCodeActions(request({ only: ['source'] }))

    assert.ok(acoes.some((a) => a.kind === CodeActionKind.SourceFixAll))
  })
})

describe('Guarda contra edição obsoleta (FR-006, R7)', () => {
  it('a alteração viaja na forma VERSIONADA do protocolo', () => {
    // Esta é a garantia inteira: com `documentChanges` e um identificador
    // versionado, é o EDITOR quem recusa a aplicação quando a versão não bate.
    // Não é preciso inventar conferência — é preciso não usar a forma simples.
    const acao = quickfixes(computeCodeActions(request({ document: doc(undefined, 42) })))[0]

    assert.ok(acao?.edit)
    assert.equal(acao.edit.changes, undefined, 'a forma simples `changes` perderia a garantia de versão')

    const mudanca = acao.edit.documentChanges?.[0]
    assert.ok(mudanca && 'textDocument' in mudanca)
    assert.equal(mudanca.textDocument.uri, 'file:///fonte.prw')
    assert.equal(mudanca.textDocument.version, 42, 'a edição não carrega a versão sobre a qual foi calculada')
  })

  it('a versão levada é a do documento no momento do CÁLCULO', () => {
    // O caminho de correção é assíncrono por natureza: o usuário pede as ações,
    // pensa, e clica. Se a versão fosse omitida — ou fosse `null` —, uma edição
    // por deslocamento sobre um texto já digitado corromperia o arquivo em
    // silêncio, e ninguém veria erro nenhum.
    const naVersao1 = quickfixes(computeCodeActions(request({ document: doc(undefined, 1) })))[0]
    const naVersao2 = quickfixes(computeCodeActions(request({ document: doc(undefined, 2) })))[0]

    const versaoDe = (acao: CodeAction | undefined): number | null | undefined => {
      const mudanca = acao?.edit?.documentChanges?.[0]
      return mudanca && 'textDocument' in mudanca ? mudanca.textDocument.version : undefined
    }

    assert.equal(versaoDe(naVersao1), 1)
    assert.equal(versaoDe(naVersao2), 2)
    assert.notEqual(versaoDe(naVersao1), versaoDe(naVersao2))
  })
})

describe('Provedor — entradas que não são nossas', () => {
  it('ignora diagnóstico cujo identificador não é texto', () => {
    // Diagnóstico de outra extensão, ou de um cliente que manda o código como
    // número. Não é nosso, e a lâmpada não tem o que oferecer.
    const numerico: Diagnostic = { ...ca3001At(), code: 3001 }

    assert.deepEqual(
      computeCodeActions(request({ diagnostics: [numerico], documentDiagnostics: [numerico] })),
      [],
    )
  })

  it('`only` vazio é tratado como "aceito tudo"', () => {
    // O protocolo permite `only: []`. Interpretá-lo como "nenhum tipo" faria a
    // lâmpada sumir sem que ninguém tivesse pedido isso.
    const acoes = computeCodeActions(request({ only: [] }))

    assert.ok(acoes.some((a) => a.kind === CodeActionKind.QuickFix))
    assert.ok(acoes.some((a) => a.kind === CodeActionKind.SourceFixAll))
  })
})
