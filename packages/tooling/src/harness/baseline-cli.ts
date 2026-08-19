import { join } from 'node:path'

import { runBaseline } from './run'

/**
 * Ponto de entrada de `npm run baseline`.
 *
 * Só fiação: resolve a raiz do repositório, chama o encadeamento e devolve o
 * código de saída. Toda a lógica — e todo o teste — vive em `run.ts`. É por
 * isso que este arquivo consta da lista de exclusão de cobertura: ele não tem
 * nada que valha asserção, e cobri-lo exigiria subir um processo só para
 * observar `process.exit`.
 */

// __dirname aponta para packages/tooling/out/src/harness — cinco níveis até a raiz.
const repoRoot = join(__dirname, '..', '..', '..', '..', '..')

void runBaseline({ repoRoot }).then(
  (result) => {
    process.exitCode = result.exitCode
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  },
)
