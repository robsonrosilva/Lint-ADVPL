import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CancellationTokenSource } from 'vscode-languageserver'

import {
  ENTRY_YIELD_STRIDE,
  INCLUDE_EXTENSIONS,
  scanIncludeDirectories,
  type ScannedFile,
} from '../../../src/includes/scan'

const NEVER_CANCELLED = new CancellationTokenSource().token

async function arvore(files: Readonly<Record<string, string[]>>): Promise<string> {
  const raiz = await mkdtemp(join(tmpdir(), 'advpl-lint-scan-'))
  for (const [subdir, nomes] of Object.entries(files)) {
    const dir = subdir === '.' ? raiz : join(raiz, subdir)
    await mkdir(dir, { recursive: true })
    for (const nome of nomes) await writeFile(join(dir, nome), '// include de teste\r\n')
  }
  return raiz
}

function nomes(files: readonly ScannedFile[]): string[] {
  return files.map((f) => f.realName).sort()
}

describe('Percurso — o nome vem da LISTAGEM, nunca de consulta de existência (FR-020, R3)', () => {
  it('devolve o nome REAL, como o disco o escreveu', async () => {
    const raiz = await arvore({ '.': ['ACADEF.CH', 'totvs.ch', 'MiStA.ch'] })

    const { files } = await scanIncludeDirectories({ directories: [raiz], token: NEVER_CANCELLED })

    assert.deepEqual(nomes(files), ['ACADEF.CH', 'MiStA.ch', 'totvs.ch'])
  })

  it('e uma consulta de existência pelo nome REFERENCIADO responderia errado', async () => {
    // Este teste é o mecanismo central da spec, escrito por extenso.
    //
    // Em Windows e macOS padrão, perguntar "o arquivo acadef.ch existe?"
    // responde SIM mesmo quando o disco guarda ACADEF.CH. É por isso que o
    // defeito é invisível: o desenvolvedor compila no Windows, o sistema de
    // arquivos responde "existe" para qualquer caixa, e a falha só aparece no
    // AppServer Linux — longe, tarde, e sem mensagem que ligue uma coisa à
    // outra.
    //
    // Qualquer implementação baseada em `stat`, `access` ou `exists` herdaria
    // essa cegueira e a regra NUNCA dispararia nas máquinas onde ela é escrita.
    const raiz = await arvore({ '.': ['ACADEF.CH'] })
    const referenciado = 'acadef.ch'

    const { files } = await scanIncludeDirectories({ directories: [raiz], token: NEVER_CANCELLED })
    const real = files[0]?.realName

    assert.equal(real, 'ACADEF.CH')
    assert.notEqual(real, referenciado, 'a listagem devolveu o nome referenciado — ela está mentindo')

    // A prova de que a alternativa não serve. Em sistema insensível a caixa
    // (Windows, macOS) o `access` responde SIM para a grafia errada; em Linux
    // ele falha. Nos DOIS casos a listagem já deu a resposta certa, e é ela que
    // o índice usa.
    let existenciaMentiu = false
    try {
      await access(join(raiz, referenciado))
      existenciaMentiu = true
    } catch {
      existenciaMentiu = false
    }

    if (existenciaMentiu) {
      assert.notEqual(
        referenciado,
        real,
        'a consulta de existência disse SIM para uma grafia que o disco não tem — ' +
          'é exatamente o defeito que PJ0001 existe para pegar',
      )
    }
  })

  it('guarda o diretório de onde cada arquivo veio', async () => {
    // É o que permite invalidar por diretório em vez de reindexar tudo, e é o
    // que a mensagem de ambiguidade precisa para dizer ONDE estão os candidatos.
    const raiz = await arvore({ '.': ['A.CH'] })

    const { files } = await scanIncludeDirectories({ directories: [raiz], token: NEVER_CANCELLED })

    assert.equal(files[0]?.directory, raiz)
  })
})

