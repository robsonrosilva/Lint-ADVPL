import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { CancellationTokenSource } from 'vscode-languageserver'

import { EMPTY_INCLUDE_INDEX, IncludeIndexStore } from '../../../src/includes/index-store'
import type { ScanOptions, ScanResult, ScannedFile } from '../../../src/includes/scan'

/** Um percurso de mentira, que devolve o que o teste mandar. */
function percursoQueDevolve(
  files: readonly ScannedFile[],
  extras: Partial<ScanResult> = {},
  onScan?: (options: ScanOptions) => void,
) {
  return async (options: ScanOptions): Promise<ScanResult> => {
    onScan?.(options)
    return { files, cancelled: false, unreadable: [], ...extras }
  }
}

function arquivo(realName: string, directory = '/inc'): ScannedFile {
  return { realName, directory }
}

describe('Índice — os três estados, e por que são três', () => {
  it('nasce AUSENTE: nada foi pedido ainda', () => {
    // Nunca na ativação (FR-021). O índice nasce sabendo que não sabe.
    const index = new IncludeIndexStore({ scan: percursoQueDevolve([]) })

    assert.equal(index.state, 'ausente')
  })

  it('sem diretório utilizável, continua AUSENTE mesmo depois de pedido', async () => {
    const index = new IncludeIndexStore({ scan: percursoQueDevolve([]) })
    index.setDirectories([])
    index.ensureBuilt()
    await index.whenIdle()

    assert.equal(index.state, 'ausente')
  })

  it('passa por CONSTRUINDO e chega a PRONTO', async () => {
    // "Ainda não sei" e "já sei que não achei" levam ao mesmo silêncio na tela,
    // por razões opostas. Colapsá-los produziria o pior resultado possível: a
    // regra disparando sobre um índice pela metade, acusando ausência de
    // arquivos que existem e ainda não foram lidos.
    let liberar: () => void = () => {}
    const espera = new Promise<void>((resolve) => (liberar = resolve))

    const index = new IncludeIndexStore({
      scan: async () => {
        await espera
        return { files: [arquivo('ACADEF.CH')], cancelled: false, unreadable: [] }
      },
    })

    index.setDirectories(['/inc'])
    index.ensureBuilt()
    assert.equal(index.state, 'construindo')

    liberar()
    await index.whenIdle()
    assert.equal(index.state, 'pronto')
  })

  it('a construção é SOB DEMANDA: sem ensureBuilt, nada é lido (FR-021)', async () => {
    // Varredura de projeto na ativação é o defeito do legado com outro nome, e
    // o Princípio I é explícito a respeito.
    let varreu = 0
    const index = new IncludeIndexStore({ scan: percursoQueDevolve([], {}, () => (varreu += 1)) })
    index.setDirectories(['/inc'])

    await new Promise((resolve) => setTimeout(resolve, 5))

    assert.equal(varreu, 0)
    assert.equal(index.state, 'ausente')
  })

  it('ensureBuilt chamado dez vezes constrói UMA vez', async () => {
    let varreu = 0
    const index = new IncludeIndexStore({ scan: percursoQueDevolve([arquivo('A.CH')], {}, () => (varreu += 1)) })
    index.setDirectories(['/inc'])

    for (let i = 0; i < 10; i += 1) index.ensureBuilt()
    await index.whenIdle()

    assert.equal(varreu, 1)
  })

  it('a consulta NÃO espera pelo índice: ela responde na hora (FR-023)', async () => {
    // A regra que impede o índice de virar bloqueio. Um `await` do índice dentro
    // do caminho de análise faria a primeira abertura de arquivo esperar por
    // dezenas de milhares de leituras de disco — e o orçamento "do arquivo
    // aberto ao primeiro diagnóstico ≤ 300 ms" morreria na hora.
    const index = new IncludeIndexStore({
      scan: async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return { files: [arquivo('ACADEF.CH')], cancelled: false, unreadable: [] }
      },
    })
    index.setDirectories(['/inc'])
    index.ensureBuilt()

    // Enquanto constrói, a consulta responde — e responde "não sei ainda".
    assert.equal(index.state, 'construindo')
    assert.deepEqual(index.lookup('acadef.ch'), { kind: 'ausente' })

    await index.whenIdle()
  })
})

