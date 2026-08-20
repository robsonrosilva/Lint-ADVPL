import type { Range, TextEdit } from 'vscode-languageserver-types'

import { offsetAt, positionAt, type AnalyzedDocument } from '../document/analyzed-document'

/**
 * A edição MÍNIMA que transforma o trecho num outro texto.
 *
 * O FR-005 é o requisito, e ele não é preciosismo: substituir a linha — ou o
 * documento — destrói dobras, marcadores, seleção e histórico de desfazer. É a
 * mesma razão pela qual o Princípio II proíbe o formatador de reescrever o
 * arquivo inteiro, aplicada ao ato de corrigir.
 *
 * "Mínima" aqui significa: descartar o prefixo e o sufixo que já coincidem, e
 * substituir só o miolo que difere. Duas consequências caem de graça:
 *
 * - **idempotência** (FR-012): texto já correto não tem miolo, e a função
 *   devolve lista vazia. Nenhuma regra precisa se lembrar de conferir isso;
 * - **guarda contra intervalo obsoleto**: quem chama compara o que leu com o
 *   que esperava antes de pedir a substituição.
 *
 * Uma edição só, e não uma por caractere divergente: `#InClUdE` produziria seis
 * edições minúsculas, cada uma com o seu par de posições, e o editor as
 * aplicaria como seis alterações — mais caro de calcular, de transmitir e de
 * desfazer, para economizar dois caracteres reescritos.
 */
export function minimalReplacement(
  document: AnalyzedDocument,
  range: Range,
  replacement: string,
): TextEdit[] {
  const start = offsetAt(document, range.start)
  const end = offsetAt(document, range.end)
  const current = document.text.slice(start, end)

  if (current === replacement) return []

  let prefix = 0
  const limit = Math.min(current.length, replacement.length)
  while (prefix < limit && current[prefix] === replacement[prefix]) prefix += 1

  let suffix = 0
  while (
    suffix < limit - prefix &&
    current[current.length - 1 - suffix] === replacement[replacement.length - 1 - suffix]
  ) {
    suffix += 1
  }

  return [
    {
      range: {
        start: positionAt(document, start + prefix),
        end: positionAt(document, end - suffix),
      },
      newText: replacement.slice(prefix, replacement.length - suffix),
    },
  ]
}

/** O texto que está dentro daquele intervalo, como o documento o tem agora. */
export function textInRange(document: AnalyzedDocument, range: Range): string {
  return document.text.slice(offsetAt(document, range.start), offsetAt(document, range.end))
}
