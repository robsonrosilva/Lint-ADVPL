import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { RuleRegistry } from '@advpl-lint/server/out/src/rules/registry'
import { ca3001 } from '@advpl-lint/server/out/src/rules/ca3001'

/**
 * O Portão 6 da constituição, na parte que dá para automatizar.
 *
 * "Regra que existe no código mas não no README, ou descrita no README e
 * ausente do código, bloqueia o merge. Vale nos dois sentidos."
 *
 * Os dois sentidos importam por razões diferentes. Regra sem página: o usuário
 * clica no identificador do diagnóstico e cai num link quebrado — pior que não
 * ter link. Página sem regra: a documentação promete ao leitor um
 * comportamento que o código não tem.
 */

export const DOCS_DIR = 'docs/regras'

/** Os identificadores que o produto realmente registra. */
export function registeredRuleIds(): string[] {
  const registry = new RuleRegistry()
  registry.register(ca3001)
  return registry.all().map((rule) => rule.id)
}

/** As páginas existentes, pelo identificador que nomeia cada arquivo. */
export async function listRuleDocs(repoRoot: string): Promise<string[]> {
  const entries = await readdir(join(repoRoot, DOCS_DIR))
  return entries.filter((name) => name.endsWith('.md')).map((name) => name.slice(0, -'.md'.length))
}

export interface DocsCheckOptions {
  readonly ruleIds: readonly string[]
  readonly docFiles: readonly string[]
}

export async function findDocsProblems(options: DocsCheckOptions): Promise<string[]> {
  const problems: string[] = []
  const docs = new Set(options.docFiles)
  const rules = new Set(options.ruleIds)

  for (const ruleId of [...rules].sort()) {
    if (docs.has(ruleId)) continue
    problems.push(
      `regra "${ruleId}" registrada e sem página em ${DOCS_DIR}/${ruleId}.md — ` +
        'o link do diagnóstico levaria a lugar nenhum',
    )
  }

  for (const doc of [...docs].sort()) {
    if (rules.has(doc)) continue
    problems.push(
      `${DOCS_DIR}/${doc}.md documenta uma regra que não existe no registro — ` +
        'documentação órfã promete o que o código não faz',
    )
  }

  return problems
}
