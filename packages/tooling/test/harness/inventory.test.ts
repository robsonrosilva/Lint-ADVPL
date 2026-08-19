import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  CACHE_FILE,
  SOURCE_EXTENSIONS,
  loadInventory,
  scanCorpus,
  type InventoryDeps,
} from '../../src/harness/inventory'

async function makeCorpus(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'advpl-inv-'))
  await mkdir(join(root, 'sub', 'mais-fundo'), { recursive: true })
  await writeFile(join(root, 'um.prw'), 'User Function Um()\nReturn\n', 'latin1')
  await writeFile(join(root, 'dois.tlpp'), 'class Dois\nendclass\n', 'latin1')
  await writeFile(join(root, 'sub', 'tres.prx'), 'Return\n', 'latin1')
  await writeFile(join(root, 'sub', 'mais-fundo', 'quatro.PRG'), 'Return\n', 'latin1')
  // Ruído que NÃO é fonte analisável: includes, imagem, texto.
  await writeFile(join(root, 'totvs.ch'), '#define X 1\n', 'latin1')
  await writeFile(join(root, 'ACADEF.CH'), '#define Y 2\n', 'latin1')
  await writeFile(join(root, 'leia-me.txt'), 'nada\n', 'utf8')
  await writeFile(join(root, 'icone.png'), 'nada\n', 'utf8')
  return root
}

