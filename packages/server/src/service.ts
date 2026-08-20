import { CancellationTokenSource } from 'vscode-languageserver'
import type { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-types'

import { analyze } from './analysis/analyze'
import { createAnalyzedDocument } from './document/analyzed-document'
import type { IncludeIndexReader } from './includes/index-store'
import type { RegisteredRule, RuleRegistry } from './rules/registry'

/** Linguagens que este servidor analisa. Qualquer outra é ignorada. */
export const SUPPORTED_LANGUAGES: readonly string[] = ['advpl', 'tlpp']

/**
 * Espera entre a última tecla e a reanálise.
 *
 * Sem isto, cada tecla dispara uma análise completa — que é exatamente como o
 * editor engasga. 250 ms é curto o bastante para o diagnóstico parecer imediato
 * e longo o bastante para engolir uma rajada de digitação.
 */
export const DEFAULT_DEBOUNCE_MS = 250

export interface DocumentSnapshot {
  readonly uri: string
  readonly languageId: string
  readonly version: number
  readonly text: string
}

export interface PublishedDiagnostics {
  readonly uri: string
  readonly version: number
  readonly diagnostics: Diagnostic[]
}

export interface DiagnosticsServiceOptions {
  readonly registry: RuleRegistry
  readonly publish: (payload: PublishedDiagnostics) => void
  readonly translate: (rule: RegisteredRule, args?: Readonly<Record<string, string | number>>) => string
  readonly docHrefOf: (rule: RegisteredRule) => string
  readonly isEnabled: (rule: RegisteredRule, uri: string) => boolean
  readonly severityOf: (rule: RegisteredRule, uri: string) => DiagnosticSeverity
  /** O índice de includes, para as regras que precisam dele (spec 002). */
  readonly includes?: IncludeIndexReader
  readonly debounceMs?: number
}

interface PendingWork {
  timer: NodeJS.Timeout | undefined
  cancellation: CancellationTokenSource | undefined
  running: Promise<void> | undefined
}

/**
 * O coração do servidor, separado da fiação do LSP para poder ser testado sem
 * subir um processo.
 *
 * Três garantias, todas do Princípio I:
 *
 * 1. Digitar CANCELA a análise anterior — de fato, não só descartando o
 *    resultado.
 * 2. A reanálise é espaçada.
 * 3. Resultado de versão vencida NUNCA sobrescreve o da versão atual. Sem esta
 *    regra, uma análise lenta que termina atrasada repinta a tela com
 *    diagnósticos de um texto que o usuário já mudou.
 */
export class DiagnosticsService {
  private readonly documents = new Map<string, DocumentSnapshot>()
  private readonly pending = new Map<string, PendingWork>()
  /**
   * O que foi publicado por documento.
   *
   * Existe para a ação "corrigir todas deste arquivo": ela precisa dos
   * diagnósticos do documento INTEIRO, e o pedido do editor só carrega os do
   * intervalo sob o cursor. Reanalisar para descobri-los seria refazer, dentro
   * do caminho da lâmpada, o trabalho que acabou de ser feito.
   */
  private readonly published = new Map<string, readonly Diagnostic[]>()
  private readonly debounceMs: number

  constructor(private readonly options: DiagnosticsServiceOptions) {
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  }

  open(snapshot: DocumentSnapshot): void {
    if (!SUPPORTED_LANGUAGES.includes(snapshot.languageId)) return
    this.documents.set(snapshot.uri, snapshot)
    // Abrir não espera: o usuário acabou de olhar o arquivo e quer ver o
    // resultado. O espaçamento existe para digitação, não para abertura.
    this.schedule(snapshot.uri, 0)
  }

  change(snapshot: DocumentSnapshot): void {
    if (!SUPPORTED_LANGUAGES.includes(snapshot.languageId)) return
    this.documents.set(snapshot.uri, snapshot)
    this.schedule(snapshot.uri, this.debounceMs)
  }

  close(uri: string): void {
    this.cancelPending(uri)
    this.documents.delete(uri)
    this.published.delete(uri)
    // Documento fechado não deixa diagnóstico órfão no painel.
    this.options.publish({ uri, version: 0, diagnostics: [] })
  }

  /** O texto e a versão correntes daquele documento, como o motor os conhece. */
  snapshotOf(uri: string): DocumentSnapshot | undefined {
    return this.documents.get(uri)
  }

  /** O que está publicado para aquele documento. Vazio se nada foi publicado ainda. */
  diagnosticsOf(uri: string): readonly Diagnostic[] {
    return this.published.get(uri) ?? []
  }

  /**
   * Reanalisa tudo o que está aberto.
   *
   * É o que a mudança de configuração aciona (US3): o usuário desliga uma regra
   * ou muda a severidade e o painel reage, sem reabrir arquivo e sem reiniciar
   * o editor.
   *
   * Passa pelo MESMO caminho debounced e cancelável da digitação — configuração
   * não é atalho para furar o Princípio I. Uma rajada de mudanças produz uma
   * análise, não uma por mudança.
   */
  revalidateAll(): void {
    for (const uri of this.documents.keys()) this.schedule(uri, this.debounceMs)
  }

  /** Aguarda o trabalho pendente terminar. Usado pelos testes e no encerramento. */
  async whenIdle(): Promise<void> {
    // Um giro basta na maioria dos casos, mas uma análise pode agendar outra;
    // o laço acompanha até a fila esvaziar de verdade.
    for (let guard = 0; guard < 1000; guard += 1) {
      const running = [...this.pending.values()].map((p) => p.running).filter(Boolean)
      const timers = [...this.pending.values()].filter((p) => p.timer !== undefined)
      if (running.length === 0 && timers.length === 0) return
      await Promise.all(running)
      await new Promise((resolve) => setTimeout(resolve, this.debounceMs + 1))
    }
  }

  dispose(): void {
    for (const uri of [...this.pending.keys()]) this.cancelPending(uri)
  }

  private schedule(uri: string, delayMs: number): void {
    // Cancelar ANTES de agendar: é isto que faz digitar interromper a análise
    // em curso em vez de deixá-la correr até o fim para jogar fora.
    this.cancelPending(uri)

    const work: PendingWork = { timer: undefined, cancellation: undefined, running: undefined }
    this.pending.set(uri, work)
    work.timer = setTimeout(() => {
      work.timer = undefined
      work.running = this.run(uri, work).finally(() => {
        work.running = undefined
        if (this.pending.get(uri) === work) this.pending.delete(uri)
      })
    }, delayMs)
  }

  private cancelPending(uri: string): void {
    const work = this.pending.get(uri)
    if (!work) return
    if (work.timer !== undefined) clearTimeout(work.timer)
    work.cancellation?.cancel()
    this.pending.delete(uri)
  }

  private async run(uri: string, work: PendingWork): Promise<void> {
    const snapshot = this.documents.get(uri)
    if (!snapshot) return

    const cancellation = new CancellationTokenSource()
    work.cancellation = cancellation

    try {
      const result = await analyze({
        document: createAnalyzedDocument(snapshot),
        rules: this.options.registry.all(),
        isEnabled: (rule) => this.options.isEnabled(rule, uri),
        severityOf: (rule) => this.options.severityOf(rule, uri),
        translate: this.options.translate,
        docHrefOf: this.options.docHrefOf,
        ...(this.options.includes ? { includes: this.options.includes } : {}),
        token: cancellation.token,
      })

      if (result.cancelled) return

      // A análise pode ter terminado enquanto uma versão mais nova chegava, ou
      // enquanto o usuário fechava a aba. Publicar em qualquer um dos dois
      // casos repintaria o painel com um texto que já não está na tela.
      //
      // Uma conferência basta: o documento corrente ainda ser exatamente o que
      // foi analisado. Uma segunda conferência contra a última versão publicada
      // seria redundante — se as versões batem aqui, nada mais novo foi
      // publicado — e ramo redundante é ramo que ninguém consegue testar.
      if (this.documents.get(uri)?.version !== snapshot.version) return

      this.published.set(uri, result.diagnostics)
      this.options.publish({ uri, version: snapshot.version, diagnostics: result.diagnostics })
    } finally {
      cancellation.dispose()
    }
  }
}
