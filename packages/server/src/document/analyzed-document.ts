import type { Position, Range } from 'vscode-languageserver-types'

/**
 * O documento que a análise consome.
 *
 * É SEMPRE o buffer em memória, nunca o arquivo em disco: durante a edição o
 * disco está desatualizado em relação ao que está na tela, e analisar o disco
 * produziria diagnóstico sobre um texto que o usuário não vê.
 *
 * O texto chega já decodificado — quem decodifica o byte CP1252 é o VS Code,
 * usando `files.encoding`, antes de o servidor ver qualquer coisa. Ver R0 da
 * research.md e o `configurationDefaults` do manifesto.
 */
export interface AnalyzedDocument {
  readonly uri: string
  readonly languageId: string
  /** Versão do LSP. Resultado de versão vencida é descartado, nunca exibido. */
  readonly version: number
  readonly text: string
  /**
   * Deslocamento inicial de cada linha, em caracteres. Calculado UMA VEZ por
   * versão do documento.
   *
   * Em CP1252 — byte único, todos os pontos no plano básico, sem pares
   * substitutos — deslocamento em bytes, índice de caractere e unidade de
   * código UTF-16 coincidem. Por isso este vetor serve direto às posições do
   * LSP, sem nenhuma conversão de índice. A garantia se perde no dia em que um
   * fonte UTF-8 for aceito.
   */
  readonly lineOffsets: readonly number[]
}

/** Cria o documento e calcula os deslocamentos de linha numa única passagem. */
export function createAnalyzedDocument(params: {
  uri: string
  languageId: string
  version: number
  text: string
}): AnalyzedDocument {
  return { ...params, lineOffsets: computeLineOffsets(params.text) }
}

/**
 * Uma passagem só sobre o texto. Reconhece CRLF, LF e CR solto — fonte Protheus
 * costuma ser CRLF, mas arquivos com os dois misturados existem e a posição do
 * diagnóstico precisa estar certa nos três casos.
 */
export function computeLineOffsets(text: string): readonly number[] {
  const offsets: number[] = [0]
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i)
    if (ch === 13 /* CR */) {
      // CRLF conta como UMA quebra. Sem isto, todo arquivo CRLF teria o dobro
      // de linhas e a linha de cada diagnóstico sairia errada.
      if (text.charCodeAt(i + 1) === 10 /* LF */) i += 1
      offsets.push(i + 1)
    } else if (ch === 10 /* LF */) {
      offsets.push(i + 1)
    }
  }
  return offsets
}

/** Converte deslocamento absoluto em posição linha/caractere, por busca binária. */
export function positionAt(document: AnalyzedDocument, offset: number): Position {
  const { lineOffsets } = document
  const clamped = Math.max(0, Math.min(offset, document.text.length))

  // Busca binária, não varredura. Uma varredura linear aqui transformaria a
  // conversão de posição em O(linhas) por diagnóstico — e num fonte de 24.636
  // linhas isso aparece.
  let low = 0
  let high = lineOffsets.length
  while (low + 1 < high) {
    const mid = (low + high) >> 1
    if (lineOffsets[mid]! > clamped) high = mid
    else low = mid
  }
  return { line: low, character: clamped - lineOffsets[low]! }
}

/** Intervalo a partir de dois deslocamentos absolutos. */
export function rangeAt(document: AnalyzedDocument, start: number, end: number): Range {
  return { start: positionAt(document, start), end: positionAt(document, end) }
}
