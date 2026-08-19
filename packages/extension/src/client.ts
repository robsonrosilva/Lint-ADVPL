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
 * Raiz do espaço de nomes da configuração.
 *
 * Precisa bater com `CONFIG_ROOT` do motor. São processos diferentes e não há
 * como o compilador ligar os dois — quem garante que não divergem é a
 * verificação do manifesto, que gera as chaves a partir do registro de regras.
 */
const CONFIG_SECTION = 'advplLint'

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
      // Faz o cliente entregar o bloco `advplLint` ao servidor na inicialização
      // e a cada mudança. É o que permite desligar uma regra ou trocar sua
      // severidade e ver o painel reagir SEM reiniciar o editor (US3).
      //
      // A API está marcada como obsoleta em favor do modelo em que o servidor
      // puxa a configuração. Ficamos com esta por ora porque ela resolve os
      // dois momentos — o inicial e o das mudanças — com uma linha, e o modelo
      // de puxar exige registro dinâmico de capacidade para ser notificado.
      // Trocar é dívida registrada, não urgência: o comportamento visível ao
      // usuário é o mesmo.
      configurationSection: CONFIG_SECTION,
    },
  }

  return new LanguageClient('advplLint', 'ADVPL Lint', serverOptions, clientOptions)
}
