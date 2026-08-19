import { SEVERITY_CHOICES, ruleConfigKey } from '@advpl-lint/server/out/src/config/settings'
import { RuleRegistry } from '@advpl-lint/server/out/src/rules/registry'
import { ca3001 } from '@advpl-lint/server/out/src/rules/ca3001'

/**
 * As chaves de `contributes.configuration` saem do REGISTRO DE REGRAS.
 *
 * Escrevê-las à mão no manifesto é o caminho curto para o defeito que o
 * Princípio IV proíbe: uma regra nova entra no motor, ninguém lembra da chave,
 * e ela nasce sem jeito de ser desligada. O inverso também acontece — chave
 * órfã no manifesto para uma regra que já saiu.
 *
 * O manifesto e o motor vivem em processos diferentes e nenhum compilador liga
 * os dois. Quem liga é esta verificação.
 */

/** O registro real do produto. Uma regra hoje; a lista cresce sozinha. */
function registry(): RuleRegistry {
  const instance = new RuleRegistry()
  instance.register(ca3001)
  return instance
}

/** As chaves de tradução que uma regra exige no NLS do manifesto. */
export function ruleNlsKeys(ruleId: string): string[] {
  return [`configuration.rules.${ruleId}.enabled`, `configuration.rules.${ruleId}.severity`]
}

export type ManifestProperties = Record<string, unknown>

/** O bloco de propriedades que o manifesto DEVE ter, derivado do registro. */
export async function buildRuleProperties(): Promise<ManifestProperties> {
  const properties: ManifestProperties = {}

  for (const rule of registry().all()) {
    const base = ruleConfigKey(rule.id)
    const [enabledKey, severityKey] = ruleNlsKeys(rule.id)

    properties[`${base}.enabled`] = {
      type: 'boolean',
      default: true,
      // Nenhuma string ao usuário é literal (Princípio V). `%chave%` é como o
      // manifesto do VS Code referencia a tradução.
      description: `%${enabledKey}%`,
    }

    properties[`${base}.severity`] = {
      type: 'string',
      enum: [...SEVERITY_CHOICES],
      default: 'default',
      description: `%${severityKey}%`,
    }
  }

  return properties
}

/** Prefixo das chaves governadas pela geração. O resto do manifesto é escrito à mão. */
const RULE_KEY_PREFIX = 'advplLint.rules.'

/**
 * O que está fora de lugar entre o manifesto e o registro.
 *
 * Lista vazia significa em dia. Cada item é uma frase pronta para ir ao
 * terminal — quem lê precisa saber qual chave e o que fazer, não só que "algo
 * divergiu".
 */
export async function findManifestDrift(properties: ManifestProperties): Promise<string[]> {
  const expected = await buildRuleProperties()
  const drift: string[] = []

  for (const [key, value] of Object.entries(expected)) {
    if (!(key in properties)) {
      drift.push(`falta no manifesto: "${key}" — a regra existe no registro e não tem chave própria`)
      continue
    }
    const atual = JSON.stringify(properties[key])
    const esperado = JSON.stringify(value)
    if (atual !== esperado) {
      drift.push(`diverge no manifesto: "${key}"\n  manifesto: ${atual}\n  registro:  ${esperado}`)
    }
  }

  for (const key of Object.keys(properties)) {
    if (!key.startsWith(RULE_KEY_PREFIX)) continue
    if (!(key in expected)) {
      drift.push(`sobra no manifesto: "${key}" — não existe regra correspondente no registro`)
    }
  }

  return drift
}
