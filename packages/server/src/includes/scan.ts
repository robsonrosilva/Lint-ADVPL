import { opendir } from 'node:fs/promises'
import { join } from 'node:path'
import type { CancellationToken } from 'vscode-languageserver'

import { TimeSlice, yieldToEventLoop } from '../analysis/cancellation'

/**
 * O percurso do disco que alimenta o índice de includes.
 *
 * ## A regra que governa este arquivo
 *
 * O nome real vem de **listagem de diretório**, jamais de consulta de
 * existência (FR-020). Em Windows e macOS padrão, perguntar "o arquivo
 * `acadef.ch` existe?" responde SIM mesmo quando o disco guarda `ACADEF.CH` —
 * e é justamente esse mecanismo que torna o defeito invisível: o desenvolvedor
 * compila no Windows, o sistema de arquivos responde "existe" para qualquer
 * caixa, e a falha só aparece no AppServer Linux.
 *
 * Uma implementação baseada em `stat`, `access` ou `exists` herdaria essa
 * cegueira e a regra nunca dispararia nas máquinas onde ela é escrita.
 *
 * ## E o Princípio I
 *
 * O corpus de referência tem 35.103 arquivos `.ch`. Três consequências, todas
 * visíveis no código abaixo:
 *
 * - `opendir` assíncrono, nunca a variante síncrona (o lint reprova `*Sync`);
 * - cancelamento conferido **entre diretórios**, com parada de fato;
 * - cessão do laço de eventos por fatia de tempo, como a análise faz entre
 *   fatias de linha. Sem isso, uma árvore grande bloquearia o servidor inteiro
 *   por todo o tempo da varredura.
 *
 * E uma que se vê pela ausência: **não há tempo-limite**. Árvore grande demora;
 * ela não falha. O legado rejeitava a análise depois de 1000 ms, o que
 * significava que fonte grande simplesmente não era analisado — sem avisar.
 */

/**
 * As extensões que contam como arquivo de include.
 *
 * Uma só, e declarada num lugar só. Ampliar esta lista multiplica o custo da
 * varredura por toda a árvore, e por isso exige medição — não palpite.
 */
export const INCLUDE_EXTENSIONS: readonly string[] = ['.ch']

/**
 * De quantas em quantas entradas o percurso devolve o controle ao laço, DENTRO
 * de um mesmo diretório.
 *
 * Existe porque ceder só **entre** diretórios não é garantia: um diretório com
 * dezenas de milhares de arquivos rodaria do começo ao fim sem respirar. No
 * corpus são ~8 arquivos por diretório e isso nunca se observou — mas garantia
 * que depende do formato dos dados não é garantia, e o Princípio I não abre
 * exceção por improbabilidade.
 *
 * ⚠️ A cessão aqui é por CONTAGEM, e não pelo relógio do `TimeSlice`, por duas
 * razões. A primeira é que ela limita o trabalho por um número que não depende
 * de quanto a máquina está ocupada — sob pressão de coleta de lixo, o relógio
 * estica e a fatia real cresce junto. A segunda é que só assim o teste é
 * determinístico: contar cessões de uma política baseada em tempo mediria a
 * MÁQUINA, e máquina mais rápida cederia MENOS vezes. É a armadilha registrada
 * em `memoria/armadilhas-do-ambiente.md`.
 *
 * 512 entradas é trabalho de microssegundos — um `setImmediate` a cada 512
 * nomes não aparece em medição nenhuma.
 */
export const ENTRY_YIELD_STRIDE = 512

export interface ScannedFile {
  /** O nome como o disco o escreveu. É o valor inteiro desta varredura. */
  readonly realName: string
  readonly directory: string
}

export interface ScanOptions {
  readonly directories: readonly string[]
  readonly token: CancellationToken
  /** Progresso (FR-022). Chamado uma vez por diretório, ANTES de lê-lo. */
  readonly onDirectory?: (directory: string) => void
}

export interface ScanResult {
  readonly files: readonly ScannedFile[]
  /** `true` quando parou por cancelamento. O chamador não deve usar o parcial. */
  readonly cancelled: boolean
  /** Diretórios que não deu para ler. Alimenta o aviso único do FR-026. */
  readonly unreadable: readonly string[]
}

function isIncludeFile(name: string): boolean {
  // A caixa da EXTENSÃO não conta: no corpus real há `.CH` e `.ch` lado a lado.
  // A caixa do NOME, essa sim, é o objeto de toda esta spec e é preservada.
  const lower = name.toLowerCase()
  return INCLUDE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export async function scanIncludeDirectories(options: ScanOptions): Promise<ScanResult> {
  const { token, onDirectory } = options
  const files: ScannedFile[] = []
  const unreadable: string[] = []

  // A fila é o que torna o percurso iterativo em vez de recursivo: recursão
  // sobre uma árvore Protheus profunda gastaria pilha sem necessidade, e
  // sobretudo não teria onde conferir o cancelamento entre um nível e outro.
  const queue = [...new Set(options.directories)]
  const visited = new Set<string>()
  const slice = new TimeSlice()

  while (queue.length > 0) {
    // ENTRE diretórios, e não no fim: é isto que faz "parar de fato" valer, em
    // vez de varrer tudo e descartar o resultado.
    if (token.isCancellationRequested) return { files, cancelled: true, unreadable }

    const directory = queue.shift()!
    // O mesmo diretório listado duas vezes seria varrido duas vezes, e todo
    // arquivo dele viraria "ambíguo" — a regra calaria justamente onde deveria
    // falar.
    if (visited.has(directory)) continue
    visited.add(directory)

    onDirectory?.(directory)

    try {
      const dir = await opendir(directory)
      let seen = 0
      for await (const entry of dir) {
        seen += 1
        // Respirar DENTRO do diretório, não só entre eles. Ver ENTRY_YIELD_STRIDE.
        if (seen % ENTRY_YIELD_STRIDE === 0) {
          await yieldToEventLoop()
          slice.restart()
        }

        if (token.isCancellationRequested) {
          // `opendir` deixa um descritor aberto; fechá-lo aqui é o que impede
          // que um cancelamento no meio de uma árvore grande vaze descritores.
          await dir.close().catch(() => {})
          return { files, cancelled: true, unreadable }
        }

        if (entry.isDirectory()) {
          queue.push(join(directory, entry.name))
          continue
        }

        // Filtrar AQUI, durante a varredura, e não depois: filtrar no fim
        // significaria carregar em memória o nome de todo arquivo da árvore
        // para descartar quase todos.
        if (entry.isFile() && isIncludeFile(entry.name)) {
          files.push({ realName: entry.name, directory })
        }
      }
    } catch {
      // Inexistente, sem permissão, unidade de rede fora do ar: nos três casos
      // a varredura CONTINUA. Um diretório ruim não pode apagar a árvore
      // inteira (FR-026). Quem chama decide o que fazer com a lista — e o
      // aviso é único por sessão, nunca um por arquivo aberto.
      unreadable.push(directory)
    }

    await slice.yieldIfNeeded()
  }

  return { files, cancelled: false, unreadable }
}
