import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { BASE_LOCALE, LOCALES, l10nFileName, nlsFileName, type Locale } from '../locales'

/**
 * O portão dos quatro idiomas (Princípio V, FR-015).
 *
 * "Conjunto de chaves divergente entre **quaisquer dois** idiomas é falha de
 * build, não pendência de tradução." Chave faltante não degrada elegantemente:
 * ela vaza o identificador cru para dentro do editor — e isso já aconteceu
 * neste projeto, com `rule.CA3001.message` aparecendo no painel do usuário.
 *
 * São **dois mecanismos** e oito arquivos: o NLS do manifesto, que traduz
 * rótulos de configuração, e o pacote de runtime, que traduz as mensagens de
 * diagnóstico. Verificar só um deixaria o outro divergir em silêncio.
 *
 * ⚠️ Limite honesto, e a constituição o registra: isto prova que as CHAVES
 * batem. Não diz nada sobre a qualidade do texto. Espanhol e russo precisam de
 * revisão de quem fala o idioma antes de publicar.
 */

export interface NlsMechanism {
  readonly name: string
  readonly dir: string
  readonly fileNameOf: (locale: Locale) => string
}

export function mechanismsOf(repoRoot: string): NlsMechanism[] {
  return [
    {
      name: 'NLS do manifesto',
      dir: join(repoRoot, 'packages', 'extension'),
      fileNameOf: nlsFileName,
    },
    {
      name: 'pacote de runtime',
      dir: join(repoRoot, 'packages', 'server', 'l10n'),
      fileNameOf: l10nFileName,
    },
  ]
}

type Bundle = Record<string, unknown>

interface LoadedBundle {
  readonly locale: Locale
  readonly file: string
  readonly keys: Set<string>
}

async function loadBundle(
  mechanism: NlsMechanism,
  locale: Locale,
  problems: string[],
): Promise<LoadedBundle | undefined> {
  const file = mechanism.fileNameOf(locale)
  const path = join(mechanism.dir, file)

  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    problems.push(`${mechanism.name}: o arquivo "${file}" não existe (${path})`)
    return undefined
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    problems.push(`${mechanism.name}: o arquivo "${file}" está ilegível — não é JSON válido`)
    return undefined
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    problems.push(`${mechanism.name}: o arquivo "${file}" deveria ser um objeto de chave para texto`)
    return undefined
  }

  return { locale, file, keys: new Set(Object.keys(parsed as Bundle)) }
}

export async function findNlsProblems(mechanisms: readonly NlsMechanism[]): Promise<string[]> {
  const problems: string[] = []

  for (const mechanism of mechanisms) {
    const bundles: LoadedBundle[] = []
    for (const locale of LOCALES) {
      const bundle = await loadBundle(mechanism, locale, problems)
      if (bundle) bundles.push(bundle)
    }

    // A união de TODAS as chaves é a referência, e não as do idioma base.
    // Usar o base como referência esconderia o caso em que uma tradução tem
    // chave que o base não tem — que é erro de digitação virando chave nova,
    // e some para sempre porque nada a lê.
    const universe = new Set<string>()
    for (const bundle of bundles) for (const key of bundle.keys) universe.add(key)

    for (const key of [...universe].sort()) {
      for (const bundle of bundles) {
        if (bundle.keys.has(key)) continue
        // Nomear os ARQUIVOS que têm a chave, e não só os idiomas: quem lê o
        // erro precisa saber onde copiar de e onde colar, sem traduzir código
        // de idioma para nome de arquivo na cabeça.
        const onde = bundles.filter((b) => b.keys.has(key)).map((b) => b.file)
        problems.push(
          `${mechanism.name}: a chave "${key}" falta em "${bundle.file}" ` +
            `e existe em ${onde.join(', ')}`,
        )
      }
    }
  }

  return problems
}

/** O idioma base é o recuo de todos os outros; existe para o relatório citá-lo. */
export const NLS_BASE_LOCALE = BASE_LOCALE

/**
 * O caminho declarado em `"l10n"` do manifesto é onde o build grava os pacotes?
 *
 * ⚠️ **Isto já falhou em silêncio.** Até 2026-08-20 o manifesto declarava
 * `"l10n": "./l10n"`, diretório que **nunca existiu** — o build sempre gravou em
 * `dist/l10n`. Resultado: a tradução de runtime da extensão jamais carregava, e
 * `l10n.t('encoding.wrongEncoding')` devolvia a CHAVE CRUA ao usuário.
 *
 * É exatamente o modo de falha que o Princípio V existe para impedir, e o portão
 * `check:nls` não o pegava: ele confere se as chaves batem entre os quatro
 * idiomas, não se alguém consegue encontrar o arquivo.
 *
 * A verificação é de CONSISTÊNCIA entre duas declarações — o manifesto e o
 * script de empacotamento — e não depende de o build ter rodado. Comparar contra
 * um diretório no disco daria verde num clone recém-feito, onde `dist/` não
 * existe ainda, e é justamente aí que o defeito seria introduzido sem alarme.
 */
export interface L10nPathSources {
  /** O valor de `"l10n"` no manifesto da extensão. */
  readonly manifestValue: unknown
  /** O conteúdo de `packages/tooling/scripts/bundle.mjs`. */
  readonly bundleScript: string
}

export function findL10nPathProblems(sources: L10nPathSources): string[] {
  const problems: string[] = []
  const declared = sources.manifestValue

  if (typeof declared !== 'string' || declared.trim().length === 0) {
    return [
      'o manifesto da extensão não declara `"l10n"` — sem ele o VS Code não carrega ' +
        'pacote de tradução nenhum, e toda chamada de `l10n.t` devolve a CHAVE CRUA ao usuário',
    ]
  }

  // `./dist/l10n` e `dist/l10n` são o mesmo lugar; o que interessa é o destino.
  const normalized = declared.replace(/^\.\//, '').replace(/\/+$/, '')

  // O script copia para um caminho que termina no destino declarado. Casar pelo
  // FIM, e não pelo caminho inteiro, porque o script monta o caminho a partir da
  // raiz do repositório e do nome do pacote.
  const copiaPara = new RegExp(`packages/extension/${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)

  if (!copiaPara.test(sources.bundleScript)) {
    problems.push(
      `o manifesto declara \`"l10n": "${declared}"\`, e o script de empacotamento NÃO grava ali. ` +
        'O VS Code não acharia os pacotes, e toda chamada de `l10n.t` devolveria a chave crua — ' +
        'foi assim, exatamente, entre a spec 001 e 2026-08-20.',
    )
  }

  return problems
}
