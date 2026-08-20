import { CancellationTokenSource, type CancellationToken } from 'vscode-languageserver'

import { scanIncludeDirectories, type ScanOptions, type ScanResult } from './scan'

/**
 * O índice de includes: o que existe no disco, e com que grafia.
 *
 * ## Os três estados, e por que são três
 *
 * | Estado | Significa | `PJ0001` |
 * | ------ | --------- | -------- |
 * | `ausente` | nenhum diretório utilizável, ou ainda não pedido | cala |
 * | `construindo` | varredura em curso | cala |
 * | `pronto` | o índice responde | consulta |
 *
 * "Ainda não sei" e "já sei que não achei" levam ao mesmo silêncio na tela, por
 * razões opostas. Colapsá-los produziria o pior resultado possível: a regra
 * disparando sobre um índice pela metade, acusando ausência de arquivos que
 * existem e ainda não foram lidos.
 *
 * ## As três respostas, pela mesma razão
 *
 * `ausente` não é `ambíguo`. "Não achei" é assunto de outra regra (FR-032);
 * "achei dois com caixas diferentes" é adivinhação recusada (FR-033). Um
 * silêncio só, sem razão declarada, esconderia um diretório mal apontado.
 *
 * ## A consulta NÃO espera
 *
 * `lookup` é síncrono e responde com o que sabe AGORA. É o que impede o índice
 * de virar bloqueio: um `await` dele dentro do caminho de análise faria a
 * primeira abertura de arquivo esperar por dezenas de milhares de leituras de
 * disco, e o orçamento de 300 ms do Princípio I morreria na hora.
 */

export type IncludeIndexState = 'ausente' | 'construindo' | 'pronto'

export interface IncludeEntry {
  /** O nome como o disco o escreveu. */
  readonly realName: string
  readonly directory: string
}

export type IncludeLookup =
  | { readonly kind: 'encontrado'; readonly entry: IncludeEntry }
  | { readonly kind: 'ausente' }
  | { readonly kind: 'ambíguo'; readonly candidates: readonly IncludeEntry[] }

/**
 * O relato de progresso da indexação (FR-022).
 *
 * Deliberadamente estreito: o índice informa **quantos diretórios já leu**, e
 * quem transforma isso em frase é quem abriu o relato. O motor não conhece
 * idioma — Princípio V — e não tem por que conhecer.
 *
 * `token` é a outra metade do requisito: é por ele que o **usuário** cancela.
 * O cancelamento já existia e já parava de fato; o que faltava era a via para
 * ele ser acionado de fora.
 */
export interface IndexProgressReporter {
  /** Quantos diretórios foram lidos até agora. */
  report(directoriesScanned: number): void
  /** Fecha o relato. Relato aberto e nunca fechado deixa a barra girando. */
  done(): void
  /** Cancelamento vindo do usuário. */
  readonly token: CancellationToken
}

export interface IncludeIndexOptions {
  /** Injetável para teste; em produção é o percurso de verdade. */
  readonly scan?: (options: ScanOptions) => Promise<ScanResult>
  /** O índice mudou: hora de revalidar os documentos abertos (FR-025). */
  readonly onChanged?: () => void
  /**
   * Diretórios que não deu para ler.
   *
   * Chamado NO MÁXIMO UMA VEZ por sessão (FR-026). Um aviso por arquivo aberto
   * vira ruído em minutos, e o usuário aprende a fechar sem ler — o mesmo
   * mecanismo pelo qual regra ruidosa faz o painel inteiro ser ignorado.
   */
  readonly onUnreadable?: (directories: readonly string[]) => void
  /**
   * Abre um relato de progresso **já iniciado**, com título traduzido.
   *
   * Já iniciado de propósito: o título é texto ao usuário, e o motor não monta
   * texto ao usuário. Quem chama abre, dá o título e a possibilidade de
   * cancelar; o índice só reporta números e fecha.
   *
   * Opcional porque o cliente pode não anunciar a capacidade de progresso — e
   * porque `window/workDoneProgress/create` é um PEDIDO ao cliente, que pode
   * falhar. Perder a barra não pode custar o índice.
   */
  readonly beginProgress?: () => Promise<IndexProgressReporter>
}

/** O que o índice guarda por nome normalizado. */
interface Bucket {
  /** Uma entrada por GRAFIA distinta. Duas ou mais ⟹ ambíguo. */
  readonly bySpelling: Map<string, IncludeEntry>
}

export class IncludeIndexStore {
  private directoriesInUse: readonly string[] = []
  /** Arquivos por diretório de RAIZ, para poder invalidar um sem perder os outros. */
  private readonly byRoot = new Map<string, readonly IncludeEntry[]>()
  private buckets = new Map<string, Bucket>()
  private building: Promise<void> | undefined
  private cancellation: CancellationTokenSource | undefined
  private disposed = false
  private warnedAboutUnreadable = false
  private readonly scan: (options: ScanOptions) => Promise<ScanResult>

