import type { CancellationToken } from 'vscode-languageserver'
import {
  CodeActionKind,
  type CodeAction,
  type Diagnostic,
  type TextEdit,
  type WorkspaceEdit,
} from 'vscode-languageserver-types'

import type { AnalyzedDocument } from '../document/analyzed-document'

/**
 * O cálculo das ações de correção.
 *
 * Uma correção automática é a única coisa neste produto que **escreve** no
 * código de quem usa — todo o resto só aponta. Por isso o contrato aqui é mais
 * apertado que o de uma regra: a edição é o menor conjunto possível (FR-005),
 * não toca em encoding nem em fim de linha (FR-007), e é recusada quando o
 * documento mudou desde o cálculo (FR-006).
 *
 * O módulo é SÍNCRONO de propósito. O trabalho é percorrer os diagnósticos de
 * um documento — dezenas, não dezenas de milhares — e para cada um fatiar uma
 * palavra. Não há I/O, não há varredura de texto, e nada disso se aproxima do
 * orçamento do Princípio I. Fosse assíncrono, o `await` convidaria alguém a pôr
 * uma leitura de disco no meio.
 */

/** Os tipos que este servidor anuncia saber produzir. */
export const SUPPORTED_CODE_ACTION_KINDS: readonly string[] = [
  CodeActionKind.QuickFix,
  CodeActionKind.SourceFixAll,
]

/**
 * O conserto de UMA regra.
 *
 * Ele recebe o diagnóstico que a própria regra emitiu — com o intervalo já
 * calculado — e devolve as edições. Devolver lista vazia é a resposta legítima
 * para "não há o que fazer aqui": é assim que a idempotência do FR-012 se
 * expressa sem que o provedor precise saber de que regra se trata.
 */
export interface RuleFix {
  readonly ruleId: string
  /** Chave de tradução do título. Princípio V: nenhuma string literal. */
  readonly titleKey: string
  computeEdits(document: AnalyzedDocument, diagnostic: Diagnostic): readonly TextEdit[]
}

export interface CodeActionRequest {
  readonly document: AnalyzedDocument
  /** Os diagnósticos do intervalo pedido — a lâmpada trabalha sobre estes. */
  readonly diagnostics: readonly Diagnostic[]
  /** Todos os diagnósticos publicados do documento — é sobre estes que "corrigir tudo" trabalha. */
  readonly documentDiagnostics: readonly Diagnostic[]
  /** `context.only` do protocolo, quando o editor restringe os tipos que aceita. */
  readonly only?: readonly string[]
  readonly fixes: readonly RuleFix[]
  readonly isEnabled: (ruleId: string) => boolean
  /** A regra participa da correção em massa? (FR-018, D9) */
  readonly participatesInFixAll: (ruleId: string) => boolean
  readonly translate: (key: string, args?: Readonly<Record<string, string | number>>) => string
  readonly token: CancellationToken
}

/** O identificador da regra, como o diagnóstico o carrega. */
function ruleIdOf(diagnostic: Diagnostic): string | undefined {
  return typeof diagnostic.code === 'string' ? diagnostic.code : undefined
}

/**
 * O editor pediu este tipo de ação?
 *
 * Sem `only`, ele aceita tudo. Com `only`, a comparação é por PREFIXO porque é
 * assim que a hierarquia de tipos do protocolo funciona: pedir `source`
 * abrange `source.fixAll`.
 */
function wants(only: readonly string[] | undefined, kind: string): boolean {
  if (only === undefined || only.length === 0) return true
  return only.some((requested) => kind === requested || kind.startsWith(`${requested}.`))
}

/**
 * Ordena por posição e descarta o que se sobrepõe (FR-016).
 *
 * As duas coisas juntas são o que torna o resultado determinístico: a ordem de
 * registro das regras deixa de importar, e duas edições que disputassem o mesmo
 * trecho — o que hoje não acontece, porque `CA3001` toca a diretiva e `PJ0001`
 * o nome — nunca chegariam ao editor para produzir texto corrompido.
 */
export function orderAndDisjoin(edits: readonly TextEdit[]): TextEdit[] {
  const ordered = [...edits].sort((a, b) => {
    const line = a.range.start.line - b.range.start.line
    return line !== 0 ? line : a.range.start.character - b.range.start.character
  })

  const kept: TextEdit[] = []
  for (const edit of ordered) {
    const previous = kept[kept.length - 1]
    if (previous && overlaps(previous, edit)) continue
    kept.push(edit)
  }
  return kept
}

function overlaps(a: TextEdit, b: TextEdit): boolean {
  const endsAfterStart =
    a.range.end.line > b.range.start.line ||
    (a.range.end.line === b.range.start.line && a.range.end.character > b.range.start.character)
  return endsAfterStart
}

