import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CancellationTokenSource } from 'vscode-languageserver'
import type { Range } from 'vscode-languageserver-types'

import { scanDocument } from '../../../src/analysis/scanner'
import { createAnalyzedDocument } from '../../../src/document/analyzed-document'
import type {
  IncludeIndexReader,
  IncludeIndexState,
  IncludeLookup,
} from '../../../src/includes/index-store'
import { pj0001 } from '../../../src/rules/pj0001'
import { decodeCp1252 } from '../../../src/text/cp1252'

const FIXTURES = join(__dirname, '..', '..', '..', '..', 'test', 'fixtures')
const NEVER_CANCELLED = new CancellationTokenSource().token

interface Reportado {
  readonly range: Range
  readonly args: Readonly<Record<string, string | number>> | undefined
  readonly data: unknown
}

/** Um índice de mentira, com a resposta e o estado que o teste mandar. */
function indice(
  respostas: Readonly<Record<string, IncludeLookup>>,
  state: IncludeIndexState = 'pronto',
): IncludeIndexReader & { pedidos: number } {
  const fake = {
    state,
    pedidos: 0,
    lookup: (name: string): IncludeLookup => respostas[name.toLowerCase()] ?? { kind: 'ausente' },
    ensureBuilt: (): void => {
      fake.pedidos += 1
    },
  }
  return fake
}

function encontrado(realName: string, directory = '/inc'): IncludeLookup {
  return { kind: 'encontrado', entry: { realName, directory } }
}

/** Roda a regra sobre o texto e devolve o que ela reportou. */
function rodar(text: string, index: IncludeIndexReader): Reportado[] {
  const document = createAnalyzedDocument({
    uri: 'file:///fonte.prw',
    languageId: 'advpl',
    version: 1,
    text,
  })
  const reportados: Reportado[] = []

  pj0001.run({
    document,
    startLine: 0,
    endLine: document.lineOffsets.length,
    scan: scanDocument(text),
    token: NEVER_CANCELLED,
    includes: index,
    report: (range, args, data) => reportados.push({ range, args, data }),
  })

  return reportados
}

/** O trecho do texto que o intervalo cobre. */
function trecho(text: string, range: Range): string {
  return text.split(/(?<=\n)/)[range.start.line]!.slice(range.start.character, range.end.character)
}

describe('PJ0001 — dispara na divergência de CAIXA (FR-028)', () => {
  it('acusa quando a referência difere do nome real apenas na caixa', async () => {
    const text = '#include "acadef.ch"\r\n'
    const reportados = rodar(text, indice({ 'acadef.ch': encontrado('ACADEF.CH') }))

    assert.equal(reportados.length, 1)
  })

  it('NÃO acusa quando a referência bate byte a byte com o disco', async () => {
    const text = '#include "ACADEF.CH"\r\n'

    assert.deepEqual(rodar(text, indice({ 'acadef.ch': encontrado('ACADEF.CH') })), [])
  })

  it('acusa em qualquer caixa da DIRETIVA — as duas regras são independentes', async () => {
    // `#INCLUDE "acadef.ch"` tem as duas violações. Uma não pode esconder a
    // outra: são requisitos diferentes, e a correção de cada uma toca um
    // pedaço diferente da linha.
    const text = '#INCLUDE "acadef.ch"\r\n'

    assert.equal(rodar(text, indice({ 'acadef.ch': encontrado('ACADEF.CH') })).length, 1)
  })

  it('a mensagem cita o nome REAL lido do disco (FR-031)', async () => {
    const text = '#include "acadef.ch"\r\n'
    const [reportado] = rodar(text, indice({ 'acadef.ch': encontrado('ACADEF.CH') }))

    assert.equal(reportado?.args?.['real'], 'ACADEF.CH')
    assert.equal(reportado?.args?.['referenced'], 'acadef.ch')
  })

  it('leva o nome real também como DADO, para a correção usar', async () => {
    // Sem isto, o conserto teria de consultar o índice de novo — sobre um
    // estado que já pode ter mudado entre o diagnóstico e o clique.
    const text = '#include "acadef.ch"\r\n'
    const [reportado] = rodar(text, indice({ 'acadef.ch': encontrado('ACADEF.CH') }))

    assert.deepEqual(reportado?.data, { realName: 'ACADEF.CH' })
  })

  it('acusa uma vez por diretiva, em fonte com várias', async () => {
    const text = '#include "acadef.ch"\r\n#include "TOTVS.CH"\r\n#include "fwmvcdef.ch"\r\n'
    const reportados = rodar(
      text,
      indice({
        'acadef.ch': encontrado('ACADEF.CH'),
        'totvs.ch': encontrado('TOTVS.CH'),
        'fwmvcdef.ch': encontrado('FWMVCDEF.CH'),
      }),
    )

    assert.equal(reportados.length, 2)
    assert.deepEqual(
      reportados.map((r) => r.range.start.line),
      [0, 2],
    )
  })
})

