import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { measureAll, measureEngineStartupMs } from '../../src/harness/measure-pool'

async function corpusTemporario(quantidade: number): Promise<{ dir: string; paths: string[] }> {
  const dir = await mkdtemp(join(tmpdir(), 'advpl-pool-'))
  const paths: string[] = []
  for (let i = 0; i < quantidade; i += 1) {
    const path = join(dir, `fonte-${i}.prw`)
    const conteudo = ['#INCLUDE "TOTVS.CH"', `User Function Teste${i}()`, 'Return', ''].join('\r\n')
    await writeFile(path, conteudo, 'latin1')
    paths.push(path)
  }
  return { dir, paths }
}

describe('Pool de medição (R5)', () => {
  it('mede todos os fontes distribuídos entre os trabalhadores', async () => {
    const { dir, paths } = await corpusTemporario(5)
    try {
      const measurements = await measureAll(paths, { repetitions: 1, workers: 2 })

      assert.equal(measurements.length, 5)
      for (const measurement of measurements) {
        assert.equal(measurement.hits, 1, 'cada fonte tem exatamente um #INCLUDE em caixa alta')
        assert.equal(measurement.lines, 4)
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('devolve as medições na ordem dos caminhos pedidos', async () => {
    // Sem ordem estável, o relatório mudaria de conteúdo entre execuções sobre
    // o mesmo corpus — e duas linhas de base deixariam de ser comparáveis.
    const { dir, paths } = await corpusTemporario(4)
    try {
      const measurements = await measureAll(paths, { repetitions: 1, workers: 3 })

      assert.deepEqual(
        measurements.map((m) => m.path),
        paths,
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('não derruba a medição inteira por causa de um fonte ilegível', async () => {
    // Num corpus de dezenas de milhares de arquivos, um caso desses é rotina.
    const { dir, paths } = await corpusTemporario(2)
    try {
      const comInexistente = [...paths, join(dir, 'este-nao-existe.prw')]
      const measurements = await measureAll(comInexistente, { repetitions: 1, workers: 2 })

      assert.equal(measurements.length, 2)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('devolve lista vazia sem subir trabalhador nenhum', async () => {
    const measurements = await measureAll([], { repetitions: 1 })

    assert.deepEqual(measurements, [])
  })

  it('dimensiona o pool e as repetições sozinho quando nada é pedido', async () => {
    const { dir, paths } = await corpusTemporario(2)
    try {
      const measurements = await measureAll(paths)

      assert.equal(measurements.length, 2)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('Pool de medição — quando um trabalhador morre', () => {
  it('propaga a falha em vez de ficar esperando para sempre', async () => {
    // Um pool que engolisse o erro do trabalhador deixaria `npm run baseline`
    // pendurado sem dizer nada — que é pior que falhar.
    const dir = await mkdtemp(join(tmpdir(), 'advpl-pool-'))
    try {
      const workerQuebrado = join(dir, 'worker-quebrado.js')
      await writeFile(workerQuebrado, 'throw new Error("trabalhador quebrado")\n', 'utf8')

      await assert.rejects(
        () => measureAll(['/qualquer/fonte.prw'], { repetitions: 1, workers: 1, workerPath: workerQuebrado }),
        /quebrado/,
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('Custo de partida do motor (SC-003)', () => {
  it('mede subir o thread e carregar o motor', async () => {
    // A ativação da extensão DENTRO do editor é medida pelo teste de
    // integração, porque envolve o VS Code. O que este harness mede é o pedaço
    // que pertence ao servidor — e é esse que o código deste repositório
    // controla.
    const startupMs = await measureEngineStartupMs()

    assert.ok(Number.isFinite(startupMs))
    assert.ok(startupMs > 0)
  })

  it('relata progresso enquanto mede', async () => {
    const { dir, paths } = await corpusTemporario(3)
    const progresso: number[] = []
    try {
      await measureAll(paths, {
        repetitions: 1,
        workers: 2,
        onProgress: (done) => progresso.push(done),
      })

      assert.equal(progresso.length, 3)
      assert.deepEqual([...progresso].sort((a, b) => a - b), [1, 2, 3])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
