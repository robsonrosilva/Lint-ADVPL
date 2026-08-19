import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { fork, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { readdirSync } from 'node:fs'
import { createMessageConnection, IPCMessageReader, IPCMessageWriter } from 'vscode-jsonrpc/node'
import type { Diagnostic } from 'vscode-languageserver-types'

/**
 * O servidor de verdade, pelo protocolo de verdade — sem editor.
 *
 * Isto existe porque o idioma **não** pode ser testado dentro do VS Code sem o
 * pacote de idioma instalado: sem ele o editor ignora `--locale` e volta para
 * inglês, e o teste passaria a provar o contrário do que diz. Medido aqui em
 * 2026-08-19.
 *
 * Falar LSP direto com o processo do servidor é melhor em três frentes: cobre
 * os **quatro** idiomas em vez de um, não depende de rede nem de marketplace, e
 * exercita exatamente o elo que faltava — o `locale` do `initialize` chegando
 * até a mensagem publicada.
 */

// __dirname aponta para packages/server/out/test/protocol — três níveis até `out`.
const SERVER = join(__dirname, '..', '..', 'src', 'server.js')

const FONTE = ['// topo', '#INCLUDE "TOTVS.CH"', ''].join('\r\n')
const URI = 'file:///teste.prw'

/**
 * Os idiomas, lidos dos arquivos que existem no disco.
 *
 * Deliberadamente NÃO enumerados aqui: a lista dos idiomas suportados tem ponto
 * único de declaração (Princípio V), que vive no workspace de ferramentas — e
 * o motor não depende dele. Derivar do disco mantém o ponto único intacto e faz
 * o teste acompanhar sozinho o dia em que entrar um quinto idioma.
 *
 * A leitura é síncrona porque roda uma vez, no carregamento do módulo de teste,
 * e não no caminho de análise.
 */
const LOCALES: readonly string[] = readdirSync(join(__dirname, '..', '..', '..', 'l10n'))
  .filter((name) => name.startsWith('bundle.l10n.') && name.endsWith('.json'))
  .map((name) => name.slice('bundle.l10n.'.length, -'.json'.length))
  .map((locale) => (locale === '' ? 'en' : locale))

interface StartedServer {
  readonly diagnostics: Promise<Diagnostic[]>
  readonly stop: () => void
}

/**
 * Sobe o servidor, faz o aperto de mão no idioma pedido, abre um documento e
 * devolve os diagnósticos publicados.
 */
function startServer(locale: string): StartedServer {
  const child: ChildProcess = fork(SERVER, ['--node-ipc'], { silent: true })
  const connection = createMessageConnection(
    new IPCMessageReader(child),
    new IPCMessageWriter(child),
  )

  const diagnostics = new Promise<Diagnostic[]>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`sem diagnóstico em ${locale}`)), 20_000)

    connection.onNotification('textDocument/publishDiagnostics', (params: { diagnostics: Diagnostic[] }) => {
      clearTimeout(timer)
      resolve(params.diagnostics)
    })

    connection.listen()

    void connection
      .sendRequest('initialize', {
        processId: process.pid,
        rootUri: null,
        capabilities: {},
        locale,
      })
      .then(() => {
        connection.sendNotification('initialized', {})
        connection.sendNotification('textDocument/didOpen', {
          textDocument: { uri: URI, languageId: 'advpl', version: 1, text: FONTE },
        })
      })
      .catch(reject)
  })

  return {
    diagnostics,
    stop: () => {
      connection.dispose()
      child.kill()
    },
  }
}

const rodando: StartedServer[] = []

function start(locale: string): StartedServer {
  const server = startServer(locale)
  rodando.push(server)
  return server
}

after(() => {
  for (const server of rodando) server.stop()
})

describe('O idioma do editor chega à mensagem (US3, cenário 3)', () => {
  it('publica a mensagem em português quando o editor está em pt-br', async () => {
    const [diagnostic] = await start('pt-br').diagnostics

    assert.ok(diagnostic)
    assert.match(diagnostic.message, /caixa baixa/i)
  })

  it('publica em inglês quando o editor está em inglês', async () => {
    const [diagnostic] = await start('en').diagnostics

    assert.ok(diagnostic)
    assert.match(diagnostic.message, /lowercase/i)
  })

  it('publica em espanhol e em russo', async () => {
    const [es] = await start('es').diagnostics
    const [ru] = await start('ru').diagnostics

    assert.ok(es)
    assert.ok(ru)
    // O russo usa alfabeto cirílico: se o texto viesse em latim, ou a tradução
    // não foi carregada, ou o arquivo foi gravado no encoding errado — e este
    // último é o defeito que destruiria o russo em CP1252.
    assert.match(ru.message, /[Ѐ-ӿ]/)
    assert.notEqual(es.message, ru.message)
  })

  it('os quatro idiomas produzem quatro mensagens distintas', async () => {
    const mensagens = new Set<string>()
    for (const locale of LOCALES) {
      const [diagnostic] = await start(locale).diagnostics
      assert.ok(diagnostic)
      mensagens.add(diagnostic.message)
    }

    assert.equal(mensagens.size, LOCALES.length, 'algum idioma recaiu no texto de outro')
  })
})

describe('O idioma nunca degrada para a chave crua (US3, cenário 4)', () => {
  it('idioma sem tradução nossa recai no inglês', async () => {
    // Alemão não está entre os quatro. O comportamento correto é o inglês —
    // NUNCA o identificador da chave.
    const [diagnostic] = await start('de').diagnostics

    assert.ok(diagnostic)
    assert.match(diagnostic.message, /lowercase/i)
  })

  it('a mensagem nunca é o identificador cru da chave', async () => {
    // É o modo de falha que o Princípio V existe para impedir, e que já
    // aconteceu neste projeto: `rule.CA3001.message` no painel do usuário.
    for (const locale of ['pt-br', 'de', 'ru']) {
      const [diagnostic] = await start(locale).diagnostics
      assert.ok(diagnostic)
      assert.doesNotMatch(diagnostic.message, /^rule\..+\.message$/)
    }
  })
})

describe('O idioma não mexe no que é contrato (US3, cenário 3)', () => {
  it('identificador e intervalo são os mesmos em qualquer idioma', async () => {
    // A mensagem é traduzida e reescrita; ela NUNCA serve de contrato.
    // Supressão, filtro e configuração se dão por identificador — se ele
    // mudasse com o idioma, quebrariam ao trocar.
    const [pt] = await start('pt-br').diagnostics
    const [ru] = await start('ru').diagnostics

    assert.ok(pt)
    assert.ok(ru)
    assert.equal(pt.code, 'CA3001')
    assert.equal(ru.code, pt.code)
    assert.deepEqual(ru.range, pt.range)
    assert.notEqual(ru.message, pt.message)
  })
})
