import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'

import { DEFAULT_REPETITIONS, workerCount, type SourceMeasurement } from './measure'
import type { WorkerResponse } from './measure-worker'

/**
 * Distribui a medição entre trabalhadores.
 *
 * Cada trabalhador importa o motor uma vez e mede muitos arquivos. A
 * alternativa rejeitada em R5 — um processo por arquivo — faria o custo de
 * subir o processo dominar exatamente o que se quer medir.
 *
 * Fila com distribuição por demanda, e não fatias fixas: os fontes do corpus
 * variam de 300 a 24.636 linhas, e dividir a lista em N pedaços iguais deixaria
 * um trabalhador com a cauda inteira enquanto os outros terminam e ficam
 * parados.
 */

/** Qual caminho cada trabalhador está medindo agora. */
const pending = new WeakMap<Worker, number>()

export interface MeasureAllOptions {
  readonly repetitions?: number
  readonly workers?: number
  readonly onProgress?: (done: number, total: number) => void
  /**
   * Outro corpo de trabalhador.
   *
   * Existe para que o caminho de FALHA do pool seja exercitável por teste: sem
   * isto, o único jeito de ver o pool reagir a um trabalhador que morre seria
   * quebrar o worker de verdade — e um caminho de erro que nunca roda é um
   * caminho de erro que não se sabe se funciona.
   */
  readonly workerPath?: string
}

export async function measureAll(
  paths: readonly string[],
  options?: MeasureAllOptions,
): Promise<SourceMeasurement[]> {
  if (paths.length === 0) return []

  const repetitions = options?.repetitions ?? DEFAULT_REPETITIONS
  const requested = options?.workers ?? workerCount(availableParallelism())
  const size = Math.max(1, Math.min(requested, paths.length))

  // O worker é o arquivo COMPILADO ao lado deste. `__dirname` aponta para
  // `out/src/harness` em execução.
  const workerPath = options?.workerPath ?? join(__dirname, 'measure-worker.js')

  // Indexado por posição do caminho pedido: a ordem do resultado não pode
  // depender de qual trabalhador terminou primeiro, senão duas execuções sobre
  // o mesmo corpus produziriam relatórios diferentes.
  const results = new Array<SourceMeasurement | undefined>(paths.length)

  let next = 0
  let done = 0

  await new Promise<void>((resolve, reject) => {
    let alive = size
    const workers: Worker[] = []

    const finish = (): void => {
      alive -= 1
      if (alive === 0) resolve()
    }

    for (let index = 0; index < size; index += 1) {
      const worker = new Worker(workerPath, { workerData: { repetitions } })
      workers.push(worker)

      const assign = (): void => {
        if (next >= paths.length) {
          void worker.terminate().then(finish, finish)
          return
        }
        const position = next
        next += 1
        worker.postMessage({ path: paths[position]! })
        pending.set(worker, position)
      }

      worker.on('message', (response: WorkerResponse) => {
        const position = pending.get(worker)
        if (position !== undefined && response.ok) results[position] = response.measurement
        // Fonte ilegível não derruba a medição inteira: fica de fora do
        // relatório e a varredura segue.
        done += 1
        options?.onProgress?.(done, paths.length)
        assign()
      })

      worker.on('error', (error) => {
        for (const other of workers) void other.terminate()
        reject(error)
      })

      assign()
    }
  })

  return results.filter((measurement): measurement is SourceMeasurement => measurement !== undefined)
}

/**
 * Custo de partida do motor em um processo novo.
 *
 * É o que o relatório registra como `activationMs`, e o nome merece explicação:
 * a ativação da extensão dentro do editor é medida pelo teste de integração,
 * porque envolve o VS Code. O que **este** harness mede honestamente é o
 * componente que pertence ao servidor — subir o thread, carregar o motor e
 * ficar pronto para responder. É o pedaço do orçamento do Princípio I que o
 * código deste repositório controla.
 *
 * O pedido é deliberadamente um caminho inexistente: o trabalhador já carregou
 * o motor (import no topo do módulo) antes de descobrir que não há arquivo, e
 * responde de imediato. Assim o número não inclui leitura de disco nem análise.
 */
export async function measureEngineStartupMs(): Promise<number> {
  const workerPath = join(__dirname, 'measure-worker.js')
  const startedAt = performance.now()

  return new Promise<number>((resolve, reject) => {
    const worker = new Worker(workerPath, { workerData: { repetitions: 1 } })

    worker.on('message', () => {
      const elapsed = performance.now() - startedAt
      void worker.terminate().then(
        () => resolve(elapsed),
        () => resolve(elapsed),
      )
    })
    worker.on('error', reject)

    worker.postMessage({ path: join(__dirname, 'este-caminho-nao-existe.prw') })
  })
}

