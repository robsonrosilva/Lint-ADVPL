import type { Diagnostic, TextEdit } from 'vscode-languageserver-types'

import type { AnalyzedDocument } from '../document/analyzed-document'
import type { IncludeIndexReader } from '../includes/index-store'
import type { RuleFix } from './provider'
import { minimalReplacement, textInRange } from './text-edit'

/**
 * A correção de `PJ0001`: a referência passa a ter a grafia real do disco.
 *
 * Ela toca **o nome do arquivo, e só ele** — nem a diretiva, nem o caminho, nem
 * as aspas (FR-038).
 *
 * ## A assimetria em relação a `CA3001`, e por que ela existe
 *
 * Baixar a caixa da diretiva é **inerte**: 71,9% dos fontes do corpus escrevem
 * `#INCLUDE` e compilam. Trocar o **nome do arquivo** muda o que o compilador
 * vai procurar. São atos de risco diferente, e é por isso que esta correção
 * fica **fora** do "corrigir tudo" por padrão (FR-040, D9): aplicá-la em massa,
 * ao salvar, sem o usuário olhar, propagaria um índice errado pelo arquivo
 * inteiro.
 *
 * ## A guarda do FR-039
 *
 * O caminho de correção é assíncrono por natureza: o usuário pede as ações,
 * pensa, e clica. Entre uma coisa e outra o arquivo pode ter sido apagado,
 * renomeado, ou ter ganho um homônimo em outro diretório da cadeia. Por isso a
 * correção **reconfere o índice** antes de escrever, e recusa se a resposta
 * mudou.
 *
 * A versão do documento (FR-006) protege da mudança no TEXTO; esta guarda
 * protege da mudança no DISCO. São coisas diferentes e as duas são precisas.
 */

/** O que a regra anexou ao diagnóstico. */
function realNameOf(diagnostic: Diagnostic): string | undefined {
  const data = diagnostic.data
  if (typeof data !== 'object' || data === null) return undefined
  const realName = (data as { realName?: unknown }).realName
  return typeof realName === 'string' && realName.length > 0 ? realName : undefined
}

export function createPj0001Fix(index: IncludeIndexReader): RuleFix {
  return {
    ruleId: 'PJ0001',
    titleKey: 'action.PJ0001.title',

    computeEdits(document: AnalyzedDocument, diagnostic: Diagnostic): readonly TextEdit[] {
      // Sem o nome real anexado não há o que escrever. Buscá-lo no índice para
      // "consertar" a falta mascararia uma inconsistência: o diagnóstico veio de
      // outro lugar que não esta regra.
      const expected = realNameOf(diagnostic)
      if (expected === undefined) return []

      const referenced = textInRange(document, diagnostic.range)
      // Guarda contra intervalo obsoleto: o texto pode ter mudado, e o
      // intervalo agora apontar para outra coisa.
      if (referenced.length === 0) return []

      // FR-039: o disco pode ter mudado desde o diagnóstico. Escrever o nome
      // velho criaria uma referência que não resolve mais — o oposto do que
      // esta regra existe para consertar.
      //
      // O estado é conferido AQUI, e não só a resposta da consulta: o índice
      // pode ter sido derrubado por uma troca de diretórios entre o diagnóstico
      // e o clique. Depender de a consulta responder "ausente" nesse caso
      // amarraria esta correção a um detalhe interno do índice.
      if (index.state !== 'pronto') return []

      const lookup = index.lookup(referenced)
      if (lookup.kind !== 'encontrado') return []
      if (lookup.entry.realName !== expected) return []

      // Texto já com a grafia real cai aqui devolvendo lista vazia.
      return minimalReplacement(document, diagnostic.range, expected)
    },
  }
}
