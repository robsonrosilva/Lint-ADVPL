import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { findNlsProblems, mechanismsOf } from './nls'
import { findManifestDrift, type ManifestProperties } from './manifest'

/**
 * Ponto de entrada de `npm run check:nls`.
 *
 * Junta as duas conferências que protegem a fronteira entre o motor e o
 * manifesto:
 *
 * 1. **Os quatro idiomas concordam**, nos dois mecanismos de tradução
 *    (Princípio V).
 * 2. **O manifesto não divergiu do registro de regras** — regra sem chave de
 *    desligamento é rejeitada pelo Princípio IV, e chave órfã aponta regra que
 *    já saiu.
 *
 * Só fiação: lê os arquivos, chama as verificações e devolve o código de saída.
 * A lógica, e o teste dela, vivem em `nls.ts` e `manifest.ts` — é por isso que
 * este arquivo consta da lista de exclusão de cobertura.
 */

// __dirname aponta para packages/tooling/out/src/checks — cinco níveis até a raiz.
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..')

async function manifestProperties(): Promise<ManifestProperties> {
  const raw = JSON.parse(
    await readFile(join(REPO_ROOT, 'packages', 'extension', 'package.json'), 'utf8'),
  ) as { contributes?: { configuration?: { properties?: ManifestProperties } } }
  return raw.contributes?.configuration?.properties ?? {}
}

async function main(): Promise<number> {
  const problems = [
    ...(await findNlsProblems(mechanismsOf(REPO_ROOT))),
    ...(await findManifestDrift(await manifestProperties())),
  ]

  if (problems.length === 0) {
    console.info('check:nls — os quatro idiomas concordam e o manifesto está em dia com o registro.')
    return 0
  }

  console.error(`check:nls — ${problems.length} problema(s):`)
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