describe('PJ0001 — o intervalo cobre SÓ o nome (FR-030, SC-008)', () => {
  it('sem as aspas e sem a diretiva', async () => {
    const text = '#include "acadef.ch"\r\n'
    const [reportado] = rodar(text, indice({ 'acadef.ch': encontrado('ACADEF.CH') }))

    assert.ok(reportado)
    assert.equal(trecho(text, reportado.range), 'acadef.ch')
    assert.deepEqual(reportado.range, {
      start: { line: 0, character: 10 },
      end: { line: 0, character: 19 },
    })
  })

  it('sem o CAMINHO que vem antes do nome', async () => {
    // O caminho está fora do escopo da regra por decisão registrada (R9):
    // ampliar para a caixa dos diretórios é regra nova, não ajuste desta.
    const text = '#include "..\\includes\\acadef.ch"\r\n'
    const [reportado] = rodar(text, indice({ 'acadef.ch': encontrado('ACADEF.CH') }))

    assert.ok(reportado)
    assert.equal(trecho(text, reportado.range), 'acadef.ch')
  })

  it('funciona com barra normal no caminho', async () => {
    const text = '#include "../includes/acadef.ch"\r\n'
    const [reportado] = rodar(text, indice({ 'acadef.ch': encontrado('ACADEF.CH') }))

    assert.ok(reportado)
    assert.equal(trecho(text, reportado.range), 'acadef.ch')
  })

  it('aceita aspa simples, como o formato do legado admitia', async () => {
    const text = "#include 'acadef.ch'\r\n"
    const [reportado] = rodar(text, indice({ 'acadef.ch': encontrado('ACADEF.CH') }))

    assert.ok(reportado)
    assert.equal(trecho(text, reportado.range), 'acadef.ch')
  })

  it('o recuo e o espaçamento não deslocam o intervalo', async () => {
    const text = '\t  #include   "acadef.ch"\r\n'
    const [reportado] = rodar(text, indice({ 'acadef.ch': encontrado('ACADEF.CH') }))

    assert.ok(reportado)
    assert.equal(trecho(text, reportado.range), 'acadef.ch')
  })
})

