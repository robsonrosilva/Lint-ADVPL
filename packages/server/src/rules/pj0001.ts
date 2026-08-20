import { DiagnosticSeverity } from 'vscode-languageserver-types'

import { rangeAt } from '../document/analyzed-document'
import type { RuleContext } from './context'
import type { RuleDefinition } from './registry'

/**
 * PJ0001 — a referência do include diverge, na CAIXA, do nome real no disco.
 *
 * ## O defeito
 *
 * ```
 * #include "acadef.ch"    <- o disco guarda ACADEF.CH
 * ```
 *
 * No Windows e no macOS padrão isso compila. No AppServer Linux, não — e é lá
 * que o Protheus roda. O desenvolvedor escreve, compila localmente, sobe, e a
 * falha aparece longe, tarde, sem nenhuma mensagem que ligue uma coisa à outra.
 *
 * ## Por que ela é `origin: 'project'` (Princípio III)
 *
 * O TOTVS Code Analyzer **não consegue** detectar isto: ele não conhece o
 * diretório de includes do projeto. A verificação exige comparar o que o fonte
 * escreve com o que existe naquela árvore, e a árvore é de quem compila, não do
 * catálogo. Não é duplicata disfarçada de regra de catálogo; é o que só este
 * produto tem como ver.
 *
 * ## Por que ela nasce LIGADA, e como `Information`
 *
 * FR-036 e Princípio VI exigem medição antes de ligar. Ela foi feita em
 * 2026-08-20, sobre 1.012 fontes do corpus: **1.445 disparos, 0% de falso
 * positivo** em 120 revisados à mão, e **72,9% dos fontes** com ao menos um.
 *
 * O volume é real e é o que decide a severidade — não o impacto. `Warning`
 * inflaria a contagem de avisos de quase todo arquivo de um projeto Protheus, e
 * regra que aparece em todo lugar treina o usuário a ignorar o painel inteiro
 * (Princípio III). É a mesma conclusão a que `CA3001` chegou, pelo mesmo
 * caminho e com volume parecido.
 *
 * `Information` não é "menos importante": o painel de Problemas do VS Code
 * LISTA `Information` — diferente de `Hint`, que ele não lista, e que já fez
 * `CA3001` sumir da tela em 2026-08-19. O defeito continua quebrando a
 * compilação no AppServer Linux; o que muda é onde ele aparece na contagem.
 *
 * Quem quiser tratá-lo como aviso ajusta sem tocar em código:
 * `advplLint.rules.PJ0001.severity: "warning"`.
 *
 * ## Os três silêncios
 *
 * | Situação | Por quê |
 * | -------- | ------- |
 * | arquivo não encontrado | "include faltante" é outra regra, fora do escopo (FR-032) |
 * | referência ambígua | apontar um candidato seria adivinhação (FR-033) |
 * | índice ainda não pronto | ela não SABE; e a análise não espera pelo disco (FR-023) |
 *
 * Os três levam ao mesmo silêncio na tela, por razões diferentes — e é
 * justamente por isso que o código os separa em vez de colapsá-los num `if`
 * único. Confundi-los produziria o pior dos mundos: a regra disparando com base
 * num índice pela metade.
 *
 * ## Custo
 *
 * Uma passagem pelas linhas da fatia, sem estado entre elas. Em cada linha, o
 * trabalho é pular o recuo, comparar uma palavra e — só quando ela é `include` —
 * achar o par de aspas. A consulta ao índice é um `Map.get` sobre nome em caixa
 * baixa. Não há I/O aqui: quem faz I/O é o índice, no seu próprio tempo, fora
 * do caminho de análise.
 */

const DIRECTIVE = 'include'
const CHAR_HASH = 35 // #
const CHAR_SPACE = 32
const CHAR_TAB = 9

/** As aspas que o formato admite. O legado aceitava as duas; manteve-se. */
const QUOTES = new Set([34 /* " */, 39 /* ' */])

/** Separadores de caminho. O caminho está fora do escopo da regra (R9). */
const PATH_SEPARATORS = new Set([47 /* / */, 92 /* \ */])

/** De quantas em quantas linhas conferir o cancelamento. Ver `ca3001.ts`. */
const CANCELLATION_STRIDE = 512

