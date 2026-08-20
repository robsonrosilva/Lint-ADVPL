import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FileChangeType } from 'vscode-languageserver'

import {
  directoriesToInvalidate,
  fileUriToPath,
  handleWatchedFileChanges,
} from '../../../src/includes/watcher'

const CRIADO = FileChangeType.Created
const ALTERADO = FileChangeType.Changed
const APAGADO = FileChangeType.Deleted

function evento(uri: string, type: FileChangeType) {
  return { uri, type }
}

describe('Observador — o que invalidar, e só isso (FR-024, SC-007)', () => {
  it('criar um include invalida o DIRETÓRIO dele, não o índice inteiro', async () => {
    // Reindexação total a cada evento é proibida: numa árvore de 35 mil
    // arquivos, salvar um include reindexaria os 35 mil. É o defeito do legado
    // com outro nome.
    const alvos = directoriesToInvalidate([evento('file:///inc/a/NOVO.CH', CRIADO)])

    assert.deepEqual(alvos, ['/inc/a'])
  })

  it('apagar um include invalida o diretório dele', async () => {
    const alvos = directoriesToInvalidate([evento('file:///inc/a/SUMIU.CH', APAGADO)])

    assert.deepEqual(alvos, ['/inc/a'])
  })

  it('renomear — que chega como apagar mais criar — invalida os dois diretórios', async () => {
    // Renomear entre diretórios é o caso que a spec cita por extenso, e o único
    // em que dois diretórios mudam de uma vez.
    const alvos = directoriesToInvalidate([
      evento('file:///inc/a/ANTES.CH', APAGADO),
      evento('file:///inc/b/DEPOIS.CH', CRIADO),
    ])

    assert.deepEqual([...alvos].sort(), ['/inc/a', '/inc/b'])
  })

  it('renomear SÓ A CAIXA, no mesmo diretório, invalida aquele diretório', async () => {
    // É o conserto que o usuário aplica depois de `PJ0001` apontar. O índice
    // precisa enxergar a nova grafia, senão a regra continua acusando o que já
    // foi corrigido.
    const alvos = directoriesToInvalidate([
      evento('file:///inc/a/acadef.ch', APAGADO),
      evento('file:///inc/a/ACADEF.CH', CRIADO),
    ])

    assert.deepEqual(alvos, ['/inc/a'])
  })

  it('vários eventos no MESMO diretório invalidam uma vez só', async () => {
    // Uma cópia em massa dispara centenas de eventos no mesmo diretório.
    // Invalidar por evento faria centenas de revarreduras da mesma pasta.
    const alvos = directoriesToInvalidate([
      evento('file:///inc/a/UM.CH', CRIADO),
      evento('file:///inc/a/DOIS.CH', CRIADO),
      evento('file:///inc/a/TRES.CH', CRIADO),
    ])

    assert.deepEqual(alvos, ['/inc/a'])
  })
})

describe('Observador — o que IGNORAR', () => {
  it('alterar o CONTEÚDO de um include não muda o índice', async () => {
    // O índice guarda NOME e diretório, nunca conteúdo. Editar um include não
    // muda nome nenhum, e revarrer por causa disso seria trabalho puro.
    assert.deepEqual(directoriesToInvalidate([evento('file:///inc/a/A.CH', ALTERADO)]), [])
  })

  it('arquivo que não é include é ignorado', async () => {
    // O observador é declarado com padrão restrito, mas o evento pode chegar
    // por outro caminho — e uma varredura disparada por um `.prw` salvo seria
    // uma varredura por tecla.
    const alvos = directoriesToInvalidate([
      evento('file:///inc/a/programa.prw', CRIADO),
      evento('file:///inc/a/leiame.txt', APAGADO),
    ])

    assert.deepEqual(alvos, [])
  })

  it('a caixa da EXTENSÃO não decide se o evento interessa', async () => {
    for (const nome of ['NOVO.CH', 'novo.ch', 'Novo.Ch']) {
      assert.deepEqual(
        directoriesToInvalidate([evento(`file:///inc/a/${nome}`, CRIADO)]),
        ['/inc/a'],
        `com ${nome}`,
      )
    }
  })

  it('lista de eventos vazia não invalida nada', async () => {
    assert.deepEqual(directoriesToInvalidate([]), [])
  })

  it('URI que não é de arquivo é ignorada, sem lançar', async () => {
    const alvos = directoriesToInvalidate([
      evento('untitled:Untitled-1', CRIADO),
      evento('não é uma uri', APAGADO),
    ])

    assert.deepEqual(alvos, [])
  })
})

