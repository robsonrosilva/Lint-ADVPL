import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DiagnosticSeverity } from 'vscode-languageserver-types'

import { RuleRegistry, RuleDefinitionError, type RuleDefinition } from '../../../src/rules/registry'

// Uma regra `totvs` válida, para servir de base às variações abaixo.
function totvsRule(overrides: Partial<RuleDefinition> = {}): RuleDefinition {
  return {
    id: 'CA3001',
    origin: 'totvs',
    group: 'G3',
    catalogSeverity: 'MINOR',
    configKey: 'advplLint.rules.CA3001',
    messageKey: 'rule.CA3001.message',
    projectRationale: null,
    run: () => {},
    ...overrides,
  }
}

function projectRule(overrides: Partial<RuleDefinition> = {}): RuleDefinition {
  return {
    id: 'PJ1001',
    origin: 'project',
    group: null,
    catalogSeverity: null,
    configKey: 'advplLint.rules.PJ1001',
    messageKey: 'rule.PJ1001.message',
    projectRationale: 'O catálogo não verifica include obsoleto para a versão do Protheus em uso.',
    // Regra própria não tem catálogo de onde mapear, então declara a
    // severidade exibida. Ver o teste "exige severidade explícita" abaixo.
    defaultSeverity: DiagnosticSeverity.Warning,
    run: () => {},
    ...overrides,
  }
}

describe('Registro de regras — identidade', () => {
  it('aceita uma regra totvs bem formada e a devolve por id', () => {
    const registry = new RuleRegistry()
    registry.register(totvsRule())
    assert.equal(registry.get('CA3001')?.id, 'CA3001')
    assert.deepEqual(
      registry.all().map((r) => r.id),
      ['CA3001'],
    )
  })

  it('resolve a severidade padrão pela tabela, e não pelo catálogo', () => {
    // FR-014. A severidade exibida NUNCA é cópia literal da severidade do
    // catálogo — ela sai da tabela versionada.
    const registry = new RuleRegistry()
    registry.register(totvsRule())
    assert.equal(registry.get('CA3001')?.defaultSeverity, DiagnosticSeverity.Information)
  })

  it('rejeita identificador duplicado', () => {
    const registry = new RuleRegistry()
    registry.register(totvsRule())
    assert.throws(() => registry.register(totvsRule()), RuleDefinitionError)
  })

  it('rejeita chave de configuração duplicada', () => {
    const registry = new RuleRegistry()
    registry.register(totvsRule())
    assert.throws(
      () => registry.register(totvsRule({ id: 'CA1004', catalogSeverity: 'MINOR' })),
      RuleDefinitionError,
    )
  })

  it('rejeita regra sem chave de configuração própria', () => {
    // Princípio IV: regra sem chave própria MUST ser rejeitada.
    const registry = new RuleRegistry()
    assert.throws(() => registry.register(totvsRule({ configKey: '' })), RuleDefinitionError)
  })
})

describe('Registro de regras — origem totvs', () => {
  it('exige grupo do catálogo', () => {
    const registry = new RuleRegistry()
    assert.throws(() => registry.register(totvsRule({ group: null })), RuleDefinitionError)
  })

  it('exige severidade de catálogo', () => {
    const registry = new RuleRegistry()
    assert.throws(() => registry.register(totvsRule({ catalogSeverity: null })), RuleDefinitionError)
  })

  it('rejeita justificativa de regra própria numa regra de catálogo', () => {
    const registry = new RuleRegistry()
    assert.throws(
      () => registry.register(totvsRule({ projectRationale: 'não deveria estar aqui' })),
      RuleDefinitionError,
    )
  })

  it('rejeita severidade de catálogo que a tabela não mapeia', () => {
    // Invariante 6 do contracts/regra.md: registrar regra cuja severidade não
    // tem entrada na tabela é erro DE REGISTRO, não valor padrão silencioso.
    const registry = new RuleRegistry()
    assert.throws(
      () => registry.register(totvsRule({ id: 'CA2050', catalogSeverity: 'INFO', configKey: 'advplLint.rules.CA2050' })),
      RuleDefinitionError,
    )
  })
})

