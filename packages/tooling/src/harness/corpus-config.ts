import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * De onde a medição descobre o corpus.
 *
 * O corpus é externo, local e NUNCA versionado (constituição, seção "Corpus de
 * Medição"): são fontes padrão do Protheus, e trazê-los para dentro do
 * repositório é problema de licença e de exposição.
 *
 * Precedência (R5 da research.md): `ADVPL_LINT_CORPUS` vence; senão
 * `corpus.local.json` na raiz; senão o corpus é declarado indisponível — e
 * indisponível NÃO é erro de execução (FR-024).
 */

export const CORPUS_ENV_VAR = 'ADVPL_LINT_CORPUS'
export const CORPUS_CONFIG_FILE = 'corpus.local.json'

export type CorpusSource = 'env' | 'file'

export interface CorpusConfig {
  readonly root: string
  readonly source: CorpusSource
}

export type CorpusResolution =
  | { readonly available: true; readonly config: CorpusConfig }
  | { readonly available: false; readonly reason: string }

export interface ResolveCorpusOptions {
  readonly repoRoot: string
  readonly env?: NodeJS.ProcessEnv
}

function unavailable(reason: string): CorpusResolution {
  return { available: false, reason }
}

/**
 * Confere que o caminho configurado é mesmo um diretório.
 *
 * Recuar em silêncio para a próxima fonte quando o caminho não existe
 * esconderia um caminho errado — e a medição sairia sobre material que não é o
 * que o mantenedor pediu, sem ninguém perceber.
 */
async function validateRoot(root: string, source: CorpusSource): Promise<CorpusResolution> {
  let stats
  try {
    stats = await stat(root)
  } catch {
    return unavailable(`o caminho do corpus não existe: ${root}`)
  }
  if (!stats.isDirectory()) return unavailable(`o caminho do corpus não é um diretório: ${root}`)
  return { available: true, config: { root, source } }
}

export async function resolveCorpus(options: ResolveCorpusOptions): Promise<CorpusResolution> {
  const env = options.env ?? process.env

  // Variável exportada vazia é o caso comum de script mal escrito. Tratá-la como
  // "definida" faria a medição apontar para a raiz do sistema de arquivos.
  const fromEnv = env[CORPUS_ENV_VAR]?.trim()
  if (fromEnv) return validateRoot(fromEnv, 'env')

  const configPath = join(options.repoRoot, CORPUS_CONFIG_FILE)

  let raw: string
  try {
    raw = await readFile(configPath, 'utf8')
  } catch {
    return unavailable(
      `corpus não configurado: defina a variável ${CORPUS_ENV_VAR} ou crie ${CORPUS_CONFIG_FILE} na raiz`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return unavailable(`${CORPUS_CONFIG_FILE} não é JSON válido`)
  }

  const root =
    typeof parsed === 'object' && parsed !== null && typeof (parsed as { root?: unknown }).root === 'string'
      ? (parsed as { root: string }).root.trim()
      : ''

  if (!root) return unavailable(`${CORPUS_CONFIG_FILE} não declara a chave "root" com o caminho do corpus`)

  return validateRoot(root, 'file')
}
