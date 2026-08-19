/**
 * PONTO ÚNICO de declaração dos idiomas suportados.
 *
 * FR-015a e Princípio V da constituição v2.2.0: acrescentar um idioma deve ser
 * mudança de CONFIGURAÇÃO, não de código. Se um segundo arquivo enumerar
 * idiomas, o quinto idioma passa a exigir caçar ocorrências pelo repositório —
 * e uma delas fica para trás, produzindo um arquivo de tradução que nunca é
 * carregado e nenhum erro.
 *
 * São os quatro idiomas em que o Protheus é localizado (D4 da spec 001).
 */

export type Locale = 'en' | 'pt-br' | 'es' | 'ru'

/**
 * A lista. O primeiro item é o idioma base — é para onde recai todo idioma sem
 * tradução nossa, nunca o identificador cru da chave.
 *
 * Os identificadores são os do VS Code, em caixa baixa e com hífen. Errar a
 * caixa produz um arquivo que jamais é carregado E NENHUM ERRO.
 */
export const LOCALES: readonly Locale[] = ['en', 'pt-br', 'es', 'ru']

/** Inglês. Base do NLS e recuo de qualquer idioma não traduzido. */
export const BASE_LOCALE: Locale = 'en'

/** Idiomas que precisam de arquivo de tradução próprio (todos menos o base). */
export const TRANSLATED_LOCALES: readonly Locale[] = LOCALES.filter((l) => l !== BASE_LOCALE)

/**
 * Nome do arquivo de NLS do manifesto para um idioma.
 * Convenção do VS Code: `package.nls.json` é o base, `package.nls.<locale>.json`
 * são as traduções.
 */
export function nlsFileName(locale: Locale): string {
  return locale === BASE_LOCALE ? 'package.nls.json' : `package.nls.${locale}.json`
}

/**
 * Nome do pacote de tradução de runtime para um idioma.
 * Convenção do `@vscode/l10n`: `bundle.l10n.json` é o base,
 * `bundle.l10n.<locale>.json` são as traduções.
 */
export function l10nFileName(locale: Locale): string {
  return locale === BASE_LOCALE ? 'bundle.l10n.json' : `bundle.l10n.${locale}.json`
}
