import { DiagnosticSeverity } from 'vscode-languageserver-types'

/** As severidades que o catálogo oficial da TOTVS usa. */
export type CatalogSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO'

/**
 * Erro de REGISTRO: alguém tentou registrar uma regra cuja severidade de
 * catálogo não tem entrada nesta tabela.
 *
 * Isto é deliberadamente um erro, e não um valor padrão. Se severidade não
 * mapeada caísse num padrão silencioso, a próxima spec "resolveria" o
 * TODO(SEVERITY_MAP) por omissão — e CA2050 (SQL Injection), que é INFO no
 * catálogo e alto impacto na prática, apareceria como dica de estilo sem
 * ninguém ter decidido isso.
 */
export class UnmappedSeverityError extends Error {
  constructor(catalogSeverity: string) {
    super(
      `A severidade de catálogo "${catalogSeverity}" não tem entrada na tabela de mapeamento. ` +
        `Ela pertence ao TODO(SEVERITY_MAP) da constituição e precisa de decisão registrada — ` +
        `não de um valor padrão.`,
    )
    this.name = 'UnmappedSeverityError'
  }
}

/**
 * A tabela versionada. O Princípio III proíbe copiar a severidade do catálogo:
 * ela é MAPEADA aqui, e a tabela é o registro dessa decisão.
 *
 * Hoje há UMA entrada. As demais estão ausentes de propósito — ausência aqui é
 * decisão pendente e visível, não esquecimento.
 */
export const SEVERITY_MAP: Readonly<Partial<Record<CatalogSeverity, DiagnosticSeverity>>> = {
  // D3 da spec 001: Information mostra a violação no painel de problemas sem
  // contaminar a contagem de erros e avisos. Warning inflaria a contagem, e
  // `#INCLUDE` em caixa alta é pervasivo em fonte legado — treinar o usuário a
  // ignorar o painel é exatamente o que o Princípio III proíbe.
  MINOR: DiagnosticSeverity.Information,
}

/** Resolve a severidade exibida a partir da severidade do catálogo. */
export function resolveSeverity(catalogSeverity: CatalogSeverity): DiagnosticSeverity {
  const mapped = SEVERITY_MAP[catalogSeverity]
  if (mapped === undefined) throw new UnmappedSeverityError(catalogSeverity)
  return mapped
}
