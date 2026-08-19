import type { RuleDefinition } from './registry'
import type { RuleContext } from './context'
import { rangeAt } from '../document/analyzed-document'

/**
 * CA3001 — a diretiva de inclusão precisa estar em caixa baixa.
 *
 * Origem: catálogo oficial da TOTVS, grupo G3 (Legacy and Deprecated Code),
 * severidade MINOR. Fonte: referencias/totvs/sonarqube-rules-reference.md,
 * linha 53, release v1.0.1, consultada em 2026-08-19.
 *
 * Exemplo proibido: #INCLUDE "TOTVS.CH"
 * Forma correta:    #include "totvs.ch"
 *
 * Custo: uma passagem pelas linhas, sem estado entre elas. Em cada linha, o
 * trabalho é pular o recuo e comparar uma palavra — não há varredura do texto
 * inteiro em lugar nenhum.
 */

const DIRECTIVE = 'include'
const CHAR_HASH = 35 // #
const CHAR_SPACE = 32
const CHAR_TAB = 9
const CHAR_CR = 13

/**
 * De quantas em quantas linhas conferir o cancelamento.
 *
 * Conferir a cada linha custaria uma chamada por linha sem ganho nenhum;
 * conferir raramente demais deixaria a análise rodando depois de cancelada.
 * 512 linhas é trabalho de microssegundos entre duas conferências.
 */
const CANCELLATION_STRIDE = 512

export const ca3001: RuleDefinition = {
  id: 'CA3001',
  origin: 'totvs',
  group: 'G3',
  catalogSeverity: 'MINOR',
  configKey: 'advplLint.rules.CA3001',
  messageKey: 'rule.CA3001.message',
  projectRationale: null,

  // NÃO sobrepõe a tabela: a severidade exibida sai dela, e MINOR mapeia para
  // Information.
  //
  // Esta regra JÁ sobrepôs para `Hint`, em 2026-08-19, com razão medida — 71,9%
  // das 15.306 diretivas do corpus estão em caixa alta, e uma regra de estilo
  // com esse volume dominaria o painel. A medição estava certa; a conclusão,
  // não. O painel de Problemas do VS Code lista Error, Warning e Information e
  // **não lista Hint**. Como Hint, a única regra do produto sumia exatamente do
  // lugar onde o usuário vai procurar — foi assim que ela foi encontrada, um
  // fonte real aberto sem nenhuma crítica à vista.
  //
  // O volume continua real e continua sem resposta aqui. A resposta é a ação de
  // "corrigir todas deste arquivo" da spec 002: com ela, muitas ocorrências
  // viram um clique, e o volume deixa de ser argumento para esconder.

  run(context: RuleContext): void {
    const { document, scan, token, report, startLine, endLine } = context
    const { text, lineOffsets } = document

    for (let line = startLine; line < endLine; line += 1) {
      if (line % CANCELLATION_STRIDE === 0 && token.isCancellationRequested) return

      const lineStart = lineOffsets[line]!
      const lineEnd = line + 1 < lineOffsets.length ? lineOffsets[line + 1]! : text.length

      // Diretiva de pré-processador vem no começo da linha, depois de recuo
      // opcional. Por isso não se varre a linha inteira: pula-se o branco e
      // olha-se um caractere.
      let cursor = lineStart
      while (cursor < lineEnd) {
        const ch = text.charCodeAt(cursor)
        if (ch !== CHAR_SPACE && ch !== CHAR_TAB) break
        cursor += 1
      }

      if (cursor >= lineEnd || text.charCodeAt(cursor) !== CHAR_HASH) continue

      const wordStart = cursor + 1
      let wordEnd = wordStart
      while (wordEnd < lineEnd && isWordChar(text.charCodeAt(wordEnd))) wordEnd += 1

      const word = text.slice(wordStart, wordEnd)
      if (word.length !== DIRECTIVE.length) continue
      if (word.toLowerCase() !== DIRECTIVE) continue

      // A forma correta. Nada a dizer.
      if (word === DIRECTIVE) continue

      // Último guarda: um `#INCLUDE` no começo de uma linha DENTRO de um
      // comentário de bloco chegaria até aqui. É o único falso positivo
      // plausível desta regra, e tem fixture dedicada.
      if (!scan.isCode(cursor)) continue

      // O intervalo cobre o token `#INCLUDE`, do '#' ao fim da palavra — nunca
      // a linha inteira. Sublinhar a linha toda esconde onde está o problema.
      report(rangeAt(document, cursor, wordEnd))
    }
  },
}

function isWordChar(charCode: number): boolean {
  return (
    (charCode >= 65 && charCode <= 90) || // A-Z
    (charCode >= 97 && charCode <= 122) // a-z
  )
}

// Referenciado para deixar claro que CR não entra na palavra da diretiva.
void CHAR_CR
