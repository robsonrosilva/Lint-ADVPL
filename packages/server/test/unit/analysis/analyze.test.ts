import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CancellationTokenSource } from 'vscode-languageserver'
import { DiagnosticSeverity } from 'vscode-languageserver-types'

import { analyze } from '../../../src/analysis/analyze'
import { createAnalyzedDocument } from '../../../src/document/analyzed-document'
import { RuleRegistry, type RegisteredRule } from '../../../src/rules/registry'
import { ca3001 } from '../../../src/rules/ca3001'
import { assertDiagnostics } from '../../support/assert-diagnostic'

function registryWithCa3001(): RuleRegistry {
  const registry = new RuleRegistry()
  registry.register(ca3001)
  return registry
}

function documentOf(text: string) {
  return createAnalyzedDocument({ uri: 'file:///t.prw', languageId: 'advpl', version: 1, text })
}

/** Requisição completa, com os pontos de injeção no padrão do produto. */
function request(text: string, rules: readonly RegisteredRule[], token = new CancellationTokenSource().token) {
  return {
    document: documentOf(text),
    rules,
    isEnabled: () => true,
    severityOf: (rule: RegisteredRule) => rule.defaultSeverity,
    translate: (rule: RegisteredRule) => `mensagem de ${rule.id}`,
    docHrefOf: (rule: RegisteredRule) => `https://exemplo/${rule.id}.md`,
    token,
  }
}

describe('Análise — produção de diagnóstico', () => {
  it('devolve o diagnóstico completo, com identificador, severidade e posição', async () => {
    const text = '// topo\n#INCLUDE "TOTVS.CH"\n'
    const result = await analyze(request(text, registryWithCa3001().all()))

    assert.equal(result.cancelled, false)
    assertDiagnostics(result.diagnostics, [
      {
        code: 'CA3001',
        severity: DiagnosticSeverity.Information,
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 8 } },
      },
    ])
  })

  it('anexa a documentação da regra ao diagnóstico', async () => {
    // FR-011: o usuário descobre o que fazer sem sair do editor.
    const result = await analyze(request('#INCLUDE "X.CH"\n', registryWithCa3001().all()))
    assert.equal(result.diagnostics[0]?.codeDescription?.href, 'https://exemplo/CA3001.md')
  })

  it('usa a mensagem traduzida que recebe, sem montar texto próprio', async () => {
    // FR-016: nenhuma string ao usuário é escrita literalmente no motor.
    const result = await analyze(request('#INCLUDE "X.CH"\n', registryWithCa3001().all()))
    assert.equal(result.diagnostics[0]?.message, 'mensagem de CA3001')
  })

  it('não executa regra desligada pela configuração', async () => {
    const base = request('#INCLUDE "X.CH"\n', registryWithCa3001().all())
    const result = await analyze({ ...base, isEnabled: () => false })
    assertDiagnostics(result.diagnostics, [])
  })

  it('usa a severidade configurada, mantendo identificador e posição', async () => {
    const base = request('#INCLUDE "X.CH"\n', registryWithCa3001().all())
    const result = await analyze({ ...base, severityOf: () => DiagnosticSeverity.Warning })
    assertDiagnostics(result.diagnostics, [
      {
        code: 'CA3001',
        severity: DiagnosticSeverity.Warning,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 8 } },
      },
    ])
  })
})

describe('Análise — cancelamento', () => {
  it('devolve cancelled quando o token já vem cancelado', async () => {
    const source = new CancellationTokenSource()
    source.cancel()
    const result = await analyze(request('#INCLUDE "X.CH"\n', registryWithCa3001().all(), source.token))
    assert.equal(result.cancelled, true)
    assertDiagnostics(result.diagnostics, [])
  })

  it('PARA DE FATO no meio do trabalho, não só descarta o resultado', async () => {
    // Princípio I: "análise cancelada MUST parar de fato". A diferença entre
    // parar e descartar é a diferença entre o editor responder e o editor
    // travar enquanto se digita.
    let ranAfterCancel = 0
    const source = new CancellationTokenSource()

    const slowRule = (index: number): RegisteredRule => ({
      ...ca3001,
      id: `ZZ${1000 + index}`,
      configKey: `advplLint.rules.ZZ${1000 + index}`,
      origin: 'project',
      group: null,
      catalogSeverity: null,
      projectRationale: 'regra de teste',
      defaultSeverity: DiagnosticSeverity.Information,
      run: () => {
        if (source.token.isCancellationRequested) ranAfterCancel += 1
        if (index === 1) source.cancel()
      },
    })

    const rules = Array.from({ length: 40 }, (_, i) => slowRule(i))
    const result = await analyze(request('Local x := 1\n', rules, source.token))

    assert.equal(result.cancelled, true)
    assert.equal(ranAfterCancel, 0, `${ranAfterCancel} regras rodaram DEPOIS do cancelamento`)
  })

  it('para em menos de 50 ms depois do cancelamento', async () => {
    // SC-009. Medido, não presumido.
    const source = new CancellationTokenSource()
    const text = Array.from({ length: 40000 }, () => '#INCLUDE "TOTVS.CH"').join('\r\n')
    let cancelledAt = 0

    const rules = Array.from({ length: 200 }, (_, i) => ({
      ...ca3001,
      id: `ZZ${2000 + i}`,
      configKey: `advplLint.rules.ZZ${2000 + i}`,
    })) as RegisteredRule[]

    const promise = analyze(request(text, rules, source.token))
    setTimeout(() => {
      cancelledAt = performance.now()
      source.cancel()
    }, 5)

    const result = await promise
    const stoppedAt = performance.now()

    assert.equal(result.cancelled, true)
    assert.ok(
      stoppedAt - cancelledAt < 50,
      `a análise levou ${(stoppedAt - cancelledAt).toFixed(1)} ms para parar depois do cancelamento`,
    )
  })
})

