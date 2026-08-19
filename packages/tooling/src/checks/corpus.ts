import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

/**
 * O portão contra vazamento do corpus (FR-027).
 *
 * Fonte padrão do Protheus dentro deste repositório é problema de licença e de
 * exposição — e o jeito como isso acontece na prática é sem ninguém decidir que
 * aconteceria: um arquivo arrastado para o lugar errado, uma fixture "derivada"
 * que na verdade foi colada, um caso de teste grande demais para ter sido
 * escrito à mão.
 *
 * Três regras, e cada uma pega um desses acidentes (R6 da research.md).
 *
 * ⚠️ O que este portão NÃO faz: julgar se uma fixture foi escrita ou copiada.
 * Isso nenhuma verificação automática consegue. O cabeçalho obrigatório força a
 * DECLARAÇÃO no instante em que a cópia seria feita — que é quando a decisão é
 * tomada, e é o máximo que dá para automatizar.
 */

/** Extensões de fonte ADVPL/TLPP, incluindo include. */
export const SOURCE_EXTENSIONS: readonly string[] = [
  '.prw',
  '.prx',
  '.prg',
  '.apw',
  '.apl',
  '.tlpp',
  '.ch',
]

/** Fixture autoral que passe disto quase certamente foi colada: a mediana do corpus é 309 linhas. */
export const MAX_FIXTURE_LINES = 300

/** A marca que abre toda fixture. */
export const AUTHORSHIP_MARKER = 'FIXTURE AUTORAL'

/** Quantas linhas do topo são lidas em busca do cabeçalho. */
const HEADER_WINDOW = 5

/** O único lugar onde fonte ADVPL pode estar versionado. */
const FIXTURE_DIR = /^packages\/[^/]+\/test\/fixtures\//

export function isFixturePath(file: string): boolean {
  return FIXTURE_DIR.test(file.replace(/\\/g, '/'))
}

function isSourceFile(file: string): boolean {
  const lower = file.toLowerCase()
  // A caixa da extensão não conta: boa parte do corpus real usa `.PRW` e `.PRX`
  // maiúsculos, que é justamente o material mais comum de arrastar sem querer.
  return SOURCE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export interface CorpusCheckOptions {
  /** Caminhos versionados, relativos à raiz e com barra normal. */
  readonly files: readonly string[]
  readonly readText: (file: string) => Promise<string>
}

const exec = promisify(execFile)

/**
 * Os arquivos que o git conhece.
 *
 * Perguntar ao git, e não varrer o disco, é o ponto: o que interessa é o que
 * está VERSIONADO. Um fonte do corpus solto no diretório de trabalho, ignorado
 * pelo `.gitignore`, não é o problema que este portão resolve.
 */
export async function listVersionedFiles(repoRoot: string): Promise<string[]> {
  const { stdout } = await exec('git', ['ls-files'], { cwd: repoRoot, maxBuffer: 32 * 1024 * 1024 })
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export async function findCorpusProblems(options: CorpusCheckOptions): Promise<string[]> {
  const problems: string[] = []

  for (const file of options.files) {
    const normalized = file.replace(/\\/g, '/')
    if (!isSourceFile(normalized)) continue

    if (!isFixturePath(normalized)) {
      problems.push(
        `"${normalized}": fonte ADVPL/TLPP versionado fora de packages/*/test/fixtures/. ` +
          'Fonte do corpus NUNCA entra no repositório (FR-027).',
      )
      continue
    }

    const text = await options.readText(normalized)
    const lines = text.split(/\r\n|\n|\r/)
    const header = lines.slice(0, HEADER_WINDOW).join('\n')

    if (!header.includes(AUTHORSHIP_MARKER)) {
      problems.push(
        `"${normalized}": sem a declaração de autoria nas primeiras ${HEADER_WINDOW} linhas. ` +
          `Toda fixture abre com "${AUTHORSHIP_MARKER}".`,
      )
    } else if (!/prop[oó]sito/i.test(header)) {
      // Só cobrado de quem já declarou autoria: exigir as duas coisas de uma
      // vez produziria dois erros para o mesmo arquivo e uma mensagem confusa.
      problems.push(
        `"${normalized}": o cabeçalho não diz o propósito — que construção do corpus ela reproduz.`,
      )
    }

    // Uma linha final vazia é artefato do fim de arquivo, não conteúdo.
    const count = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length
    if (count > MAX_FIXTURE_LINES) {
      problems.push(
        `"${normalized}": ${count} linhas, acima do limite de ${MAX_FIXTURE_LINES}. ` +
          'Caso grande de propósito é GERADO em tempo de teste, nunca versionado.',
      )
    }
  }

  return problems
}
