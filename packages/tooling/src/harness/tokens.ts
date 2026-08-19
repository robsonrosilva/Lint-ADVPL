/**
 * Os dois tokens de cancelamento que a medição usa.
 *
 * Vivem em módulo próprio porque são a única parte do harness que precisa
 * satisfazer o contrato de cancelamento do motor — e satisfazer um contrato de
 * mentirinha é justamente o tipo de coisa que passa despercebida até o dia em
 * que o motor começa a usar o pedaço que ninguém implementou.
 */

export interface Disposable {
  dispose(): void
}

export interface MeasurementToken {
  readonly isCancellationRequested: boolean
  /**
   * A assinatura aceita qualquer ouvinte de propósito: é o formato que o motor
   * espera, e estreitá-la aqui faria o token deixar de servir ao contrato dele.
   */
  onCancellationRequested(listener?: (event: unknown) => unknown): Disposable
}

const NOOP_DISPOSABLE: Disposable = {
  dispose(): void {
    // Não há nada a soltar: estes tokens não guardam ouvinte.
  },
}

/**
 * Token que nunca cancela.
 *
 * A medição não é o caminho de edição: ninguém está digitando por cima dela, e
 * interromper no meio produziria número sem sentido.
 */
export const neverCancelled: MeasurementToken = {
  isCancellationRequested: false,
  onCancellationRequested(): Disposable {
    return NOOP_DISPOSABLE
  },
}

export interface ControllableToken extends MeasurementToken {
  cancel(): void
}

/** Token que a medição de parada aciona à mão, para cronometrar o quanto a análise ainda gasta. */
export function createControllableToken(): ControllableToken {
  let cancelled = false
  return {
    get isCancellationRequested(): boolean {
      return cancelled
    },
    onCancellationRequested(): Disposable {
      return NOOP_DISPOSABLE
    },
    cancel(): void {
      cancelled = true
    },
  }
}
