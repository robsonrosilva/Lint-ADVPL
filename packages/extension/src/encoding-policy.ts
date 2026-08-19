/**
 * A política de codificação, sem nenhuma dependência do editor.
 *
 * Ela mora separada de `encoding-guard.ts` — que é quem fala com a API do VS
 * Code — porque é aqui que está a decisão, e decisão precisa de teste que rode
 * sem subir um editor.
 */

/** O único code page que os compiladores Protheus aceitam. */
export const REQUIRED_ENCODING = 'windows1252'

/**
 * A extensão empurra `files.encoding: windows1252` por `configurationDefaults`,
 * mas o usuário pode ter uma escolha explícita em contrário — e nesse caso o
 * padrão da extensão perde, como deve ser.
 *
 * O problema é que ler CP1252 como UTF-8 não falha ruidosamente: bytes ≥ 0x80
 * viram U+FFFD, e sequências que por acaso formem UTF-8 válido colapsam DOIS
 * bytes num caractere só — deslocando a coluna de todo diagnóstico seguinte na
 * linha. Diagnóstico na coluna errada é pior que nenhum, então isto precisa ser
 * dito ao usuário.
 */
export function isAcceptableEncoding(encoding: string | undefined): boolean {
  if (!encoding) return false
  // O VS Code aceita `windows1252`; normalizar separadores e caixa evita que
  // `Windows-1252` seja tratado como codificação diferente.
  return encoding.toLowerCase().replace(/[-_]/g, '') === REQUIRED_ENCODING
}

export interface EncodingWarningState {
  /** Já avisamos nesta sessão? */
  readonly warned: boolean
}

/**
 * Avisar UMA vez por sessão, nunca por arquivo.
 *
 * Um aviso por arquivo aberto viraria ruído em minutos, e o usuário aprenderia
 * a fechar sem ler — que é o mesmo mecanismo pelo qual regra ruidosa faz o
 * painel de problemas inteiro ser ignorado (Princípio III).
 */
export function shouldWarnAboutEncoding(
  state: EncodingWarningState,
  encoding: string | undefined,
): boolean {
  if (state.warned) return false
  return !isAcceptableEncoding(encoding)
}
