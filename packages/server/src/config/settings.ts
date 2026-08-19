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

interface RuleSettings {
  readonly enabled?: boolean
  readonly severity?: DiagnosticSeverity | null
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export class Settings {
  private byRuleId = new Map<string, RuleSettings>()

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
  }

  isEnabled(rule: RegisteredRule): boolean {
    return this.byRuleId.get(rule.id)?.enabled ?? true
  }

  severityOf(rule: RegisteredRule): DiagnosticSeverity {
    // Sem escolha do usuário, vale o padrão resolvido no registro — que saiu da
    // tabela versionada, nunca de cópia literal da severidade de catálogo.
    return this.byRuleId.get(rule.id)?.severity ?? rule.defaultSeverity
  }
}
