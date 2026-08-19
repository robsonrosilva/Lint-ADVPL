import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { LOCALES } from '../../src/locales'
import { findNlsProblems, mechanismsOf } from '../../src/checks/nls'

// __dirname aponta para packages/tooling/out/test/checks — cinco níveis até a raiz.
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..')

/** Monta um par de mecanismos falso, com o conteúdo pedido por idioma. */
async function fakeRepo(
  manifest: Record<string, Record<string, string>>,
  runtime: Record<string, Record<string, string>>,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'advpl-nls-'))
  await mkdir(join(root, 'packages', 'extension'), { recursive: true })
  await mkdir(join(root, 'packages', 'server', 'l10n'), { recursive: true })

  for (const [file, content] of Object.entries(manifest)) {
    await writeFile(join(root, 'packages', 'extension', file), JSON.stringify(content), 'utf8')
  }
  for (const [file, content] of Object.entries(runtime)) {
    await writeFile(join(root, 'packages', 'server', 'l10n', file), JSON.stringify(content), 'utf8')
  }
  return root
}

const OK_MANIFEST = {
  'package.nls.json': { 'a.b': 'A' },
  'package.nls.pt-br.json': { 'a.b': 'A' },
  'package.nls.es.json': { 'a.b': 'A' },
  'package.nls.ru.json': { 'a.b': 'A' },
}

const OK_RUNTIME = {
  'bundle.l10n.json': { 'x.y': 'X' },
  'bundle.l10n.pt-br.json': { 'x.y': 'X' },
  'bundle.l10n.es.json': { 'x.y': 'X' },
  'bundle.l10n.ru.json': { 'x.y': 'X' },
}

describe('Verificação de NLS — o repositório de verdade', () => {
  it('os quatro idiomas concordam, nos dois mecanismos', async () => {
    // FR-015: conjunto de chaves divergente entre QUAISQUER dois idiomas é
    // falha de build, não pendência de tradução.
    const problems = await findNlsProblems(mechanismsOf(REPO_ROOT))

    assert.deepEqual(problems, [], `NLS fora de sincronia:\n${problems.join('\n')}`)
  })

  it('cobre os dois mecanismos, e não só um', async () => {
    // São oito arquivos: quatro do manifesto e quatro do runtime. Verificar só
    // um par deixaria o outro divergir em silêncio.
    const mechanisms = mechanismsOf(REPO_ROOT)

    assert.equal(mechanisms.length, 2)
    assert.ok(mechanisms.some((m) => /manifesto/i.test(m.name)))
    assert.ok(mechanisms.some((m) => /runtime|execu/i.test(m.name)))
  })

  it('verifica todos os quatro idiomas declarados no ponto único', async () => {
    assert.equal(LOCALES.length, 4)
  })
})

describe('Verificação de NLS — acusa a divergência e diz onde', () => {
  it('falha quando uma chave existe no base e falta em outro idioma', async () => {
    const root = await fakeRepo(
      { ...OK_MANIFEST, 'package.nls.ru.json': {} },
      OK_RUNTIME,
    )
    try {
      const problems = await findNlsProblems(mechanismsOf(root))

      assert.ok(problems.length > 0, 'a divergência passou batido')
      assert.ok(problems.some((p) => p.includes('a.b')), 'a mensagem não nomeia a chave')
      assert.ok(problems.some((p) => p.includes('package.nls.ru.json')), 'a mensagem não nomeia o arquivo')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('falha quando um idioma tem chave a mais', async () => {
    // Chave sobrando é tão defeito quanto chave faltando: ela indica tradução
    // de algo que já não existe, ou erro de digitação que virou chave nova.
    const root = await fakeRepo(
      { ...OK_MANIFEST, 'package.nls.es.json': { 'a.b': 'A', 'a.c': 'sobra' } },
      OK_RUNTIME,
    )
    try {
      const problems = await findNlsProblems(mechanismsOf(root))

      assert.ok(problems.some((p) => p.includes('a.c')))
      assert.ok(problems.some((p) => p.includes('package.nls.es.json')))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('falha no mecanismo de runtime também, não só no do manifesto', async () => {
    const root = await fakeRepo(OK_MANIFEST, { ...OK_RUNTIME, 'bundle.l10n.pt-br.json': {} })
    try {
      const problems = await findNlsProblems(mechanismsOf(root))

      assert.ok(problems.some((p) => p.includes('bundle.l10n.pt-br.json')))
      assert.ok(problems.some((p) => p.includes('x.y')))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('falha quando um arquivo de idioma não existe', async () => {
    // Idioma declarado sem arquivo é o modo de falha mais silencioso de todos:
    // tudo recai no inglês e ninguém percebe que a tradução sumiu.
    const manifestSemRusso = { ...OK_MANIFEST }
    delete (manifestSemRusso as Record<string, unknown>)['package.nls.ru.json']

    const root = await fakeRepo(manifestSemRusso, OK_RUNTIME)
    try {
      const problems = await findNlsProblems(mechanismsOf(root))

      assert.ok(problems.some((p) => p.includes('package.nls.ru.json') && /não existe|ausente/i.test(p)))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('falha quando um arquivo de idioma não é JSON válido', async () => {
    const root = await fakeRepo(OK_MANIFEST, OK_RUNTIME)
    try {
      await writeFile(join(root, 'packages', 'extension', 'package.nls.es.json'), '{ quebrado', 'utf8')

      const problems = await findNlsProblems(mechanismsOf(root))

      assert.ok(problems.some((p) => p.includes('package.nls.es.json') && /json|ilegível/i.test(p)))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('não reclama quando está tudo certo', async () => {
    const root = await fakeRepo(OK_MANIFEST, OK_RUNTIME)
    try {
      assert.deepEqual(await findNlsProblems(mechanismsOf(root)), [])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