describe('Índice — as três respostas da consulta', () => {
  async function pronto(files: readonly ScannedFile[]): Promise<IncludeIndexStore> {
    const index = new IncludeIndexStore({ scan: percursoQueDevolve(files) })
    index.setDirectories(['/inc'])
    index.ensureBuilt()
    await index.whenIdle()
    return index
  }

  it('ENCONTRADO devolve o nome real, achado por qualquer caixa', async () => {
    const index = await pronto([arquivo('ACADEF.CH', '/inc/a')])

    for (const referencia of ['acadef.ch', 'ACADEF.CH', 'AcaDef.Ch']) {
      const resposta = index.lookup(referencia)
      assert.equal(resposta.kind, 'encontrado', `para ${referencia}`)
      assert.equal(resposta.kind === 'encontrado' && resposta.entry.realName, 'ACADEF.CH')
      assert.equal(resposta.kind === 'encontrado' && resposta.entry.directory, '/inc/a')
    }
  })

  it('AUSENTE quando não há arquivo com aquele nome', async () => {
    // "Include faltante" é outra regra, fora do escopo (FR-032). Aqui isso
    // precisa ser dizível.
    const index = await pronto([arquivo('ACADEF.CH')])

    assert.deepEqual(index.lookup('nao-existe.ch'), { kind: 'ausente' })
  })

  it('AMBÍGUO quando duas caixas diferentes existem em diretórios distintos', async () => {
    // Apontar uma delas seria adivinhação (FR-033). Ambiguidade NÃO é ausência:
    // colapsá-las esconderia um diretório mal apontado atrás de um silêncio.
    const index = await pronto([arquivo('ACADEF.CH', '/inc/a'), arquivo('acadef.ch', '/inc/b')])

    const resposta = index.lookup('acadef.ch')
    assert.equal(resposta.kind, 'ambíguo')
    assert.equal(resposta.kind === 'ambíguo' && resposta.candidates.length, 2)
  })

  it('a MESMA grafia em dois diretórios NÃO é ambígua', async () => {
    // Não há o que decidir: a grafia é uma só, e é ela que a regra compara.
    // Chamar isso de ambíguo calaria a regra em toda árvore com espelho.
    const index = await pronto([arquivo('ACADEF.CH', '/inc/a'), arquivo('ACADEF.CH', '/inc/b')])

    const resposta = index.lookup('acadef.ch')
    assert.equal(resposta.kind, 'encontrado')
    assert.equal(resposta.kind === 'encontrado' && resposta.entry.realName, 'ACADEF.CH')
  })

  it('índice AUSENTE responde ausente para tudo, sem lançar', () => {
    const index = new IncludeIndexStore({ scan: percursoQueDevolve([]) })

    assert.deepEqual(index.lookup('qualquer.ch'), { kind: 'ausente' })
  })

  it('varredura cancelada NÃO vira índice pronto', async () => {
    // Publicar um índice pela metade como se estivesse completo é o defeito que
    // os três estados existem para impedir.
    const index = new IncludeIndexStore({
      scan: percursoQueDevolve([arquivo('A.CH')], { cancelled: true }),
    })
    index.setDirectories(['/inc'])
    index.ensureBuilt()
    await index.whenIdle()

    assert.notEqual(index.state, 'pronto')
    assert.deepEqual(index.lookup('a.ch'), { kind: 'ausente' })
  })
})

