import assert from 'node:assert/strict'
import type { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-types'

/**
 * O que se assere sobre um diagnóstico: identificador, severidade e posição
 * exata. A mensagem fica de fora de propósito — ela é traduzida e reescrita, e
 * o Princípio IV diz que ela NEVER serve de contrato.
 */
export interface ExpectedDiagnostic {
  readonly code: string
  readonly severity: DiagnosticSeverity
  readonly range: {
    readonly start: { readonly line: number; readonly character: number }
    readonly end: { readonly line: number; readonly character: number }
  }
}

/**
 * Compara UM diagnóstico específico, inteiro.
 *
 * FR-029. O legado assertava apenas totais de error/warning/information/hint
 * sobre cinco arquivos. Com esse desenho, duas regras quebradas em direções
 * opostas mantêm a suíte verde — uma para de disparar, a outra passa a disparar
 * a mais, e o total não muda.
 */
export function assertDiagnostic(
  actual: Diagnostic | undefined,
  expected: ExpectedDiagnostic,
  context?: string,
): void {
  const where = context ? ` (${context})` : ''
  assert.ok(actual !== undefined, `esperava um diagnóstico ${expected.code} e não veio nenhum${where}`)

  assert.equal(actual.code, expected.code, `identificador divergente${where}`)
  assert.equal(actual.severity, expected.severity, `severidade divergente em ${expected.code}${where}`)
  assert.deepEqual(
    { line: actual.range.start.line, character: actual.range.start.character },
    expected.range.start,
    `posição INICIAL divergente em ${expected.code}${where}`,
  )
  assert.deepEqual(
    { line: actual.range.end.line, character: actual.range.end.character },
    expected.range.end,
    `posição FINAL divergente em ${expected.code}${where}`,
  )
}

/**
 * Compara a lista inteira, elemento a elemento e em ordem.
 *
 * Isto NÃO é asserção agregada: cada diagnóstico é comparado por completo. O
 * que o FR-029 proíbe é assertar só o total, ou só a contagem por severidade.
 * Por isso este módulo não exporta nada que devolva contagem.
 */
export function assertDiagnostics(actual: readonly Diagnostic[], expected: readonly ExpectedDiagnostic[]): void {
  for (let i = 0; i < Math.max(actual.length, expected.length); i += 1) {
    const want = expected[i]
    const got = actual[i]
    assert.ok(
      want !== undefined,
      `diagnóstico inesperado na posição ${i}: ${got?.code} em ${JSON.stringify(got?.range)}`,
    )
    assertDiagnostic(got, want, `posição ${i} da lista`)
  }
}
