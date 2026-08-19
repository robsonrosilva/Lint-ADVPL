import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import type { InventoryEntry } from '../../src/harness/inventory'
import { MINIMUM_SAMPLE, percentileEntries, stratifiedSample } from '../../src/harness/sample'

/**
 * Inventário sintético com distribuição parecida com a do corpus real: muitos
 * fontes pequenos, cauda longa. Os números do corpus são p50 309, p90 1.699,
 * p95 2.933, p99 7.951 e máximo 24.636 linhas.
 */
function synthetic(count: number): InventoryEntry[] {
  const entries: InventoryEntry[] = []
  for (let i = 0; i < count; i += 1) {
    // Crescimento acelerado no fim, para produzir cauda de verdade.
    const bytes = Math.round(200 + Math.pow(i / count, 6) * 900_000)
    entries.push({ path: `/corpus/fonte-${i}.prw`, bytes })
  }
  return entries
}

describe('Amostragem — tamanho mínimo (SC-006)', () => {
  it('soma no mínimo 1.000 fontes quando o inventário é maior que isso', () => {
    const result = stratifiedSample(synthetic(35_000))

    assert.ok(
      result.entries.length >= MINIMUM_SAMPLE,
      `amostra de ${result.entries.length} está abaixo do mínimo de ${MINIMUM_SAMPLE}`,
    )
  })

  it('o mínimo declarado é 1.000', () => {
    assert.equal(MINIMUM_SAMPLE, 1000)
  })

  it('devolve o inventário inteiro quando ele é menor que o mínimo', () => {
    const entries = synthetic(120)
    const result = stratifiedSample(entries)

    assert.equal(result.entries.length, 120)
  })

  it('devolve amostra vazia para inventário vazio, sem quebrar', () => {
    const result = stratifiedSample([])

    assert.equal(result.entries.length, 0)
  })
})

describe('Amostragem — cobre a cauda (R5)', () => {
  it('inclui os fontes de p50, p90, p95, p99 e o maior de todos', () => {
    // Amostragem uniformemente aleatória sub-representa a cauda, que é
    // exatamente onde o Princípio I corre risco. Daí a estratificação.
    const entries = synthetic(35_000)
    const marcos = percentileEntries(entries)
    const result = stratifiedSample(entries)
    const amostrados = new Set(result.entries.map((e) => e.path))

    for (const [nome, entry] of Object.entries(marcos)) {
      assert.ok(amostrados.has(entry.path), `o fonte de ${nome} ficou de fora da amostra`)
    }
  })

  it('o maior arquivo do inventário é o maior da amostra', () => {
    const entries = synthetic(35_000)
    const result = stratifiedSample(entries)

    const maiorInventario = Math.max(...entries.map((e) => e.bytes))
    const maiorAmostra = Math.max(...result.entries.map((e) => e.bytes))

    assert.equal(maiorAmostra, maiorInventario)
  })

  it('distribui a amostra por faixas de tamanho, não concentra nas pequenas', () => {
    const entries = synthetic(35_000)
    const result = stratifiedSample(entries)

    const maiorInventario = Math.max(...entries.map((e) => e.bytes))
    const grandes = result.entries.filter((e) => e.bytes > maiorInventario / 2)

    assert.ok(grandes.length > 0, 'nenhum fonte da metade superior de tamanho entrou na amostra')
  })
})

describe('Amostragem — é determinística', () => {
  it('duas execuções sobre o mesmo inventário produzem a mesma amostra', () => {
    // Sem determinismo, dois relatórios de linha de base não são comparáveis:
    // a diferença poderia vir do sorteio e não do código. O Portão 4 compara
    // entregas, então a régua não pode se mexer sozinha.
    const entries = synthetic(35_000)

    const primeira = stratifiedSample(entries)
    const segunda = stratifiedSample(entries)

    assert.deepEqual(
      primeira.entries.map((e) => e.path),
      segunda.entries.map((e) => e.path),
    )
  })

  it('declara a estratégia usada, para o relatório poder registrá-la (FR-025)', () => {
    const result = stratifiedSample(synthetic(35_000))

    assert.match(result.strategy, /estratificada/i)
    assert.ok(result.buckets > 1)
  })

  it('aceita outro número de faixas e o declara', () => {
    const result = stratifiedSample(synthetic(35_000), { buckets: 4, minimum: 100 })

    assert.equal(result.buckets, 4)
    assert.match(result.strategy, /4 faixas/)
  })

  it('nunca usa mais faixas que arquivos', () => {
    // Mais faixas que arquivos deixaria faixas vazias e derrubaria a amostra
    // abaixo do inventário — e corpus pequeno é justamente o caso em que a
    // resposta certa é medir tudo.
    const result = stratifiedSample(synthetic(6), { minimum: 1 })

    assert.equal(result.buckets, 6)
    assert.equal(result.entries.length, 6)
  })
})

describe('Percentis do inventário', () => {
  it('aponta o fonte de cada percentil sobre a ordenação por tamanho', () => {
    const entries: InventoryEntry[] = [
      { path: '/c/e.prw', bytes: 500 },
      { path: '/c/a.prw', bytes: 100 },
      { path: '/c/d.prw', bytes: 400 },
      { path: '/c/b.prw', bytes: 200 },
      { path: '/c/c.prw', bytes: 300 },
    ]

    const marcos = percentileEntries(entries)

    assert.equal(marcos.max.bytes, 500)
    assert.ok(marcos.p50.bytes >= 200 && marcos.p50.bytes <= 400)
    assert.ok(marcos.p95.bytes >= marcos.p50.bytes)
    assert.ok(marcos.p99.bytes >= marcos.p95.bytes)
  })

  it('desempata por caminho quando dois fontes têm o mesmo tamanho', () => {
    // Sem desempate, dois inventários com os mesmos arquivos poderiam produzir
    // amostras diferentes conforme a ordem em que o sistema de arquivos os
    // devolveu — e duas linhas de base deixariam de ser comparáveis.
    const entries: InventoryEntry[] = [
      { path: '/c/z.prw', bytes: 100 },
      { path: '/c/a.prw', bytes: 100 },
    ]

    const marcos = percentileEntries(entries)

    assert.equal(marcos.max.path, '/c/z.prw')
    assert.equal(marcos.p50.path, '/c/a.prw')
  })

  it('recusa calcular percentil de inventário vazio', () => {
    // Devolver zeros seria pior: o relatório sairia com números que parecem
    // medição e não são.
    assert.throws(() => percentileEntries([]), /vazio/i)
  })

  it('funciona com um único fonte', () => {
    const marcos = percentileEntries([{ path: '/c/unico.prw', bytes: 42 }])

    assert.equal(marcos.p50.bytes, 42)
    assert.equal(marcos.max.bytes, 42)
  })
})