describe('Índice — mudança de diretórios e invalidação (FR-024)', () => {
  it('trocar os diretórios derruba o índice para AUSENTE', async () => {
    const index = new IncludeIndexStore({ scan: percursoQueDevolve([arquivo('A.CH')]) })
    index.setDirectories(['/inc'])
    index.ensureBuilt()
    await index.whenIdle()
    assert.equal(index.state, 'pronto')

    index.setDirectories(['/outro'])

    assert.equal(index.state, 'ausente')
    assert.deepEqual(index.lookup('a.ch'), { kind: 'ausente' })
  })

  it('receber os MESMOS diretórios não joga fora o índice', async () => {
    // O cliente reafirma os diretórios a cada mudança de configuração. Se cada
    // reafirmação apagasse o índice, uma sessão com o painel de configurações
    // aberto reindexaria a árvore inteira a cada tecla.
    let varreu = 0
    const index = new IncludeIndexStore({
      scan: percursoQueDevolve([arquivo('A.CH')], {}, () => (varreu += 1)),
    })
    index.setDirectories(['/inc'])
    index.ensureBuilt()
    await index.whenIdle()

    index.setDirectories(['/inc'])
    index.ensureBuilt()
    await index.whenIdle()

    assert.equal(varreu, 1)
    assert.equal(index.state, 'pronto')
  })

  it('avisa quem precisa reanalisar quando o índice muda (FR-025)', async () => {
    const mudancas: string[] = []
    const index = new IncludeIndexStore({
      scan: percursoQueDevolve([arquivo('A.CH')]),
      onChanged: () => mudancas.push('mudou'),
    })
    index.setDirectories(['/inc'])
    index.ensureBuilt()
    await index.whenIdle()

    assert.deepEqual(mudancas, ['mudou'])
  })

  it('invalidar UM diretório não joga fora os outros (FR-024, SC-007)', async () => {
    // Reindexação total a cada evento do sistema de arquivos é proibida: numa
    // árvore de 35 mil arquivos, salvar um include reindexaria os 35 mil.
    let varridos: readonly string[] = []
    const index = new IncludeIndexStore({
      scan: async (options) => {
        varridos = options.directories
        return {
          files: options.directories.flatMap((dir) =>
            dir === '/a' ? [arquivo('A.CH', '/a')] : [arquivo('B.CH', '/b')],
          ),
          cancelled: false,
          unreadable: [],
        }
      },
    })

    index.setDirectories(['/a', '/b'])
    index.ensureBuilt()
    await index.whenIdle()

    index.invalidateDirectory('/a')
    await index.whenIdle()

    assert.deepEqual([...varridos], ['/a'], 'a revarredura levou mais que o diretório afetado')
    assert.equal(index.lookup('b.ch').kind, 'encontrado', 'o outro diretório foi jogado fora junto')
    assert.equal(index.lookup('a.ch').kind, 'encontrado')
  })

  it('invalidar um SUBDIRETÓRIO revarre o diretório raiz que o contém', async () => {
    // O observador acompanha diretórios; o evento chega com o caminho do
    // subdiretório afetado, que não é um dos diretórios de raiz da cadeia.
    let varridos: readonly string[] = []
    const index = new IncludeIndexStore({
      scan: async (options) => {
        varridos = options.directories
        return { files: [arquivo('A.CH', '/a/sub')], cancelled: false, unreadable: [] }
      },
    })
    index.setDirectories(['/a', '/b'])
    index.ensureBuilt()
    await index.whenIdle()

    index.invalidateDirectory('/a/sub/mais/fundo')
    await index.whenIdle()

    assert.deepEqual([...varridos], ['/a'])
  })

  it('invalidar diretório fora da cadeia não faz nada', async () => {
    let varreu = 0
    const index = new IncludeIndexStore({
      scan: percursoQueDevolve([arquivo('A.CH')], {}, () => (varreu += 1)),
    })
    index.setDirectories(['/a'])
    index.ensureBuilt()
    await index.whenIdle()

    index.invalidateDirectory('/em/outro/lugar')
    await index.whenIdle()

    assert.equal(varreu, 1)
  })
})