describe('Percurso — filtragem por extensão DURANTE a varredura (FR-023)', () => {
  it('só arquivos de include entram', async () => {
    // Filtrar depois significaria carregar em memória o nome de todo arquivo da
    // árvore para descartar quase todos. Numa árvore Protheus isso é
    // dezenas de milhares de nomes a mais, sem nenhum uso.
    const raiz = await arvore({
      '.': ['A.CH', 'programa.prw', 'leiame.txt', 'B.ch', 'semextensao'],
    })

    const { files } = await scanIncludeDirectories({ directories: [raiz], token: NEVER_CANCELLED })

    assert.deepEqual(nomes(files), ['A.CH', 'B.ch'])
  })

  it('a caixa da EXTENSÃO não conta', async () => {
    const raiz = await arvore({ '.': ['MAIUSCULA.CH', 'minuscula.ch', 'MiStA.Ch'] })

    const { files } = await scanIncludeDirectories({ directories: [raiz], token: NEVER_CANCELLED })

    assert.equal(files.length, 3)
  })

  it('a lista de extensões é declarada num lugar só', () => {
    // Ampliar exige medição, não palpite: uma extensão a mais multiplica a
    // varredura por toda a árvore.
    assert.deepEqual([...INCLUDE_EXTENSIONS], ['.ch'])
  })

  it('desce pelos subdiretórios', async () => {
    // A árvore de includes do Protheus é hierárquica. Varrer só o primeiro
    // nível deixaria a maior parte de fora, e a regra calaria por "ausente"
    // sobre arquivos que existem.
    const raiz = await arvore({
      '.': ['RAIZ.CH'],
      'nivel1': ['UM.CH'],
      'nivel1/nivel2': ['DOIS.CH'],
    })

    const { files } = await scanIncludeDirectories({ directories: [raiz], token: NEVER_CANCELLED })

    assert.deepEqual(nomes(files), ['DOIS.CH', 'RAIZ.CH', 'UM.CH'])
  })

  it('varre mais de um diretório de raiz', async () => {
    const a = await arvore({ '.': ['A.CH'] })
    const b = await arvore({ '.': ['B.CH'] })

    const { files } = await scanIncludeDirectories({ directories: [a, b], token: NEVER_CANCELLED })

    assert.deepEqual(nomes(files), ['A.CH', 'B.CH'])
  })
})

describe('Percurso — cancelamento (FR-022, SC-006)', () => {
  it('PARA DE FATO entre diretórios, não descarta o resultado no fim', async () => {
    // A distinção do Princípio I. O teste conta os diretórios VISITADOS depois
    // do cancelamento — escrito conferindo só o retorno, um percurso que
    // varresse tudo e jogasse fora passaria.
    const raiz = await arvore({
      '.': ['RAIZ.CH'],
      a: ['A.CH'],
      b: ['B.CH'],
      c: ['C.CH'],
      d: ['D.CH'],
      e: ['E.CH'],
    })

    const source = new CancellationTokenSource()
    let visitadosDepois = 0
    let visitados = 0

    const resultado = await scanIncludeDirectories({
      directories: [raiz],
      token: source.token,
      onDirectory: () => {
        if (source.token.isCancellationRequested) visitadosDepois += 1
        visitados += 1
        if (visitados === 2) source.cancel()
      },
    })

    assert.equal(resultado.cancelled, true)
    assert.equal(visitadosDepois, 0, `${visitadosDepois} diretórios visitados DEPOIS do cancelamento`)
    assert.ok(visitados < 6, `varreu ${visitados} de 6 diretórios — não parou`)
  })

  it('cancelado antes de começar, não toca no disco', async () => {
    const raiz = await arvore({ '.': ['A.CH'] })
    const source = new CancellationTokenSource()
    source.cancel()

    let visitados = 0
    const resultado = await scanIncludeDirectories({
      directories: [raiz],
      token: source.token,
      onDirectory: () => (visitados += 1),
    })

    assert.equal(resultado.cancelled, true)
    assert.equal(visitados, 0)
    assert.deepEqual(resultado.files, [])
  })

  it('reporta progresso a cada diretório', async () => {
    // FR-022: a indexação reporta progresso. Sem isso, uma árvore grande é
    // indistinguível de um travamento para quem espera.
    const raiz = await arvore({ '.': ['A.CH'], sub: ['B.CH'] })
    const visitados: string[] = []

    await scanIncludeDirectories({
      directories: [raiz],
      token: NEVER_CANCELLED,
      onDirectory: (dir) => visitados.push(dir),
    })

    assert.equal(visitados.length, 2)
    assert.ok(visitados.includes(raiz))
  })
})

