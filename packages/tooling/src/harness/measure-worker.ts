import { parentPort, workerData } from 'node:worker_threads'

import { buildStaticIndex, measureSource, useMeasurementIndex } from './measure'

/**
 * O corpo de um trabalhador da medição.
 *
 * Roda em outro thread, então **nada aqui é contabilizado pela cobertura** do
 * processo principal — motivo pelo qual este arquivo é o único do harness
 * declarado na lista de exclusão, e motivo pelo qual ele é deliberadamente
 * burro: recebe um caminho, chama `measureSource`, devolve o resultado. Toda a
 * lógica que merece teste vive em `measure.ts` e em `measure-pool.ts`.
 *
 * O trabalhador importa o motor UMA VEZ, no carregamento do módulo, e mede
 * muitos arquivos — subir um processo por arquivo faria o custo de partida
 * dominar justamente o que se quer medir (R5).
 */

interface WorkerSetup {
  readonly repetitions: number
  readonly includeEntries: readonly { readonly realName: string; readonly directory: string }[]
}

export interface WorkerRequest {
  readonly path: string
}

export type WorkerResponse =
  | { readonly ok: true; readonly measurement: Awaited<ReturnType<typeof measureSource>> }
  | { readonly ok: false; readonly path: string; readonly reason: string }

const setup = workerData as WorkerSetup

// O índice chega PRONTO, montado a partir de entradas já lidas pelo processo
// principal. Varrer o disco aqui faria cada trabalhador repetir a varredura da
// árvore inteira, e o número medido deixaria de ser o custo por documento.
useMeasurementIndex(buildStaticIndex(setup.includeEntries ?? []))

parentPort?.on('message', (request: WorkerRequest) => {
  void measureSource({ path: request.path, repetitions: setup.repetitions })
    .then((measurement) => {
      parentPort?.postMessage({ ok: true, measurement } satisfies WorkerResponse)
    })
    .catch((error: unknown) => {
      parentPort?.postMessage({
        ok: false,
        path: request.path,
        reason: error instanceof Error ? error.message : String(error),
      } satisfies WorkerResponse)
    })
})