/**
 * Monta a alteração no formato VERSIONADO do protocolo.
 *
 * `documentChanges` com `OptionalVersionedTextDocumentIdentifier` faz o EDITOR
 * recusar a aplicação quando a versão não bate (FR-006, R7). A forma simples
 * (`changes`) perderia essa garantia — e o caminho de correção é assíncrono por
 * natureza: o usuário pede as ações, pensa, e clica. Entre uma coisa e outra ele
 * pode ter digitado, e uma edição por deslocamento sobre texto que mudou
 * corrompe o arquivo em silêncio.
 */
function versionedEdit(document: AnalyzedDocument, edits: readonly TextEdit[]): WorkspaceEdit {
  return {
    documentChanges: [
      {
        textDocument: { uri: document.uri, version: document.version },
        edits: [...edits],
      },
    ],
  }
}

export function computeCodeActions(request: CodeActionRequest): CodeAction[] {
  const { token } = request
  if (token.isCancellationRequested) return []

  const byRuleId = new Map(request.fixes.map((fix) => [fix.ruleId, fix]))
  const actions: CodeAction[] = []

  if (wants(request.only, CodeActionKind.QuickFix)) {
    for (const diagnostic of request.diagnostics) {
      // Conferir a CADA diagnóstico, e não uma vez no começo, é o que faz
      // "parar de fato" valer para o meio do trabalho. Custa uma leitura de
      // booleano por diagnóstico.
      if (token.isCancellationRequested) return []

      const fix = fixFor(byRuleId, diagnostic, request)
      if (!fix) continue

      const edits = orderAndDisjoin(fix.computeEdits(request.document, diagnostic))
      if (edits.length === 0) continue

      actions.push({
        title: request.translate(fix.titleKey, { ruleId: fix.ruleId }),
        kind: CodeActionKind.QuickFix,
        // Vincular ao diagnóstico é o FR-004: o usuário precisa saber QUAL
        // regra está sendo corrigida, e é isto que o editor usa para riscar a
        // marca assim que a correção é aplicada.
        diagnostics: [diagnostic],
        edit: versionedEdit(request.document, edits),
      })
    }
  }

  if (wants(request.only, CodeActionKind.SourceFixAll)) {
    const fixAll = computeFixAll(byRuleId, request)
    if (fixAll) actions.push(fixAll)
  }

  return token.isCancellationRequested ? [] : actions
}

/** O conserto aplicável àquele diagnóstico, ou `undefined` se não houver. */
function fixFor(
  byRuleId: ReadonlyMap<string, RuleFix>,
  diagnostic: Diagnostic,
  request: CodeActionRequest,
): RuleFix | undefined {
  const ruleId = ruleIdOf(diagnostic)
  if (ruleId === undefined) return undefined

  const fix = byRuleId.get(ruleId)
  if (!fix) return undefined

  // FR-008: a lâmpada NÃO ressuscita o que o usuário desligou. A conferência
  // vem ANTES de calcular a edição — "calcular e jogar fora" dá o mesmo
  // resultado na tela e custa o cálculo.
  if (!request.isEnabled(ruleId)) return undefined

  return fix
}

/**
 * "Corrigir todas deste arquivo" — a ação que habilita a correção ao salvar.
 *
 * `source.fixAll` não é convenção nossa: é o tipo que o VS Code procura para
 * `editor.codeActionsOnSave`. Declará-lo é o que faz "corrigir ao salvar"
 * funcionar sem nenhuma linha de código do lado do cliente.
 *
 * Devolve `undefined` — e não uma ação com zero edições — quando não há o que
 * corrigir: uma ação vazia oferecida ao salvamento marcaria o documento como
 * modificado sem ter mudado nada (FR-015).
 */
function computeFixAll(
  byRuleId: ReadonlyMap<string, RuleFix>,
  request: CodeActionRequest,
): CodeAction | undefined {
  const collected: TextEdit[] = []
  const covered: Diagnostic[] = []

  for (const diagnostic of request.documentDiagnostics) {
    if (request.token.isCancellationRequested) return undefined

    const fix = fixFor(byRuleId, diagnostic, request)
    if (!fix) continue

    // A segunda chave, independente do desligamento da regra (FR-018):
    // corrigir em massa é mais invasivo que apontar, e `PJ0001` nasce de fora
    // (FR-040, D9) porque trocar o nome de um arquivo muda o que o compilador
    // vai procurar — trocar a diretiva é inerte por medição.
    if (!request.participatesInFixAll(fix.ruleId)) continue

    const edits = fix.computeEdits(request.document, diagnostic)
    if (edits.length === 0) continue

    collected.push(...edits)
    covered.push(diagnostic)
  }

  const edits = orderAndDisjoin(collected)
  if (edits.length === 0) return undefined

  return {
    title: request.translate('action.fixAll.title'),
    kind: CodeActionKind.SourceFixAll,
    diagnostics: covered,
    // TODAS as edições numa `WorkspaceEdit` só: é isso, e não um laço de
    // aplicações, que faz o editor agrupá-las em UMA operação de desfazer
    // (FR-013).
    edit: versionedEdit(request.document, edits),
  }
}
