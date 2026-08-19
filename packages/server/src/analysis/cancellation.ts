import type { CancellationToken } from 'vscode-languageserver'

/**
 * Orçamento de tempo entre duas cessões do laço de eventos.
 *
 * Princípio I: "nenhuma tarefa pode ocupar o event loop por mais de 50 ms sem
 * ceder". 50 ms é o TETO, não a meta: entre duas conferências ainda cabe o
 * trabalho de uma fatia, e sob pressão de coleta de lixo esse trabalho estica.
 * 10 ms deixa margem para os dois.
 */
export const YIELD_BUDGET_MS = 10

/**
 * Devolve o controle ao laço de eventos.
 *
 * `setImmediate` e não `setTimeout(0)`: o primeiro roda na fase de checagem do
 * mesmo giro, o segundo entra na fila de temporizadores e custa mais. Num
 * caminho que cede dezenas de vezes por análise, a diferença aparece.
 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

/**
 * Marcador de tempo que sabe quando é hora de respirar.
 *
 * O padrão de uso é sempre o mesmo: trabalhar um pouco, perguntar
 * `shouldYield()`, e ceder se a resposta for sim.
 */
export class TimeSlice {
  private startedAt = performance.now()

  shouldYield(): boolean {
    return performance.now() - this.startedAt >= YIELD_BUDGET_MS
  }

  async yieldIfNeeded(): Promise<void> {
    if (!this.shouldYield()) return
    await yieldToEventLoop()
    this.startedAt = performance.now()
  }
}

/**
 * Lançado internamente para abortar a análise assim que o cancelamento chega.
 *
 * É deliberadamente uma exceção, e não um valor de retorno: sem ela, cada
 * ponto do caminho precisaria conferir e propagar "cancelou?" à mão, e é
 * exatamente esse tipo de conferência esquecida que faz uma análise cancelada
 * continuar rodando — descartando o resultado no fim, mas tendo gasto o tempo.
 */
export class AnalysisCancelledError extends Error {
  constructor() {
    super('Análise cancelada')
    this.name = 'AnalysisCancelledError'
  }
}

export function throwIfCancelled(token: CancellationToken): void {
  if (token.isCancellationRequested) throw new AnalysisCancelledError()
}
