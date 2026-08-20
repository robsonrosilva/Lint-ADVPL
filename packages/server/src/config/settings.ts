import { DiagnosticSeverity } from 'vscode-languageserver-types'

import type { RegisteredRule } from '../rules/registry'

/**
 * A configuração do usuário, do lado do motor.
 *
 * Princípio IV: toda regra é desligável individualmente e tem severidade
 * configurável. Este módulo é quem responde as duas perguntas que a análise faz
 * por documento — "esta regra está ligada?" e "com que severidade?".
 *
 * Ele trata a configuração como **entrada externa**, porque é: vem do arquivo
 * de configurações do usuário e pode conter qualquer coisa. Valor de tipo
 * errado NUNCA desliga uma regra por acidente e NUNCA derruba o servidor no
 * meio da análise — cai no padrão e segue.
 */

/** Raiz do espaço de nomes. Declarada uma vez, usada em todo lugar. */
export const CONFIG_ROOT = 'advplLint'

export type SeverityChoice = 'default' | 'error' | 'warning' | 'information' | 'hint'

/** As escolhas oferecidas ao usuário, na ordem em que aparecem no manifesto. */
export const SEVERITY_CHOICES: readonly SeverityChoice[] = [
  'default',
  'error',
  'warning',
  'information',
  'hint',
]

/** A chave própria daquela regra em `contributes.configuration`. */
export function ruleConfigKey(ruleId: string): string {
  return `${CONFIG_ROOT}.rules.${ruleId}`
}

const SEVERITY_BY_CHOICE: Readonly<Record<string, DiagnosticSeverity>> = {
  error: DiagnosticSeverity.Error,
  warning: DiagnosticSeverity.Warning,
  information: DiagnosticSeverity.Information,
  hint: DiagnosticSeverity.Hint,
}

/**
 * A escolha do usuário como severidade do protocolo.
 *
 * `null` significa "não decida por mim": é o caso de `default`, em que quem
 * manda é a tabela versionada, e também o de qualquer valor que não exista.
 */
export function toDiagnosticSeverity(choice: unknown): DiagnosticSeverity | null {
  if (typeof choice !== 'string') return null
  return SEVERITY_BY_CHOICE[choice] ?? null
}

/**
 * Quem participa da correção em massa quando o usuário não disse nada.
 *
 * É uma LISTA, e não "todas as regras ligadas", por decisão registrada (D9):
 * corrigir em massa é mais invasivo que apontar. `CA3001` está aqui porque
 * trocar a diretiva é inerte por medição — 71,9% dos fontes do corpus usam
 * caixa alta e compilam, logo o pré-processador não distingue. `PJ0001` fica
 * de fora porque trocar o NOME do arquivo muda o que o compilador vai procurar
 * (FR-040).
 *
 * Regra nova nasce fora até alguém decidir o contrário por escrito, e o custo
 * dessa decisão é uma linha aqui.
 */
export const DEFAULT_FIX_ALL_RULES: readonly string[] = ['CA3001']

interface RuleSettings {
  readonly enabled?: boolean
  readonly severity?: DiagnosticSeverity | null
}

/**
 * Lê `advplLint.fixAll.includeRules`.
 *
 * `undefined` significa "o usuário não configurou"; um conjunto vazio significa
 * "configurou e não quer nenhuma". Valor de tipo errado cai no primeiro caso —
 * configuração é entrada externa e não pode derrubar o cálculo da lâmpada.
 */
function readFixAllRules(root: Record<string, unknown> | undefined): ReadonlySet<string> | undefined {
  const raw = asRecord(root?.['fixAll'])?.['includeRules']
  if (!Array.isArray(raw)) return undefined
  return new Set(raw.filter((item): item is string => typeof item === 'string'))
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export class Settings {
  private byRuleId = new Map<string, RuleSettings>()
  /**
   * `undefined` quando o usuário não configurou nada — que é DIFERENTE de uma
   * lista vazia. Sem essa distinção, "nenhuma regra na correção em massa" seria
   * indistinguível de "não mexi nisso", e quem pedisse para desligar tudo veria
   * a correção acontecer mesmo assim.
   */
  private fixAllRules: ReadonlySet<string> | undefined

  /**
   * Recebe o bloco `advplLint` inteiro, como o cliente o envia.
   *
   * Substitui o estado anterior por completo, em vez de mesclar: mesclar faria
   * uma chave apagada pelo usuário continuar valendo até o editor reiniciar —
   * exatamente o comportamento que a US3 existe para evitar.
   */
  update(raw: unknown): void {
    const next = new Map<string, RuleSettings>()
    const rules = asRecord(asRecord(raw)?.['rules'])

    for (const [ruleId, value] of Object.entries(rules ?? {})) {
      const entry = asRecord(value)
      if (!entry) continue

      const enabled = entry['enabled']
      const severity = toDiagnosticSeverity(entry['severity'])

      next.set(ruleId, {
        ...(typeof enabled === 'boolean' ? { enabled } : {}),
        ...(severity === null ? {} : { severity }),
      })
    }

    this.byRuleId = next
    this.fixAllRules = readFixAllRules(asRecord(raw))
  }

  /**
   * A regra entra na correção em massa e na correção ao salvar? (FR-018)
   *
   * É uma pergunta SEPARADA de "a regra está ligada", de propósito: apontar e
   * corrigir sem o usuário olhar são atos de invasividade diferente.
   */
  participatesInFixAll(ruleId: string): boolean {
    return (this.fixAllRules ?? new Set(DEFAULT_FIX_ALL_RULES)).has(ruleId)
  }

  isEnabled(rule: RegisteredRule): boolean {
    // Sem escolha do usuário, quem manda é o REGISTRO. Assumir `true` aqui
    // desfaria em silêncio a decisão do Princípio VI de fazer regra sem
    // medição nascer desligada.
    return this.byRuleId.get(rule.id)?.enabled ?? rule.enabledByDefault
  }

  severityOf(rule: RegisteredRule): DiagnosticSeverity {
    // Sem escolha do usuário, vale o padrão resolvido no registro — que saiu da
    // tabela versionada, nunca de cópia literal da severidade de catálogo.
    return this.byRuleId.get(rule.id)?.severity ?? rule.defaultSeverity
  }
}
