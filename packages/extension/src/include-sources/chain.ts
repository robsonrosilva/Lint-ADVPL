import { stat } from 'node:fs/promises'

/**
 * A cadeia de precedência com recuo (D8, FR-027).
 *
 * Quatro fontes, nesta ordem: a extensão oficial da TOTVS, a outra extensão
 * ADVPL, a chave própria deste produto, e as pastas do workspace.
 *
 * ## A regra que dá nome ao requisito
 *
 * A cadeia para na primeira fonte **utilizável**, não na primeira **presente**.
 * "Utilizável" é: pelo menos um diretório que EXISTE, depois de descartadas as
 * entradas vazias.
 *
 * Não é preciosismo. Medido na máquina de referência em 2026-08-19, as duas
 * primeiras fontes estão presentes e vazias — `includes: [""]` e
 * `advpl.environments: []`. Uma cadeia que parasse na presença da chave
 * deixaria `PJ0001` muda exatamente onde ela foi medida.
 *
 * ## E o que ela NÃO faz
 *
 * Não junta fontes. A precedência existe para que o usuário saiba de onde a
 * árvore veio; somar duas árvores diferentes produziria "ambíguo" para todo
 * arquivo presente nas duas, e a regra calaria justamente onde deveria falar.
 *
 * ## Por que isto vive no CLIENTE
 *
 * Três das quatro fontes só existem através da API do editor. Concentrar a
 * resolução aqui deixa a superfície sensível — o arquivo da fonte 1, que guarda
 * tokens — num lugar só, auditável de uma vez, e longe do motor. O que
 * atravessa a fronteira para o servidor é `ResolvedSources`, e nada mais.
 */

export interface IncludeSource {
  /** A precedência do FR-027. É ela que manda, não a ordem do vetor. */
  readonly order: 1 | 2 | 3 | 4
  /** Nome exibível ao usuário — é o que o FR-027c mostra. */
  readonly name: string
  /** Os diretórios que a fonte propõe. Lista vazia significa "recue". */
  resolve(): Promise<readonly string[]>
}

/** O que atravessa a fronteira cliente → servidor. Nada além disto. */
export interface ResolvedSources {
  readonly winner: string | null
  readonly directories: readonly string[]
}

/**
 * O caminho é um diretório que dá para varrer?
 *
 * `stat` e não `exists`: apontar um ARQUIVO é erro de configuração comum, e a
 * varredura do índice faria `opendir` nele e falharia. Recusar aqui, em
 * silêncio, é mais barato que tratar o erro lá adiante.
 *
 * ⚠️ Isto responde "existe", e é a única coisa para a qual uma consulta de
 * existência serve neste produto. Descobrir o NOME REAL de um arquivo por
 * consulta de existência é proibido (FR-020) — em sistema de arquivos
 * insensível a caixa ela responde "existe" para a grafia errada, que é o
 * mecanismo que `PJ0001` existe para pegar.
 */
export async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    // Inexistente, sem permissão, unidade de rede fora do ar: nos três casos a
    // resposta é a mesma, e nenhum deles é erro a mostrar ao usuário aqui.
    return false
  }
}

export async function resolveIncludeSources(
  sources: readonly IncludeSource[],
  isDirectory: (path: string) => Promise<boolean> = directoryExists,
): Promise<ResolvedSources> {
  for (const source of [...sources].sort((a, b) => a.order - b.order)) {
    let proposed: readonly string[]
    try {
      proposed = await source.resolve()
    } catch {
      // Formato de terceiro pode mudar sem aviso (FR-027d). Uma exceção vinda
      // de lá não derruba a resolução: ela recua.
      continue
    }

    const directories = await usableDirectories(proposed, isDirectory)
    if (directories.length === 0) continue

    return { winner: source.name, directories }
  }

  return { winner: null, directories: [] }
}

/** Descarta vazias, repetidas e as que não existem — nesta ordem. */
async function usableDirectories(
  proposed: readonly string[],
  isDirectory: (path: string) => Promise<boolean>,
): Promise<string[]> {
  const candidates = [...new Set(proposed.map((entry) => entry.trim()).filter((entry) => entry.length > 0))]

  const kept: string[] = []
  for (const candidate of candidates) {
    try {
      if (await isDirectory(candidate)) kept.push(candidate)
    } catch {
      // Sonda que lança — unidade de rede fora do ar, por exemplo — é o mesmo
      // que "não serve".
    }
  }
  return kept
}

/**
 * O relato que o FR-027c pede, sob demanda.
 *
 * A FRASE vem do pacote de tradução; o que este módulo monta é o DADO — o nome
 * da fonte e a lista de diretórios. É a fronteira do Princípio V: nenhuma
 * frase ao usuário nasce literal no código.
 */
export function describeResolution(
  resolution: ResolvedSources,
  t: (key: string, args?: Record<string, string | number>) => string,
): string {
  if (resolution.winner === null) return t('includeSources.none')

  return t('includeSources.inUse', {
    source: resolution.winner,
    count: resolution.directories.length,
    directories: resolution.directories.join('\n'),
  })
}