describe('Índice — falha de leitura: UM aviso por sessão (FR-026)', () => {
  it('avisa uma vez, com os diretórios que falharam', async () => {
    const avisos: string[][] = []
    const index = new IncludeIndexStore({
      scan: percursoQueDevolve([], { unreadable: ['/Z/fora-do-ar'] }),
      onUnreadable: (dirs) => avisos.push([...dirs]),
    })
    index.setDirectories(['/Z/fora-do-ar'])
    index.ensureBuilt()
    await index.whenIdle()

    assert.deepEqual(avisos, [['/Z/fora-do-ar']])
  })

  it('NUNCA avisa duas vezes, por mais que reindexe', async () => {
    // Um aviso por arquivo aberto vira ruído em minutos, e o usuário aprende a
    // fechar sem ler — o mesmo mecanismo pelo qual regra ruidosa faz o painel
    // inteiro ser ignorado (Princípio III).
    const avisos: string[][] = []
    const index = new IncludeIndexStore({
      scan: percursoQueDevolve([], { unreadable: ['/Z/fora-do-ar'] }),
      onUnreadable: (dirs) => avisos.push([...dirs]),
    })

    for (let i = 0; i < 5; i += 1) {
      index.setDirectories([`/Z/fora-do-ar`])
      index.ensureBuilt()
      await index.whenIdle()
      index.invalidateDirectory('/Z/fora-do-ar')
      await index.whenIdle()
    }

    assert.equal(avisos.length, 1, `${avisos.length} avisos numa sessão — deveria ser no máximo um`)
  })

  it('a regra segue CALADA e sem erro: a falha degrada em silêncio para ela', async () => {
    const index = new IncludeIndexStore({
      scan: percursoQueDevolve([arquivo('A.CH', '/bom')], { unreadable: ['/Z/fora-do-ar'] }),
    })
    index.setDirectories(['/bom', '/Z/fora-do-ar'])
    index.ensureBuilt()
    await index.whenIdle()

    // O que deu para ler continua valendo. O que não deu não vira exceção.
    assert.equal(index.state, 'pronto')
    assert.equal(index.lookup('a.ch').kind, 'encontrado')
    assert.deepEqual(index.lookup('nao-existe.ch'), { kind: 'ausente' })
  })

  it('sem falha nenhuma, ninguém é avisado', async () => {
    const avisos: string[][] = []
    const index = new IncludeIndexStore({
      scan: percursoQueDevolve([arquivo('A.CH')]),
      onUnreadable: (dirs) => avisos.push([...dirs]),
    })
    index.setDirectories(['/inc'])
    index.ensureBuilt()
    await index.whenIdle()

    assert.deepEqual(avisos, [])
  })
})

describe('Índice — encerramento', () => {
  it('descartar cancela a varredura em curso', async () => {
    let cancelouDeFato = false
    const index = new IncludeIndexStore({
      scan: async (options) => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        cancelouDeFato = options.token.isCancellationRequested
        return { files: [], cancelled: true, unreadable: [] }
      },
    })
    index.setDirectories(['/inc'])
    index.ensureBuilt()
    index.dispose()
    await index.whenIdle()

    assert.equal(cancelouDeFato, true, 'a varredura não recebeu o cancelamento no encerramento')
  })
})

describe('Índice — o índice VAZIO', () => {
  it('responde ausente e não faz nada quando lhe pedem para construir', () => {
    // Serve a quem analisa sem cadeia de includes resolvida: o harness de
    // medição e os testes das outras regras. Com ele, `PJ0001` cala — que é o
    // comportamento previsto quando não há diretório utilizável (FR-023).
    assert.equal(EMPTY_INCLUDE_INDEX.state, 'ausente')
    assert.deepEqual(EMPTY_INCLUDE_INDEX.lookup('qualquer.ch'), { kind: 'ausente' })
    assert.doesNotThrow(() => EMPTY_INCLUDE_INDEX.ensureBuilt())
  })
})

describe('Índice — o que ele expõe de si', () => {
  it('diz quais diretórios está usando', async () => {
    // É o que o log de diagnóstico do servidor imprime, e o que separa "a regra
    // não dispara" de "a regra dispara sobre a árvore errada".
    const index = new IncludeIndexStore({ scan: percursoQueDevolve([]) })
    assert.deepEqual([...index.directories], [])

    index.setDirectories(['/a', '/b', '/a'])

    assert.deepEqual([...index.directories], ['/a', '/b'])
  })

  it('varredura que LANÇA degrada em silêncio, sem derrubar o servidor', async () => {
    // Derrubar o motor por causa do disco seria trocar um silêncio por um
    // travamento.
    const index = new IncludeIndexStore({
      scan: () => Promise.reject(new Error('disco em chamas')),
    })
    index.setDirectories(['/inc'])
    index.ensureBuilt()

    await assert.doesNotReject(() => index.whenIdle())
    assert.notEqual(index.state, 'pronto')
    assert.deepEqual(index.lookup('a.ch'), { kind: 'ausente' })
  })
})