describe('Inventário do corpus — o percurso (R5)', () => {
  it('colhe os fontes analisáveis e ignora include, imagem e texto', async () => {
    const root = await makeCorpus()
    try {
      const entries = await scanCorpus(root)
      const names = entries.map((e) => e.path.split(/[\\/]/).pop()).sort()

      assert.deepEqual(names, ['dois.tlpp', 'quatro.PRG', 'tres.prx', 'um.prw'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reconhece a extensão sem depender da caixa', async () => {
    // `quatro.PRG` está em caixa alta. Fonte Protheus vem das duas formas, e um
    // inventário que perdesse metade dos arquivos produziria percentis errados
    // sem nenhum aviso.
    const root = await makeCorpus()
    try {
      const entries = await scanCorpus(root)
      assert.ok(entries.some((e) => e.path.endsWith('quatro.PRG')))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('filtra por extensão DURANTE a varredura, sem medir o que não interessa', async () => {
    // A varredura ingênua sobre os ~93.000 arquivos do corpus já foi medida e
    // estourou 2 minutos (R5). O que a torna barata é decidir pelo nome, antes
    // de perguntar o tamanho ao sistema de arquivos.
    const root = await makeCorpus()
    const measured: string[] = []
    try {
      const deps: Partial<InventoryDeps> = {
        stat: async (path) => {
          measured.push(path)
          const { stat } = await import('node:fs/promises')
          return stat(path)
        },
      }

      const entries = await scanCorpus(root, deps)

      assert.equal(entries.length, 4)
      assert.equal(measured.length, 4, 'o tamanho só deve ser perguntado para fonte analisável')
      for (const path of measured) {
        const ext = path.slice(path.lastIndexOf('.')).toLowerCase()
        assert.ok(SOURCE_EXTENSIONS.includes(ext), `${path} não deveria ter sido medido`)
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('desce por subdiretórios', async () => {
    const root = await makeCorpus()
    try {
      const entries = await scanCorpus(root)
      assert.ok(entries.some((e) => e.path.includes('mais-fundo')))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('Inventário do corpus — o que ele guarda (FR-023)', () => {
  it('guarda apenas caminho e tamanho, nunca conteúdo', async () => {
    const root = await makeCorpus()
    const cachePath = join(root, CACHE_FILE)
    try {
      const inventory = await loadInventory({ root, cachePath })

      for (const entry of inventory.entries) {
        assert.deepEqual(Object.keys(entry).sort(), ['bytes', 'path'])
        assert.equal(typeof entry.path, 'string')
        assert.equal(typeof entry.bytes, 'number')
      }

      const raw = await readFile(cachePath, 'utf8')
      assert.ok(!raw.includes('User Function'), 'o cache não pode guardar conteúdo de fonte')
      assert.ok(!raw.includes('endclass'), 'o cache não pode guardar conteúdo de fonte')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('grava o cache no arquivo local combinado', async () => {
    const root = await makeCorpus()
    const cachePath = join(root, CACHE_FILE)
    try {
      await loadInventory({ root, cachePath })
      const raw = JSON.parse(await readFile(cachePath, 'utf8')) as { root: string; entries: unknown[] }

      assert.equal(raw.root, root)
      assert.equal(raw.entries.length, 4)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('Inventário do corpus — o cache (R5)', () => {
  it('reaproveita o cache quando a raiz é a mesma', async () => {
    const root = await makeCorpus()
    const cachePath = join(root, CACHE_FILE)
    let scans = 0
    try {
      const deps: Partial<InventoryDeps> = {
        stat: async (path) => {
          scans += 1
          const { stat } = await import('node:fs/promises')
          return stat(path)
        },
      }

      await loadInventory({ root, cachePath, deps })
      const afterFirst = scans

      const second = await loadInventory({ root, cachePath, deps })

      assert.equal(scans, afterFirst, 'a segunda execução não deveria varrer o disco de novo')
      assert.equal(second.entries.length, 4)
      assert.equal(second.fromCache, true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('invalida o cache quando a raiz muda', async () => {
    const primeira = await makeCorpus()
    const segunda = await makeCorpus()
    const cachePath = join(primeira, CACHE_FILE)
    try {
      await loadInventory({ root: primeira, cachePath })
      const inventory = await loadInventory({ root: segunda, cachePath })

      assert.equal(inventory.root, segunda)
      assert.equal(inventory.fromCache, false)
    } finally {
      await rm(primeira, { recursive: true, force: true })
      await rm(segunda, { recursive: true, force: true })
    }
  })

  it('ignora cache corrompido e varre de novo, sem quebrar', async () => {
    const root = await makeCorpus()
    const cachePath = join(root, CACHE_FILE)
    try {
      await writeFile(cachePath, '{ isto não é json', 'utf8')

      const inventory = await loadInventory({ root, cachePath })

      assert.equal(inventory.entries.length, 4)
      assert.equal(inventory.fromCache, false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('refaz a varredura quando explicitamente pedido', async () => {
    const root = await makeCorpus()
    const cachePath = join(root, CACHE_FILE)
    try {
      await loadInventory({ root, cachePath })
      const inventory = await loadInventory({ root, cachePath, refresh: true })

      assert.equal(inventory.fromCache, false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('ignora cache de formato antigo', async () => {
    // A versão do formato existe para que estrutura antiga não seja lida como
    // boa: um campo que mudou de significado produz número errado sem erro.
    const root = await makeCorpus()
    const cachePath = join(root, CACHE_FILE)
    try {
      await writeFile(cachePath, JSON.stringify({ version: 0, root, builtAt: '', entries: [] }), 'utf8')

      const inventory = await loadInventory({ root, cachePath })

      assert.equal(inventory.fromCache, false)
      assert.equal(inventory.entries.length, 4)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('ignora cache com estrutura inesperada', async () => {
    const root = await makeCorpus()
    const cachePath = join(root, CACHE_FILE)
    try {
      await writeFile(cachePath, JSON.stringify({ version: 1, root, builtAt: 7, entries: 'nada' }), 'utf8')

      const inventory = await loadInventory({ root, cachePath })

      assert.equal(inventory.fromCache, false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('ignora cache que não é objeto', async () => {
    const root = await makeCorpus()
    const cachePath = join(root, CACHE_FILE)
    try {
      await writeFile(cachePath, '"apenas um texto"', 'utf8')

      const inventory = await loadInventory({ root, cachePath })

      assert.equal(inventory.fromCache, false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('carimba o inventário com a hora da varredura', async () => {
    const root = await makeCorpus()
    const cachePath = join(root, CACHE_FILE)
    try {
      const inventory = await loadInventory({
        root,
        cachePath,
        now: () => new Date('2026-08-19T12:00:00.000Z'),
      })

      assert.equal(inventory.builtAt, '2026-08-19T12:00:00.000Z')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('um diretório ilegível não derruba a varredura inteira', async () => {
    // Num corpus de dezenas de milhares de arquivos, um diretório sem permissão
    // ou removido durante o percurso é rotina, não exceção.
    const root = await makeCorpus()
    try {
      const entries = await scanCorpus(root, {
        opendir: async (path) => {
          if (path.endsWith('sub')) throw new Error('sem permissão')
          const { opendir } = await import('node:fs/promises')
          return opendir(path)
        },
      })

      // Os dois fontes da raiz continuam inventariados; os de `sub` se perderam.
      assert.equal(entries.length, 2)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('ignora entradas que não são arquivo nem diretório', async () => {
    const root = await makeCorpus()
    try {
      const entries = await scanCorpus(root, {
        opendir: async () =>
          ({
            async *[Symbol.asyncIterator]() {
              yield { name: 'cano.prw', isDirectory: () => false, isFile: () => false }
            },
          }) as never,
      })

      assert.deepEqual(entries, [])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('o arquivo de cache está ignorado pelo versionamento', async () => {
    const repoRoot = join(__dirname, '..', '..', '..', '..', '..')
    const gitignore = await readFile(join(repoRoot, '.gitignore'), 'utf8')

    assert.ok(gitignore.includes(CACHE_FILE), `${CACHE_FILE} precisa estar no .gitignore`)
  })
})
