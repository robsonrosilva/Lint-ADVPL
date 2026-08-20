import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readTdsIncludes, tdsServersFile } from '../../../src/include-sources/tds-vscode'

const FIXTURES = join(__dirname, '..', '..', '..', '..', 'test', 'fixtures')
const COM_SENTINELA = join(FIXTURES, 'servers-com-sentinela.json')

/** O valor plantado nas três chaves sensíveis da fixture. */
const SENTINELA = 'SENTINELA-NAO-DEVE-VAZAR-8f3a2b1c'

async function tempFile(name: string, content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'advpl-lint-tds-'))
  const file = join(dir, name)
  await writeFile(file, content, 'utf8')
  return file
}

describe('Fonte 1 — servers.json do tds-vscode (FR-027b)', () => {
  it('devolve APENAS os caminhos de `includes`', async () => {
    const caminhos = await readTdsIncludes(COM_SENTINELA)

    assert.deepEqual(caminhos, ['C:/totvs/protheus/includes', 'C:/projeto/includes'])
  })

  it('não devolve os `includes` de dentro de `configurations`', async () => {
    // A chave de nível superior é a que descreve os diretórios do usuário. Uma
    // leitura frouxa que varresse o arquivo atrás de qualquer `includes`
    // arrastaria configuração de servidor junto — e o passo seguinte seria
    // arrastar o resto.
    const caminhos = await readTdsIncludes(COM_SENTINELA)

    assert.ok(!caminhos.some((c) => c.includes('nao-deve-vencer')))
  })

  it('descarta entrada que não é texto', async () => {
    const file = await tempFile('servers.json', JSON.stringify({ includes: ['/a', 42, null, '/b'] }))

    assert.deepEqual(await readTdsIncludes(file), ['/a', '/b'])
  })

  it('sabe onde o arquivo mora, sem que ninguém precise repetir o caminho', () => {
    // O caminho é do formato de terceiro; declarar num lugar só é o que impede
    // que uma mudança dele precise ser caçada pelo repositório.
    const caminho = tdsServersFile('/casa/fulano')

    assert.equal(caminho.replace(/\\/g, '/'), '/casa/fulano/.totvsls/servers.json')
  })
})

describe('Fonte 1 — recuo silencioso (FR-027d)', () => {
  it('arquivo ausente devolve lista vazia, sem lançar', async () => {
    const caminho = join(tmpdir(), 'advpl-lint-nao-existe', 'servers.json')

    assert.deepEqual(await readTdsIncludes(caminho), [])
  })

  it('JSON inválido devolve lista vazia, sem lançar', async () => {
    const file = await tempFile('servers.json', '{ isto não é json')

    assert.deepEqual(await readTdsIncludes(file), [])
  })

  it('forma inesperada devolve lista vazia, sem lançar', async () => {
    // As fontes 1 e 2 são formatos que este projeto NÃO controla e podem mudar
    // sem aviso. Recuar é o comportamento correto; quebrar não é.
    for (const conteudo of ['[]', '"texto"', 'null', '{"includes":"um caminho só"}', '{}']) {
      const file = await tempFile('servers.json', conteudo)
      assert.deepEqual(await readTdsIncludes(file), [], `com o conteúdo ${conteudo}`)
    }
  })
})

