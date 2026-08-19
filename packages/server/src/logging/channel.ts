/**
 * Canal de log com nível, DESLIGADO por padrão.
 *
 * Princípio I: log no caminho quente é proibido. O legado tinha 66 chamadas de
 * `console.log` no motor, sem nível e sem chave de desligamento — mais uma por
 * LINHA de cada arquivo analisado (validaAdvpl.ts:121-124), junto com um
 * breakpoint esquecido.
 */

export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug'

/**
 * A mensagem pode ser uma função. Detalhe que decide desempenho: montar a
 * string custa mesmo quando a linha é descartada. Passando `() => \`...\``, o
 * custo só existe se o nível estiver ligado.
 */
export type LogMessage = string | (() => string)

export interface LogChannel {
  setLevel(level: LogLevel): void
  getLevel(): LogLevel
  error(message: LogMessage): void
  warn(message: LogMessage): void
  info(message: LogMessage): void
  debug(message: LogMessage): void
}

/** Ordem da escala. `off` é 0 e nunca deixa nada passar. */
const RANK: Readonly<Record<LogLevel, number>> = {
  off: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
}

/**
 * Cria um canal que escreve no `sink` recebido.
 *
 * O canal não conhece `console` nem o sistema de arquivos — quem decide para
 * onde a linha vai é quem o constrói. É o que permite testá-lo sem efeito
 * colateral e o que mantém o motor livre de I/O.
 */
export function createLogChannel(sink: (line: string) => void): LogChannel {
  let level: LogLevel = 'off'

  function emit(at: LogLevel, message: LogMessage): void {
    // A comparação vem ANTES de qualquer trabalho. Com o canal desligado, o
    // custo total de uma chamada de log é uma comparação de inteiros.
    if (RANK[level] < RANK[at]) return
    sink(`[${at}] ${typeof message === 'function' ? message() : message}`)
  }

  return {
    setLevel: (next) => {
      level = next
    },
    getLevel: () => level,
    error: (message) => emit('error', message),
    warn: (message) => emit('warn', message),
    info: (message) => emit('info', message),
    debug: (message) => emit('debug', message),
  }
}
