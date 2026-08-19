import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CancellationTokenSource } from 'vscode-languageserver'
import { DiagnosticSeverity, type Diagnostic, type Range } from 'vscode-languageserver-types'

import { ca3001 } from '../../../src/rules/ca3001'
import { scanDocument } from '../../../src/analysis/scanner'
import { createAnalyzedDocument } from '../../../src/document/analyzed-document'
import { decodeCp1252 } from '../../../src/text/cp1252'
import { assertDiagnostics } from '../../support/assert-diagnostic'

const FIXTURES = join(__dirname, '..', '..', '..', '..', 'test', 'fixtures')

/**
 * Carrega a fixture do jeito que o produto carrega: bytes do disco, decodificados
 * como CP1252. Ler como utf8 aqui esconderia justamente o defeito do legado.
 */
async function runOnFixture(name: string): Promise<Diagnostic[]> {
  const bytes = await readFile(join(FIXTURES, name))
  const text = decodeCp1252(bytes)
  const document = createAnalyzedDocument({
    uri: `file:///${name}`,
    languageId: 'advpl',
    version: 1,
    text,
  })
  const source = new CancellationTokenSource()
  const collected: Diagnostic[] = []

  ca3001.run({
    document,
    startLine: 0,
    endLine: document.lineOffsets.length,
    scan: scanDocument(text),
    token: source.token,
    report: (range: Range) => {
      collected.push({
        code: ca3001.id,
        severity: DiagnosticSeverity.Information,
        range,
        message: '(irrelevante para esta asserção)',
        source: 'advpl-lint',
      })
    },
  })
  return collected
}

/** Atalho para o esperado: sempre CA3001/Information, variando só a posição. */
function at(line: number, startChar: number, endChar: number) {
  return {
    code: 'CA3001',
    severity: DiagnosticSeverity.Information,
    range: { start: { line, character: startChar }, end: { line, character: endChar } },
  }
}

describe('CA3001 — dispara', () => {
  it('marca #INCLUDE em caixa alta, com o intervalo exato do token', async () => {
    // O intervalo cobre `#INCLUDE` — 8 caracteres do '#' ao fim da palavra —
    // e NÃO a linha inteira. FR-019.
    assertDiagnostics(await runOnFixture('ca3001-basic.prw'), [at(2, 0, 8)])
  })

  it('marca qualquer caixa que não seja toda baixa', async () => {
    // `#Include` e `#InClUdE` disparam; `#include` não.
    assertDiagnostics(await runOnFixture('ca3001-mixed-case.prw'), [at(2, 0, 8), at(3, 0, 8)])
  })

  it('acha a diretiva mesmo indentada, sem incluir o recuo no intervalo', async () => {
    assertDiagnostics(await runOnFixture('ca3001-eol-mixed.prw'), [at(2, 0, 8), at(5, 3, 11)])
  })
})

describe('CA3001 — não dispara', () => {
  it('ignora #INCLUDE em comentário de linha, de bloco e em literal de texto', async () => {
    // O único falso positivo plausível desta regra. A fixture cita #INCLUDE em
    // cinco lugares e só UM deles é código de verdade.
    assertDiagnostics(await runOnFixture('ca3001-comment-and-string.prw'), [at(6, 0, 8)])
  })

  it('ignora a forma correta em caixa baixa', async () => {
    const diagnostics = await runOnFixture('ca3001-basic.prw')
    assert.ok(
      diagnostics.every((d) => d.range.start.line !== 3),
      'a linha 4 tem `#include` em caixa baixa e não deveria produzir diagnóstico',
    )
  })
})

describe('CA3001 — codificação e fim de linha', () => {
  it('não se desloca por bytes CP1252 na faixa 0x80-0x9F', async () => {
    // A fixture traz travessão (0x97), aspas tipográficas (0x93/0x94) e euro
    // (0x80) nas linhas ANTES da diretiva. Lidos como UTF-8, alguns pares de
    // bytes colapsariam num caractere só e a aritmética de posição andaria.
    assertDiagnostics(await runOnFixture('ca3001-cp1252-highrange.prw'), [at(4, 0, 8)])
  })

  it('conta linha certo com LF puro', async () => {
    assertDiagnostics(await runOnFixture('ca3001-eol-lf.prw'), [at(2, 0, 8)])
  })

  it('conta linha certo com CRLF e LF misturados no mesmo arquivo', async () => {
    // CRLF conta como UMA quebra. Sem isso, todo arquivo CRLF teria o dobro de
    // linhas e cada diagnóstico apareceria no lugar errado.
    assertDiagnostics(await runOnFixture('ca3001-eol-mixed.prw'), [at(2, 0, 8), at(5, 3, 11)])
  })
})

