import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DiagnosticSeverity } from 'vscode-languageserver-types'

import { resolveSeverity, SEVERITY_MAP, UnmappedSeverityError } from '../../../src/severity/map'

describe('Tabela de severidade', () => {
  it('mapeia MINOR do catálogo para Information no editor', () => {
    // D3 da spec 001. Information mostra a violação no painel sem contaminar a
    // contagem de erros e avisos.
    assert.equal(resolveSeverity('MINOR'), DiagnosticSeverity.Information)
  })

  it('tem exatamente UMA entrada preenchida nesta spec', () => {
    // As demais pertencem ao TODO(SEVERITY_MAP) da constituição e estão
    // deliberadamente ausentes. Ausência aqui é decisão, não esquecimento.
    assert.deepEqual(Object.keys(SEVERITY_MAP), ['MINOR'])
  })

  it('LANÇA para severidade de catálogo sem entrada, em vez de assumir padrão', () => {
    // Este é o ponto inteiro da tabela. Se severidade não mapeada caísse num
    // valor padrão silencioso, a próxima spec "resolveria" o TODO(SEVERITY_MAP)
    // por omissão — e CA2050 (SQL Injection, INFO no catálogo) apareceria como
    // dica de estilo sem ninguém ter decidido isso.
    for (const unmapped of ['CRITICAL', 'MAJOR', 'INFO'] as const) {
      assert.throws(
        () => resolveSeverity(unmapped),
        UnmappedSeverityError,
        `${unmapped} não deveria ter mapeamento nesta spec`,
      )
    }
  })

  it('a mensagem do erro nomeia a severidade que faltou', () => {
    assert.throws(() => resolveSeverity('CRITICAL'), /CRITICAL/)
  })
})