describe('Índice — o percurso de verdade e o encerramento', () => {
  it('sem percurso injetado, usa o de verdade e lê o disco', async () => {
    // O padrão do construtor é o percurso real. Sem este teste, o produto
    // poderia estar montando o índice com um percurso que só existe em teste.
    const { mkdtemp, writeFile } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')

    const raiz = await mkdtemp(join(tmpdir(), 'advpl-lint-idx-'))
    await writeFile(join(raiz, 'ACADEF.CH'), '// include\r\n')

    const index = new IncludeIndexStore()
    index.setDirectories([raiz])
    index.ensureBuilt()
    await index.whenIdle()

    const resposta = index.lookup('acadef.ch')
    assert.equal(resposta.kind, 'encontrado')
    assert.equal(resposta.kind === 'encontrado' && resposta.entry.realName, 'ACADEF.CH')
  })

  it('depois de descartado, ensureBuilt não constrói mais nada', async () => {
    // Encerramento do servidor: pedidos que cheguem depois não podem ressuscitar
    // uma varredura que ninguém vai usar.
    let varreu = 0
    const index = new IncludeIndexStore({ scan: percursoQueDevolve([arquivo('A.CH')], {}, () => (varreu += 1)) })
    index.setDirectories(['/inc'])
    index.dispose()

    index.ensureBuilt()
    await index.whenIdle()

    assert.equal(varreu, 0)
    assert.equal(index.lookup('a.ch').kind, 'ausente')
  })

  it('descartar no meio da varredura NÃO publica o resultado parcial', async () => {
    // O percurso pode terminar sem se dar conta do cancelamento — ele confere
    // entre diretórios, e o cancelamento pode chegar depois do último. Quem
    // recusa a publicação é o índice, conferindo o token de novo.
    let liberar: () => void = () => {}
    const espera = new Promise<void>((resolve) => (liberar = resolve))

    const index = new IncludeIndexStore({
      scan: async () => {
        await espera
        // `cancelled: false` de propósito: o percurso acha que terminou bem.
        return { files: [arquivo('A.CH')], cancelled: false, unreadable: [] }
      },
    })
    index.setDirectories(['/inc'])
    index.ensureBuilt()

    index.dispose()
    liberar()
    await index.whenIdle()

    assert.notEqual(index.state, 'pronto')
    assert.deepEqual(index.lookup('a.ch'), { kind: 'ausente' })
  })
})

