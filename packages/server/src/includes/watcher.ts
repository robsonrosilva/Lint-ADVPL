import { FileChangeType, type FileEvent } from 'vscode-languageserver'

import { INCLUDE_EXTENSIONS } from './scan'

/**
 * A atualização incremental do índice (FR-024).
 *
 * ## O risco que este arquivo mitiga
 *
 * O plano registra o observador de sistema de arquivos como **o risco desta
 * spec**: observar dezenas de milhares de arquivos é fonte clássica de
 * travamento — Princípio I sob outro nome, e o defeito que matou a versão
 * anterior.
 *
 * A mitigação é de desenho, e está inteira aqui: o evento vira **invalidação de
 * um diretório**, nunca reindexação total. Numa árvore de 35 mil arquivos,
 * revarrer tudo a cada include salvo é o legado com outro nome. Este módulo
 * sequer tem como dizer "tudo" — o que ele devolve é uma lista de diretórios.
 *
 * ## E o que ele descarta
 *
 * O índice guarda **nome e diretório**, nunca conteúdo. Logo:
 *
 * - `Changed` não interessa: editar um include não muda nome nenhum;
 * - arquivo que não é include não interessa: senão salvar um `.prw` viraria uma
 *   revarredura por tecla.
 *
 * Renomear chega como `Deleted` mais `Created` — inclusive a renomeação que
 * muda **só a caixa**, que é justamente o conserto que o usuário aplica depois
 * de `PJ0001` apontar. Sem enxergá-la, a regra continuaria acusando o que já
 * foi corrigido.
 */

/** O que o índice precisa expor para este módulo. */
export interface InvalidatableIndex {
  invalidateDirectory(directory: string): void
}

function isIncludeFile(path: string): boolean {
  const lower = path.toLowerCase()
  return INCLUDE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/**
 * Caminho de sistema de arquivos a partir de um URI `file:`.
 *
 * Escrito à mão, e não trazido de `vscode-uri`: o plano desta spec declara
 * **nenhuma dependência nova**, e o que é preciso aqui cabe em oito linhas —
 * tirar o esquema, decodificar o percent-encoding e desfazer a barra que o URI
 * põe antes da letra de unidade no Windows (`file:///d%3A/x` ⟹ `d:/x`).
 *
 * `undefined` para qualquer coisa que não seja um URI de arquivo. O evento pode
 * vir de um documento sem título ou de um esquema virtual, e nenhum dos dois
 * tem diretório a invalidar.
 */
export function fileUriToPath(uri: string): string | undefined {
  if (!uri.startsWith('file://')) return undefined

  let path: string
  try {
    path = decodeURIComponent(uri.slice('file://'.length))
  } catch {
    // Percent-encoding malformado não derruba o tratamento do lote.
    return undefined
  }

  // `/d:/inc/a.ch` ⟹ `d:/inc/a.ch`. Sem isto, o diretório invalidado nunca
  // casaria com o diretório indexado, e o índice ficaria eternamente velho.
  return /^\/[a-zA-Z]:/.test(path) ? path.slice(1) : path
}

/** O diretório de um caminho de arquivo, com barra normal. */
function directoryOf(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const cut = normalized.lastIndexOf('/')
  return cut <= 0 ? normalized.slice(0, cut + 1) : normalized.slice(0, cut)
}

/**
 * Os diretórios afetados por um lote de eventos, sem repetição.
 *
 * Sem a deduplicação, uma cópia em massa — que dispara centenas de eventos no
 * mesmo diretório — produziria centenas de revarreduras da mesma pasta.
 */
export function directoriesToInvalidate(events: readonly FileEvent[]): string[] {
  const affected = new Set<string>()

  for (const event of events) {
    if (event.type === FileChangeType.Changed) continue

    const path = fileUriToPath(event.uri)
    if (path === undefined) continue
    if (!isIncludeFile(path)) continue
    affected.add(directoryOf(path))
  }

  return [...affected]
}

/** Aplica o lote ao índice: uma invalidação por diretório afetado. */
export function handleWatchedFileChanges(
  events: readonly FileEvent[],
  index: InvalidatableIndex,
): void {
  for (const directory of directoriesToInvalidate(events)) index.invalidateDirectory(directory)
}
