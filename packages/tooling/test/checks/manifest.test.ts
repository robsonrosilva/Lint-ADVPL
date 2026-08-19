import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  buildRuleProperties,
  findManifestDrift,
  ruleNlsKeys,
} from '../../src/checks/manifest'

// __dirname aponta para packages/tooling/out/test/checks — cinco níveis até a raiz.
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..')
const MANIFEST = join(REPO_ROOT, 'packages', 'extension', 'package.json')

async function manifestProperties(): Promise<Record<string, unknown>> {
  const raw = JSON.parse(await readFile(MANIFEST, 'utf8')) as {
    contributes: { configuration: { properties: Record<string, unknown> } }
  }
  return raw.contributes.configuration.properties
}

describe('Chaves de configuração geradas a partir do registro (Princípio IV)', () => {
  it('gera duas chaves por regra: desligamento e severidade', async () => {
    const properties = await buildRuleProperties()

    assert.ok(properties['advplLint.rules.CA3001.enabled'])
    assert.ok(properties['advplLint.rules.CA3001.severity'])
  })

  it('a chave de desligamento é booleana e nasce ligada', async () => {
    const properties = await buildRuleProperties()
    const enabled = properties['advplLint.rules.CA3001.enabled']

    assert.deepEqual(enabled, {
      type: 'boolean',
      default: true,
      description: '%configuration.rules.CA3001.enabled%',
    })
  })

  it('a chave de severidade oferece as cinco escolhas, com "default" primeiro', async () => {
    const properties = await buildRuleProperties()
    const severity = properties['advplLint.rules.CA3001.severity'] as { enum: string[]; default: string }

    assert.deepEqual(severity.enum, ['default', 'error', 'warning', 'information', 'hint'])
    assert.equal(severity.default, 'default')
  })

  it('o texto visível ao usuário passa pelo NLS, nunca escrito no manifesto', async () => {
    // Princípio V: nenhuma string ao usuário é literal. `%chave%` é como o
    // manifesto do VS Code referencia a tradução.
    const properties = await buildRuleProperties()

    for (const [key, value] of Object.entries(properties)) {
      const description = (value as { description?: string }).description
      assert.match(description ?? '', /^%.+%$/, `${key} não passa pelo NLS`)
    }
  })

  it('nomeia as chaves de tradução que cada regra exige', () => {
    assert.deepEqual(ruleNlsKeys('CA3001'), [
      'configuration.rules.CA3001.enabled',
      'configuration.rules.CA3001.severity',
    ])
  })
})

describe('O manifesto não pode divergir do registro', () => {
  it('o manifesto versionado está em dia com o registro', async () => {
    // Este é o teste que impede o defeito real: uma regra nova entra no motor,
    // ninguém acrescenta a chave no manifesto, e a regra nasce sem jeito de ser
    // desligada — o que o Princípio IV proíbe. Ou o contrário: chave órfã no
    // manifesto para uma regra que já não existe.
    const drift = await findManifestDrift(await manifestProperties())

    assert.deepEqual(drift, [], `manifesto fora de sincronia:\n${drift.join('\n')}`)
  })

  it('acusa chave que falta no manifesto', async () => {
    const semRegra = { 'advplLint.trace.server': { type: 'string' } }

    const drift = await findManifestDrift(semRegra)

    assert.ok(drift.some((item) => item.includes('CA3001') && /falta/i.test(item)))
  })

  it('acusa chave de regra que não existe mais no registro', async () => {
    const properties = { ...(await manifestProperties()) }
    properties['advplLint.rules.CA9999.enabled'] = { type: 'boolean', default: true }

    const drift = await findManifestDrift(properties)

    assert.ok(drift.some((item) => item.includes('CA9999') && /sobra|não existe/i.test(item)))
  })

  it('acusa chave de regra com forma diferente da gerada', async () => {
    const properties = { ...(await manifestProperties()) }
    properties['advplLint.rules.CA3001.enabled'] = { type: 'boolean', default: false }

    const drift = await findManifestDrift(properties)

    assert.ok(drift.some((item) => item.includes('CA3001.enabled') && /diverge/i.test(item)))
  })

  it('não reclama de chave que não é de regra', async () => {
    // `trace.server` e `log.level` são escritas à mão e continuam sendo — a
    // geração governa só o que sai do registro de regras.
    const drift = await findManifestDrift(await manifestProperties())

    assert.ok(!drift.some((item) => item.includes('trace.server') || item.includes('log.level')))
  })
})
