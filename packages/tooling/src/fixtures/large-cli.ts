import { join } from 'node:path'

import { DEFAULT_LARGE_SOURCE, writeLargeFixture } from './generate-large'

/**
 * Ponto de entrada de `npm run fixture:large`.
 *
 * O fonte de 24.636 linhas existe para a validação manual do Princípio I —
 * digitar nele por dez segundos e conferir que o editor não engasga. Ele é
 * GERADO, e nunca versionado: um arquivo desse tamanho dentro do repositório
 * cairia no portão `check:corpus`, e é essa a intenção.
 */

// __dirname aponta para packages/tooling/out/src/fixtures — cinco níveis até a raiz.
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..')

const DESTINO = join(
  REPO_ROOT,
  'packages',
  'extension',
  'test',
  'fixtures',
  'generated',
  'grande.prw',
)

void writeLargeFixture(DESTINO).then(
  () => {
    console.info(`fixture:large — ${DEFAULT_LARGE_SOURCE.lines} linhas em ${DESTINO}`)
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  },
)
