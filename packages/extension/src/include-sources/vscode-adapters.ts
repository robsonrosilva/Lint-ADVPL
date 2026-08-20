import { homedir } from 'node:os'
import * as vscode from 'vscode'
import * as l10n from '@vscode/l10n'

import { extractAdvplIncludeList } from './advpl-vscode'
import {
  describeResolution,
  resolveIncludeSources,
  type IncludeSource,
  type ResolvedSources,
} from './chain'
import { normalizeIncludePaths } from './own-setting'
import { readTdsIncludes, tdsServersFile } from './tds-vscode'
import { workspaceIncludeDirectories } from './workspace-scan'

/**
 * A ÚNICA parte da cadeia de fontes que toca a API do editor.
 *
 * Tudo o que decide alguma coisa — a precedência, o que é "utilizável", como
 * separar `includeList`, o que sai da leitura de `servers.json` — mora nos
 * módulos vizinhos, que são Node puro e rodam na suíte unitária em
 * milissegundos. Aqui sobra a leitura da configuração viva e o registro do
 * comando, que só existem dentro de um VS Code.
 *
 * É a mesma fronteira que separa `encoding-policy.ts` de `encoding-guard.ts`, e
 * é o que permite ao SC-016 ser provado sem subir um editor.
 */

/**
 * O nome da notificação que leva os diretórios ao motor.
 *
 * O servidor precisa conhecê-lo também, e não há como o compilador ligar os
 * dois — são processos diferentes, e o motor não depende deste pacote. É a
 * mesma situação de `CONFIG_SECTION` em `client.ts`; a divergência apareceria
 * como "o índice nunca fica pronto", que é o teste de integração de `PJ0001`.
 */
export const INCLUDE_DIRECTORIES_NOTIFICATION = 'advplLint/includeDirectories'

/**
 * Os tipos de evento do `workspace/didChangeWatchedFiles`, como o protocolo os
 * numera. Declarados aqui para não trazer a dependência do protocolo ao cliente.
 */
export const FILE_CREATED = 1
export const FILE_DELETED = 3

/** Um evento de arquivo, na forma que o protocolo espera. */
export interface WatchedFileEvent {
  readonly uri: string
  readonly type: number
}

/** O que o cliente precisa mandar ao motor. */
export interface IncludeSourcesChannel {
  /** Os diretórios resolvidos pela cadeia. */
  sendDirectories(resolution: ResolvedSources): void
  /**
   * Include criado ou apagado num dos diretórios observados.
   *
   * ⚠️ Precisa ser enviado à mão, e isso NÃO é redundância com o observador do
   * cliente LSP. O `LanguageClient` só encaminha ao servidor os eventos dos
   * watchers declarados em `synchronize.fileEvents`, que é fixado na construção
   * do cliente — antes de qualquer diretório de include ser conhecido. Um
   * watcher criado depois dispara no processo da extensão e morre ali.
   *
   * Foi exatamente esse o defeito: o observador funcionava, o índice sabia
   * invalidar, e nada ligava um ao outro. Cada elo tinha teste unitário; a
   * corrente inteira, não — e ela estava rompida.
   */
  sendFileEvents(events: readonly WatchedFileEvent[]): void
}

/** Raiz do espaço de nomes da configuração deste produto. */
const CONFIG_SECTION = 'advplLint'

/**
 * Monta as quatro fontes, na ordem do FR-027.
 *
 * Lê a configuração **sem recurso**, que é o escopo padrão do VS Code: ele já
 * enxerga o valor definido no workspace, que é o que o FR-027e pede.
 *
 * Houve aqui um parâmetro `scope?: vscode.Uri` que **nenhum chamador passava** —
 * generalidade especulativa, removida na convergência de 2026-08-20. Ele só
 * teria uso para ler a chave por PASTA em workspace de várias raízes, o que vai
 * além do requisito e exigiria um índice por pasta para fazer sentido. Quando
 * essa necessidade aparecer, ela vem com spec e teste.
 */
