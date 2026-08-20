import type { Diagnostic, TextEdit } from 'vscode-languageserver-types'

import type { AnalyzedDocument } from '../document/analyzed-document'
import type { RuleFix } from './provider'
import { minimalReplacement, textInRange } from './text-edit'

/**
 * A correção de `CA3001`: a diretiva de inclusão vai para caixa baixa.
 *
 * Ela toca o token da diretiva, do `#` ao fim da palavra, e **nada mais** — nem
 * o nome do arquivo, nem sua caixa, nem as aspas, nem o espaçamento (FR-011).
 *
 * **A assimetria em relação a `PJ0001` é medida, não estética.** Baixar a caixa
 * da diretiva é inerte: 71,9% dos fontes do corpus escrevem `#INCLUDE` e
 * compilam, logo o pré-processador do Protheus não distingue. Baixar a caixa do
 * NOME do arquivo quebraria 706 referências que hoje resolvem, porque 7% dos
 * includes do disco têm maiúscula no nome real e o AppServer roda em Linux.
 */

/** A forma correta, e a única que esta correção escreve. */
const CORRECT_DIRECTIVE = '#include'

export const ca3001Fix: RuleFix = {
  ruleId: 'CA3001',
  titleKey: 'action.CA3001.title',

  computeEdits(document: AnalyzedDocument, diagnostic: Diagnostic): readonly TextEdit[] {
    const current = textInRange(document, diagnostic.range)

    // Guarda contra intervalo obsoleto: o texto pode ter mudado entre a análise
    // e o pedido da ação. Editar às cegas, por deslocamento, sobre um trecho
    // que já não é a diretiva corromperia o arquivo em silêncio — e a versão do
    // documento só protege da mudança que chega DEPOIS do cálculo.
    if (current.toLowerCase() !== CORRECT_DIRECTIVE) return []

    // Texto já correto cai aqui devolvendo lista vazia: é a idempotência do
    // FR-012, e é o que faz "corrigir tudo" não marcar como modificado um
    // documento que não tinha o que corrigir (FR-015).
    return minimalReplacement(document, diagnostic.range, CORRECT_DIRECTIVE)
  },
}