describe('Registro de regras — origem project', () => {
  it('aceita regra própria bem formada', () => {
    const registry = new RuleRegistry()
    registry.register(projectRule())
    assert.equal(registry.get('PJ1001')?.origin, 'project')
  })

  it('exige identificador na faixa reservada PJ####', () => {
    // D2 da spec 001. Os prefixos em uso no catálogo oficial são CA, BG e CS.
    const registry = new RuleRegistry()
    for (const bad of ['XX1001', 'PJ1', 'PJ10011', 'CA3002']) {
      assert.throws(
        () => registry.register(projectRule({ id: bad, configKey: `advplLint.rules.${bad}` })),
        RuleDefinitionError,
        `${bad} não deveria ser aceito como id de regra própria`,
      )
    }
  })

  it('exige a justificativa do que ela pega e o padrão não pega', () => {
    // Princípio III: sem essa frase, a regra é duplicata não declarada.
    const registry = new RuleRegistry()
    assert.throws(() => registry.register(projectRule({ projectRationale: null })), RuleDefinitionError)
    assert.throws(() => registry.register(projectRule({ projectRationale: '   ' })), RuleDefinitionError)
  })

  it('rejeita grupo de catálogo numa regra própria', () => {
    const registry = new RuleRegistry()
    assert.throws(() => registry.register(projectRule({ group: 'G3' })), RuleDefinitionError)
  })

  it('usa a severidade explícita, já que não há catálogo de onde mapear', () => {
    const registry = new RuleRegistry()
    registry.register(projectRule({ defaultSeverity: DiagnosticSeverity.Error }))
    assert.equal(registry.get('PJ1001')?.defaultSeverity, DiagnosticSeverity.Error)
  })

  it('exige severidade explícita quando não há catálogo', () => {
    // Sem catálogo e sem declaração, não existe severidade de onde partir — e
    // assumir uma seria o mesmo pecado que a tabela de severidade evita.
    const registry = new RuleRegistry()
    const { defaultSeverity: _omitted, ...withoutSeverity } = projectRule()
    assert.throws(() => registry.register(withoutSeverity as RuleDefinition), RuleDefinitionError)
  })

  it('a recusa CITA o identificador da regra (FR-035)', () => {
    // A mensagem é o que aparece a quem quebrou o registro. Dizer só "faltou
    // severidade", com dezenas de regras carregando no mesmo laço, obriga quem
    // lê a caçar qual delas — e o registro sabe exatamente qual é.
    const registry = new RuleRegistry()
    const { defaultSeverity: _omitted, ...withoutSeverity } = projectRule({ id: 'PJ4242' })

    assert.throws(
      () => registry.register({ ...withoutSeverity, configKey: 'advplLint.rules.PJ4242' } as RuleDefinition),
      (error: unknown) => {
        assert.ok(error instanceof RuleDefinitionError)
        assert.match(error.message, /PJ4242/)
        assert.match(error.message, /severidade/i)
        return true
      },
    )
  })

  it('regra própria pode nascer DESLIGADA, e o padrão continua sendo ligada (FR-036)', () => {
    // Princípio VI: regra sem taxa de falso positivo medida entra desligada.
    // O registro é a fonte única disso — quem gera as chaves do manifesto e
    // quem responde "está ligada?" leem daqui, não de duas listas paralelas.
    const registry = new RuleRegistry()
    registry.register(projectRule({ enabledByDefault: false }))
    assert.equal(registry.get('PJ1001')?.enabledByDefault, false)

    const outro = new RuleRegistry()
    outro.register(projectRule())
    assert.equal(outro.get('PJ1001')?.enabledByDefault, true, 'sem declarar, a regra nasce ligada')
  })
})