  constructor(private readonly options: IncludeIndexOptions = {}) {
    this.scan = options.scan ?? scanIncludeDirectories
  }

  get state(): IncludeIndexState {
    if (this.building !== undefined) return 'construindo'
    if (this.directoriesInUse.length === 0) return 'ausente'
    return this.byRoot.size === this.directoriesInUse.length ? 'pronto' : 'ausente'
  }

  get directories(): readonly string[] {
    return this.directoriesInUse
  }

  /**
   * Os diretórios que o cliente resolveu (FR-027).
   *
   * Receber os MESMOS não joga o índice fora: o cliente reafirma a cada mudança
   * de configuração, e reindexar a cada reafirmação faria uma sessão com o
   * painel de configurações aberto varrer a árvore inteira a cada tecla.
   */
  setDirectories(directories: readonly string[]): void {
    const next = [...new Set(directories)]
    if (sameList(next, this.directoriesInUse)) return

    this.cancelBuild()
    this.directoriesInUse = next
    this.byRoot.clear()
    this.buckets = new Map()
  }

  /**
   * Constrói, se ainda não construiu. **Não espera** — e é isso que faz a
   * indexação ser sob demanda sem virar bloqueio (FR-021, FR-023).
   */
  ensureBuilt(): void {
    if (this.disposed) return
    if (this.building !== undefined) return
    if (this.directoriesInUse.length === 0) return

    const pending = this.directoriesInUse.filter((dir) => !this.byRoot.has(dir))
    if (pending.length === 0) return

    this.startBuild(pending)
  }

  lookup(fileName: string): IncludeLookup {
    if (this.state !== 'pronto') return { kind: 'ausente' }

    const bucket = this.buckets.get(fileName.toLowerCase())
    if (!bucket) return { kind: 'ausente' }

    const spellings = [...bucket.bySpelling.values()]
    // Uma grafia só: não há o que decidir, mesmo que ela apareça em dois
    // diretórios. Chamar isso de ambíguo calaria a regra em toda árvore com
    // espelho.
    if (spellings.length === 1) return { kind: 'encontrado', entry: spellings[0]! }

    return { kind: 'ambíguo', candidates: spellings }
  }

  /**
   * Um diretório mudou (FR-024).
   *
   * Revarre **apenas o diretório de raiz que o contém**, nunca a árvore toda.
   * Numa árvore de 35 mil arquivos, reindexação total a cada salvamento de
   * include é o defeito do legado com outro nome.
   */
  invalidateDirectory(directory: string): void {
    const root = this.rootContaining(directory)
    if (root === undefined) return

    this.byRoot.delete(root)
    this.rebuildBuckets()
    this.startBuild([root])
  }

  /** Aguarda a construção pendente. Usado pelos testes e no encerramento. */
  async whenIdle(): Promise<void> {
    for (let guard = 0; guard < 100; guard += 1) {
      if (this.building === undefined) return
      await this.building
    }
  }

  dispose(): void {
    this.disposed = true
    this.cancelBuild()
  }

  private startBuild(pending: readonly string[]): void {
    const cancellation = new CancellationTokenSource()
    this.cancellation = cancellation

    this.building = this.runBuild(pending, cancellation)
      .catch(() => {
        // Falha imprevista na varredura degrada em silêncio para a regra: sem
        // índice, `PJ0001` cala. Derrubar o servidor por causa do disco seria
        // trocar um silêncio por um travamento.
      })
      .finally(() => {
        cancellation.dispose()
        if (this.cancellation === cancellation) this.cancellation = undefined
        this.building = undefined
      })
  }

  private async runBuild(
    pending: readonly string[],
    cancellation: CancellationTokenSource,
  ): Promise<void> {
    const progress = await this.openProgress(cancellation)

    let scanned = 0
    try {
      const result = await this.scan({
        directories: pending,
        token: cancellation.token,
        onDirectory: () => {
          scanned += 1
          progress?.report(scanned)
        },
      })
      this.publish(pending, result, cancellation)
    } finally {
      // No `finally`: varredura que falha ou é cancelada também fecha o relato.
      // Sem isto, a barra ficaria girando para sempre depois de um erro.
      progress?.done()
    }
  }

