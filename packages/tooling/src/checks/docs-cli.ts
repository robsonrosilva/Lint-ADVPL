import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { findDocsProblems, findReadmeProblems, listRuleDocs, registeredRuleIds } from './docs'

/**
 * Ponto de entrada de `npm run check:docs`.
 *
 * Só fiação: junta o registro de regras com as páginas em disco e chama a
 * verificação. A lógica e o teste vivem em `docs.ts`.
 */

// __dirname aponta para packages/tooling/out/src/checks — cinco níveis até a raiz.
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..')

async function main(): Promise<number> {
  const ruleIds = registeredRuleIds()
  const problems = [
    ...(await findDocsProblems({ ruleIds, docFiles: await listRuleDocs(REPO_ROOT) })),
    ...findReadmeProblems(ruleIds, await readFile(join(REPO_ROOT, 'README.md'), 'utf8')),
  ]

  if (problems.length === 0) {
    console.info(`check:docs — ${ruleIds.length} regra(s), cada uma com sua página e listada no README.`)
    return 0
  }

  console.error(`check:docs — ${problems.length} problema(s):`)
  for (const problem of problems) console.error(`  - ${problem}`)
  return 1
}

void main().then(
  (code) => {
    process.exitCode = code
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  },
)