describe('Registro de regras — o que ele NÃO valida', () => {
  it('não toca no sistema de arquivos', () => {
    // As invariantes 4 (chave nos quatro idiomas) e 5 (documentação existe)
    // pertencem aos portões check:nls e check:docs, que rodam em `tooling`.
    // O registro roda dentro do MOTOR, e o Princípio I proíbe I/O ali.
    // Este teste existe para que ninguém "melhore" o registro adicionando uma
    // conferência de arquivo — que é como o legado chegou a readFileSync por
    // fonte do projeto.
    const source = RuleRegistry.prototype.register.toString()
    assert.ok(!/readFile|existsSync|statSync|require\(['"]node:fs/.test(source))
  })
})

describe('Registro de regras — rejeições de forma', () => {
  it('rejeita identificador vazio', () => {
    const registry = new RuleRegistry()
    assert.throws(() => registry.register(totvsRule({ id: '' })), RuleDefinitionError)
  })

  it('rejeita chave de mensagem vazia ou só com espaço', () => {
    // Sem chave de mensagem não há o que traduzir, e o Princípio V garante que
    // o identificador cru nunca chega à tela — então a regra não pode existir.
    const registry = new RuleRegistry()
    assert.throws(() => registry.register(totvsRule({ messageKey: '' })), RuleDefinitionError)
    assert.throws(() => registry.register(totvsRule({ messageKey: '   ' })), RuleDefinitionError)
  })

  it('rejeita chave de configuração só com espaço', () => {
    const registry = new RuleRegistry()
    assert.throws(() => registry.register(totvsRule({ configKey: '   ' })), RuleDefinitionError)
  })

  it('devolve undefined para identificador não registrado', () => {
    const registry = new RuleRegistry()
    assert.equal(registry.get('CA9999'), undefined)
  })

  it('a mensagem do erro nomeia a regra rejeitada', () => {
    const registry = new RuleRegistry()
    assert.throws(() => registry.register(totvsRule({ group: null })), /CA3001/)
  })
})

describe('Registro de regras — sobreposição de severidade', () => {
  it('aceita sobreposição com razão registrada e ela vence a tabela', () => {
    // A tabela mapeia severidade de CATÁLOGO. Volume é outro eixo, que ela não
    // enxerga: duas regras MINOR podem disparar uma vez por projeto e setenta
    // vezes por arquivo.
    const registry = new RuleRegistry()
    registry.register(
      totvsRule({
        severityOverride: { severity: DiagnosticSeverity.Hint, reason: '71,9% das linhas medidas' },
      }),
    )
    assert.equal(registry.get('CA3001')?.defaultSeverity, DiagnosticSeverity.Hint)
  })

  it('REJEITA sobreposição sem razão', () => {
    // Sobreposição sem justificativa é a "cópia literal disfarçada" que o
    // Princípio III veda. Quem sobrepõe diz por quê, por escrito.
    const registry = new RuleRegistry()
    assert.throws(
      () => registry.register(totvsRule({ severityOverride: { severity: DiagnosticSeverity.Hint, reason: '' } })),
      RuleDefinitionError,
    )
    assert.throws(
      () => registry.register(totvsRule({ severityOverride: { severity: DiagnosticSeverity.Hint, reason: '   ' } })),
      RuleDefinitionError,
    )
  })

  it('sem sobreposição, a tabela continua mandando', () => {
    const registry = new RuleRegistry()
    registry.register(totvsRule())
    assert.equal(registry.get('CA3001')?.defaultSeverity, DiagnosticSeverity.Information)
  })

  it('regra própria não sobrepõe tabela — ela não tem tabela de onde sair', () => {
    const registry = new RuleRegistry()
    assert.throws(
      () =>
        registry.register(
          projectRule({ severityOverride: { severity: DiagnosticSeverity.Hint, reason: 'qualquer' } }),
        ),
      RuleDefinitionError,
    )
  })
})

describe('CA3001 — a severidade sai da tabela, sem sobreposição', () => {
  it('nasce como Information, o que a tabela mapeia para MINOR', async () => {
    const { ca3001 } = await import('../../../src/rules/ca3001')
    const registry = new RuleRegistry()
    registry.register(ca3001)
    assert.equal(registry.get('CA3001')?.defaultSeverity, DiagnosticSeverity.Information)
  })

  it('não sobrepõe a tabela', async () => {
    // A sobreposição para `Hint` existiu entre 2026-08-19 e a mesma data, e foi
    // revertida por um motivo que a medição de volume não enxergava: o painel
    // de Problemas do VS Code lista Error, Warning e Information — e NÃO lista
    // Hint. Como Hint, a única regra do produto ficava invisível no lugar onde
    // o usuário vai procurar. O mecanismo de sobreposição continua existindo e
    // testado acima; quem não o usa é esta regra.
    const { ca3001 } = await import('../../../src/rules/ca3001')
    assert.equal(ca3001.severityOverride, undefined)
  })
})
