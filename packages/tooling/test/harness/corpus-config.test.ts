import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  CORPUS_CONFIG_FILE,
  CORPUS_ENV_VAR,
  resolveCorpus,
} from '../../src/harness/corpus-config'

/** Cria uma raiz temporária isolada por teste. */
async function makeTempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'advpl-corpus-'))
}

describe('Configuração do corpus — precedência (FR-023)', () => {
  it('a variável de ambiente vence sobre o arquivo local', async () => {
    const repoRoot = await makeTempRoot()
    const viaEnv = join(repoRoot, 'fontes-do-ambiente')
    const viaArquivo = join(repoRoot, 'fontes-do-arquivo')
    try {
      await mkdir(viaEnv)
      await mkdir(viaArquivo)
      await writeFile(join(repoRoot, CORPUS_CONFIG_FILE), JSON.stringify({ root: viaArquivo }), 'utf8')

      const resolution = await resolveCorpus({ repoRoot, env: { [CORPUS_ENV_VAR]: viaEnv } })

      assert.equal(resolution.available, true)
      assert.ok(resolution.available)
      assert.equal(resolution.config.root, viaEnv)
      assert.equal(resolution.config.source, 'env')
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('usa o arquivo local quando a variável de ambiente não está definida', async () => {
    const repoRoot = await makeTempRoot()
    const viaArquivo = join(repoRoot, 'fontes')
    try {
      await mkdir(viaArquivo)
      await writeFile(join(repoRoot, CORPUS_CONFIG_FILE), JSON.stringify({ root: viaArquivo }), 'utf8')

      const resolution = await resolveCorpus({ repoRoot, env: {} })

      assert.ok(resolution.available)
      assert.equal(resolution.config.root, viaArquivo)
      assert.equal(resolution.config.source, 'file')
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('trata variável de ambiente vazia como não definida', async () => {
    // Uma variável exportada vazia é o caso comum de script mal escrito. Tratá-la
    // como "definida" faria a medição apontar para a raiz do sistema de arquivos.
    const repoRoot = await makeTempRoot()
    const viaArquivo = join(repoRoot, 'fontes')
    try {
      await mkdir(viaArquivo)
      await writeFile(join(repoRoot, CORPUS_CONFIG_FILE), JSON.stringify({ root: viaArquivo }), 'utf8')

      const resolution = await resolveCorpus({ repoRoot, env: { [CORPUS_ENV_VAR]: '   ' } })

      assert.ok(resolution.available)
      assert.equal(resolution.config.source, 'file')
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })
})

describe('Configuração do corpus — ambiente do processo', () => {
  it('lê o ambiente do processo quando nenhum é passado', async () => {
    const repoRoot = await makeTempRoot()
    const original = process.env[CORPUS_ENV_VAR]
    try {
      const viaEnv = join(repoRoot, 'fontes')
      await mkdir(viaEnv)
      process.env[CORPUS_ENV_VAR] = viaEnv

      const resolution = await resolveCorpus({ repoRoot })

      assert.ok(resolution.available)
      assert.equal(resolution.config.root, viaEnv)
    } finally {
      if (original === undefined) delete process.env[CORPUS_ENV_VAR]
      else process.env[CORPUS_ENV_VAR] = original
      await rm(repoRoot, { recursive: true, force: true })
    }
  })
})

describe('Configuração do corpus — indisponibilidade (FR-024)', () => {
  it('sem variável e sem arquivo, declara o corpus indisponível', async () => {
    const repoRoot = await makeTempRoot()
    try {
      const resolution = await resolveCorpus({ repoRoot, env: {} })

      assert.equal(resolution.available, false)
      assert.ok(!resolution.available)
      assert.match(resolution.reason, /corpus/i)
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('declara indisponível quando o caminho configurado não existe', async () => {
    // Silenciosamente recuar para outra fonte esconderia um caminho errado, e a
    // medição sairia sobre material que não é o que o mantenedor pediu.
    const repoRoot = await makeTempRoot()
    try {
      const inexistente = join(repoRoot, 'nao-existe')
      const resolution = await resolveCorpus({ repoRoot, env: { [CORPUS_ENV_VAR]: inexistente } })

      assert.ok(!resolution.available)
      assert.match(resolution.reason, /nao-existe/)
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('declara indisponível quando o caminho configurado é um arquivo, não um diretório', async () => {
    const repoRoot = await makeTempRoot()
    try {
      const arquivo = join(repoRoot, 'isto-e-um-arquivo.txt')
      await writeFile(arquivo, 'conteúdo', 'utf8')

      const resolution = await resolveCorpus({ repoRoot, env: { [CORPUS_ENV_VAR]: arquivo } })

      assert.ok(!resolution.available)
      assert.match(resolution.reason, /diret/i)
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('declara indisponível quando o arquivo local é JSON inválido', async () => {
    const repoRoot = await makeTempRoot()
    try {
      await writeFile(join(repoRoot, CORPUS_CONFIG_FILE), '{ isto não é json', 'utf8')

      const resolution = await resolveCorpus({ repoRoot, env: {} })

      assert.ok(!resolution.available)
      assert.match(resolution.reason, new RegExp(CORPUS_CONFIG_FILE.replace('.', '\\.')))
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('declara indisponível quando o arquivo local não traz a raiz', async () => {
    const repoRoot = await makeTempRoot()
    try {
      await writeFile(join(repoRoot, CORPUS_CONFIG_FILE), JSON.stringify({ outraCoisa: 1 }), 'utf8')

      const resolution = await resolveCorpus({ repoRoot, env: {} })

      assert.ok(!resolution.available)
      assert.match(resolution.reason, /root/)
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('declara indisponível quando o arquivo local não é objeto', async () => {
    const repoRoot = await makeTempRoot()
    try {
      await writeFile(join(repoRoot, CORPUS_CONFIG_FILE), '"apenas um texto"', 'utf8')

      const resolution = await resolveCorpus({ repoRoot, env: {} })

      assert.ok(!resolution.available)
      assert.match(resolution.reason, /root/)
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })

  it('declara indisponível quando a raiz declarada é texto em branco', async () => {
    const repoRoot = await makeTempRoot()
    try {
      await writeFile(join(repoRoot, CORPUS_CONFIG_FILE), JSON.stringify({ root: '   ' }), 'utf8')

      const resolution = await resolveCorpus({ repoRoot, env: {} })

      assert.ok(!resolution.available)
    } finally {
      await rm(repoRoot, { recursive: true, force: true })
    }
  })
})

describe('Configuração do corpus — nada dela é versionado (FR-023)', () => {
  it('os dois nomes de arquivo estão ignorados pelo versionamento', async () => {
    const { readFile } = await import('node:fs/promises')
    // __dirname aponta para packages/tooling/out/test/harness — cinco níveis.
    const repoRoot = join(__dirname, '..', '..', '..', '..', '..')
    const gitignore = await readFile(join(repoRoot, '.gitignore'), 'utf8')

    assert.ok(
      gitignore.includes(CORPUS_CONFIG_FILE),
      `${CORPUS_CONFIG_FILE} precisa estar no .gitignore — ele guarda o caminho do corpus`,
    )
  })
})
