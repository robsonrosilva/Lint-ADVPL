/**
 * Fonte 3 da cadeia: a chave própria deste produto, `advplLint.includePaths`.
 *
 * É a única fonte da cadeia que o usuário deste produto controla diretamente, e
 * por isso ela é definível **por workspace** (FR-027e) — o manifesto declara a
 * chave com escopo `resource`. Um desenvolvedor que atende dois clientes com
 * árvores de include diferentes não deveria ter de trocar a configuração global
 * ao alternar de projeto.
 *
 * Este módulo é puro: recebe o valor já lido e não conhece a API do editor.
 */

/**
 * Normaliza a lista da chave própria.
 *
 * Valor que não é lista devolve vazio — configuração é entrada externa e um
 * `advplLint.includePaths: "C:/x"` não pode virar exceção no caminho de
 * resolução.
 */
export function normalizeIncludePaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}
