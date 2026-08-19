/**
 * As linguagens que a extensão atende.
 *
 * Sem `import 'vscode'`, de propósito: assim este módulo é usado tanto pelo
 * código que fala com o editor quanto por teste que roda fora dele.
 */
export const SUPPORTED_LANGUAGES: readonly string[] = ['advpl', 'tlpp']

/**
 * Extensões de arquivo reconhecidas (constituição, Restrições Técnicas).
 * Ampliar esta lista exige regra e fixture.
 */
export const SUPPORTED_EXTENSIONS: readonly string[] = ['prw', 'prx', 'prg', 'apw', 'apl', 'tlpp']
