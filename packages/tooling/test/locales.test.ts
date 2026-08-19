import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

import { BASE_LOCALE, LOCALES, nlsFileName, l10nFileName } from '../src/locales'

// __dirname aponta para packages/tooling/out/test — quatro níveis até a raiz.
const REPO_ROOT = join(__dirname, '..', '..', '..', '..')

describe('Idiomas — ponto único de declaração', () => {
  it('declara exatamente os quatro idiomas do Protheus', () => {
    // D4 da spec 001, Princípio V da constituição v2.2.0.
    assert.deepEqual([...LOCALES], ['en', 'pt-br', 'es', 'ru'])
  })

  it('usa inglês como idioma base', () => {
    // É para onde recai todo idioma sem tradução nossa. Nunca o identificador
    // cru da chave.
    assert.equal(BASE_LOCALE, 'en')
    assert.equal(LOCALES[0], BASE_LOCALE)
  })

  it('usa os identificadores de localidade do VS Code, em caixa baixa', () => {
    // `pt-br` minúsculo com hífen. Errar a caixa produz um arquivo que nunca é
    // carregado E NENHUM ERRO — daí a lista única.
    for (const locale of LOCALES) {
      assert.equal(locale, locale.toLowerCase(), `${locale} deveria estar em caixa baixa`)
      assert.match(locale, /^[a-z]{2}(-[a-z]{2})?$/)
    }
  })

  it('nomeia o arquivo de NLS do manifesto conforme a convenção do VS Code', () => {
    assert.equal(nlsFileName('en'), 'package.nls.json')
    assert.equal(nlsFileName('pt-br'), 'package.nls.pt-br.json')
    assert.equal(nlsFileName('es'), 'package.nls.es.json')
    assert.equal(nlsFileName('ru'), 'package.nls.ru.json')
  })

  it('nomeia o pacote de tradução de runtime conforme a convenção do VS Code', () => {
    assert.equal(l10nFileName('en'), 'bundle.l10n.json')
    assert.equal(l10nFileName('pt-br'), 'bundle.l10n.pt-br.json')
    assert.equal(l10nFileName('ru'), 'bundle.l10n.ru.json')
  })
})

describe('Idiomas — nenhum outro lugar os enumera', () => {
  it('nenhum código-fonte fora de locales.ts lista os idiomas', async () => {
    // FR-015a: acrescentar um idioma deve ser mudança de CONFIGURAÇÃO e não de
    // código. Se um segundo arquivo enumerar idiomas, o quinto idioma passa a
    // exigir caçar ocorrências — e uma delas vai ficar para trás.
    const sources = await collectTypeScriptSources(join(REPO_ROOT, 'packages'))
    const offenders: string[] = []

    for (const file of sources) {
      const normalized = relative(REPO_ROOT, file).split(sep).join('/')
      if (normalized === 'packages/tooling/src/locales.ts') continue
      if (normalized.includes('/test/')) continue

      const text = await readFile(file, 'utf8')
      // Procura a lista, não a menção: dois ou mais identificadores de
      // localidade não-base no mesmo arquivo é enumeração.
      const found = LOCALES.filter((l) => l !== BASE_LOCALE).filter((l) =>
        new RegExp(`['"\`]${l}['"\`]`).test(text),
      )
      if (found.length >= 2) offenders.push(`${normalized} (${found.join(', ')})`)
    }

    assert.deepEqual(offenders, [], `arquivos enumerando idioma fora da lista única:\n${offenders.join('\n')}`)
  })
})

async function collectTypeScriptSources(root: string): Promise<string[]> {
  const found: string[] = []
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(root, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'out' || entry.name === 'fixtures') continue
      found.push(...(await collectTypeScriptSources(full)))
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      found.push(full)
    }
  }
  return found
}
