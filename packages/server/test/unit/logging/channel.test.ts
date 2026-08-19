import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createLogChannel, type LogLevel } from '../../../src/logging/channel'

// Coletor de saída, para provar o que foi e o que não foi emitido.
function collector(): { lines: string[]; sink: (line: string) => void } {
  const lines: string[] = []
  return { lines, sink: (line) => lines.push(line) }
}

describe('Canal de log', () => {
  it('nasce DESLIGADO e não emite absolutamente nada', () => {
    // Princípio I. O legado tinha 66 console.log no motor, sem nível e sem
    // chave de desligamento, mais um por linha de cada arquivo analisado.
    const { lines, sink } = collector()
    const log = createLogChannel(sink)

    log.error('erro')
    log.warn('aviso')
    log.info('informação')
    log.debug('depuração')

    assert.deepEqual(lines, [])
  })

  it('emite apenas o que está no nível configurado ou acima', () => {
    const { lines, sink } = collector()
    const log = createLogChannel(sink)

    log.setLevel('warn')
    log.error('e')
    log.warn('w')
    log.info('i')
    log.debug('d')

    assert.deepEqual(
      lines.map((l) => l.split(' ')[0]),
      ['[error]', '[warn]'],
    )
  })

  it('respeita cada nível da escala', () => {
    const cases: ReadonlyArray<readonly [LogLevel, number]> = [
      ['off', 0],
      ['error', 1],
      ['warn', 2],
      ['info', 3],
      ['debug', 4],
    ]
    for (const [level, expected] of cases) {
      const { lines, sink } = collector()
      const log = createLogChannel(sink)
      log.setLevel(level)
      log.error('e')
      log.warn('w')
      log.info('i')
      log.debug('d')
      assert.equal(lines.length, expected, `nível ${level} deveria emitir ${expected} linhas`)
    }
  })

  it('não avalia a mensagem quando o nível está desligado', () => {
    // Detalhe que decide desempenho: no caminho quente, montar a string custa
    // mesmo quando a linha é descartada. Passando uma função, o custo só existe
    // se o nível estiver ligado.
    const { lines, sink } = collector()
    const log = createLogChannel(sink)
    let evaluated = 0

    log.debug(() => {
      evaluated += 1
      return 'caro de montar'
    })
    assert.equal(evaluated, 0, 'a mensagem foi montada com o canal desligado')

    log.setLevel('debug')
    log.debug(() => {
      evaluated += 1
      return 'caro de montar'
    })
    assert.equal(evaluated, 1)
    assert.equal(lines.length, 1)
  })

  it('volta a ficar em silêncio ao ser desligado de novo', () => {
    const { lines, sink } = collector()
    const log = createLogChannel(sink)
    log.setLevel('debug')
    log.info('ligado')
    log.setLevel('off')
    log.info('desligado')
    assert.equal(lines.length, 1)
  })
})

describe('Canal de log — nível corrente', () => {
  it('informa o nível em que está, começando por off', () => {
    const { sink } = collector()
    const log = createLogChannel(sink)
    assert.equal(log.getLevel(), 'off')
    log.setLevel('info')
    assert.equal(log.getLevel(), 'info')
  })
})
