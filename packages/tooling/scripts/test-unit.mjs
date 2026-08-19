import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Roda a suíte unitária com o portão de cobertura.
 *
 * Existe por um motivo só: as exclusões vinham repetidas à mão no `package.json`
 * E declaradas em `coverage-exclusions.json`, e duas listas que precisam
 * concordar acabam divergindo. Já tinham divergido — em 2026-08-19, três
 * exclusões da camada de extensão estavam no script sem razão registrada em
 * lugar nenhum, o que o Princípio VI proíbe.
 *
 * Agora a lista versionada, com a razão de cada item, é a **única** fonte. Um
 * `npm script` não consegue ler JSON; este runner consegue.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Limiar do Princípio VI. Abaixo disso o merge está bloqueado. */
const THRESHOLD = 98

const INCLUDES = [
  'packages/server/out/src/**',
  'packages/tooling/out/src/**',
  'packages/extension/out/src/**',
]

const TEST_GLOBS = [
  'packages/server/out/test/**/*.test.js',
  'packages/tooling/out/test/**/*.test.js',
  'packages/extension/out/test/unit/**/*.test.js',
]

const { exclusions } = JSON.parse(readFileSync(join(REPO_ROOT, 'coverage-exclusions.json'), 'utf8'))

// A lista declara o caminho do FONTE; a cobertura mede o compilado. A troca de
// extensão é a única tradução, e fica aqui para que quem escreve a razão pense
// no arquivo que existe de verdade.
const excluded = exclusions.map((item) => item.path.replace(/\.ts$/, '.js'))

const args = [
  '--test',
  '--experimental-test-coverage',
  ...INCLUDES.map((glob) => `--test-coverage-include=${glob}`),
  ...excluded.map((file) => `--test-coverage-exclude=${file}`),
  `--test-coverage-lines=${THRESHOLD}`,
  `--test-coverage-functions=${THRESHOLD}`,
  `--test-coverage-branches=${THRESHOLD}`,
  // Argumentos extras vêm ANTES dos globs, e a ordem é o ponto: flag depois de
  // caminho é ignorada em silêncio pelo Node. Era por isso que
  // `npm run test:unit -- --test-coverage-lines=100` saía com SUCESSO e dava a
  // impressão de que o portão estava quebrado. Aqui eles sobrepõem os padrões,
  // que é o que quem os digita espera.
  ...process.argv.slice(2),
  ...TEST_GLOBS,
]

const result = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: REPO_ROOT })
process.exit(result.status ?? 1)