export const pj0001: RuleDefinition = {
  id: 'PJ0001',
  origin: 'project',
  group: null,
  catalogSeverity: null,
  configKey: 'advplLint.rules.PJ0001',
  messageKey: 'rule.PJ0001.message',

  // Princípio III: o que ela pega que o padrão não pega. Literal, não retórico.
  projectRationale:
    'O TOTVS Code Analyzer não conhece o diretório de includes do projeto e por isso não ' +
    'consegue comparar a referência com o nome real do arquivo no disco. O defeito já falha hoje, ' +
    'em silêncio, no AppServer Linux — e é invisível no Windows, onde o sistema de arquivos ' +
    'responde "existe" para a grafia errada.',

  // R5: regra `project` não tem catálogo de onde mapear, então DECLARA.
  //
  // `Information` e não `Warning`, por VOLUME medido — 72,9% dos fontes do
  // corpus têm ao menos um disparo. A gravidade do defeito não está em questão:
  // ele quebra a compilação no AppServer Linux. O que a severidade decide é se
  // a regra inunda a contagem de avisos de quase todo arquivo, e o Princípio III
  // é explícito sobre o dano disso.
  //
  // `Information` aparece no painel de Problemas; `Hint` não aparece, e foi
  // assim que `CA3001` sumiu da tela em 2026-08-19. Ver docs/regras/PJ0001.md.
  defaultSeverity: DiagnosticSeverity.Information,

  // FR-036 cumprido: medida em 2026-08-20 sobre 1.012 fontes do corpus, com 0%
  // de falso positivo em 120 revisados à mão. Ligada com o número na mão (T065).
  enabledByDefault: true,

  run(context: RuleContext): void {
    const { document, scan, token, includes, report, startLine, endLine } = context
    const { text, lineOffsets } = document

    // O índice ainda não sabe responder. Pedir a construção UMA vez por fatia —
    // e não uma por diretiva — e sair: a análise NÃO espera pelo disco
    // (FR-021, FR-023). As outras regras publicam normalmente.
    if (includes.state !== 'pronto') {
      includes.ensureBuilt()
      return
    }

    for (let line = startLine; line < endLine; line += 1) {
      if (line % CANCELLATION_STRIDE === 0 && token.isCancellationRequested) return

      const lineStart = lineOffsets[line]!
      const lineEnd = line + 1 < lineOffsets.length ? lineOffsets[line + 1]! : text.length

      const reference = findIncludeReference(text, lineStart, lineEnd)
      if (!reference) continue
      if (!scan.isCode(reference.directiveStart)) continue

      const referenced = text.slice(reference.nameStart, reference.nameEnd)
      const lookup = includes.lookup(referenced)

      // Ausente: "include faltante" é outra regra (FR-032).
      if (lookup.kind === 'ausente') continue
      // Ambíguo: escolher um candidato seria adivinhação (FR-033).
      if (lookup.kind === 'ambíguo') continue

      const { realName } = lookup.entry
      // Bate byte a byte: nada a dizer. É o caso da esmagadora maioria.
      if (realName === referenced) continue

      // O intervalo cobre SÓ o nome — sem as aspas, sem a diretiva, sem o
      // caminho (FR-030). Sublinhar a linha toda esconde onde está o problema,
      // e sublinhar as aspas faria a correção parecer que vai mexer nelas.
      report(
        rangeAt(document, reference.nameStart, reference.nameEnd),
        { real: realName, referenced },
        // O nome real viaja com o diagnóstico até a correção. Sem isto, o
        // conserto consultaria o índice de novo, sobre um estado que pode ter
        // mudado entre o diagnóstico e o clique.
        { realName },
      )
    }
  },
}

interface IncludeReference {
  readonly directiveStart: number
  /** Início do NOME do arquivo — depois das aspas e depois do caminho. */
  readonly nameStart: number
  readonly nameEnd: number
}

/**
 * Acha `#include "…nome…"` numa linha, se houver.
 *
 * Diretiva de pré-processador vem no começo da linha, depois de recuo opcional.
 * Por isso não se varre a linha inteira: pula-se o branco e olha-se um
 * caractere. Só quando ele é `#` e a palavra é `include` é que vale procurar as
 * aspas.
 */
function findIncludeReference(
  text: string,
  lineStart: number,
  lineEnd: number,
): IncludeReference | undefined {
  let cursor = lineStart
  while (cursor < lineEnd) {
    const ch = text.charCodeAt(cursor)
    if (ch !== CHAR_SPACE && ch !== CHAR_TAB) break
    cursor += 1
  }

  if (cursor >= lineEnd || text.charCodeAt(cursor) !== CHAR_HASH) return undefined
  const directiveStart = cursor

  const wordStart = cursor + 1
  let wordEnd = wordStart
  while (wordEnd < lineEnd && isWordChar(text.charCodeAt(wordEnd))) wordEnd += 1

  const word = text.slice(wordStart, wordEnd)
  // A caixa da DIRETIVA não decide se esta regra olha a linha: `#INCLUDE` é
  // violação de CA3001, e as duas regras são independentes. Uma não pode
  // esconder a outra.
  if (word.length !== DIRECTIVE.length || word.toLowerCase() !== DIRECTIVE) return undefined

  const openQuote = findQuote(text, wordEnd, lineEnd)
  if (openQuote === undefined) return undefined

  const quote = text.charCodeAt(openQuote)
  let closeQuote = openQuote + 1
  while (closeQuote < lineEnd && text.charCodeAt(closeQuote) !== quote) closeQuote += 1
  // Aspas não fechadas na linha: não há referência a julgar. Engolir o resto do
  // arquivo aqui produziria diagnóstico sobre um trecho que ninguém escreveu.
  if (closeQuote >= lineEnd) return undefined

  // O caminho fica de fora (R9): a spec limita PJ0001 ao NOME do arquivo, e
  // ampliar para a caixa dos diretórios é regra nova, não ajuste desta.
  let nameStart = openQuote + 1
  for (let i = openQuote + 1; i < closeQuote; i += 1) {
    if (PATH_SEPARATORS.has(text.charCodeAt(i))) nameStart = i + 1
  }

  if (nameStart >= closeQuote) return undefined

  return { directiveStart, nameStart, nameEnd: closeQuote }
}

/** A primeira aspa depois da palavra, se só houver branco no caminho. */
function findQuote(text: string, from: number, lineEnd: number): number | undefined {
  for (let i = from; i < lineEnd; i += 1) {
    const ch = text.charCodeAt(i)
    if (QUOTES.has(ch)) return i
    if (ch !== CHAR_SPACE && ch !== CHAR_TAB) return undefined
  }
  return undefined
}

function isWordChar(charCode: number): boolean {
  return (
    (charCode >= 65 && charCode <= 90) || // A-Z
    (charCode >= 97 && charCode <= 122) // a-z
  )
}
