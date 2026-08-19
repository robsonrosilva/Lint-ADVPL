import type { ScanResult } from '../rules/context'

/**
 * Varredura léxica mínima: separa o que é código do que é comentário ou
 * literal de texto.
 *
 * Roda UMA VEZ por documento e o resultado é compartilhado por todas as regras.
 * Se cada regra refizesse esta varredura, o custo viraria O(regras × linhas) já
 * na segunda regra — e o legado morreu exatamente assim, varrendo todas as
 * linhas dentro do laço por linha (validaAdvpl.ts:459).
 *
 * O resultado é uma lista ORDENADA de intervalos que não são código, consultada
 * por busca binária. Guardar um vetor de bytes por caractere custaria ~800 KB
 * num fonte grande; a lista de intervalos costuma ter algumas centenas de
 * entradas.
 */

const CHAR_SLASH = 47 // /
const CHAR_STAR = 42 // *
const CHAR_AMP = 38 // &
const CHAR_DQUOTE = 34 // "
const CHAR_SQUOTE = 39 // '
const CHAR_LF = 10
const CHAR_CR = 13
const CHAR_SPACE = 32
const CHAR_TAB = 9

/** Um intervalo [start, end) que NÃO é código. */
interface NonCodeSpan {
  readonly start: number
  readonly end: number
}

export function scanDocument(text: string): ScanResult {
  const spans: NonCodeSpan[] = []
  const length = text.length

  // `atLineStart` acompanha se ainda só vimos espaço em branco nesta linha.
  // É o que distingue `*` de comentário xBase (início de linha) de `*` de
  // multiplicação (meio da linha).
  let atLineStart = true
  let i = 0

  while (i < length) {
    const ch = text.charCodeAt(i)

    if (ch === CHAR_LF) {
      atLineStart = true
      i += 1
      continue
    }

    if (ch === CHAR_SLASH && text.charCodeAt(i + 1) === CHAR_SLASH) {
      i = pushToEndOfLine(text, spans, i)
      atLineStart = true
      continue
    }

    if (ch === CHAR_AMP && text.charCodeAt(i + 1) === CHAR_AMP) {
      // Comentário de linha herdado do xBase.
      i = pushToEndOfLine(text, spans, i)
      atLineStart = true
      continue
    }

    if (ch === CHAR_STAR && atLineStart) {
      // Comentário de linha inteira do xBase. Só vale se nada além de espaço
      // veio antes nesta linha — no meio da linha, `*` é multiplicação.
      i = pushToEndOfLine(text, spans, i)
      atLineStart = true
      continue
    }

    if (ch === CHAR_SLASH && text.charCodeAt(i + 1) === CHAR_STAR) {
      const start = i
      let j = i + 2
      while (j < length && !(text.charCodeAt(j) === CHAR_STAR && text.charCodeAt(j + 1) === CHAR_SLASH)) {
        j += 1
      }
      // Bloco sem fechamento consome o resto do arquivo — é o que o
      // pré-processador do Protheus faz.
      const end = j >= length ? length : j + 2
      spans.push({ start, end })
      i = end
      atLineStart = false
      continue
    }

    if (ch === CHAR_DQUOTE || ch === CHAR_SQUOTE) {
      const start = i
      let j = i + 1
      // O literal termina na aspa correspondente OU no fim da linha. Terminar
      // na linha importa: com aspas desbalanceadas, engolir o resto do arquivo
      // desligaria todas as regras dali para baixo, e o usuário veria o painel
      // esvaziar sem entender por quê.
      while (j < length) {
        const cur = text.charCodeAt(j)
        if (cur === ch) {
          j += 1
          break
        }
        if (cur === CHAR_LF || cur === CHAR_CR) break
        j += 1
      }
      spans.push({ start, end: j })
      i = j
      atLineStart = false
      continue
    }

    if (ch !== CHAR_SPACE && ch !== CHAR_TAB && ch !== CHAR_CR) atLineStart = false
    i += 1
  }

  return createScanResult(spans)
}

/** Marca de `from` até o fim da linha (sem incluir a quebra) e devolve onde parar. */
function pushToEndOfLine(text: string, spans: NonCodeSpan[], from: number): number {
  let j = from
  while (j < text.length && text.charCodeAt(j) !== CHAR_LF) j += 1
  spans.push({ start: from, end: j })
  return j
}

function createScanResult(spans: readonly NonCodeSpan[]): ScanResult {
  return {
    isCode(offset: number): boolean {
      // Busca binária no vetor já ordenado por construção — a varredura
      // caminha da esquerda para a direita e nunca volta.
      let low = 0
      let high = spans.length - 1
      while (low <= high) {
        const mid = (low + high) >> 1
        const span = spans[mid]!
        if (offset < span.start) high = mid - 1
        else if (offset >= span.end) low = mid + 1
        else return false
      }
      return true
    },
  }
}