  /**
   * Abre o relato e liga o cancelamento do usuário ao da varredura.
   *
   * Falha ao abrir devolve `undefined` e a construção segue: `createWorkDoneProgress`
   * é um pedido ao cliente, e um cliente que não responde não pode custar o índice.
   */
  private async openProgress(
    cancellation: CancellationTokenSource,
  ): Promise<IndexProgressReporter | undefined> {
    if (!this.options.beginProgress) return undefined

    try {
      const progress = await this.options.beginProgress()
      // É AQUI que o usuário passa a poder cancelar. O token dele não substitui
      // o interno — ele o dispara, e o interno é quem a varredura confere.
      progress.token.onCancellationRequested(() => cancellation.cancel())
      // O usuário pode ter cancelado antes de o relato abrir.
      if (progress.token.isCancellationRequested) cancellation.cancel()
      return progress
    } catch {
      return undefined
    }
  }

  private publish(
    pending: readonly string[],
    result: ScanResult,
    cancellation: CancellationTokenSource,
  ): void {

    // Cancelado NÃO vira índice pronto. Publicar um índice pela metade como se
    // estivesse completo é justamente o que os três estados existem para
    // impedir.
    //
    // São DUAS conferências, e as duas são precisas: o percurso pode terminar
    // sem se dar conta do cancelamento — ele confere entre diretórios, e o
    // cancelamento pode chegar depois do último. A segunda pergunta ao token,
    // que é a autoridade.
    if (result.cancelled || cancellation.token.isCancellationRequested) return

    for (const root of pending) {
      this.byRoot.set(
        root,
        result.files.filter((file) => isUnder(file.directory, root)),
      )
    }
    this.rebuildBuckets()

    if (result.unreadable.length > 0) this.warnOnce(result.unreadable)
    this.options.onChanged?.()
  }

  /**
   * O aviso único da sessão (FR-026).
   *
   * A bandeira é do OBJETO, não da chamada: uma sessão que reindexa dez vezes
   * uma unidade de rede fora do ar produz um aviso, não dez.
   */
  private warnOnce(directories: readonly string[]): void {
    if (this.warnedAboutUnreadable) return
    this.warnedAboutUnreadable = true
    this.options.onUnreadable?.(directories)
  }

  private cancelBuild(): void {
    this.cancellation?.cancel()
  }

  /** Remonta o mapa de consulta a partir do que cada raiz contribuiu. */
  private rebuildBuckets(): void {
    const buckets = new Map<string, Bucket>()

    for (const entries of this.byRoot.values()) {
      for (const entry of entries) {
        const key = entry.realName.toLowerCase()
        let bucket = buckets.get(key)
        if (!bucket) {
          bucket = { bySpelling: new Map() }
          buckets.set(key, bucket)
        }
        // A chave é a GRAFIA: o mesmo nome escrito igual em dois diretórios
        // conta uma vez, e a primeira ocorrência — pela precedência da cadeia —
        // é a que fica.
        if (!bucket.bySpelling.has(entry.realName)) bucket.bySpelling.set(entry.realName, entry)
      }
    }

    this.buckets = buckets
  }

  private rootContaining(directory: string): string | undefined {
    return this.directoriesInUse.find((root) => isUnder(directory, root))
  }
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index])
}

/** O caminho está dentro daquela raiz (ou é ela)? Comparação textual, normalizada. */
function isUnder(path: string, root: string): boolean {
  const p = normalize(path)
  const r = normalize(root)
  return p === r || p.startsWith(`${r}/`)
}

function normalize(path: string): string {
  // Separador e caixa não podem decidir isto: no Windows, o mesmo diretório
  // chega escrito das duas formas conforme a origem do evento. É a única
  // comparação deste módulo que ignora caixa — e ela é sobre CAMINHO, não sobre
  // nome de arquivo, que é o objeto da spec.
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

/**
 * O que uma REGRA enxerga do índice.
 *
 * Deliberadamente menor que a classe: a regra consulta e pede a construção, e
 * não tem como trocar os diretórios nem invalidar nada.
 *
 * ⚠️ **Isto não fura o Princípio I**, e vale dizer por quê, porque parece que
 * sim. `RuleContext` não entrega sistema de arquivos a ninguém — e continua não
 * entregando. `lookup` é SÍNCRONO e responde com um mapa em memória;
 * `ensureBuilt` dispara a varredura e **não espera** por ela. Uma regra não
 * consegue, por este contrato, bloquear a análise esperando o disco.
 */
export interface IncludeIndexReader {
  readonly state: IncludeIndexState
  lookup(fileName: string): IncludeLookup
  /** Pede a construção sob demanda (FR-021). Retorna imediatamente. */
  ensureBuilt(): void
}

/**
 * O índice que não existe.
 *
 * Serve a quem analisa sem cadeia de includes resolvida — o harness de medição
 * e os testes das outras regras. Com ele, `PJ0001` cala, que é exatamente o
 * comportamento previsto quando não há diretório utilizável (FR-023).
 */
export const EMPTY_INCLUDE_INDEX: IncludeIndexReader = {
  state: 'ausente',
  lookup: () => ({ kind: 'ausente' }),
  ensureBuilt: () => {},
}
