/**
 * Fonte 2 da cadeia: a outra extensão ADVPL (`killerall.advpl-vscode`).
 *
 * Os diretórios ficam em `advpl.environments[].includeList`, no ambiente cujo
 * `name` bate com `advpl.selectedEnvironment`.
 *
 * **`includeList` é um TEXTO, não uma lista.** Verificado no manifesto da
 * v0.18.1 em 2026-08-19: o próprio formato documenta *"separate each directory
 * with ;"*. Tratá-lo como lista devolveria o texto inteiro como se fosse um
 * único diretório — que não existe —, e a fonte recuaria sempre, em silêncio.
 *
 * Este módulo é PURO de propósito: ele recebe os dois valores de configuração
 * já lidos e não conhece a API do editor. Quem os lê é `vscode-adapters.ts`. A
 * decisão inteira — qual ambiente, como separar, o que descartar — fica aqui,
 * onde o teste roda sem subir um VS Code.
 */

/** O separador que o formato de terceiro declara. */
export const ADVPL_INCLUDE_SEPARATOR = ';'

/**
 * Os diretórios do ambiente selecionado.
 *
 * Qualquer forma inesperada devolve lista vazia para que a cadeia recue
 * (FR-027d) — nunca lança. As fontes 1 e 2 são formatos que este projeto não
 * controla e podem mudar sem aviso.
 */
export function extractAdvplIncludeList(environments: unknown, selected: unknown): string[] {
  if (typeof selected !== 'string' || selected.length === 0) return []
  if (!Array.isArray(environments)) return []

  // `find` e não `filter`: nome duplicado é configuração malformada do usuário,
  // e juntar as listas inventaria uma árvore que ele não pediu.
  const environment = environments
    .map(asRecord)
    .find((entry) => entry?.['name'] === selected)

  const includeList = environment?.['includeList']
  if (typeof includeList !== 'string') return []

  return includeList
    .split(ADVPL_INCLUDE_SEPARATOR)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