describe('Índice — progresso e cancelamento PELO USUÁRIO (FR-022, SC-006)', () => {
  /**
   * Um relato de progresso de mentira, com o token que o usuário cancela.
   *
   * O contrato é estreito de propósito: o índice informa QUANTOS diretórios já
   * leu, e quem transforma isso em frase é quem abriu o relato. O motor não
   * conhece idioma — Princípio V.
   */
  function relato() {
    const source = new CancellationTokenSource()
    const reportados: number[] = []
    let encerrado = 0
    return {
      source,
      reportados,
      encerrados: () => encerrado,
      reporter: {
        token: source.token,
        report: (lidos: number) => reportados.push(lidos),
        done: () => {
          encerrado += 1
        },
      },
    }
  }

  it('reporta quantos diretórios já leu', async () => {
    // Sem isto, uma varredura de 35 mil arquivos é indistinguível de um
    // travamento para quem espera — e desde que `PJ0001` nasce ligada, ela
    // acontece na primeira abertura de fonte de toda sessão.
    const r = relato()
    const index = new IncludeIndexStore({
      scan: async (options) => {
        options.onDirectory?.('/inc/a')
        options.onDirectory?.('/inc/b')
        return { files: [arquivo('A.CH')], cancelled: false, unreadable: [] }
      },
      beginProgress: async () => r.reporter,
    })

    index.setDirectories(['/inc'])
    index.ensureBuilt()
    await index.whenIdle()

    assert.deepEqual(r.reportados, [1, 2], 'o progresso não acompanhou os diretórios lidos')
  })

  it('ENCERRA o relato quando termina', async () => {
    // Relato aberto e nunca fechado deixa a barra girando para sempre.
    const r = relato()
    const index = new IncludeIndexStore({
      scan: percursoQueDevolve([arquivo('A.CH')]),
      beginProgress: async () => r.reporter,
    })
    index.setDirectories(['/inc'])
    index.ensureBuilt()
    await index.whenIdle()

    assert.equal(r.encerrados(), 1)
  })

  it('encerra o relato também quando a varredura FALHA', async () => {
    const r = relato()
    const index = new IncludeIndexStore({
      scan: () => Promise.reject(new Error('disco em chamas')),
      beginProgress: async () => r.reporter,
    })
    index.setDirectories(['/inc'])
    index.ensureBuilt()
    await index.whenIdle()

    assert.equal(r.encerrados(), 1, 'a barra ficaria girando para sempre depois de uma falha')
  })

  it('o usuário cancela e a varredura PARA DE FATO', async () => {
    // A outra metade do FR-022. O cancelamento já existia e já parava de fato —
    // o que faltava era uma via para o usuário acioná-lo.
    const r = relato()
    let lidosDepois = 0
    let lidos = 0

    const index = new IncludeIndexStore({
      scan: async (options) => {
        for (const dir of ['/a', '/b', '/c', '/d', '/e']) {
          if (options.token.isCancellationRequested) {
            return { files: [], cancelled: true, unreadable: [] }
          }
          options.onDirectory?.(dir)
          lidos += 1
          if (r.source.token.isCancellationRequested) lidosDepois += 1
          // O usuário clica em cancelar depois do segundo diretório.
          if (lidos === 2) r.source.cancel()
          await new Promise((resolve) => setImmediate(resolve))
        }
        return { files: [arquivo('A.CH')], cancelled: false, unreadable: [] }
      },
      beginProgress: async () => r.reporter,
    })

    index.setDirectories(['/inc'])
    index.ensureBuilt()
    await index.whenIdle()

    assert.equal(lidosDepois, 0, `${lidosDepois} diretórios lidos DEPOIS do cancelamento do usuário`)
    assert.ok(lidos < 5, `leu ${lidos} de 5 — o cancelamento do usuário não chegou à varredura`)
    assert.notEqual(index.state, 'pronto', 'um índice pela metade foi publicado como pronto')
  })

  it('cancelado pelo usuário, uma NOVA construção ainda é possível', () => {
    // Cancelar não pode ser uma porta que tranca: o usuário desiste agora e
    // abre outro arquivo em seguida.
    //
    // ⚠️ Cada construção abre um relato NOVO, com token novo — é o que
    // `createWorkDoneProgress` faz. Reaproveitar o relato cancelado deixaria a
    // segunda tentativa nascer morta, e o teste passaria a provar o contrário
    // do que diz.
    return (async () => {
      let tentativas = 0
      const relatos: ReturnType<typeof relato>[] = []

      const index = new IncludeIndexStore({
        scan: async () => {
          tentativas += 1
          if (tentativas === 1) {
            relatos[relatos.length - 1]!.source.cancel()
            return { files: [], cancelled: true, unreadable: [] }
          }
          return { files: [arquivo('A.CH')], cancelled: false, unreadable: [] }
        },
        beginProgress: async () => {
          const novo = relato()
          relatos.push(novo)
          return novo.reporter
        },
      })

      index.setDirectories(['/inc'])
      index.ensureBuilt()
      await index.whenIdle()
      assert.notEqual(index.state, 'pronto', 'o cancelamento do usuário não impediu a publicação')

      index.ensureBuilt()
      await index.whenIdle()

      assert.equal(tentativas, 2, 'a segunda construção nem foi tentada')
      assert.equal(index.state, 'pronto', 'cancelar trancou a porta para sempre')
      assert.equal(relatos.length, 2, 'a segunda construção reaproveitou o relato já cancelado')
    })()
  })

  it('sem relato de progresso, o índice constrói normalmente', async () => {
    // O cliente pode não anunciar a capacidade de progresso. O índice não
    // depende dela para funcionar.
    const index = new IncludeIndexStore({ scan: percursoQueDevolve([arquivo('A.CH')]) })
    index.setDirectories(['/inc'])
    index.ensureBuilt()
    await index.whenIdle()

    assert.equal(index.state, 'pronto')
  })

  it('relato que FALHA ao abrir não impede a construção', async () => {
    // `window/workDoneProgress/create` é um PEDIDO ao cliente, e pedido pode
    // falhar. Perder a barra de progresso não pode custar o índice.
    const index = new IncludeIndexStore({
      scan: percursoQueDevolve([arquivo('A.CH')]),
      beginProgress: () => Promise.reject(new Error('cliente não respondeu')),
    })
    index.setDirectories(['/inc'])
    index.ensureBuilt()
    await index.whenIdle()

    assert.equal(index.state, 'pronto')
    assert.equal(index.lookup('a.ch').kind, 'encontrado')
  })
})
