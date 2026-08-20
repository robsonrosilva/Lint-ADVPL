import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DiagnosticSeverity } from 'vscode-languageserver-types'

import { CONFIG_ROOT, Settings, ruleConfigKey, toDiagnosticSeverity } from '../../../src/config/settings'
import { RuleRegistry } from '../../../src/rules/registry'
import { ca3001 } from '../../../src/rules/ca3001'

function registered() {
  const registry = new RuleRegistry()
  registry.register(ca3001)
  return registry.get('CA3001')!
}

describe('Chave de configuração por regra (Princípio IV)', () => {
  it('monta a chave a partir do identificador da regra', () => {
    assert.equal(ruleConfigKey('CA3001'), 'advplLint.rules.CA3001')
    assert.equal(ruleConfigKey('PJ0001'), 'advplLint.rules.PJ0001')
  })

  it('declara a raiz do espaço de nomes num lugar só', () => {
    assert.equal(CONFIG_ROOT, 'advplLint')
  })
})

describe('Severidade escolhida pelo usuário', () => {
  it('traduz cada escolha para a severidade do protocolo', () => {
    assert.equal(toDiagnosticSeverity('error'), DiagnosticSeverity.Error)
    assert.equal(toDiagnosticSeverity('warning'), DiagnosticSeverity.Warning)
    assert.equal(toDiagnosticSeverity('information'), DiagnosticSeverity.Information)
    assert.equal(toDiagnosticSeverity('hint'), DiagnosticSeverity.Hint)
  })

  it('devolve nulo para "default" — quem decide é a tabela versionada', () => {
    assert.equal(toDiagnosticSeverity('default'), null)
  })

  it('devolve nulo para valor que não existe', () => {
    assert.equal(toDiagnosticSeverity('urgentíssimo'), null)
  })
})

describe('Configuração — sem nada configurado, valem os padrões', () => {
  it('a regra nasce ligada', () => {
    const settings = new Settings()

    assert.equal(settings.isEnabled(registered()), true)
  })

  it('a severidade vem da tabela, pelo padrão da regra', () => {
    const settings = new Settings()

    assert.equal(settings.severityOf(registered()), DiagnosticSeverity.Information)
  })

  it('regra que o registro declara DESLIGADA nasce desligada (FR-036)', () => {
    // Princípio VI: sem taxa de falso positivo medida, a regra entra desligada.
    // Quem sabe disso é o registro; a configuração apenas obedece — se ela
    // assumisse `true` aqui, a decisão do Princípio VI seria silenciosamente
    // desfeita por quem nunca tocou na chave.
    const settings = new Settings()
    const desligada = { ...registered(), id: 'PJ0001', enabledByDefault: false }

    assert.equal(settings.isEnabled(desligada), false)
  })

  it('o usuário RELIGA por chave a regra que nasce desligada', () => {
    const settings = new Settings()
    settings.update({ rules: { PJ0001: { enabled: true } } })
    const desligada = { ...registered(), id: 'PJ0001', enabledByDefault: false }

    assert.equal(settings.isEnabled(desligada), true)
  })
})

describe('Configuração — o usuário manda (FR-013)', () => {
  it('desliga a regra individualmente', () => {
    const settings = new Settings()
    settings.update({ rules: { CA3001: { enabled: false } } })

    assert.equal(settings.isEnabled(registered()), false)
  })

  it('religa a regra', () => {
    const settings = new Settings()
    settings.update({ rules: { CA3001: { enabled: false } } })
    settings.update({ rules: { CA3001: { enabled: true } } })

    assert.equal(settings.isEnabled(registered()), true)
  })

  it('altera a severidade exibida', () => {
    const settings = new Settings()
    settings.update({ rules: { CA3001: { severity: 'warning' } } })

    assert.equal(settings.severityOf(registered()), DiagnosticSeverity.Warning)
  })

  it('"default" devolve o comando à tabela versionada', () => {
    const settings = new Settings()
    settings.update({ rules: { CA3001: { severity: 'error' } } })
    settings.update({ rules: { CA3001: { severity: 'default' } } })

    assert.equal(settings.severityOf(registered()), DiagnosticSeverity.Information)
  })

  it('desligar uma regra não mexe na configuração de outra', () => {
    const settings = new Settings()
    settings.update({ rules: { CA9999: { enabled: false } } })

    assert.equal(settings.isEnabled(registered()), true)
  })
})

describe('Configuração — entrada inválida não derruba nem mente', () => {
  it('ignora valor de tipo errado e mantém o padrão', () => {
    // Configuração do usuário é entrada externa. Um `enabled: "não"` não pode
    // desligar a regra por acidente nem quebrar o servidor no meio da análise.
    const settings = new Settings()
    settings.update({ rules: { CA3001: { enabled: 'não', severity: 42 } } })

    assert.equal(settings.isEnabled(registered()), true)
    assert.equal(settings.severityOf(registered()), DiagnosticSeverity.Information)
  })

  it('ignora severidade que não existe na lista', () => {
    const settings = new Settings()
    settings.update({ rules: { CA3001: { severity: 'catastrófico' } } })

    assert.equal(settings.severityOf(registered()), DiagnosticSeverity.Information)
  })

  it('aceita configuração vazia, nula ou de forma inesperada', () => {
    const settings = new Settings()

    assert.doesNotThrow(() => settings.update(undefined))
    assert.doesNotThrow(() => settings.update(null))
    assert.doesNotThrow(() => settings.update('texto'))
    assert.doesNotThrow(() => settings.update({ rules: 'nada disso' }))
    assert.doesNotThrow(() => settings.update({ rules: { CA3001: null } }))

    assert.equal(settings.isEnabled(registered()), true)
  })
})

describe('Participação na correção em massa (FR-018, D9)', () => {
  it('sem configuração, participa só quem está na lista padrão', () => {
    // O padrão é uma LISTA, não "todas as regras ligadas": corrigir em massa é
    // mais invasivo que apontar, e uma regra nova entra fora da correção
    // automática até alguém decidir o contrário por escrito.
    const settings = new Settings()

    assert.equal(settings.participatesInFixAll('CA3001'), true)
    assert.equal(settings.participatesInFixAll('PJ0001'), false)
  })

  it('o usuário escolhe quem participa', () => {
    const settings = new Settings()
    settings.update({ fixAll: { includeRules: ['CA3001', 'PJ0001'] } })

    assert.equal(settings.participatesInFixAll('PJ0001'), true)
  })

  it('lista vazia significa NENHUMA regra na correção em massa', () => {
    // Vazio precisa ser distinguível de "não configurado", senão desligar tudo
    // seria impossível — a lista cairia no padrão e o usuário veria a correção
    // acontecer mesmo tendo pedido que não.
    const settings = new Settings()
    settings.update({ fixAll: { includeRules: [] } })

    assert.equal(settings.participatesInFixAll('CA3001'), false)
  })

  it('valor de tipo errado cai no padrão em vez de derrubar o servidor', () => {
    // Configuração é ENTRADA EXTERNA. Um número onde deveria haver lista não
    // pode virar exceção no meio do cálculo da lâmpada.
    const settings = new Settings()
    settings.update({ fixAll: { includeRules: 42 } })

    assert.equal(settings.participatesInFixAll('CA3001'), true)
  })

  it('entrada que não é texto é ignorada, e o resto da lista continua valendo', () => {
    const settings = new Settings()
    settings.update({ fixAll: { includeRules: ['CA3001', 7, null] } })

    assert.equal(settings.participatesInFixAll('CA3001'), true)
    assert.equal(settings.participatesInFixAll('PJ0001'), false)
  })
})