describe('Análise — o editor continua respondendo', () => {
  it('cede o controle e não bloqueia o laço de eventos por mais de 50 ms', async () => {
    // FR-006. Um relógio corre em paralelo enquanto a análise trabalha; o maior
    // intervalo entre duas batidas é o tempo em que o laço ficou preso.
    //
    // A carga é pesada de propósito — 25.000 linhas, o percentil máximo do
    // corpus, com 60 regras ligadas — mas REALISTA: a diretiva aparece em ~2%
    // das linhas. Fazer as 60 regras dispararem em todas as 25.000 linhas geraria
    // 1,5 milhão de objetos de diagnóstico e o que a medição capturaria seria a
    // pausa do coletor de lixo, não o desenho de cessão. Cenário impossível não
    // prova nada sobre o cenário real.
    const text = Array.from({ length: 25000 }, (_, i) =>
      i % 50 === 0 ? '#INCLUDE "TOTVS.CH"  // diretiva' : `Local x${i} := "valor ${i}"  // comentario`,
    ).join('\r\n')
    const rules = Array.from({ length: 60 }, (_, i) => ({
      ...ca3001,
      id: `ZZ${3000 + i}`,
      configKey: `advplLint.rules.ZZ${3000 + i}`,
    })) as RegisteredRule[]

    let running = true
    let ticks = 0
    let maxGap = 0
    let last = performance.now()
    const tick = (): void => {
      const now = performance.now()
      maxGap = Math.max(maxGap, now - last)
      last = now
      ticks += 1
      if (running) setImmediate(tick)
    }
    setImmediate(tick)

    last = performance.now()
    ticks = 0
    await analyze(request(text, rules))
    running = false

    // A asserção PRINCIPAL é determinística: o relógio paralelo só consegue
    // bater enquanto a análise está cedendo o controle. Se `analyze` segurasse
    // o laço do início ao fim, `ticks` ficaria em zero ou um, qualquer que
    // fosse a carga da máquina.
    assert.ok(ticks >= 10, `a análise cedeu o controle só ${ticks} vez(es) — deveria ceder por fatia`)

    // A asserção SECUNDÁRIA é de relógio, e o teto é folgado de propósito. O
    // limite do Princípio I é 50 ms, mas esta suíte roda com os arquivos em
    // processos paralelos e com instrumentação de cobertura ligada: sob essa
    // contenção, o intervalo medido diz mais sobre a carga da máquina que sobre
    // o desenho. Aqui isso serve como alarme de bloqueio grosseiro; a
    // verificação dos 50 ms de verdade é do harness da US2, em máquina quieta.
    assert.ok(maxGap < 250, `o laço de eventos ficou ${maxGap.toFixed(1)} ms sem respirar`)
  })
})

describe('Análise — sem tempo-limite', () => {
  it('conclui um fonte gigante sem descartar nada por tempo', async () => {
    // FR-009 e SC-010. O legado tinha um setTimeout de 1000 ms que REJEITAVA a
    // análise (validaAdvpl.ts:57): fonte grande simplesmente não era analisado.
    // Aqui fonte grande demora mais — e termina.
    const lines = 24636
    const text = Array.from({ length: lines }, (_, i) =>
      i % 3 === 0 ? '#INCLUDE "TOTVS.CH"' : `Local x${i} := ${i}`,
    ).join('\r\n')

    const result = await analyze(request(text, registryWithCa3001().all()))

    assert.equal(result.cancelled, false)
    assert.equal(result.diagnostics.length, Math.ceil(lines / 3))
    // Confere a posição do ÚLTIMO diagnóstico: se a contagem de linhas
    // escorregasse em algum ponto, é aqui que apareceria.
    const last = result.diagnostics[result.diagnostics.length - 1]
    assert.equal(last?.range.start.line, lines - 3)
    assert.equal(last?.range.end.character, 8)
  })
})
