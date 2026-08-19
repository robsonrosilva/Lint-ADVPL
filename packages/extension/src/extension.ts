import type { ExtensionContext } from 'vscode'
import type { LanguageClient } from 'vscode-languageclient/node'

import { createClient } from './client'
import { registerEncodingGuard } from './encoding-guard'

/**
 * Ponto de entrada da extensão.
 *
 * Orçamento do Princípio I: ficar pronta em no máximo 200 ms. Por isso, o que
 * NÃO acontece aqui importa tanto quanto o que acontece:
 *
 * - nenhuma leitura de arquivo;
 * - nenhuma varredura de projeto;
 * - nenhuma análise — isso é do servidor, em outro processo;
 * - nenhum `await` do início do cliente: ele sobe o servidor em segundo plano.
 *
 * `activate` NÃO é `async` de propósito. Um `async` aqui convidaria alguém a
 * pôr um `await` no caminho de ativação, e o custo entraria no orçamento sem
 * ninguém perceber.
 */

let client: LanguageClient | undefined

export function activate(context: ExtensionContext): void {
  client = createClient(context)
  registerEncodingGuard(context)

  // Sem await: a ativação retorna e o servidor sobe em paralelo.
  void client.start()
}

export function deactivate(): Promise<void> | undefined {
  const stopping = client?.stop()
  client = undefined
  return stopping
}