describe('Observador — a ligação com o índice', () => {
  it('chama o índice UMA vez por diretório afetado', async () => {
    const invalidados: string[] = []

    handleWatchedFileChanges(
      [
        evento('file:///inc/a/UM.CH', CRIADO),
        evento('file:///inc/a/DOIS.CH', CRIADO),
        evento('file:///inc/b/TRES.CH', APAGADO),
      ],
      { invalidateDirectory: (dir) => invalidados.push(dir) },
    )

    assert.deepEqual([...invalidados].sort(), ['/inc/a', '/inc/b'])
  })

  it('sem diretório afetado, o índice não é tocado', async () => {
    const invalidados: string[] = []

    handleWatchedFileChanges([evento('file:///inc/a/A.CH', ALTERADO)], {
      invalidateDirectory: (dir) => invalidados.push(dir),
    })

    assert.deepEqual(invalidados, [])
  })
})

describe('Observador — o requisito que o plano manda vigiar', () => {
  it('nunca devolve uma ordem de reindexar tudo', async () => {
    // O plano registra este como O risco desta spec: observar dezenas de
    // milhares de ARQUIVOS é fonte clássica de travamento. A mitigação é
    // observar DIRETÓRIOS e tratar o evento como invalidação de um diretório —
    // e o contrato deste módulo é justamente não ter como dizer "tudo".
    const alvos = directoriesToInvalidate([evento('file:///inc/a/A.CH', CRIADO)])

    assert.ok(Array.isArray(alvos))
    assert.equal(alvos.length, 1)
    assert.ok(!alvos.includes('*') && !alvos.includes(''))
  })
})

describe('Observador — o caminho vindo do URI', () => {
  it('desfaz o percent-encoding e a barra da letra de unidade do Windows', async () => {
    // `file:///d%3A/inc/a.ch` é como o VS Code manda no Windows. Sem desfazer a
    // barra, o diretório invalidado nunca casaria com o diretório indexado e o
    // índice ficaria eternamente velho.
    assert.equal(fileUriToPath('file:///d%3A/inc/A.CH'), 'd:/inc/A.CH')
    assert.equal(fileUriToPath('file:///inc/a/A.CH'), '/inc/a/A.CH')
    assert.equal(fileUriToPath('file:///inc/com%20espaco/A.CH'), '/inc/com espaco/A.CH')
  })

  it('devolve indefinido para o que não é URI de arquivo', async () => {
    assert.equal(fileUriToPath('untitled:Untitled-1'), undefined)
    assert.equal(fileUriToPath('https://exemplo/a.ch'), undefined)
    assert.equal(fileUriToPath('não é uma uri'), undefined)
  })

  it('percent-encoding malformado devolve indefinido em vez de lançar', async () => {
    assert.equal(fileUriToPath('file:///inc/%ZZ/A.CH'), undefined)
  })

  it('invalida o diretório certo num caminho do Windows', async () => {
    const alvos = directoriesToInvalidate([evento('file:///d%3A/protheus/includes/NOVO.CH', CRIADO)])

    assert.deepEqual(alvos, ['d:/protheus/includes'])
  })
})

describe('Observador — caminho sem diretório', () => {
  it('arquivo na raiz do sistema não produz diretório vazio', async () => {
    // `file:///A.CH` é um caminho de um segmento só. Devolver texto vazio faria
    // o índice procurar a raiz "" e nunca casar com diretório nenhum.
    const alvos = directoriesToInvalidate([evento('file:///A.CH', CRIADO)])

    assert.deepEqual(alvos, ['/'])
  })
})