describe('PJ0001 — os TRÊS silêncios, cada um com sua razão', () => {
  it('cala quando o arquivo NÃO É ENCONTRADO — ausência é outra regra (FR-032)', async () => {
    // "Include faltante" é outro assunto e está fora do escopo. Acusar aqui
    // faria a regra dizer duas coisas diferentes com a mesma mensagem.
    const text = '#include "nao-existe.ch"\r\n'

    assert.deepEqual(rodar(text, indice({})), [])
  })

  it('cala quando a referência é AMBÍGUA — apontar um seria adivinhação (FR-033)', async () => {
    // Dois arquivos com o mesmo nome e caixas diferentes, em diretórios
    // distintos da cadeia. Escolher um deles é adivinhar, e a correção
    // propagaria o palpite pelo arquivo.
    const text = '#include "acadef.ch"\r\n'
    const ambiguo = indice({
      'acadef.ch': {
        kind: 'ambíguo',
        candidates: [
          { realName: 'ACADEF.CH', directory: '/inc/a' },
          { realName: 'acadef.ch', directory: '/inc/b' },
        ],
      },
    })

    assert.deepEqual(rodar(text, ambiguo), [])
  })

  it('cala quando o índice AINDA NÃO ESTÁ PRONTO — e pede a construção (FR-023)', async () => {
    // "Ainda não sei" e "já sei que não achei" levam ao mesmo silêncio na tela,
    // por razões opostas. A diferença observável é esta: no primeiro caso a
    // regra PEDE a construção, e a análise NÃO espera por ela.
    const text = '#include "acadef.ch"\r\n'
    const construindo = indice({ 'acadef.ch': encontrado('ACADEF.CH') }, 'construindo')

    assert.deepEqual(rodar(text, construindo), [])
    assert.ok(construindo.pedidos > 0, 'a regra calou sem sequer pedir a construção do índice')
  })

  it('índice AUSENTE também pede a construção — é a indexação sob demanda (FR-021)', async () => {
    const text = '#include "acadef.ch"\r\n'
    const ausente = indice({}, 'ausente')

    assert.deepEqual(rodar(text, ausente), [])
    assert.ok(ausente.pedidos > 0)
  })

  it('índice PRONTO não pede construção de novo', async () => {
    const text = '#include "acadef.ch"\r\n'
    const pronto = indice({ 'acadef.ch': encontrado('ACADEF.CH') })

    rodar(text, pronto)

    assert.equal(pronto.pedidos, 0)
  })

  it('pede a construção UMA vez por fatia, não uma por diretiva', async () => {
    // Um `ensureBuilt` por linha num fonte com quarenta includes seria quarenta
    // chamadas para descobrir a mesma coisa.
    const text = Array.from({ length: 40 }, (_, i) => `#include "a${i}.ch"`).join('\r\n')
    const ausente = indice({}, 'ausente')

    rodar(text, ausente)

    assert.equal(ausente.pedidos, 1)
  })
})

describe('PJ0001 — o que não é uma diretiva de inclusão', () => {
  it('ignora referência dentro de COMENTÁRIO', async () => {
    const text = '// #include "acadef.ch"\r\n'

    assert.deepEqual(rodar(text, indice({ 'acadef.ch': encontrado('ACADEF.CH') })), [])
  })

  it('ignora referência dentro de comentário de BLOCO', async () => {
    const text = '/*\r\n#include "acadef.ch"\r\n*/\r\n'

    assert.deepEqual(rodar(text, indice({ 'acadef.ch': encontrado('ACADEF.CH') })), [])
  })

  it('ignora outras diretivas de pré-processador', async () => {
    const text = '#define ACADEF "acadef.ch"\r\n#ifdef acadef.ch\r\n'

    assert.deepEqual(rodar(text, indice({ 'acadef.ch': encontrado('ACADEF.CH') })), [])
  })

  it('ignora linha sem aspas', async () => {
    const text = '#include acadef.ch\r\n'

    assert.deepEqual(rodar(text, indice({ 'acadef.ch': encontrado('ACADEF.CH') })), [])
  })

  it('ignora aspas não fechadas', async () => {
    const text = '#include "acadef.ch\r\n'

    assert.deepEqual(rodar(text, indice({ 'acadef.ch': encontrado('ACADEF.CH') })), [])
  })

  it('ignora nome vazio entre aspas', async () => {
    const text = '#include ""\r\n'

    assert.deepEqual(rodar(text, indice({})), [])
  })

  it('ignora referência que é só um caminho, sem nome de arquivo', async () => {
    const text = '#include "..\\includes\\"\r\n'

    assert.deepEqual(rodar(text, indice({})), [])
  })
})

describe('PJ0001 — cancelamento', () => {
  it('PARA DE FATO no meio do documento', async () => {
    const source = new CancellationTokenSource()
    source.cancel()

    const text = Array.from({ length: 2000 }, () => '#include "acadef.ch"').join('\r\n')
    const document = createAnalyzedDocument({
      uri: 'file:///fonte.prw',
      languageId: 'advpl',
      version: 1,
      text,
    })
    const reportados: Range[] = []

    pj0001.run({
      document,
      startLine: 0,
      endLine: document.lineOffsets.length,
      scan: scanDocument(text),
      token: source.token,
      includes: indice({ 'acadef.ch': encontrado('ACADEF.CH') }),
      report: (range) => reportados.push(range),
    })

    assert.equal(reportados.length, 0, `${reportados.length} diagnósticos DEPOIS do cancelamento`)
  })
})

