import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_WORKERS,
  collectHits,
  measureAnalysisMs,
  measureCancellationStopMs,
  measureSource,
  median,
  workerCount,
} from '../../src/harness/measure'

const COM_DIRETIVA = ['#INCLUDE "TOTVS.CH"', '#INCLUDE "ACADEF.CH"', 'User Function Teste()', 'Return', ''].join('\r\n')

const SEM_DIRETIVA = ['#include "totvs.ch"', '#include "acadef.ch"', 'User Function Teste()', 'Return', ''].join('\r\n')

/** Relógio falso: cada leitura avança um passo fixo, e dá para empurrá-lo à mão. */
function fakeClock(steps: readonly number[]) {
  let index = 0
  let current = 0
  const clock = {
    now(): number {
      const step = steps[index % steps.length] ?? 0
      index += 1
      const value = current
      current += step
      return value
    },
    advance(ms: number): void {
      current += ms
    },
  }
  return clock
}

describe('Mediana', () => {
  it('devolve o valor central de uma lista ímpar', () => {
    assert.equal(median([3, 1, 2]), 2)
  })

  it('devolve a média dos dois centrais de uma lista par', () => {
    assert.equal(median([1, 2, 3, 4]), 2.5)
  })

  it('devolve zero para lista vazia, sem quebrar', () => {
    assert.equal(median([]), 0)
  })

  it('não é afetada por um único valor absurdo', () => {
    // É por isso que o relatório usa mediana e não média: uma pausa de coleta de
    // lixo no meio de uma repetição não pode virar "regressão de desempenho".
    assert.equal(median([10, 10, 10, 10, 9000]), 10)
  })
})

describe('Medição — repetições (contrato do relatório, regra 4)', () => {
  it('usa a mediana de várias repetições, não uma medição única', async () => {
    // Passos: 5, 5, 40, 5, 5 — a mediana é 5, a média seria 12.
    const clock = fakeClock([5, 5, 40, 5, 5])

    const ms = await measureAnalysisMs({ text: COM_DIRETIVA, repetitions: 5, now: () => clock.now() })

    assert.equal(ms, 5)
  })

  it('roda o número de repetições pedido', async () => {
    let leituras = 0
    const clock = fakeClock([7])

    await measureAnalysisMs({
      text: COM_DIRETIVA,
      repetitions: 3,
      now: () => {
        leituras += 1
        return clock.now()
      },
    })

    // Duas leituras de relógio por repetição: antes e depois da análise.
    assert.equal(leituras, 6)
  })
})

describe('Medição — o que entra no cronômetro (contrato do relatório, regra 3)', () => {
  it('a leitura do disco fica FORA do cronômetro', async () => {
    // Se a leitura entrasse na conta, a medição diria mais sobre o disco da
    // máquina que sobre o custo da análise — e a linha de base perderia o
    // sentido de comparar código com código.
    const clock = fakeClock([5])

    const measurement = await measureSource({
      path: '/corpus/qualquer.prw',
      repetitions: 1,
      now: () => clock.now(),
      readSource: async () => {
        // A "leitura" custa 500 ms de relógio.
        clock.advance(500)
        return COM_DIRETIVA
      },
    })

    assert.equal(measurement.withRuleMs, 5)
    assert.ok(measurement.withRuleMs < 500, 'o tempo da leitura vazou para dentro da medição')
  })
})

describe('Medição — custo incremental da regra (FR-021)', () => {
  it('é a diferença entre rodar com a regra e rodar sem ela', async () => {
    const measurement = await measureSource({
      path: '/corpus/qualquer.prw',
      repetitions: 3,
      readSource: async () => COM_DIRETIVA,
    })

    assert.equal(
      measurement.incrementalMs,
      measurement.withRuleMs - measurement.withoutRuleMs,
      'o custo incremental precisa ser a diferença medida, não uma estimativa',
    )
  })

  it('conta os disparos da regra no fonte medido (FR-022)', async () => {
    const measurement = await measureSource({
      path: '/corpus/qualquer.prw',
      repetitions: 1,
      readSource: async () => COM_DIRETIVA,
    })

    assert.equal(measurement.hits, 2)
  })

  it('não conta disparo em fonte já correto', async () => {
    const measurement = await measureSource({
      path: '/corpus/qualquer.prw',
      repetitions: 1,
      readSource: async () => SEM_DIRETIVA,
    })

    assert.equal(measurement.hits, 0)
  })

  it('registra tamanho em linhas do fonte medido', async () => {
    const measurement = await measureSource({
      path: '/corpus/qualquer.prw',
      repetitions: 1,
      readSource: async () => COM_DIRETIVA,
    })

    assert.equal(measurement.lines, 5)
  })
})

describe('Medição — dimensionamento do pool (R5)', () => {
  it('usa núcleos menos dois, deixando a máquina respirar', () => {
    assert.equal(workerCount(16), 12)
    assert.equal(workerCount(8), 6)
    assert.equal(workerCount(4), 2)
  })

  it('nunca passa do teto de 12', () => {
    // Acima disso o ganho some e a disputa por memória começa a atrapalhar a
    // própria medição.
    assert.equal(workerCount(64), MAX_WORKERS)
    assert.equal(MAX_WORKERS, 12)
  })

  it('nunca desce abaixo de um trabalhador', () => {
    assert.equal(workerCount(1), 1)
    assert.equal(workerCount(2), 1)
  })
})

