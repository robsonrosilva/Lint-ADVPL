import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { findL10nPathProblems, findNlsProblems, mechanismsOf } from './nls'
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
 * 3. **O pacote de tradução é encontrável** — o `"l10n"` do manifesto aponta
 *    para onde o build grava. Até 2026-08-20 ele não apontava, e a tradução de
 *    runtime da extensão nunca carregava: `l10n.t` devolvia a chave crua ao
 *    usuário, que é o modo de falha do Princípio V. As conferências 1 e 2 não
 *    pegavam isso — elas comparam chaves, não sabem se alguém acha o arquivo.
 *
 * Só fiação: lê os arquivos, chama as verificações e devolve o código de saída.
 * A lógica, e o teste dela, vivem em `nls.ts` e `manifest.ts` — é por isso que
 * este arquivo consta da lista de exclusão de cobertura.
 */

// __dirname aponta para packages/tooling/out/src/checks — cinco níveis até a raiz.
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..')

interface ExtensionManifest {
  readonly l10n?: unknown
  readonly contributes?: { configuration?: { properties?: ManifestProperties } }
}

async function readManifest(): Promise<ExtensionManifest> {
  return JSON.parse(
    await readFile(join(REPO_ROOT, 'packages', 'extension', 'package.json'), 'utf8'),
  ) as ExtensionManifest
}

async function main(): Promise<number> {
  const manifest = await readManifest()
  const bundleScript = await readFile(
    join(REPO_ROOT, 'packages', 'tooling', 'scripts', 'bundle.mjs'),
    'utf8',
  )

  const problems = [
    ...(await findNlsProblems(mechanismsOf(REPO_ROOT))),
    ...(await findManifestDrift(manifest.contributes?.configuration?.properties ?? {})),
    ...findL10nPathProblems({ manifestValue: manifest.l10n, bundleScript }),
  ]

  if (problems.length === 0) {
    console.info(
      'check:nls — os quatro idiomas concordam, o manifesto está em dia com o registro ' +
        'e o pacote de tradução está onde o manifesto diz.',
    )
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
