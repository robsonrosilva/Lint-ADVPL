import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Tradução das mensagens ao usuário.
 *
 * O modelo é chave → texto, e a chave NUNCA vaza para a tela: quando o idioma
 * não tem tradução, recai-se no inglês, que é o idioma base. Chave crua no
 * painel de problemas é o modo de falha que o Princípio V existe para impedir.
 *
 * A conferência de que os quatro idiomas têm exatamente as mesmas chaves é do
 * portão `check:nls`, e falha a construção — não é responsabilidade daqui.
 */

export type MessageBundle = Readonly<Record<string, string>>

/** Inglês. Base do NLS e recuo de qualquer idioma sem tradução. */
const BASE_BUNDLE_FILE = 'bundle.l10n.json'

export interface Translator {
  (key: string, args?: Readonly<Record<string, string | number>>): string
}

/**
 * Carrega o pacote do idioma pedido mais o base.
 *
 * Roda UMA VEZ, na inicialização do servidor. Não é caminho quente: nada aqui
 * roda por documento nem por regra.
 */
/**
 * O pacote base não existir é ERRO, e alto.
 *
 * Aprendido na prática em 2026-08-19: a primeira versão engolia a falha de
 * leitura e devolvia `{}`. Resultado — o servidor empacotado procurava as
 * traduções no lugar errado, ninguém foi avisado, e o painel de problemas do
 * VS Code exibiu literalmente `rule.CA3001.message` ao usuário. É exatamente o
 * modo de falha que o Princípio V descreve: "chave faltante não degrada
 * elegantemente, ela vaza o identificador cru para dentro do editor".
 *
 * Falhar aqui é melhor: o erro aparece na inicialização, com o caminho, em vez
 * de virar texto estranho na tela de quem usa.
 */
export class MissingBaseBundleError extends Error {
  constructor(candidates: readonly string[]) {
    super(
      `Pacote de tradução base (${BASE_BUNDLE_FILE}) não encontrado. Procurado em:\n` +
        candidates.map((c) => `  - ${c}`).join('\n'),
    )
    this.name = 'MissingBaseBundleError'
  }
}

export async function loadBundles(
  candidateDirs: readonly string[],
  locale: string,
): Promise<{ base: MessageBundle; localized: MessageBundle }> {
  // Vários candidatos porque o caminho depende de como o servidor foi iniciado:
  // compilado por `tsc` (out/src) ou empacotado por esbuild (dist). Procurar em
  // vez de assumir evita que um dos dois modos fique mudo.
  for (const dir of candidateDirs) {
    const base = await readBundle(join(dir, BASE_BUNDLE_FILE))
    if (!base) continue

    if (locale === 'en') return { base, localized: base }

    // Idioma sem tradução nossa NÃO é erro: não há arquivo, e tudo recai no
    // inglês. É o comportamento nativo do NLS do VS Code.
    const localized = await readBundle(join(dir, `bundle.l10n.${locale}.json`))
    return { base, localized: localized ?? base }
  }
  throw new MissingBaseBundleError(candidateDirs.map((d) => join(d, BASE_BUNDLE_FILE)))
}

/** `undefined` quando o arquivo não existe — distinto de um pacote vazio. */
async function readBundle(path: string): Promise<MessageBundle | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as MessageBundle
  } catch {
    return undefined
  }
}

/**
 * Monta o tradutor.
 *
 * Ordem de busca: idioma pedido → inglês → a própria chave. O terceiro degrau
 * só é alcançável se o pacote base estiver quebrado, e existe para que uma
 * mensagem estranha seja melhor que uma exceção no meio da análise.
 */
export function createTranslator(base: MessageBundle, localized: MessageBundle): Translator {
  return (key, args) => {
    const template = localized[key] ?? base[key] ?? key
    if (!args) return template
    return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
      const value = args[name]
      return value === undefined ? whole : String(value)
    })
  }
}

/**
 * Normaliza o identificador de localidade que o editor envia.
 *
 * O VS Code manda `pt-br`, mas também aparece `pt-BR` conforme a origem. Caixa
 * errada produz um arquivo que nunca é carregado E NENHUM ERRO — por isso a
 * normalização é explícita e testada.
 */
export function normalizeLocale(raw: string | undefined): string {
  if (!raw) return 'en'
  return raw.toLowerCase()
}
