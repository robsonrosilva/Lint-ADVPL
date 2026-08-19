import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { findCorpusProblems, listVersionedFiles } from './corpus'

/**
 * Ponto de entrada de `npm run check:corpus`.
 *
 * Só fiação: lista o que o git conhece, lê o texto de cada candidato e chama a
 * verificação. A lógica e o teste vivem em `corpus.ts`.
 */

// __dirname aponta para packages/tooling/out/src/checks — cinco níveis até a raiz.
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..')

async function main(): Promise<number> {
  const files = await listVersionedFiles(REPO_ROOT)
  const problems = await findCorpusProblems({
    files,
    // `latin1` aqui é deliberado e não é o encoding do produto: a leitura só
    // precisa contar linhas e achar o cabeçalho, e este modo nunca falha nem
    // troca byte por caractere de substituição. Fixture de verdade é lida como
    // CP1252 pelo motor, que é outro caminho.
    readText: (file) => readFile(join(REPO_ROOT, file), 'latin1'),
  })

  if (problems.length === 0) {
    console.info(`check:corpus — ${files.length} arquivos versionados, nenhum fonte do corpus entre eles.`)
    return 0
  }

  console.error(`check:corpus — ${problems.length} problema(s):`)
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
