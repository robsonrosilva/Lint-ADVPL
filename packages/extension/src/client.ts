import { join } from 'node:path'
import type { ExtensionContext } from 'vscode'
import { workspace } from 'vscode'
import {
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from 'vscode-languageclient/node'

import { SUPPORTED_LANGUAGES } from './languages'

/**
 * Cria e inicia o cliente LSP.
 *
 * O `start()` NÃO é aguardado por quem ativa a extensão: o cliente sobe o
 * processo do servidor em segundo plano e a ativação retorna imediatamente.
 * Esperar aqui colocaria o tempo de subir um processo Node dentro do orçamento
 * de 200 ms da ativação (Princípio I) sem nenhum ganho — não há nada para
 * mostrar ao usuário antes de ele abrir um fonte.
 */
export function createClient(context: ExtensionContext): LanguageClient {
  const serverModule = context.asAbsolutePath(join('dist', 'server.js'))

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6011'] },
    },
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector: SUPPORTED_LANGUAGES.map((language) => ({ scheme: 'file', language })),
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.{prw,prx,prg,apw,apl,tlpp}'),
    },
  }

  return new LanguageClient('advplLint', 'ADVPL Lint', serverOptions, clientOptions)
}
