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

const connection = createConnection(ProposedFeatures.all)
const log = createLogChannel((line) => connection.console.log(line))

const registry = new RuleRegistry()
registry.register(ca3001)

let translate: Translator = (key) => key
let service: DiagnosticsService | undefined

const settings = new Settings()

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
  })

  log.info(() => `servidor pronto, idioma ${locale}, ${registry.all().length} regra(s)`)

  return {
    capabilities: {
      // Incremental seria mais barato no cano, mas exige manter o buffer
      // sincronizado à mão. Enquanto o custo de análise for o que é, o texto
      // completo é mais simples e não aparece na medição.
      textDocumentSync: TextDocumentSyncKind.Full,
    },
  }
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
})

connection.listen()
