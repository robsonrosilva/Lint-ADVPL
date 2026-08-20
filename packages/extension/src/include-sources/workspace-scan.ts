/**
 * Fonte 4 da cadeia: as pastas abertas no editor. **Último recurso.**
 *
 * Último por uma razão concreta: a árvore de includes do Protheus costuma ficar
 * FORA do workspace — ela pertence à instalação do ambiente, não ao projeto. É
 * por isso que a varredura do workspace é o quarto degrau e não o primeiro, e é
 * por isso que `workspace.findFiles` foi rejeitado como estratégia geral em R1.
 *
 * O que este módulo NÃO faz: adivinhar um subdiretório chamado `include` ou
 * `includes` dentro da pasta aberta. Adivinhar acertaria em alguns projetos e
 * silenciosamente olharia a árvore errada nos outros — e "a regra dispara sobre
 * a árvore errada" é indistinguível de "a regra não dispara" para quem usa. As
 * pastas abertas vão como estão, e o percurso do índice, que já filtra por
 * extensão durante a varredura, encontra o que houver.
 */

/** As pastas abertas como diretórios candidatos, sem repetidas nem vazias. */
export function workspaceIncludeDirectories(folders: readonly string[]): string[] {
  return [...new Set(folders.map((folder) => folder.trim()).filter((folder) => folder.length > 0))]
}
