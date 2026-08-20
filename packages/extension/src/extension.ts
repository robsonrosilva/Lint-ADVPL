import type { ExtensionContext } from 'vscode'
import type { LanguageClient } from 'vscode-languageclient/node'

import { createClient } from './client'
import { registerEncodingGuard } from './encoding-guard'
import {
  INCLUDE_DIRECTORIES_NOTIFICATION,
  registerIncludeSources,
} from './include-sources/vscode-adapters'

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

/**
 * O que a extensão devolve a quem a ativa.
 *
 * `activationMs` é o tempo do trabalho PRÓPRIO da ativação — o corpo desta
 * função, e nada mais. Ele existe porque o orçamento do Princípio I tem duas
 * metades e só esta está sob controle do código: quem chama `activate()` mede a
 * ativação COMPLETA, que inclui o editor ler, compilar e resolver os `require`
 * do pacote. Medido em 2026-08-19: 18,4 ms de trabalho próprio contra 200 a
 * 430 ms de carregamento.
 *
 * Sem este número, um `await` indevido acrescentado aqui se esconderia dentro da
 * variação do carregamento — que depende do disco e do estado do editor — e
 * nenhum portão pegaria.
 */
export interface AdvplLintApi {
  readonly activationMs: number
}

export function activate(context: ExtensionContext): AdvplLintApi {
  const started = performance.now()

  client = createClient(context)
  registerEncodingGuard(context)

  // A cadeia de fontes de include (spec 002, FR-027). O registro é barato — um
  // comando e dois ouvintes; a RESOLUÇÃO, que toca o disco, acontece fora do
  // caminho de ativação, e o envio ao servidor espera o cliente estar de pé.
  const lsp = client
  /** Manda ao motor, esperando o cliente estar de pé — sem travar quem chamou. */
  const notificar = (metodo: string, payload: unknown): void => {
    void lsp
      .start()
      .then(() => lsp.sendNotification(metodo, payload))
      .catch(() => {
        // Servidor ainda subindo ou já encerrado. Sem diretórios, `PJ0001`
        // cala — que é exatamente o comportamento previsto (FR-023).
      })
  }

  registerIncludeSources(context, {
    sendDirectories: (resolution) => notificar(INCLUDE_DIRECTORIES_NOTIFICATION, resolution),
    // `workspace/didChangeWatchedFiles` é o método PADRÃO do protocolo, e o
    // servidor já o atende. O que não é padrão é precisar mandá-lo à mão: o
    // `LanguageClient` só encaminha os eventos dos watchers de
    // `synchronize.fileEvents`, fixado na construção do cliente — antes de
    // qualquer diretório de include existir.
    sendFileEvents: (changes) => notificar('workspace/didChangeWatchedFiles', { changes }),
  })

  // Sem await: a ativação retorna e o servidor sobe em paralelo.
  void client.start()

  return { activationMs: performance.now() - started }
}

export function deactivate(): Promise<void> | undefined {
  const stopping = client?.stop()
  client = undefined
  return stopping
}