describe('SC-016 — nada além dos caminhos sai desta leitura', () => {
  /**
   * Este é o teste que a revisão de segurança pediu, e ele existe porque
   * verificar só o valor devolvido NÃO alcança os dois caminhos reais de
   * vazamento:
   *
   * 1. o objeto retido viaja — uma vez guardado num campo, aparece em log de
   *    depuração ou numa mensagem de erro sem que ninguém tenha decidido isso;
   * 2. a mensagem de erro ecoa a entrada — `catch (e) { log(\`falhou: ${raw}\`) }`
   *    publica os tokens no canal de log.
   *
   * O arquivo lido guarda a sentinela em `savedTokens`, `permissions` e
   * `connectedServer`. Ela não pode aparecer em lugar nenhum.
   */
  it('a sentinela não aparece no retorno', async () => {
    const caminhos = await readTdsIncludes(COM_SENTINELA)

    assert.ok(!JSON.stringify(caminhos).includes(SENTINELA))
  })

  it('a sentinela não aparece no canal de log — nem no caminho feliz', async () => {
    const registrado: string[] = []
    await readTdsIncludes(COM_SENTINELA, (linha) => registrado.push(linha))

    assert.ok(!registrado.join('\n').includes(SENTINELA), `log: ${registrado.join(' | ')}`)
  })

  it('a sentinela não aparece no log quando o JSON está QUEBRADO', async () => {
    // O caso perigoso de verdade. A mensagem nativa de `JSON.parse` do Node
    // inclui um TRECHO DA ENTRADA — se ela for repassada ao log, os tokens vão
    // junto. Por isso o texto do erro nunca é ecoado: a mensagem diz o caminho
    // e a natureza do problema, e nada mais (FR-027b2).
    const original = await readFile(COM_SENTINELA, 'utf8')
    const quebrado = await tempFile('servers.json', original.slice(0, original.length - 3))

    const registrado: string[] = []
    const caminhos = await readTdsIncludes(quebrado, (linha) => registrado.push(linha))

    assert.deepEqual(caminhos, [])
    assert.ok(registrado.length > 0, 'o recuo aconteceu sem nenhum registro — não dá para diagnosticar')
    assert.ok(!registrado.join('\n').includes(SENTINELA), `log: ${registrado.join(' | ')}`)
    assert.ok(!registrado.join('\n').includes('savedTokens'), 'o log citou uma chave do arquivo')
    assert.ok(!registrado.join('\n').includes('authorizationtoken'))
  })

  it('a leitura NUNCA lança — não há texto de exceção onde a sentinela pudesse ir', async () => {
    // O terceiro caminho de vazamento é o texto da exceção. A defesa é não ter
    // exceção: toda falha vira recuo silencioso com lista vazia.
    const original = await readFile(COM_SENTINELA, 'utf8')

    const casos = [
      COM_SENTINELA,
      await tempFile('a.json', original.slice(0, 40)),
      await tempFile('b.json', original.replace('"includes"', '"includez"')),
      join(tmpdir(), 'advpl-lint-nao-existe', 'servers.json'),
    ]

    for (const caso of casos) {
      await assert.doesNotReject(() => readTdsIncludes(caso), `lançou para ${caso}`)
    }
  })

  it('o log cita o CAMINHO do arquivo e a natureza do problema (FR-027b2)', async () => {
    // Recuar em silêncio não pode significar recuar sem rastro: sem o caminho,
    // "a regra não dispara" vira indiagnosticável.
    const file = await tempFile('servers.json', '{ quebrado')
    const registrado: string[] = []

    await readTdsIncludes(file, (linha) => registrado.push(linha))

    const tudo = registrado.join('\n')
    assert.ok(tudo.includes(file), 'o log não diz QUAL arquivo')
    assert.match(tudo, /json|formato|leitura|ilegível/i, 'o log não diz o QUE aconteceu')
  })

  it('nada do arquivo sobrevive à função: o retorno não compartilha estrutura com a entrada', async () => {
    // FR-027b1 na prática. Duas leituras devolvem vetores independentes, e
    // nenhum deles carrega uma referência para o objeto lido — que é o que
    // permitiria o resto do arquivo viajar preso a ele.
    const uma = await readTdsIncludes(COM_SENTINELA)
    const outra = await readTdsIncludes(COM_SENTINELA)

    assert.notEqual(uma, outra)
    assert.deepEqual(uma, outra)
    for (const item of uma) assert.equal(typeof item, 'string')
  })
})

describe('Fonte 1 — o recuo por FORMA inesperada também é relatado', () => {
  it('avisa quando `includes` existe mas não é uma lista', async () => {
    // Diferente do arquivo ausente, que é o caso NORMAL de quem não usa a
    // extensão da TOTVS: aqui o arquivo está lá e a forma mudou. É a hipótese
    // do FR-027d — formato de terceiro muda sem aviso —, e ela precisa deixar
    // rastro, senão a regra fica muda sem nada que explique.
    const file = await tempFile('servers.json', JSON.stringify({ includes: 'um caminho só' }))
    const registrado: string[] = []

    const caminhos = await readTdsIncludes(file, (linha) => registrado.push(linha))

    assert.deepEqual(caminhos, [])
    assert.match(registrado.join('\n'), /includes/)
    assert.ok(registrado.join('\n').includes(file))
  })

  it('arquivo AUSENTE não vira aviso — é o caso normal, não um problema', async () => {
    const registrado: string[] = []

    await readTdsIncludes(join(tmpdir(), 'advpl-lint-nao-existe', 'servers.json'), (linha) =>
      registrado.push(linha),
    )

    assert.deepEqual(registrado, [], 'quem não usa a extensão da TOTVS não precisa ser avisado')
  })
})
