import type { CancellationToken } from 'vscode-languageserver'
import type { Range } from 'vscode-languageserver-types'
import type { AnalyzedDocument } from '../document/analyzed-document'
import type { IncludeIndexReader } from '../includes/index-store'

/**
 * O que a varredura léxica entrega às regras.
 *
 * O tipo mora AQUI, no contrato, e não no módulo que o implementa: quem manda é
 * o que a regra precisa saber, não o jeito como a varredura foi escrita.
 */
export interface ScanResult {
  /**
   * `true` quando o deslocamento cai em código de verdade — fora de comentário
   * de linha, de comentário de bloco e de literal de texto.
   *
   * É o que separa `#INCLUDE "TOTVS.CH"` de um `#INCLUDE` citado dentro de um
   * comentário. Sem isso, `CA3001` teria falso positivo garantido.
   */
  isCode(offset: number): boolean
}

/**
 * O que uma regra recebe para trabalhar.
 *
 * Repare no que NÃO está aqui: nada de sistema de arquivos, nada de rede, nada
 * de canal de log. Uma regra que precisasse de qualquer um dos três estaria
 * violando o Princípio I, e a forma mais barata de impedir isso é não entregar
 * a ferramenta.
 */
export interface RuleContext {
  readonly document: AnalyzedDocument
  /**
   * Faixa de linhas desta fatia, `[startLine, endLine)`.
   *
   * A análise é fatiada para poder ceder o laço de eventos entre as fatias. Se
   * a regra varresse o documento inteiro de uma vez, um fonte grande travaria a
   * digitação por todo o tempo que ela levasse — e nenhum ponto de cessão
   * externo consertaria isso, porque `run` é síncrono.
   */
  readonly startLine: number
  readonly endLine: number
  /**
   * Classificação de comentário e literal, feita UMA VEZ por documento e
   * compartilhada por todas as regras. Se cada regra refizesse a varredura, o
   * custo viraria O(regras × linhas) já na segunda regra.
   */
  readonly scan: ScanResult
  readonly token: CancellationToken
  /**
   * O que existe no disco, em memória (spec 002).
   *
   * ⚠️ Isto NÃO contradiz o parágrafo acima, e a distinção é a spec inteira: o
   * que a regra recebe é um MAPA JÁ LIDO, com consulta síncrona. Ela não abre
   * arquivo, não lista diretório e não tem como esperar por disco — `lookup`
   * responde na hora e `ensureBuilt` dispara a varredura sem aguardá-la.
   *
   * Quem faz I/O é o índice, no seu próprio tempo, fora do caminho de análise.
   * Se este campo fosse uma promessa, a primeira abertura de arquivo esperaria
   * por dezenas de milhares de leituras de disco — e é exatamente essa a porta
   * que o contrato síncrono fecha.
   */
  readonly includes: IncludeIndexReader

  /**
   * Reporta uma violação. A regra informa ONDE; quem monta a mensagem
   * traduzida é o emissor, porque a tradução depende do idioma efetivo e a
   * regra não tem por que conhecê-lo.
   *
   * `data` viaja com o diagnóstico até a ação de correção — é como `PJ0001`
   * leva o nome real lido do disco até quem vai escrever a substituição, sem
   * que o conserto tenha de consultar o índice de novo sobre um estado que já
   * pode ter mudado.
   */
  report(
    range: Range,
    args?: Readonly<Record<string, string | number>>,
    data?: unknown,
  ): void
}