describe('PJ0001 — sobre a fixture autoral', () => {
  it('acusa as duas divergências e cala nas demais linhas, no arquivo de verdade', async () => {
    // A fixture guarda o caso completo, e o disco de teste diz que `ACADEF.CH`
    // está em caixa alta e `totvs.ch` em caixa baixa. As linhas são:
    //
    //   3  #include "acadef.ch"   -> diverge (disco: ACADEF.CH)   ACUSA
    //   4  #include "totvs.ch"    -> bate byte a byte             cala
    //   5  #INCLUDE "TOTVS.CH"    -> diverge (disco: totvs.ch)    ACUSA
    //   8  literal com "acadef.ch"                                cala
    //   9  comentário com #include                                cala
    //
    // A linha 5 é a que vale por si: a diretiva está em caixa alta — violação de
    // CA3001 — e o NOME também diverge. Uma regra não esconde a outra.
    const bytes = await readFile(join(FIXTURES, 'pj0001-caso-basico.prw'))
    const text = decodeCp1252(bytes)

    const reportados = rodar(
      text,
      indice({ 'acadef.ch': encontrado('ACADEF.CH'), 'totvs.ch': encontrado('totvs.ch') }),
    )

    assert.deepEqual(
      reportados.map((r) => r.range.start.line),
      [3, 5],
      'linhas acusadas fora do esperado',
    )
    assert.equal(trecho(text, reportados[0]!.range), 'acadef.ch')
    assert.equal(trecho(text, reportados[1]!.range), 'TOTVS.CH')
    assert.equal(reportados[1]?.args?.['real'], 'totvs.ch')
  })

  it('cala inteiro sobre a fixture ambígua', async () => {
    const bytes = await readFile(join(FIXTURES, 'pj0001-ambiguo.prw'))
    const text = decodeCp1252(bytes)

    const reportados = rodar(text, {
      state: 'pronto',
      ensureBuilt: () => {},
      lookup: () => ({
        kind: 'ambíguo',
        candidates: [
          { realName: 'AMBIGUO.CH', directory: '/inc/a' },
          { realName: 'ambiguo.ch', directory: '/inc/b' },
        ],
      }),
    })

    assert.deepEqual(reportados, [])
  })
})

describe('PJ0001 — identidade (Princípio III, Princípio IV)', () => {
  it('declara origem própria, com a justificativa obrigatória', async () => {
    assert.equal(pj0001.origin, 'project')
    assert.equal(pj0001.group, null)
    assert.equal(pj0001.catalogSeverity, null)
    assert.ok((pj0001.projectRationale ?? '').length > 40)
    assert.match(pj0001.projectRationale ?? '', /diret[óo]rio de includes/i)
  })

  it('nasce LIGADA, com a taxa de falso positivo medida (FR-036)', async () => {
    // Medida em 2026-08-20: 1.445 disparos, 0% de falso positivo em 120
    // revisados à mão. O Princípio VI foi cumprido, não dispensado.
    assert.equal(pj0001.enabledByDefault, true)
  })

  it('declara a severidade, porque não há catálogo de onde mapear (R5)', async () => {
    // `Information` e não `Warning`, por VOLUME medido: 72,9% dos fontes do
    // corpus têm ao menos um disparo, e `Warning` inflaria a contagem de avisos
    // de quase todo arquivo — o que o Princípio III proíbe.
    //
    // A gravidade do defeito não está em questão: ele quebra a compilação no
    // AppServer Linux. `Information` aparece no painel de Problemas do VS Code;
    // `Hint`, que não aparece, é que estaria errado aqui.
    assert.equal(pj0001.defaultSeverity, 3 /* DiagnosticSeverity.Information */)
  })

  it('tem chave própria de desligamento e chave de mensagem', async () => {
    assert.equal(pj0001.configKey, 'advplLint.rules.PJ0001')
    assert.equal(pj0001.messageKey, 'rule.PJ0001.message')
  })
})

describe('PJ0001 — a diretiva sem nada depois dela', () => {
  it('ignora `#include` seguido só de espaço até o fim da linha', async () => {
    // Linha em edição: o usuário digitou a diretiva e ainda não escreveu o
    // nome. Não há referência a julgar.
    const text = '#include   \r\nLocal x := 1\r\n'

    assert.deepEqual(rodar(text, indice({ 'acadef.ch': encontrado('ACADEF.CH') })), [])
  })
})
