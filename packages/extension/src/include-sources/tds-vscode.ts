import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Fonte 1 da cadeia: a extensão oficial da TOTVS (`totvs.tds-vscode`).
 *
 * Os diretórios de include ficam na chave `includes`, no topo de
 * `~/.totvsls/servers.json`. Verificado em 2026-08-19, na versão 2.0.16.
 *
 * ## Por que este módulo é tão estreito
 *
 * O mesmo arquivo guarda, ao lado de `includes`, as chaves `permissions`,
 * `savedTokens` e `connectedServer` — credenciais de servidor Protheus.
 *
 * A revisão de segurança de 2026-08-19 apontou que o risco prático **não é
 * alguém decidir publicar o arquivo**. São dois caminhos que ninguém decide:
 *
 * 1. **o objeto retido viaja.** Uma vez guardado num campo, num cache ou numa
 *    estrutura que sobreviva à função, ele reaparece em log de depuração, em
 *    telemetria ou numa mensagem de erro sem que ninguém tenha escolhido isso;
 * 2. **a mensagem de erro ecoa a entrada.** O padrão
 *    `catch (e) { log(\`falhou: ${raw}\`) }` publica os tokens no canal de log.
 *
 * A defesa é estrutural, não disciplinar: `raw` e `parsed` são **locais**,
 * morrem no `return`, e o que sai é um vetor novo de textos. E o texto do erro
 * **nunca** é ecoado — nem o do `JSON.parse`, cuja mensagem nativa do Node
 * **inclui um trecho da entrada**. É por isso que a mensagem daqui é escrita à
 * mão, dizendo caminho e natureza do problema, e mais nada (FR-027b1, FR-027b2).
 *
 * ## E por que ele não conhece o VS Code
 *
 * Nada aqui precisa do editor: é um arquivo no perfil do usuário. Manter o
 * módulo em Node puro é o que permite ao SC-016 rodar na suíte unitária, em
 * milissegundos, em vez de dentro de uma instância do editor.
 */

/** Onde o formato de terceiro guarda o arquivo. Declarado UMA vez. */
export function tdsServersFile(home: string): string {
  return join(home, '.totvsls', 'servers.json')
}

/**
 * Extrai os caminhos de include, e só eles.
 *
 * Qualquer falha — arquivo ausente, JSON inválido, forma inesperada — devolve
 * lista vazia para que a cadeia recue à próxima fonte (FR-027d). A função
 * **nunca lança**: exceção aqui seria mais um texto onde o conteúdo do arquivo
 * poderia viajar.
 *
 * `onProblem` recebe uma linha pronta, sem nada do conteúdo. Ele é opcional
 * porque este módulo não decide para onde a linha vai — quem o chama decide.
 */
export async function readTdsIncludes(
  path: string,
  onProblem?: (message: string) => void,
): Promise<string[]> {
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    // Arquivo ausente é o caso NORMAL de quem não usa a extensão da TOTVS.
    // Não é problema a relatar; é a cadeia funcionando.
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    const includes = asRecord(parsed)?.['includes']

    if (!Array.isArray(includes)) {
      onProblem?.(`${path}: a chave "includes" não é uma lista — recuando para a próxima fonte`)
      return []
    }

    // O vetor devolvido é NOVO e só tem textos. Nem `parsed` nem `raw`
    // sobrevivem a esta linha.
    return includes.filter((item): item is string => typeof item === 'string')
  } catch {
    // ⚠️ O texto do erro NÃO é repassado, de propósito. A mensagem nativa de
    // `JSON.parse` no Node cita um trecho da entrada — e a entrada é o arquivo
    // com os tokens.
    onProblem?.(`${path}: JSON inválido, formato ilegível — recuando para a próxima fonte`)
    return []
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
