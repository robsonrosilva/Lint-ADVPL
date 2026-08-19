// Empacotamento com esbuild: um arquivo por processo.
//
// Princípio I, seção Restrições Técnicas: "carregar centenas de arquivos na
// ativação é custo direto no orçamento". A ativação carrega UM módulo.
//
// `packages/tooling` fica deliberadamente de fora — harness e verificações
// nunca entram no .vsix nem no custo de ativação.

import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const production = process.argv.includes('--production')

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  // `vscode` é fornecido pelo editor em tempo de execução; empacotá-lo
  // quebraria a extensão.
  external: ['vscode'],
  minify: production,
  sourcemap: production ? false : 'linked',
  logLevel: 'info',
}

await Promise.all([
  build({
    ...common,
    entryPoints: [join(REPO_ROOT, 'packages/extension/src/extension.ts')],
    outfile: join(REPO_ROOT, 'packages/extension/dist/extension.js'),
  }),
  build({
    ...common,
    entryPoints: [join(REPO_ROOT, 'packages/server/src/server.ts')],
    outfile: join(REPO_ROOT, 'packages/extension/dist/server.js'),
  }),
])
