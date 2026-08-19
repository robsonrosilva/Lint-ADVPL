import type { CancellationToken } from 'vscode-languageserver'
import type { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver-types'

import type { AnalyzedDocument } from '../document/analyzed-document'
import type { RegisteredRule } from '../rules/registry'
import { scanDocument } from './scanner'
import { AnalysisCancelledError, TimeSlice, throwIfCancelled } from './cancellation'

/** Identifica esta extensão como emissora do diagnóstico. */
export const DIAGNOSTIC_SOURCE = 'advpl-lint'

/**
 * Quantas linhas a análise processa entre duas oportunidades de ceder o laço.
 *
 * 500 linhas é o ponto em que o trabalho por fatia fica bem abaixo do orçamento
 * mesmo com dezenas de regras ligadas, sem que o custo de fatiar (uma volta de
 * laço e uma conferência de relógio) comece a pesar. O p50 do corpus é 309
 * linhas — o fonte típico cabe numa fatia só.
 */
export const LINE_CHUNK = 500

export interface AnalyzeRequest {
  readonly document: AnalyzedDocument
  readonly rules: readonly RegisteredRule[]
  /** A regra está ligada para este documento? Vem da configuração do usuário. */
  readonly isEnabled: (rule: RegisteredRule) => boolean
  /** Severidade exibida: configurada pelo usuário ou o padrão da tabela. */
  readonly severityOf: (rule: RegisteredRule) => DiagnosticSeverity
  /**
   * Mensagem já traduzida. O motor NUNCA monta texto para o usuário — ele não
   * conhece o idioma efetivo e não tem por que conhecer.
   */
  readonly translate: (rule: RegisteredRule, args?: Readonly<Record<string, string | number>>) => string
  /** Endereço da documentação daquela regra, para o usuário chegar lá do editor. */
  readonly docHrefOf: (rule: RegisteredRule) => string
  readonly token: CancellationToken
}

export interface AnalyzeResult {
  readonly diagnostics: Diagnostic[]
  /**
   * `true` quando a análise foi interrompida. O chamador NUNCA deve publicar o
   * resultado parcial — ele corresponde a um texto que já não está na tela.
   */
  readonly cancelled: boolean
}

/**
 * Roda as regras ligadas sobre o documento.
 *
 * Duas garantias que este módulo existe para dar, e que foram o que matou a
 * versão anterior quando faltaram:
 *
 * 1. Cancelou, PARA. Não "descarta o resultado no fim" — para de gastar tempo.
 * 2. Cede o laço de eventos a cada fatia de tempo, para que digitar continue
 *    respondendo enquanto um fonte de 24 mil linhas é analisado.
 *
 * E uma que ele existe para NÃO dar: não há tempo-limite. Fonte grande demora
 * mais; ela não falha. O legado rejeitava a análise depois de 1000 ms
 * (validaAdvpl.ts:57), o que significa que fonte grande simplesmente não era
 * analisado — e ninguém era avisado disso.
 */
export async function analyze(request: AnalyzeRequest): Promise<AnalyzeResult> {
  const { document, rules, isEnabled, severityOf, translate, docHrefOf, token } = request
  const diagnostics: Diagnostic[] = []

  try {
    throwIfCancelled(token)

    // A varredura léxica roda UMA VEZ e serve todas as regras. Fazê-la por
    // regra transformaria o custo em O(regras × linhas).
    const scan = scanDocument(document.text)
    const slice = new TimeSlice()

    // Só as regras ligadas, resolvidas uma vez: repetir isto por fatia
    // multiplicaria o custo pelo número de fatias.
    const active = rules
      .filter((rule) => isEnabled(rule))
      .map((rule) => ({ rule, severity: severityOf(rule), href: docHrefOf(rule) }))

    const totalLines = document.lineOffsets.length

    // O laço externo é a FATIA DE LINHAS, não a regra.
    //
    // Medido em 2026-08-19, num fonte de 25.000 linhas: uma única regra leva
    // ~9 ms para varrer o documento inteiro. Com o laço invertido — regra por
    // fora, ceder entre regras —, bastavam poucas regras para estourar os 50 ms
    // do Princípio I, e nenhum ponto de cessão externo consertava isso, porque
    // `run` é síncrono e não devolve o controle no meio.
    //
    // Fatiando as linhas, o trabalho entre duas cessões passa a ser limitado
    // pelo TAMANHO DA FATIA e não pelo tamanho do documento. Fonte maior custa
    // mais fatias, não fatias mais longas.
    for (let start = 0; start < totalLines; start += LINE_CHUNK) {
      throwIfCancelled(token)
      const end = Math.min(start + LINE_CHUNK, totalLines)

      for (const { rule, severity, href } of active) {
        // Conferir aqui dentro, e não só por fatia, é o que faz "parar de fato"
        // valer também para o meio da fatia. Com o laço invertido, a conferência
        // externa sozinha deixaria todas as regras restantes rodarem depois do
        // cancelamento — o que é justamente descartar o resultado em vez de
        // parar. Custa uma leitura de booleano por regra por fatia.
        throwIfCancelled(token)

        rule.run({
          document,
          startLine: start,
          endLine: end,
          scan,
          token,
          report: (range: Range, args) => {
            diagnostics.push({
              // O identificador é o do catálogo, puro, sem prefixo nem
              // qualificação de origem (D2 da spec 001).
              code: rule.id,
              codeDescription: { href },
              severity,
              range,
              message: translate(rule, args),
              source: DIAGNOSTIC_SOURCE,
            })
          },
        })
      }

      await slice.yieldIfNeeded()
    }

    throwIfCancelled(token)
    return { diagnostics, cancelled: false }
  } catch (error) {
    if (error instanceof AnalysisCancelledError) return { diagnostics: [], cancelled: true }
    throw error
  }
}
