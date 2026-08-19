import { opendir as fsOpendir, stat as fsStat, readFile, writeFile } from 'node:fs/promises'
import type { Dir, Stats } from 'node:fs'
import { extname, join } from 'node:path'

/**
 * Inventário do corpus: que fontes existem e quanto pesam.
 *
 * Roda UMA VEZ e guarda o resultado em cache local (R5). A varredura ingênua
 * dos ~93.000 arquivos já foi medida e estourou 2 minutos de relógio; o que a
 * torna barata é filtrar por extensão DURANTE o percurso, decidindo pelo nome
 * antes de perguntar o tamanho ao sistema de arquivos.
 */

/** Extensões que a extensão analisa (constituição, Arquitetura). */
export const SOURCE_EXTENSIONS: readonly string[] = ['.prw', '.prx', '.prg', '.apw', '.apl', '.tlpp']

/** Nome do inventário em cache. Local, NUNCA versionado. */
export const CACHE_FILE = '.corpus-cache.json'

/** Sobe quando o formato do cache muda, para não ler estrutura antiga como boa. */
const CACHE_VERSION = 1

export interface InventoryEntry {
  /** Caminho absoluto do fonte. Nunca sai daqui para o relatório (FR-023). */
  readonly path: string
  readonly bytes: number
}

export interface Inventory {
  readonly root: string
  readonly builtAt: string
  readonly entries: readonly InventoryEntry[]
  readonly fromCache: boolean
}

export interface InventoryDeps {
  readonly opendir: (path: string) => Promise<Dir>
  readonly stat: (path: string) => Promise<Stats>
}

export interface LoadInventoryParams {
  readonly root: string
  readonly cachePath: string
  readonly refresh?: boolean
  readonly deps?: Partial<InventoryDeps>
  readonly now?: () => Date
}

export function isSourceFile(name: string): boolean {
  return SOURCE_EXTENSIONS.includes(extname(name).toLowerCase())
}

export async function scanCorpus(
  root: string,
  deps?: Partial<InventoryDeps>,
): Promise<InventoryEntry[]> {
  const opendir = deps?.opendir ?? fsOpendir
  const stat = deps?.stat ?? fsStat

  const entries: InventoryEntry[] = []
  const pending: string[] = [root]

  while (pending.length > 0) {
    const dir = pending.pop()!

    let handle: Dir
    try {
      handle = await opendir(dir)
    } catch {
      // Diretório sem permissão ou removido durante o percurso não derruba a
      // varredura inteira — num corpus de dezenas de milhares de arquivos, um
      // caso desses é rotina, não exceção.
      continue
    }

    for await (const dirent of handle) {
      const full = join(dir, dirent.name)
      if (dirent.isDirectory()) {
        pending.push(full)
        continue
      }
      if (!dirent.isFile()) continue

      // AQUI está o que torna o percurso barato: a decisão sai do NOME, que já
      // veio junto com a entrada do diretório. Perguntar o tamanho de todos os
      // ~93.000 arquivos para descartar 60% depois é o que custava 2 minutos.
      if (!isSourceFile(dirent.name)) continue

      const stats = await stat(full)
      entries.push({ path: full, bytes: stats.size })
    }
  }

  return entries
}

interface CachedInventory {
  readonly version: number
  readonly root: string
  readonly builtAt: string
  readonly entries: readonly InventoryEntry[]
}

function isUsableCache(value: unknown, root: string): value is CachedInventory {
  if (typeof value !== 'object' || value === null) return false
  const cache = value as Partial<CachedInventory>
  if (cache.version !== CACHE_VERSION) return false
  // Raiz diferente é inventário de outro corpus. Reaproveitá-lo produziria
  // percentis de um material que não é o que se pediu para medir.
  if (cache.root !== root) return false
  if (typeof cache.builtAt !== 'string') return false
  return Array.isArray(cache.entries)
}

export async function loadInventory(params: LoadInventoryParams): Promise<Inventory> {
  const now = params.now ?? ((): Date => new Date())

  if (params.refresh !== true) {
    try {
      const cached: unknown = JSON.parse(await readFile(params.cachePath, 'utf8'))
      if (isUsableCache(cached, params.root)) {
        return { root: cached.root, builtAt: cached.builtAt, entries: cached.entries, fromCache: true }
      }
    } catch {
      // Cache ausente ou corrompido é caso normal, não erro: varre de novo.
    }
  }

  const entries = await scanCorpus(params.root, params.deps)
  const inventory: CachedInventory = {
    version: CACHE_VERSION,
    root: params.root,
    builtAt: now().toISOString(),
    // Só caminho e tamanho. Guardar conteúdo faria do cache uma cópia do corpus
    // no disco de quem clonou — e o cache é justamente um arquivo que ninguém
    // olha (FR-023).
    entries: entries.map((entry) => ({ path: entry.path, bytes: entry.bytes })),
  }

  await writeFile(params.cachePath, JSON.stringify(inventory), 'utf8')

  return { root: inventory.root, builtAt: inventory.builtAt, entries: inventory.entries, fromCache: false }
}
