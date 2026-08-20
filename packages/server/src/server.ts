import { join } from 'node:path'
import {
  createConnection,
  ProposedFeatures,
  TextDocumentSyncKind,
  type InitializeParams,
  type InitializeResult,
} from 'vscode-languageserver/node'

import { DiagnosticsService, SUPPORTED_LANGUAGES } from './service'
import { RuleRegistry } from './rules/registry'
import { ca3001 } from './rules/ca3001'
import { pj0001 } from './rules/pj0001'
import { computeCodeActions, SUPPORTED_CODE_ACTION_KINDS, type RuleFix } from './actions/provider'
import { ca3001Fix } from './actions/ca3001-fix'
import { createPj0001Fix } from './actions/pj0001-fix'
import { createAnalyzedDocument } from './document/analyzed-document'
import { IncludeIndexStore } from './includes/index-store'
import { handleWatchedFileChanges } from './includes/watcher'
import { CONFIG_ROOT, Settings } from './config/settings'
import { createTranslator, loadBundles, normalizeLocale, type Translator } from './l10n/messages'
import { createLogChannel } from './logging/channel'

/**
 * Fiação do Language Server.
 *
 * Este arquivo é DELIBERADAMENTE fino: ele conecta o protocolo ao serviço e não
 * decide nada. Toda lógica que valha a pena testar mora em `service.ts`,
 * `analysis/` e `rules/` — que rodam sem processo de editor nenhum.
 *
 * Ele está na lista de exclusão de cobertura, com razão registrada em
 * `coverage-exclusions.json`: o que sobra aqui só se exercita com um servidor
 * de verdade do outro lado do cano, e isso é trabalho dos testes de integração.
 */

const DOCS_BASE_URL = 'https://github.com/robsonrosilva/Lint-ADVPL/blob/master/docs/regras'

/**
 * A notificação pela qual o cliente entrega os diretórios de include.
 *
 * O nome está declarado também em
 * `packages/extension/src/include-sources/vscode-adapters.ts`, e não há como o
 * compilador ligar os dois — são processos diferentes, e o motor não depende do
 * pacote da extensão. É a mesma situação de `CONFIG_ROOT`. A divergência
 * apareceria como "o índice nunca fica pronto", que é o teste de integração de
 * `PJ0001`.
 */
const INCLUDE_DIRECTORIES_NOTIFICATION = 'advplLint/includeDirectories'

const connection = createConnection(ProposedFeatures.all)
const log = createLogChannel((line) => connection.console.log(line))

const registry = new RuleRegistry()
registry.register(ca3001)
// Nasce LIGADA (FR-036), com a taxa de falso positivo MEDIDA em 2026-08-20: 0%
// em 120 disparos revisados à mão. Quem declara o padrão é a própria regra, e o
// registro é a fonte única de onde saem tanto as chaves do manifesto quanto a
// resposta de "esta regra está ligada?".
registry.register(pj0001)

let translate: Translator = (key) => key
let service: DiagnosticsService | undefined

const settings = new Settings()

/**
 * O índice de includes (spec 002).
 *
 * Ele nasce VAZIO e não varre nada: a construção é sob demanda, disparada pela
 * primeira regra que precisar dele (FR-021). Nada de indexação na ativação — é
 * o Princípio I explícito, e o orçamento de 50 ms de trabalho próprio não
 * comporta nem o começo de uma varredura de 35 mil arquivos.
 */
const includeIndex = new IncludeIndexStore({
  /**
   * O progresso da indexação, e a via pela qual o usuário a cancela (FR-022).
   *
   * `createWorkDoneProgress` resolve as duas metades do requisito de uma vez: o
   * relato aparece na barra de status do editor, e o `token` dele é cancelado
   * quando o usuário clica em cancelar. O índice só reporta números e fecha; a
   * FRASE é montada aqui, porque o motor não conhece idioma (Princípio V).
   *
   * Isto passou a importar mais depois que `PJ0001` nasceu ligada: a primeira
   * abertura de fonte de cada sessão dispara uma varredura que, no corpus de
   * referência, leva ~9,4 s. Sem relato, ela é indistinguível de um travamento.
   */
  beginProgress: async () => {
    const progress = await connection.window.createWorkDoneProgress()
    progress.begin(
      translate('includes.progress.title'),
      // Sem percentual: não se sabe quantos diretórios existem antes de varrer,
      // e uma barra que inventa progresso mente sobre quanto falta.
      undefined,
      undefined,
      // Cancelável — é o que o FR-022 pede, e o que o SC-006 afere.
      true,
    )
    return {
      token: progress.token,
      report: (lidos: number) => progress.report(translate('includes.progress.scanned', { lidos })),
      done: () => progress.done(),
    }
  },
  // O índice mudou: os documentos abertos passam pelo MESMO caminho debounced e
  // cancelável da digitação (FR-025). Reanalisar direto seria furar o
  // Princípio I por uma porta lateral.
  onChanged: () => service?.revalidateAll(),
  // UM aviso por sessão, nunca um por arquivo aberto (FR-026). Um aviso por
  // arquivo vira ruído em minutos e treina o usuário a fechar sem ler.
  onUnreadable: (directories) => {
    void connection.window.showWarningMessage(
      translate('includes.unreadable', { count: directories.length, directories: directories.join(', ') }),
    )
  },
})

/**
 * Os consertos disponíveis, por regra. Regra sem entrada aqui só aponta.
 *
 * `PJ0001` está aqui mas fica FORA do "corrigir tudo" por padrão — quem decide
 * isso é `advplLint.fixAll.includeRules` (FR-040, D9). Estar na lista de
 * consertos é ter lâmpada; participar da correção em massa é outra decisão.
 */
const fixes: RuleFix[] = [ca3001Fix, createPj0001Fix(includeIndex)]

connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
  const locale = normalizeLocale(params.locale)
  // Dois candidatos porque o caminho depende de como o servidor foi iniciado:
  // empacotado por esbuild (dist/l10n, copiado no build) ou compilado por tsc
  // (packages/server/l10n). Assumir só um deixava o outro mudo — e mudo aqui
  // significa a chave crua indo para o painel de problemas do usuário.
  const { base, localized } = await loadBundles(
    [join(__dirname, 'l10n'), join(__dirname, '..', '..', 'l10n')],
    locale,
  )
  translate = createTranslator(base, localized)

  service = new DiagnosticsService({
    registry,
    publish: ({ uri, version, diagnostics }) => {
      void connection.sendDiagnostics({ uri, version, diagnostics })
    },
    translate: (rule, args) => translate(rule.messageKey, args),
    docHrefOf: (rule) => `${DOCS_BASE_URL}/${rule.id}.md`,
    isEnabled: (rule) => settings.isEnabled(rule),
    severityOf: (rule) => settings.severityOf(rule),
    includes: includeIndex,
  })

  log.info(() => `servidor pronto, idioma ${locale}, ${registry.all().length} regra(s)`)

  return {
    capabilities: {
      // Incremental seria mais barato no cano, mas exige manter o buffer
      // sincronizado à mão. Enquanto o custo de análise for o que é, o texto
      // completo é mais simples e não aparece na medição.
      textDocumentSync: TextDocumentSyncKind.Full,
      // `source.fixAll` não é convenção nossa: é o tipo que o VS Code procura
      // para `editor.codeActionsOnSave`. Declará-lo aqui é o que habilita
      // "corrigir ao salvar" sem nenhuma linha de código no cliente.
      codeActionProvider: { codeActionKinds: [...SUPPORTED_CODE_ACTION_KINDS] },
    },
  }
})

/**
 * As ações de correção (spec 002).
 *
 * O manipulador é síncrono porque o cálculo é: percorrer os diagnósticos já
 * publicados e fatiar uma palavra em cada um. Nada de I/O, nada de varredura de
 * texto. O `token` do protocolo é repassado ao cálculo, que confere a cada
 * diagnóstico — pedido substituído por outro é abandonado de fato, não
 * descartado no fim (FR-002).
 */
connection.onCodeAction((params, token) => {
  const snapshot = service?.snapshotOf(params.textDocument.uri)
  if (!snapshot) return []

  return computeCodeActions({
    document: createAnalyzedDocument(snapshot),
    diagnostics: params.context.diagnostics,
    documentDiagnostics: service?.diagnosticsOf(params.textDocument.uri) ?? [],
    ...(params.context.only ? { only: params.context.only } : {}),
    fixes,
    isEnabled: (ruleId) => {
      const rule = registry.get(ruleId)
      return rule !== undefined && settings.isEnabled(rule)
    },
    participatesInFixAll: (ruleId) => settings.participatesInFixAll(ruleId),
    translate: (key, args) => translate(key, args),
    token,
  })
})

/**
 * O cliente resolveu a cadeia de fontes e manda os diretórios (FR-027).
 *
 * O motor NÃO lê configuração de extensão nenhuma: três das quatro fontes só
 * existem através da API do editor, e o arquivo da fonte 1 guarda tokens. O que
 * atravessa a fronteira é uma lista de caminhos e o nome da fonte que venceu.
 */
connection.onNotification(INCLUDE_DIRECTORIES_NOTIFICATION, (payload: unknown) => {
  const directories = (payload as { directories?: unknown })?.directories
  const winner = (payload as { winner?: unknown })?.winner

  includeIndex.setDirectories(
    Array.isArray(directories) ? directories.filter((d): d is string => typeof d === 'string') : [],
  )
  log.info(() => `diretórios de include: fonte "${String(winner)}", ${includeIndex.directories.length}`)
})

/**
 * Include criado, renomeado ou apagado (FR-024).
 *
 * A invalidação é POR DIRETÓRIO, nunca do índice inteiro — é a mitigação do
 * risco que o plano manda vigiar.
 */
connection.onDidChangeWatchedFiles(({ changes }) => {
  handleWatchedFileChanges(changes, includeIndex)
})

/**
 * Mudança de configuração revalida o que está aberto (US3).
 *
 * O cliente manda o bloco inteiro; o servidor troca o estado e reanalisa pelo
 * mesmo caminho debounced — configuração não é atalho para furar o Princípio I.
 */
connection.onDidChangeConfiguration((change) => {
  const raw = (change.settings as Record<string, unknown> | undefined)?.[CONFIG_ROOT]
  settings.update(raw)
  log.info(() => 'configuração mudou, revalidando documentos abertos')
  service?.revalidateAll()
})

connection.onDidOpenTextDocument(({ textDocument }) => {
  if (!SUPPORTED_LANGUAGES.includes(textDocument.languageId)) return
  service?.open({
    uri: textDocument.uri,
    languageId: textDocument.languageId,
    version: textDocument.version,
    text: textDocument.text,
  })
})

connection.onDidChangeTextDocument(({ textDocument, contentChanges }) => {
  const full = contentChanges[contentChanges.length - 1]
  if (!full || !('text' in full)) return
  service?.change({
    uri: textDocument.uri,
    // A linguagem não vem no evento de alteração; o serviço já guarda o
    // documento desde a abertura, e reenviá-la aqui seria inventar dado.
    languageId: 'advpl',
    version: textDocument.version,
    text: full.text,
  })
})

connection.onDidCloseTextDocument(({ textDocument }) => {
  service?.close(textDocument.uri)
})

connection.onShutdown(() => {
  service?.dispose()
  includeIndex.dispose()
})

connection.listen()