describe('CA3001 — identidade da regra', () => {
  it('declara origem totvs, grupo G3 e severidade MINOR do catálogo', () => {
    // referencias/totvs/sonarqube-rules-reference.md, linha 53, release v1.0.1,
    // consultada em 2026-08-19.
    assert.equal(ca3001.id, 'CA3001')
    assert.equal(ca3001.origin, 'totvs')
    assert.equal(ca3001.group, 'G3')
    assert.equal(ca3001.catalogSeverity, 'MINOR')
    assert.equal(ca3001.projectRationale, null)
  })

  it('tem chave de configuração e chave de mensagem próprias', () => {
    assert.equal(ca3001.configKey, 'advplLint.rules.CA3001')
    assert.equal(ca3001.messageKey, 'rule.CA3001.message')
  })
})

describe('CA3001 — cancelamento', () => {
  it('para de trabalhar quando o token é cancelado', async () => {
    const text = Array.from({ length: 20000 }, () => '#INCLUDE "TOTVS.CH"').join('\n')
    const document = createAnalyzedDocument({ uri: 'file:///big.prw', languageId: 'advpl', version: 1, text })
    const source = new CancellationTokenSource()
    source.cancel()

    let reports = 0
    ca3001.run({
      document,
      startLine: 0,
      endLine: document.lineOffsets.length,
      scan: scanDocument(text),
      token: source.token,
      report: () => {
        reports += 1
      },
    })

    assert.ok(reports < 20000, `a regra ignorou o cancelamento e reportou ${reports} vezes`)
  })
})

// --- Casos de borda de reconhecimento da diretiva ---
//
// Estes são micro-casos, não fontes realistas: por isso vivem inline em vez de
// virar fixture versionada. Fixture é para o comportamento que se quer poder
// abrir e ler como código ADVPL de verdade.

function runOnText(text: string): number {
  const document = createAnalyzedDocument({ uri: 'file:///i.prw', languageId: 'advpl', version: 1, text })
  const source = new CancellationTokenSource()
  let reports = 0
  ca3001.run({
    document,
    startLine: 0,
    endLine: document.lineOffsets.length,
    scan: scanDocument(text),
    token: source.token,
    report: () => {
      reports += 1
    },
  })
  return reports
}

describe('CA3001 — reconhecimento da diretiva', () => {
  it('aceita recuo com tabulação, não só com espaço', () => {
    assert.equal(runOnText('\t#INCLUDE "X.CH"\n'), 1)
    assert.equal(runOnText('\t\t#include "x.ch"\n'), 0)
  })

  it('ignora outras diretivas de tamanho diferente', () => {
    assert.equal(runOnText('#DEFINE X 1\n#IFDEF Y\n#ENDIF\n'), 0)
  })

  it('ignora outra diretiva do MESMO tamanho de "include"', () => {
    // `#COMMAND` tem 7 letras, igual a `include`. Se a comparação olhasse só o
    // comprimento, esta linha viraria falso positivo.
    assert.equal(runOnText('#COMMAND FOO => BAR\n'), 0)
  })

  it('ignora linha em branco e linha só com espaço', () => {
    assert.equal(runOnText('\n   \n\t\n'), 0)
  })

  it('ignora "#" solto no fim da linha', () => {
    assert.equal(runOnText('#\n#  \n'), 0)
  })

  it('NÃO dispara em #INCLUDE no início de linha dentro de comentário de bloco', () => {
    // Este é o caminho que só a varredura léxica pega: a diretiva está na
    // coluna 1, com a forma exata de código, e mesmo assim não é código.
    assert.equal(runOnText('/*\n#INCLUDE "X.CH"\n*/\n'), 0)
    assert.equal(runOnText('/*\n#INCLUDE "X.CH"\n*/\n#INCLUDE "Y.CH"\n'), 1)
  })

  it('não confunde texto que apenas contém "include"', () => {
    assert.equal(runOnText('Local cX := INCLUDE\n// includes\n'), 0)
  })
})
