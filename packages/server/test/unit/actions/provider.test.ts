import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CancellationTokenSource } from 'vscode-languageserver'
import { DiagnosticSeverity, type Diagnostic, type TextEdit } from 'vscode-languageserver-types'

import { computeCodeActions, type CodeActionRequest, type RuleFix } from '../../../src/actions/provider'
import { createAnalyzedDocument, type AnalyzedDocument } from '../../../src/document/analyzed-document'

const NEVER_CANCELLED = new CancellationTokenSource().token

function doc(text = '#INCLUDE "TOTVS.CH"\r\n', version = 7): AnalyzedDocument {
  return createAnalyzedDocument({ uri: 'file:///fonte.prw', languageId: 'advpl', version, text })
}

function diagnostic(ruleId: string, line = 0, start = 0, end = 8): Diagnostic {
  return {
    code: ruleId,
    severity: DiagnosticSeverity.Information,
    range: { start: { line, character: start }, end: { line, character: end } },
    message: `mensagem de ${ruleId}`,
    source: 'advpl-lint',
  }
}

/** Um conserto de mentira que troca o intervalo do diagnóstico por um texto fixo. */
function fixoQueTroca(ruleId: string, novoTexto: string, onCompute?: () => void): RuleFix {
  return {
    ruleId,
    titleKey: `action.${ruleId}.title`,
    computeEdits(_document: AnalyzedDocument, d: Diagnostic): readonly TextEdit[] {
      onCompute?.()
      return [{ range: d.range, newText: novoTexto }]
    },
  }
}

function request(overrides: Partial<CodeActionRequest> = {}): CodeActionRequest {
  return {
    document: doc(),
    diagnostics: [],
    documentDiagnostics: [],
    fixes: [fixoQueTroca('CA3001', '#include')],
    isEnabled: () => true,
    participatesInFixAll: () => true,
    translate: (key) => `traduzido:${key}`,
    token: NEVER_CANCELLED,
    ...overrides,
  }
}

describe('Provedor de ações — quando não há o que oferecer', () => {
  it('devolve lista vazia sem diagnóstico no intervalo', () => {
    // O caso mais comum de todos: o cursor está numa linha limpa. Nada de
    // lâmpada, e — o que importa mais — nenhum trabalho gasto para descobrir
    // isso.
    assert.deepEqual(computeCodeActions(request()), [])
  })

  it('devolve lista vazia quando nenhum conserto conhece a regra do diagnóstico', () => {
    // Diagnóstico de regra sem correção automática é a maioria dos casos
    // futuros: apontar não obriga a consertar.
    const actions = computeCodeActions(request({ diagnostics: [diagnostic('CA9999')] }))

    assert.deepEqual(actions, [])
  })

  it('NÃO oferece ação de regra desligada (FR-008)', () => {
    // A lâmpada não ressuscita o que o usuário desligou. Se ela oferecesse, o
    // desligamento passaria a valer só para o painel — e o usuário veria a
    // extensão propor consertar o que ele mandou ignorar.
    const actions = computeCodeActions(
      request({ diagnostics: [diagnostic('CA3001')], isEnabled: () => false }),
    )

    assert.deepEqual(actions, [])
  })

  it('nem sequer CALCULA a edição de regra desligada', () => {
    // "Não oferecer" e "calcular e jogar fora" dão o mesmo resultado na tela e
    // custam coisas diferentes. Esta é a distinção que o Princípio I cobra.
    let calculou = 0
    computeCodeActions(
      request({
        diagnostics: [diagnostic('CA3001')],
        fixes: [fixoQueTroca('CA3001', '#include', () => (calculou += 1))],
        isEnabled: () => false,
      }),
    )

    assert.equal(calculou, 0, 'a edição de uma regra desligada foi calculada mesmo assim')
  })

  it('devolve lista vazia quando o conserto não produz edição nenhuma', () => {
    // Idempotência vista de fora: um conserto que nada tem a fazer não vira
    // uma ação vazia na lâmpada.
    const inerte: RuleFix = { ruleId: 'CA3001', titleKey: 'action.CA3001.title', computeEdits: () => [] }
    const actions = computeCodeActions(request({ diagnostics: [diagnostic('CA3001')], fixes: [inerte] }))

    assert.deepEqual(actions, [])
  })
})

describe('Provedor de ações — cancelamento (FR-002)', () => {
  it('PARA DE FATO: nenhuma edição é calculada depois do cancelamento', () => {
    // A distinção que o Princípio I cobra, e o defeito que matou a versão
    // anterior: "descartou o resultado" NÃO é "parou". O teste conta o
    // trabalho feito DEPOIS do cancelamento — se ele fosse escrito conferindo
    // só o valor devolvido, um provedor que rodasse tudo e jogasse fora
    // passaria.
    const source = new CancellationTokenSource()
    let calculadasDepois = 0

    const conserto = fixoQueTroca('CA3001', '#include', () => {
      if (source.token.isCancellationRequested) calculadasDepois += 1
      // O segundo diagnóstico chega com o pedido já substituído por outro.
      source.cancel()
    })

    const diagnosticos = Array.from({ length: 40 }, (_, i) => diagnostic('CA3001', i))

    computeCodeActions(
      request({ diagnostics: diagnosticos, fixes: [conserto], token: source.token }),
    )

    assert.equal(
      calculadasDepois,
      0,
      `${calculadasDepois} edições foram calculadas DEPOIS do cancelamento`,
    )
  })

  it('cancelado, devolve lista vazia — resultado parcial não vai para a tela', () => {
    const source = new CancellationTokenSource()
    source.cancel()

    const actions = computeCodeActions(
      request({ diagnostics: [diagnostic('CA3001')], token: source.token }),
    )

    assert.deepEqual(actions, [], 'um resultado parcial de pedido cancelado chegou à lâmpada')
  })
})

describe('Provedor de ações — o que ele NÃO faz', () => {
  it('não faz I/O e não registra log', () => {
    // Princípio I no caminho quente. O lint já reprova `*Sync` e `console.*`
    // em packages/server/src; este teste guarda o caso de alguém trazer a
    // variante assíncrona para dentro do cálculo, que o lint não pega.
    const source = computeCodeActions.toString()

    assert.ok(!/readFile|opendir|readdir|console\./.test(source))
  })
})
