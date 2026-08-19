import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  buildLargeSource,
  countDirectives,
  writeLargeFixture,
  DEFAULT_LARGE_SOURCE,
} from '../../src/fixtures/generate-large'

describe('Fixture grande — geração', () => {
  it('gera o tamanho pedido, contando as linhas pelo terminador', () => {
    const text = buildLargeSource({ lines: 1000, directiveEvery: 50, eol: '\r\n' })
    assert.equal(text.split('\r\n').length, 1000)
  })

  it('usa por padrão o maior fonte observado no corpus', () => {
    // 24.636 linhas, medido em 2026-08-19. Ver memoria/distribuicao-tamanho-fontes.md.
    assert.equal(DEFAULT_LARGE_SOURCE.lines, 24636)
  })

  it('abre declarando que é gerada e não é cópia de fonte padrão', () => {
    // A verificação de vazamento de corpus (FR-027) procura essa declaração.
    const text = buildLargeSource({ lines: 10, directiveEvery: 5, eol: '\n' })
    assert.match(text.split('\n')[0]!, /NAO e copia de fonte padrao do Protheus/)
  })

  it('a contagem prometida bate com a quantidade real de diretivas', () => {
    // Se contar e gerar divergissem, o teste de tamanho estaria comparando o
    // resultado com um número inventado.
    const options = { lines: 5000, directiveEvery: 37, eol: '\n' } as const
    const real = buildLargeSource(options)
      .split('\n')
      .filter((line) => line.startsWith('#INCLUDE')).length
    assert.equal(countDirectives(options), real)
  })

  it('gera ASCII puro — codificação tem fixtures próprias', () => {
    const text = buildLargeSource({ lines: 500, directiveEvery: 10, eol: '\r\n' })
    assert.ok(
      [...text].every((c) => c.charCodeAt(0) < 128),
      'apareceu byte fora do ASCII numa fixture que deveria exercitar só tamanho',
    )
  })

  it('recusa parâmetros impossíveis em vez de gerar lixo', () => {
    assert.throws(() => buildLargeSource({ lines: 1, directiveEvery: 10, eol: '\n' }))
    assert.throws(() => buildLargeSource({ lines: 100, directiveEvery: 0, eol: '\n' }))
  })
})

describe('Fixture grande — gravação', () => {
  it('grava o arquivo criando o diretório se preciso', async () => {
    const path = join(tmpdir(), `advpl-lint-test-${process.pid}`, 'nested', 'large.prw')
    try {
      await writeLargeFixture(path, { lines: 300, directiveEvery: 25, eol: '\r\n' })
      const written = await readFile(path)
      assert.equal(written.toString('ascii').split('\r\n').length, 300)
    } finally {
      await rm(join(tmpdir(), `advpl-lint-test-${process.pid}`), { recursive: true, force: true })
    }
  })
})
