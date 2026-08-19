import type { CancellationToken } from 'vscode-languageserver'
import type { Range } from 'vscode-languageserver-types'
import type { AnalyzedDocument } from '../document/analyzed-document'

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
   * Classificação de comentário e literal, feita UMA VEZ por documento e
   * compartilhada por todas as regras. Se cada regra refizesse a varredura, o
   * custo viraria O(regras × linhas) já na segunda regra.
   */
  readonly scan: ScanResult
  readonly token: CancellationToken

  /**
   * Reporta uma violação. A regra informa ONDE; quem monta a mensagem
   * traduzida é o emissor, porque a tradução depende do idioma efetivo e a
   * regra não tem por que conhecê-lo.
   */
  report(range: Range, args?: Readonly<Record<string, string | number>>): void
}