describe('Medição — leitura do fonte em CP1252', () => {
  it('lê o arquivo do disco como CP1252, e não como latin1', async () => {
    // Os dois divergem em 0x80–0x9F, faixa do travessão e das aspas
    // tipográficas. Ler errado desloca a coluna de todo diagnóstico seguinte na
    // linha — e o legado errava exatamente nisto.
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')

    const dir = await mkdtemp(join(tmpdir(), 'advpl-cp1252-'))
    try {
      const path = join(dir, 'fonte.prw')
      // 0x97 é travessão em CP1252 e caractere de controle em ISO-8859-1.
      const bytes = Buffer.from([0x2f, 0x2f, 0x20, 0x97, 0x0d, 0x0a, ...Buffer.from('#INCLUDE "T.CH"\r\n', 'latin1')])
      await writeFile(path, bytes)

      const measurement = await measureSource({ path, repetitions: 1 })

      assert.equal(measurement.hits, 1)
      assert.equal(measurement.lines, 3)
      assert.ok(measurement.bytes > 0)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('usa o número padrão de repetições também ao medir um fonte', async () => {
    const measurement = await measureSource({
      path: '/corpus/qualquer.prw',
      readSource: async () => COM_DIRETIVA,
    })

    assert.equal(measurement.hits, 2)
  })

  it('mede sem a regra quando pedido', async () => {
    const ms = await measureAnalysisMs({ text: COM_DIRETIVA, repetitions: 1, withRule: false })

    assert.ok(ms >= 0)
  })

  it('usa o número padrão de repetições quando nenhum é pedido', async () => {
    let leituras = 0
    await measureAnalysisMs({
      text: COM_DIRETIVA,
      now: () => {
        leituras += 1
        return leituras
      },
    })

    // Cinco repetições, duas leituras de relógio cada.
    assert.equal(leituras, 10)
  })
})

describe('Coleta de trechos para revisão (FR-022)', () => {
  it('devolve um trecho por disparo, com a linha em base 1', async () => {
    const hits = await collectHits('/corpus/qualquer.prw', async () => COM_DIRETIVA)

    assert.equal(hits.length, 2)
    assert.equal(hits[0]?.line, 1)
    assert.equal(hits[1]?.line, 2)
  })

  it('leva o identificador da regra que disparou', async () => {
    const hits = await collectHits('/corpus/qualquer.prw', async () => COM_DIRETIVA)

    assert.equal(hits[0]?.ruleId, 'CA3001')
  })

  it('leva a linha inteira em que houve o disparo', async () => {
    // O revisor precisa do contexto para julgar. É por isso que este material é
    // local: ele carrega fonte padrão do Protheus (FR-023).
    const hits = await collectHits('/corpus/qualquer.prw', async () => COM_DIRETIVA)

    assert.equal(hits[0]?.excerpt, '#INCLUDE "TOTVS.CH"')
  })

  it('sai vazia em fonte sem disparo', async () => {
    const hits = await collectHits('/corpus/qualquer.prw', async () => SEM_DIRETIVA)

    assert.deepEqual(hits, [])
  })

  it('acerta a linha em fonte com LF, e não só com CRLF', async () => {
    const comLf = ['User Function Teste()', '#INCLUDE "TOTVS.CH"', 'Return'].join('\n')
    const hits = await collectHits('/corpus/qualquer.prw', async () => comLf)

    assert.equal(hits[0]?.line, 2)
    assert.equal(hits[0]?.excerpt, '#INCLUDE "TOTVS.CH"')
  })
})

describe('Medição — parada após cancelamento (SC-009)', () => {
  it('a análise cancelada devolve resultado de cancelamento, e rápido', async () => {
    // O número que interessa não é quanto ela demoraria: é quanto tempo ela
    // ainda gasta DEPOIS de o usuário ter digitado. O legado gastava tudo e
    // descartava o resultado no fim — que é o oposto de parar.
    // 100.000 linhas porque a análise só é cancelável DEPOIS de ceder o laço, e
    // ela só cede ao passar de 10 ms. O maior fonte do corpus — 27.832 linhas —
    // é analisado em ~6 ms e cabe numa fatia só: com ele, não há meio de
    // análise onde cancelar. Um teste com 20.000 linhas passava ou falhava
    // conforme a carga da máquina.
    const grande = Array.from({ length: 100_000 }, (_, i) => `#INCLUDE "T${i}.CH"`).join('\r\n')

    const stopMs = await measureCancellationStopMs(grande)

    assert.ok(Number.isFinite(stopMs), 'a análise não relatou cancelamento')
    assert.ok(stopMs >= 0)
  })

  it('não devolve número quando a análise terminou antes do cancelamento', async () => {
    // Num fonte minúsculo a análise acaba antes de haver o que cancelar. O
    // resultado precisa dizer "não mediu", e não um zero que passaria por
    // medição no relatório.
    const stopMs = await measureCancellationStopMs('Return\r\n')

    assert.ok(Number.isNaN(stopMs))
  })
})