export function buildIncludeSources(): IncludeSource[] {
  return [
    {
      order: 1,
      name: 'totvs.tds-vscode',
      resolve: () => readTdsIncludes(tdsServersFile(homedir())),
    },
    {
      order: 2,
      name: 'killerall.advpl-vscode',
      resolve: async () => {
        const advpl = vscode.workspace.getConfiguration('advpl')
        return extractAdvplIncludeList(
          advpl.get('environments'),
          advpl.get('selectedEnvironment'),
        )
      },
    },
    {
      order: 3,
      name: `${CONFIG_SECTION}.includePaths`,
      resolve: async () =>
        normalizeIncludePaths(
          vscode.workspace.getConfiguration(CONFIG_SECTION).get('includePaths'),
        ),
    },
    {
      order: 4,
      name: 'workspace',
      resolve: async () =>
        workspaceIncludeDirectories(
          (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
        ),
    },
  ]
}

export async function resolveForEditor(): Promise<ResolvedSources> {
  return resolveIncludeSources(buildIncludeSources())
}

/**
 * Registra o comando do FR-027c e mantém o motor informado.
 *
 * `send` é injetado em vez de o módulo conhecer o cliente LSP: a extensão sobe o
 * servidor em segundo plano, e este registro acontece no caminho de ativação,
 * onde o Princípio I orça 50 ms de trabalho próprio. Nada aqui espera pelo
 * servidor.
 *
 * A resolução em si é `void`: ela toca o disco (a sonda de existência), e o
 * caminho de ativação **não** espera por I/O.
 */
export function registerIncludeSources(
  context: vscode.ExtensionContext,
  channel: IncludeSourcesChannel,
): void {
  /**
   * Observadores dos diretórios de include, um por diretório em uso.
   *
   * ⚠️ Observar DIRETÓRIOS, nunca arquivos individuais. O plano registra este
   * como o risco desta spec: pôr um observador em dezenas de milhares de
   * arquivos é fonte clássica de travamento — Princípio I sob outro nome, e o
   * defeito que matou a versão anterior.
   *
   * O padrão é restrito à extensão de include, e o evento chega ao servidor
   * como invalidação de UM diretório.
   *
   * `synchronize.fileEvents` do cliente não serve aqui: ele só alcança o
   * workspace aberto, e a árvore de includes do Protheus costuma ficar FORA
   * dele — foi a razão de a varredura do workspace ser o quarto degrau da
   * cadeia, não o primeiro.
   */
  let watchers: vscode.Disposable[] = []

  const disposeWatchers = (): void => {
    for (const watcher of watchers) watcher.dispose()
    watchers = []
  }

  // UM registro em `context.subscriptions`, e não um por watcher.
  //
  // A primeira versão empilhava cada watcher em `subscriptions` a cada
  // resolução da cadeia e descartava os antigos à mão — então `subscriptions`
  // crescia sem limite e, no encerramento, o editor descartava de novo o que já
  // tinha sido descartado. Em Windows isso saía como
  // `PostQueuedCompletionStatus: (6) Identificador inválido` e um código de
  // saída de abort DEPOIS de todos os testes passarem.
  context.subscriptions.push({ dispose: disposeWatchers })

  const watchDirectories = (directories: readonly string[]): void => {
    disposeWatchers()

    for (const directory of directories) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(directory), '**/*.[cC][hH]'),
        false,
        // Alteração de CONTEÚDO é ignorada na origem: o índice guarda nome e
        // diretório, nunca conteúdo. Sem isto, salvar um include disparia uma
        // revarredura que não muda nada.
        true,
        false,
      )

      // O encaminhamento ao motor é EXPLÍCITO — ver `sendFileEvents`.
      // Os `Disposable` dos ouvintes entram na MESMA lista do watcher: eles
      // morrem juntos, na próxima resolução da cadeia.
      watchers.push(
        watcher,
        watcher.onDidCreate((uri) =>
          channel.sendFileEvents([{ uri: uri.toString(), type: FILE_CREATED }]),
        ),
        watcher.onDidDelete((uri) =>
          channel.sendFileEvents([{ uri: uri.toString(), type: FILE_DELETED }]),
        ),
      )
    }
  }

  const publish = (): void => {
    void resolveForEditor().then(
      (resolution) => {
        watchDirectories(resolution.directories)
        channel.sendDirectories(resolution)
      },
      () => {
        // A cadeia já recua sozinha em toda falha prevista. Chegar aqui significa
        // defeito nosso, e mesmo então o editor não pode quebrar: sem diretórios,
        // `PJ0001` simplesmente cala.
        channel.sendDirectories({ winner: null, directories: [] })
      },
    )
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(`${CONFIG_SECTION}.showIncludeSources`, async () => {
      const resolution = await resolveForEditor()
      // Reaproveita o momento para reafirmar ao motor o que está valendo: quem
      // roda este comando está justamente diagnosticando "por que a regra não
      // dispara".
      channel.sendDirectories(resolution)
      await vscode.window.showInformationMessage(
        describeResolution(resolution, (key, args) => l10n.t(key, args ?? {})),
        { modal: false },
      )
    }),
  )

  // A configuração muda: a árvore de includes pode ter mudado junto.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration(`${CONFIG_SECTION}.includePaths`) ||
        event.affectsConfiguration('advpl.environments') ||
        event.affectsConfiguration('advpl.selectedEnvironment')
      ) {
        publish()
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => publish()),
  )

  publish()
}
