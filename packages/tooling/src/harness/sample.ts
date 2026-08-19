import type { InventoryEntry } from './inventory'

/**
 * Amostragem estratificada por tamanho.
 *
 * Medir os ~35.000 fontes é desnecessário para estabilizar percentis e
 * transformaria a medição num ritual que ninguém executa (R5). Amostrar
 * uniformemente ao acaso seria pior: sub-representa a cauda, que é exatamente
 * onde o Princípio I corre risco.
 *
 * O tamanho em bytes é proxy barato do número de linhas e sai do inventário sem
 * abrir arquivo nenhum.
 */

/** Piso exigido por SC-006. */
export const MINIMUM_SAMPLE = 1000

/**
 * Quantas faixas de tamanho.
 *
 * 16 é fino o bastante para separar o fonte típico (p50 309 linhas) do fonte da
 * cauda (24.636), e grosso o bastante para cada faixa ainda ter itens de sobra
 * num corpus de dezenas de milhares de arquivos.
 */
export const DEFAULT_BUCKETS = 16

export type PercentileName = 'p50' | 'p90' | 'p95' | 'p99' | 'max'

export interface SampleResult {
  readonly entries: readonly InventoryEntry[]
  readonly strategy: string
  readonly buckets: number
}

export interface SampleOptions {
  readonly minimum?: number
  readonly buckets?: number
}

function describeStrategy(buckets: number): string {
  return `estratificada por tamanho em bytes, ${buckets} faixas de igual contagem`
}

/**
 * Ordenação canônica: por tamanho e, em empate, por caminho.
 *
 * O desempate por caminho não é preciosismo — sem ele, dois inventários com os
 * mesmos arquivos poderiam produzir amostras diferentes conforme a ordem em que
 * o sistema de arquivos os devolveu, e dois relatórios de linha de base
 * deixariam de ser comparáveis (Portão 4).
 */
function sortBySize(entries: readonly InventoryEntry[]): InventoryEntry[] {
  return [...entries].sort((a, b) => a.bytes - b.bytes || a.path.localeCompare(b.path))
}

export function percentileEntries(
  entries: readonly InventoryEntry[],
): Record<PercentileName, InventoryEntry> {
  const sorted = sortBySize(entries)
  if (sorted.length === 0) throw new Error('inventário vazio não tem percentis')

  const at = (percentile: number): InventoryEntry => {
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1))
    return sorted[index]!
  }

  return { p50: at(50), p90: at(90), p95: at(95), p99: at(99), max: sorted[sorted.length - 1]! }
}

export function stratifiedSample(
  entries: readonly InventoryEntry[],
  options?: SampleOptions,
): SampleResult {
  const minimum = options?.minimum ?? MINIMUM_SAMPLE
  const requested = options?.buckets ?? DEFAULT_BUCKETS

  if (entries.length === 0) {
    return { entries: [], strategy: describeStrategy(requested), buckets: requested }
  }

  const sorted = sortBySize(entries)
  if (sorted.length <= minimum) {
    return { entries: sorted, strategy: describeStrategy(requested), buckets: requested }
  }

  // Mais faixas que arquivos deixaria faixas vazias e derrubaria o tamanho da
  // amostra abaixo do inventário — que é o caso de corpus pequeno, onde a
  // resposta certa é medir tudo.
  const buckets = Math.min(requested, sorted.length)
  const strategy = describeStrategy(buckets)

  // Faixas de igual CONTAGEM, não de igual largura em bytes. A distribuição do
  // corpus é muito enviesada — p50 309 linhas, máximo 24.636 —, e faixas de
  // largura fixa jogariam quase tudo na primeira, deixando a cauda com um
  // punhado de itens espalhados por quinze faixas quase vazias.
  const perBucket = Math.ceil(minimum / buckets)
  const bucketSize = sorted.length / buckets
  const chosen = new Map<string, InventoryEntry>()

  // Cada faixa tem ao menos um item: `bucketSize` nunca é menor que 1, porque o
  // número de faixas já foi limitado ao número de arquivos.
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const start = Math.floor(bucket * bucketSize)
    const end = Math.min(sorted.length, Math.floor((bucket + 1) * bucketSize))
    const available = end - start

    const take = Math.min(perBucket, available)
    // Passo uniforme dentro da faixa: determinístico e sem sorteio. Sem
    // determinismo, dois relatórios não seriam comparáveis — a diferença
    // poderia vir do sorteio, não do código.
    const stride = available / take
    for (let k = 0; k < take; k += 1) {
      const entry = sorted[start + Math.floor(k * stride)]!
      chosen.set(entry.path, entry)
    }
  }

  // Os marcos entram à força. É a única garantia de que o relatório fala do
  // mesmo p95 e do mesmo maior arquivo que o inventário conhece — que é o que
  // o Princípio I cobra.
  for (const entry of Object.values(percentileEntries(sorted))) chosen.set(entry.path, entry)

  return { entries: sortBySize([...chosen.values()]), strategy, buckets }
}