describe('Percurso — falha de leitura degrada em silêncio (FR-026)', () => {
  it('diretório inexistente não derruba a varredura e é RELATADO', async () => {
    // Degradar em silêncio para a REGRA não é degradar em silêncio para o
    // diagnóstico: quem chama precisa saber que um diretório falhou, para
    // decidir sobre o aviso único da sessão.
    const bom = await arvore({ '.': ['A.CH'] })
    const ruim = join(tmpdir(), 'advpl-lint-jamais-existiu', 'includes')

    const resultado = await scanIncludeDirectories({
      directories: [ruim, bom],
      token: NEVER_CANCELLED,
    })

    assert.deepEqual(nomes(resultado.files), ['A.CH'], 'o diretório bom deveria ter sido varrido')
    assert.deepEqual(resultado.unreadable, [ruim])
  })

  it('subdiretório ilegível não impede o resto da árvore', async () => {
    const raiz = await arvore({ '.': ['RAIZ.CH'], sub: ['SUB.CH'] })

    const resultado = await scanIncludeDirectories({
      directories: [raiz, join(raiz, 'nao-existe')],
      token: NEVER_CANCELLED,
    })

    assert.deepEqual(nomes(resultado.files), ['RAIZ.CH', 'SUB.CH'])
    assert.equal(resultado.unreadable.length, 1)
  })

  it('lista de diretórios vazia devolve resultado vazio, sem falha', async () => {
    const resultado = await scanIncludeDirectories({ directories: [], token: NEVER_CANCELLED })

    assert.deepEqual(resultado.files, [])
    assert.deepEqual(resultado.unreadable, [])
    assert.equal(resultado.cancelled, false)
  })

  it('o mesmo diretório listado duas vezes é varrido uma vez', async () => {
    // Varrer duas vezes produziria "ambíguo" para TODO arquivo daquela árvore —
    // e a regra calaria justamente onde deveria falar.
    const raiz = await arvore({ '.': ['A.CH'] })

    const { files } = await scanIncludeDirectories({
      directories: [raiz, raiz],
      token: NEVER_CANCELLED,
    })

    assert.equal(files.length, 1)
  })
})

describe('Percurso — o mesmo diretório alcançado por dois caminhos', () => {
  it('subdiretório também listado como raiz é varrido UMA vez', async () => {
    // A cadeia pode entregar uma raiz e um subdiretório dela. Sem a marca de
    // visitado, os arquivos do subdiretório entrariam duas vezes — e todo
    // arquivo dele viraria "ambíguo", calando a regra justamente onde ela
    // deveria falar.
    const raiz = await arvore({ '.': ['RAIZ.CH'], sub: ['SUB.CH'] })

    const { files } = await scanIncludeDirectories({
      directories: [raiz, join(raiz, 'sub')],
      token: NEVER_CANCELLED,
    })

    assert.deepEqual(nomes(files), ['RAIZ.CH', 'SUB.CH'])
  })
})

describe('Percurso — cede o laço DENTRO de um diretório grande (Princípio I)', () => {
  it('a cessão acontece por CONTAGEM de entradas, não só entre diretórios', async () => {
    // O Princípio I diz que nada ocupa o laço por mais de 50 ms sem ceder. A
    // primeira versão deste percurso cedia **entre** diretórios: um diretório
    // com dezenas de milhares de arquivos rodava do começo ao fim sem devolver o
    // controle. No corpus são ~8 arquivos por diretório e nada se observava —
    // mas a garantia não era estrutural, e garantia que depende do formato dos
    // dados não é garantia.
    //
    // ⚠️ A cessão é por CONTAGEM, e não por relógio, exatamente para que este
    // teste seja determinístico. Um teste que contasse cessões de uma política
    // baseada em tempo mediria a MÁQUINA — máquina mais rápida cederia MENOS
    // vezes —, e é a armadilha registrada em memoria/armadilhas-do-ambiente.md.
    const total = ENTRY_YIELD_STRIDE * 2 + 10
    const raiz = await arvore({
      '.': Array.from({ length: total }, (_, i) => `INC${i}.CH`),
    })

    // Uma corrente que se reagenda: ela só avança se o percurso devolver o
    // controle ao laço de eventos.
    let voltas = 0
    let rodando = true
    const corrente = (): void => {
      if (!rodando) return
      voltas += 1
      setImmediate(corrente)
    }
    setImmediate(corrente)

    const { files } = await scanIncludeDirectories({ directories: [raiz], token: NEVER_CANCELLED })
    rodando = false

    assert.equal(files.length, total, 'a varredura não leu tudo')
    assert.ok(
      voltas >= 2,
      `o laço de eventos girou ${voltas} vez(es) durante a varredura de ${total} arquivos ` +
        `num único diretório — com cessão a cada ${ENTRY_YIELD_STRIDE} entradas, esperava ao menos 2`,
    )
  })

  it('a passada de cessão é declarada num lugar só', () => {
    // Ela governa quanto trabalho cabe entre duas respirações. Mudar o número
    // muda o comportamento do Princípio I, e por isso ele é explícito.
    assert.equal(typeof ENTRY_YIELD_STRIDE, 'number')
    assert.ok(ENTRY_YIELD_STRIDE > 0)
  })
})
