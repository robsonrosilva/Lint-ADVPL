import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DiagnosticSeverity, type Diagnostic } from 'vscode-languageserver-types'

import { assertDiagnostic, assertDiagnostics } from '../../support/assert-diagnostic'
import * as support from '../../support/assert-diagnostic'

// Um diagnóstico de referência para as comparações abaixo.
function sample(): Diagnostic {
  return {
    code: 'CA3001',
    severity: DiagnosticSeverity.Information,
    range: { start: { line: 2, character: 0 }, end: { line: 2, character: 8 } },
    message: 'irrelevante para a asserção',
    source: 'advpl-lint',
  }
}

const EXPECTED = {
  code: 'CA3001',
  severity: DiagnosticSeverity.Information,
  range: { start: { line: 2, character: 0 }, end: { line: 2, character: 8 } },
}

describe('Utilitário de asserção de diagnóstico', () => {
  it('aceita um diagnóstico idêntico ao esperado', () => {
    assert.doesNotThrow(() => assertDiagnostic(sample(), EXPECTED))
  })

  it('acusa divergência no identificador', () => {
    assert.throws(() => assertDiagnostic({ ...sample(), code: 'CA1004' }, EXPECTED))
  })

  it('acusa divergência na severidade', () => {
    assert.throws(() =>
      assertDiagnostic({ ...sample(), severity: DiagnosticSeverity.Warning }, EXPECTED),
    )
  })

  it('acusa divergência na LINHA', () => {
    const moved = sample()
    moved.range = { start: { line: 3, character: 0 }, end: { line: 3, character: 8 } }
    assert.throws(() => assertDiagnostic(moved, EXPECTED))
  })

  it('acusa divergência na COLUNA', () => {
    // Separado da linha de propósito: um erro de aritmética de coluna — como o
    // que a leitura errada de encoding produz — desloca só o caractere, e um
    // teste que só compara linha passaria.
    const moved = sample()
    moved.range = { start: { line: 2, character: 1 }, end: { line: 2, character: 9 } }
    assert.throws(() => assertDiagnostic(moved, EXPECTED))
  })

  it('acusa diagnóstico ausente', () => {
    assert.throws(() => assertDiagnostic(undefined, EXPECTED))
  })

  it('compara listas elemento a elemento, em ordem', () => {
    assert.doesNotThrow(() => assertDiagnostics([sample()], [EXPECTED]))
    assert.throws(() => assertDiagnostics([], [EXPECTED]))
    assert.throws(() => assertDiagnostics([sample(), sample()], [EXPECTED]))
  })

  it('NÃO oferece nenhuma forma de assertar contagem agregada', () => {
    // FR-029. O legado assertava totais de error/warning/information/hint sobre
    // cinco arquivos: com esse desenho, duas regras quebradas em direções
    // opostas mantêm a suíte verde. A proibição precisa de dente — se o
    // utilitário não expõe a forma agregada, ninguém a usa por descuido.
    const exported = Object.keys(support)
    const aggregate = exported.filter((name) => /count|total|amount|quantidade/i.test(name))
    assert.deepEqual(aggregate, [], `exportações agregadas encontradas: ${aggregate.join(', ')}`)
    assert.deepEqual(exported.sort(), ['assertDiagnostic', 'assertDiagnostics'])
  })
})
