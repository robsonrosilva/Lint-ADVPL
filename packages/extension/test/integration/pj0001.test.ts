import * as assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as vscode from 'vscode'

const WORKSPACE = path.join(__dirname, '..', '..', '..', 'test', 'fixtures', 'workspace')
const CRLF = '\r\n'

const CABECALHO = [
  '// FIXTURE GERADA - advpl-lint - NAO e copia de fonte padrao do Protheus.',
  '// Proposito: exercitar PJ0001 com um diretorio de includes controlado',
]

function codeValueOf(diagnostic: vscode.Diagnostic): string {
  const code = diagnostic.code
  return typeof code === 'object' && code !== null ? String(code.value) : String(code)
}

async function waitFor(
  uri: vscode.Uri,
  condition: (diagnostics: vscode.Diagnostic[]) => boolean,
  timeoutMs = 20000,
): Promise<vscode.Diagnostic[]> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const found = vscode.languages.getDiagnostics(uri)
    if (condition(found)) return found
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return vscode.languages.getDiagnostics(uri)
}

async function escreverFonte(nome: string, linhas: readonly string[]): Promise<vscode.Uri> {
  const dir = path.join(WORKSPACE, 'generated')
  await fs.mkdir(dir, { recursive: true })
  const arquivo = path.join(dir, nome)
  await fs.writeFile(arquivo, Buffer.from(linhas.join(CRLF), 'latin1'))
  return vscode.Uri.file(arquivo)
}

/**
 * O diretório de includes do teste, com CAIXA MISTA DE PROPÓSITO.
 *
 * ⚠️ Este teste só prova o que diz porque roda no **Windows**, onde o sistema
 * de arquivos é insensível a caixa. Uma implementação baseada em `exists`
 * responderia "existe" para `acadef.ch` e a regra nunca dispararia. Se `PJ0001`
 * acusa aqui, o índice está lendo o nome REAL da listagem do diretório.
 */
async function criarArvoreDeIncludes(): Promise<string> {
  const raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'advpl-lint-inc-'))
  await fs.writeFile(path.join(raiz, 'ACADEF.CH'), '// include de teste\r\n')
  await fs.writeFile(path.join(raiz, 'totvs.ch'), '// include de teste\r\n')
  return raiz
}

suite('US3 — PJ0001 aponta o que o padrão não vê', () => {
  const config = () => vscode.workspace.getConfiguration('advplLint')
  let arvore: string
  let alvo: vscode.Uri

  suiteSetup(async () => {
    arvore = await criarArvoreDeIncludes()

    // Fonte 3 da cadeia. As duas primeiras estão presentes e VAZIAS nesta
    // máquina — `includes: [""]` e `advpl.environments: []` —, e é por isso que
    // a cadeia precisa recuar por "não utilizável" e não por "não presente".
    await config().update('includePaths', [arvore], true)
    // A regra NÃO é ligada aqui: ela nasce ligada desde 2026-08-20, com a taxa
    // de falso positivo medida. Ligá-la no teste esconderia uma regressão no
    // padrão — se ele voltasse a `false`, o teste continuaria verde.

    alvo = await escreverFonte('pj0001-integracao.prw', [
      ...CABECALHO,
      '#include "acadef.ch"',
      '#include "totvs.ch"',
      '#include "nao-existe.ch"',
      'User Function Pj0001Integracao()',
      'Return Nil',
      '',
    ])
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(alvo))
  })

  suiteTeardown(async () => {
    await config().update('includePaths', undefined, true)
    await config().update('rules.PJ0001.enabled', undefined, true)
  })

  test('nasce LIGADA: nenhuma configuração foi preciso para ela apontar', async () => {
    // O padrão do manifesto e o padrão do registro precisam concordar. Eles
    // vivem em processos diferentes e nenhum compilador os liga.
    const extension = vscode.extensions.getExtension('robsonrosilva.advpl-lint')
    assert.ok(extension)
    const propriedades = (
      extension.packageJSON.contributes as {
        configuration: { properties: Record<string, { default?: unknown }> }
      }
    ).configuration.properties

    assert.equal(propriedades['advplLint.rules.PJ0001.enabled']?.default, true)
    assert.equal(
      config().get('rules.PJ0001.enabled'),
      true,
      'a regra precisou ser ligada à mão — o padrão regrediu',
    )
  })

  test('acusa a referência divergente, com o nome real na mensagem (US3 cenário 1)', async () => {
    const diagnosticos = await waitFor(alvo, (d) => d.some((x) => codeValueOf(x) === 'PJ0001'))
    const pj = diagnosticos.filter((d) => codeValueOf(d) === 'PJ0001')

    assert.equal(
      pj.length,
      1,
      `esperava um PJ0001; vieram ${pj.length}. Se vier zero, confira qual fonte da cadeia venceu ` +
        `com o comando "advplLint.showIncludeSources".`,
    )

    const diagnostico = pj[0]!
    // `Information`, e não `Warning`, por volume medido: 72,9% dos fontes do
    // corpus têm ao menos um disparo. E `Information` — não `Hint` — porque o
    // painel de Problemas do VS Code não lista `Hint`.
    assert.equal(diagnostico.severity, vscode.DiagnosticSeverity.Information)
    assert.equal(diagnostico.source, 'advpl-lint')
    assert.match(diagnostico.message, /ACADEF\.CH/, 'a mensagem não cita o nome real do disco')
    assert.doesNotMatch(diagnostico.message, /^rule\./, 'a chave crua vazou para o painel')
  })

  test('o intervalo cobre só o nome — sem aspas e sem a diretiva (FR-030)', async () => {
    const diagnostico = (await waitFor(alvo, (d) => d.some((x) => codeValueOf(x) === 'PJ0001'))).find(
      (d) => codeValueOf(d) === 'PJ0001',
    )!
    const documento = await vscode.workspace.openTextDocument(alvo)

    assert.equal(documento.getText(diagnostico.range), 'acadef.ch')
    assert.equal(diagnostico.range.start.line, 2)
  })

  test('cala sobre a referência que bate e sobre a que não existe (FR-032)', async () => {
    const diagnosticos = await waitFor(alvo, (d) => d.some((x) => codeValueOf(x) === 'PJ0001'))
    const linhas = diagnosticos
      .filter((d) => codeValueOf(d) === 'PJ0001')
      .map((d) => d.range.start.line)

    assert.deepEqual(linhas, [2], 'PJ0001 acusou linha que deveria ficar em silêncio')
  })

  test('a análise NÃO espera pelo índice: os outros diagnósticos aparecem (US3 cenário 6, SC-005)', async () => {
    // A regra que impede o índice de virar bloqueio. Um arquivo recém-aberto
    // recebe os diagnósticos das outras regras enquanto a varredura corre — o
    // orçamento "do arquivo aberto ao primeiro diagnóstico" não conhece disco.
    const outro = await escreverFonte('pj0001-nao-espera.prw', [
      ...CABECALHO,
      '#INCLUDE "TOTVS.CH"',
      'Return',
      '',
    ])

    const marca = performance.now()
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(outro))
    const diagnosticos = await waitFor(outro, (d) => d.some((x) => codeValueOf(x) === 'CA3001'))
    const decorrido = performance.now() - marca

    assert.ok(
      diagnosticos.some((d) => codeValueOf(d) === 'CA3001'),
      'nenhum CA3001 — a análise ficou esperando o índice',
    )
    assert.ok(
      decorrido <= 300,
      `levou ${decorrido.toFixed(1)} ms até o primeiro diagnóstico — a análise esperou pelo disco`,
    )
  })

  test('desligar PJ0001 faz o diagnóstico sumir, sem reiniciar o editor', async () => {
    try {
      await config().update('rules.PJ0001.enabled', false, true)
      const depois = await waitFor(alvo, (d) => !d.some((x) => codeValueOf(x) === 'PJ0001'))

      assert.equal(depois.filter((d) => codeValueOf(d) === 'PJ0001').length, 0)
    } finally {
      await config().update('rules.PJ0001.enabled', true, true)
      await waitFor(alvo, (d) => d.some((x) => codeValueOf(x) === 'PJ0001'))
    }
  })

  test('o comando de diagnóstico da cadeia existe e roda', async () => {
    // FR-027c: sem ele, "a regra não dispara" e "a regra dispara sobre a árvore
    // errada" são indistinguíveis para quem usa.
    const comandos = await vscode.commands.getCommands(true)

    assert.ok(
      comandos.includes('advplLint.showIncludeSources'),
      'o comando que mostra a fonte em uso não foi registrado',
    )
  })
})

suite('US4 — a lâmpada ajusta a referência ao nome real', () => {
  const config = () => vscode.workspace.getConfiguration('advplLint')
  let arvore: string

  suiteSetup(async () => {
    arvore = await criarArvoreDeIncludes()
    await config().update('includePaths', [arvore], true)
  })

  suiteTeardown(async () => {
    await config().update('includePaths', undefined, true)
    await config().update('fixAll.includeRules', undefined, true)
  })

  test('aplicar a correção troca a referência pelo nome real do disco (US4 cenário 1)', async () => {
    const alvo = await escreverFonte('pj0001-correcao.prw', [
      ...CABECALHO,
      '#include "acadef.ch"',
      'Return',
      '',
    ])
    const documento = await vscode.workspace.openTextDocument(alvo)
    await vscode.window.showTextDocument(documento)

    const diagnostico = (await waitFor(alvo, (d) => d.some((x) => codeValueOf(x) === 'PJ0001'))).find(
      (d) => codeValueOf(d) === 'PJ0001',
    )
    assert.ok(diagnostico, 'nenhum PJ0001 para corrigir')

    const acoes =
      (await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        alvo,
        diagnostico.range,
        vscode.CodeActionKind.QuickFix.value,
      )) ?? []
    const correcao = acoes.find((a) => /PJ0001/.test(a.title))

    assert.ok(correcao?.edit, 'nenhuma correção de PJ0001 foi oferecida')
    assert.equal(await vscode.workspace.applyEdit(correcao.edit), true)

    assert.equal(documento.lineAt(2).text, '#include "ACADEF.CH"')
    await waitFor(alvo, (d) => !d.some((x) => codeValueOf(x) === 'PJ0001'))
  })

  test('as duas correções na mesma linha produzem #include "ACADEF.CH" (US4 cenário 2, FR-016)', async () => {
    // `#INCLUDE "acadef.ch"` tem as DUAS violações. Os intervalos são disjuntos
    // — um cobre a diretiva, o outro o nome — e aplicar as duas dá o resultado
    // certo, independentemente da ordem.
    const alvo = await escreverFonte('pj0001-duas-correcoes.prw', [
      ...CABECALHO,
      '#INCLUDE "acadef.ch"',
      'Return',
      '',
    ])
    const documento = await vscode.workspace.openTextDocument(alvo)
    await vscode.window.showTextDocument(documento)

    const diagnosticos = await waitFor(
      alvo,
      (d) =>
        d.some((x) => codeValueOf(x) === 'PJ0001') && d.some((x) => codeValueOf(x) === 'CA3001'),
    )
    const ca3001 = diagnosticos.find((d) => codeValueOf(d) === 'CA3001')!
    const pj0001 = diagnosticos.find((d) => codeValueOf(d) === 'PJ0001')!

    // Disjuntos: a diretiva termina antes de o nome começar.
    assert.ok(
      ca3001.range.end.character <= pj0001.range.start.character,
      'os intervalos das duas regras se sobrepõem',
    )

    const linhaInteira = new vscode.Range(2, 0, 2, documento.lineAt(2).text.length)
    const acoes =
      (await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        alvo,
        linhaInteira,
        vscode.CodeActionKind.QuickFix.value,
      )) ?? []

    for (const regra of ['CA3001', 'PJ0001']) {
      const correcao = acoes.find((a) => a.title.includes(regra))
      assert.ok(correcao?.edit, `nenhuma correção de ${regra} foi oferecida`)
      assert.equal(await vscode.workspace.applyEdit(correcao.edit), true)
    }

    assert.equal(documento.lineAt(2).text, '#include "ACADEF.CH"')
  })

  test('PJ0001 fica FORA do "corrigir tudo" por padrão (FR-040, D9)', async () => {
    // Trocar a diretiva é inerte; trocar o nome do arquivo muda o que o
    // compilador vai procurar. Aplicar isso em massa, ao salvar, sem o usuário
    // olhar, propagaria um índice errado pelo arquivo inteiro.
    const alvo = await escreverFonte('pj0001-fora-do-fixall.prw', [
      ...CABECALHO,
      '#INCLUDE "acadef.ch"',
      'Return',
      '',
    ])
    const documento = await vscode.workspace.openTextDocument(alvo)
    await vscode.window.showTextDocument(documento)
    await waitFor(alvo, (d) => d.some((x) => codeValueOf(x) === 'PJ0001'))

    const todoOArquivo = new vscode.Range(0, 0, documento.lineCount, 0)
    const acoes =
      (await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        alvo,
        todoOArquivo,
        vscode.CodeActionKind.SourceFixAll.value,
      )) ?? []
    const corrigirTudo = acoes.find((a) => a.kind?.contains(vscode.CodeActionKind.SourceFixAll))

    assert.ok(corrigirTudo?.edit, 'nenhuma ação de "corrigir tudo" foi oferecida')
    assert.equal(await vscode.workspace.applyEdit(corrigirTudo.edit), true)

    // A diretiva baixou; o NOME continua como estava.
    assert.equal(documento.lineAt(2).text, '#include "acadef.ch"')
    assert.ok(
      vscode.languages.getDiagnostics(alvo).some((d) => codeValueOf(d) === 'PJ0001') ||
        (await waitFor(alvo, (d) => d.some((x) => codeValueOf(x) === 'PJ0001'))).length > 0,
      'PJ0001 sumiu — a correção em massa mexeu no nome do arquivo',
    )
  })

  test('a chave de participação inclui PJ0001 na correção em massa (FR-018)', async () => {
    const alvo = await escreverFonte('pj0001-dentro-do-fixall.prw', [
      ...CABECALHO,
      '#INCLUDE "acadef.ch"',
      'Return',
      '',
    ])
    const documento = await vscode.workspace.openTextDocument(alvo)
    await vscode.window.showTextDocument(documento)
    await waitFor(alvo, (d) => d.some((x) => codeValueOf(x) === 'PJ0001'))

    await config().update('fixAll.includeRules', ['CA3001', 'PJ0001'], true)
    await new Promise((resolve) => setTimeout(resolve, 800))

    const todoOArquivo = new vscode.Range(0, 0, documento.lineCount, 0)
    const acoes =
      (await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        alvo,
        todoOArquivo,
        vscode.CodeActionKind.SourceFixAll.value,
      )) ?? []
    const corrigirTudo = acoes.find((a) => a.kind?.contains(vscode.CodeActionKind.SourceFixAll))

    assert.ok(corrigirTudo?.edit)
    assert.equal(await vscode.workspace.applyEdit(corrigirTudo.edit), true)

    assert.equal(documento.lineAt(2).text, '#include "ACADEF.CH"')
  })
})

suite('SC-007 — o observador reflete no diagnóstico, sem reiniciar o editor', () => {
  // ⚠️ Este é o caminho que o plano manda vigiar, e até 2026-08-20 ele nunca
  // tinha sido exercitado INTEIRO: cada elo tinha teste unitário — o observador,
  // a invalidação por diretório, a revalidação debounced — e a corrente nunca
  // fora puxada de ponta a ponta dentro de um editor de verdade.
  //
  // A corrente é: o cliente cria o observador sobre os diretórios da cadeia → o
  // evento chega ao servidor por `workspace/didChangeWatchedFiles` → o índice
  // invalida APENAS o diretório afetado → os documentos abertos revalidam pelo
  // mesmo caminho debounced da digitação.
  const config = () => vscode.workspace.getConfiguration('advplLint')
  let arvore: string
  let alvo: vscode.Uri

  suiteSetup(async () => {
    arvore = await fs.mkdtemp(path.join(os.tmpdir(), 'advpl-lint-obs-'))
    // O disco começa com a grafia em caixa BAIXA, igual à do fonte: nada a
    // acusar.
    await fs.writeFile(path.join(arvore, 'obs.ch'), '// include de teste\r\n')
    await config().update('includePaths', [arvore], true)

    alvo = await escreverFonte('pj0001-observador.prw', [
      ...CABECALHO,
      '#include "obs.ch"',
      'Return',
      '',
    ])
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(alvo))
    // Espera o índice ficar pronto: sem isso, o silêncio inicial seria "ainda
    // não sei" em vez de "olhei e está certo", e o teste não provaria nada.
    await new Promise((resolve) => setTimeout(resolve, 2000))
  })

  suiteTeardown(async () => {
    await config().update('includePaths', undefined, true)
  })

  test('parte de um estado SEM diagnóstico — a grafia bate', async () => {
    const pj = vscode.languages.getDiagnostics(alvo).filter((d) => codeValueOf(d) === 'PJ0001')

    assert.equal(pj.length, 0, 'já havia PJ0001 antes de o disco mudar — o teste não provaria nada')
  })

  test('RENOMEAR o include só na caixa faz o diagnóstico APARECER (SC-007, FR-024)', async () => {
    // Renomear chega como apagar mais criar. É o caso que mais importa: é o
    // conserto — ou o estrago — que o usuário faz no disco enquanto edita.
    await fs.rename(path.join(arvore, 'obs.ch'), path.join(arvore, 'OBS.CH'))

    const depois = await waitFor(alvo, (d) => d.some((x) => codeValueOf(x) === 'PJ0001'), 25000)
    const pj = depois.find((d) => codeValueOf(d) === 'PJ0001')

    assert.ok(
      pj,
      'o disco mudou e o diagnóstico não apareceu — a corrente observador → índice → ' +
        'revalidação está rompida em algum elo',
    )
    assert.match(pj.message, /OBS\.CH/, 'a mensagem não cita a grafia NOVA do disco')
  })

  test('desfazer a renomeação faz o diagnóstico SUMIR, sem reiniciar o editor', async () => {
    await fs.rename(path.join(arvore, 'OBS.CH'), path.join(arvore, 'obs.ch'))

    const depois = await waitFor(alvo, (d) => !d.some((x) => codeValueOf(x) === 'PJ0001'), 25000)

    assert.equal(
      depois.filter((d) => codeValueOf(d) === 'PJ0001').length,
      0,
      'o índice ficou com a grafia velha — a invalidação não aconteceu na volta',
    )
  })

  test('APAGAR o include faz a regra CALAR — ausência é outra regra (FR-032)', async () => {
    // Some do disco: a consulta passa a responder "ausente", e ausência não é
    // assunto desta regra. O que NÃO pode acontecer é a regra continuar
    // acusando sobre um índice velho.
    //
    // ⚠️ Para APAGAR e observar o silêncio, é preciso primeiro estar FALANDO.
    // A primeira versão deste teste renomeava para um nome DIFERENTE antes de
    // apagar — e com nome diferente a referência já ficava ausente, então
    // PJ0001 nunca chegava a aparecer. O `waitFor` estourava os 25 s e o teste
    // passava sem provar nada. Aqui a renomeação é só de CAIXA, que é o que faz
    // a regra falar.
    await fs.rename(path.join(arvore, 'obs.ch'), path.join(arvore, 'OBS.CH'))
    const falando = await waitFor(alvo, (d) => d.some((x) => codeValueOf(x) === 'PJ0001'), 25000)
    assert.ok(
      falando.some((d) => codeValueOf(d) === 'PJ0001'),
      'a regra não chegou a acusar — o resto do teste não provaria nada',
    )

    await fs.unlink(path.join(arvore, 'OBS.CH'))

    const depois = await waitFor(alvo, (d) => !d.some((x) => codeValueOf(x) === 'PJ0001'), 25000)
    assert.equal(
      depois.filter((d) => codeValueOf(d) === 'PJ0001').length,
      0,
      'o arquivo sumiu do disco e a regra continuou acusando sobre o índice velho',
    )
  })
})

suite('SC-005 — árvore GRANDE de includes não atrasa a ativação nem o 1º diagnóstico', () => {
  // O critério fala em "projeto com dezenas de milhares de arquivos de include".
  // Até 2026-08-20 este caminho era exercitado com uma árvore de DOIS arquivos —
  // o que prova a lógica e não prova nada sobre escala.
  //
  // A árvore é GERADA aqui e vive em diretório temporário: fonte do corpus nunca
  // entra no repositório, e uma fixture desse porte cairia no `check:corpus`.
  const config = () => vscode.workspace.getConfiguration('advplLint')
  const ARQUIVOS = 8_000
  const POR_DIRETORIO = 200

  let arvore: string
  let alvo: vscode.Uri

  suiteSetup(async function () {
    // Gerar 8.000 arquivos leva mais que o tempo padrão de um teste.
    this.timeout(180_000)

    arvore = await fs.mkdtemp(path.join(os.tmpdir(), 'advpl-lint-grande-'))
    for (let i = 0; i < ARQUIVOS; i += 1) {
      const sub = path.join(arvore, `d${Math.floor(i / POR_DIRETORIO)}`)
      if (i % POR_DIRETORIO === 0) await fs.mkdir(sub, { recursive: true })
      // Caixa ALTA no disco, caixa baixa na referência do fonte: é o que faz
      // PJ0001 falar quando o índice ficar pronto.
      await fs.writeFile(path.join(sub, `INC${i}.CH`), '// include gerado\r\n')
    }

    alvo = await escreverFonte('pj0001-arvore-grande.prw', [
      ...CABECALHO,
      '#INCLUDE "inc7999.ch"',
      'Return',
      '',
    ])
  })

  suiteTeardown(async function () {
    this.timeout(120_000)
    await config().update('includePaths', undefined, true)
    await fs.rm(arvore, { recursive: true, force: true })
  })

  test('o primeiro diagnóstico das OUTRAS regras chega antes de a indexação terminar', async () => {
    // A garantia do FR-023, no tamanho em que ela importa. Apontar a árvore e
    // abrir o fonte no mesmo instante: `CA3001` precisa aparecer sem esperar
    // pelos 8.000 arquivos.
    await config().update('includePaths', [arvore], true)

    const marca = performance.now()
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(alvo))
    const diagnosticos = await waitFor(alvo, (d) => d.some((x) => codeValueOf(x) === 'CA3001'))
    const decorrido = performance.now() - marca

    assert.ok(
      diagnosticos.some((d) => codeValueOf(d) === 'CA3001'),
      'nenhum CA3001 — a análise ficou esperando o índice de 8.000 arquivos',
    )
    assert.ok(
      decorrido <= 300,
      `levou ${decorrido.toFixed(1)} ms até o primeiro diagnóstico com ${ARQUIVOS} includes ` +
        'sendo indexados — a análise esperou pelo disco',
    )

    // E `PJ0001` cala enquanto o índice não fica pronto: silêncio com
    // conhecimento de causa, não por não ter achado.
    assert.equal(
      diagnosticos.filter((d) => codeValueOf(d) === 'PJ0001').length,
      0,
      'PJ0001 falou antes de o índice ficar pronto — ela estaria adivinhando',
    )
  })

  test('quando o índice fica pronto, PJ0001 acusa sobre a árvore grande', async () => {
    // A outra metade: a indexação de 8.000 arquivos termina e a regra passa a
    // responder, sem que ninguém reabra o arquivo.
    const depois = await waitFor(alvo, (d) => d.some((x) => codeValueOf(x) === 'PJ0001'), 60_000)
    const pj = depois.find((d) => codeValueOf(d) === 'PJ0001')

    assert.ok(pj, `a indexação de ${ARQUIVOS} includes não chegou a produzir diagnóstico`)
    assert.match(pj.message, /INC7999\.CH/, 'a mensagem não cita o nome real do disco')
  })

  test('a ativação continua dentro do orçamento com a árvore grande apontada', async () => {
    // FR-021: a indexação é sob demanda e NUNCA na ativação. Com a árvore
    // apontada e já indexada, reativar não pode custar mais.
    const extension = vscode.extensions.getExtension('robsonrosilva.advpl-lint')
    assert.ok(extension)

    const api = (await extension.activate()) as { activationMs?: number } | undefined

    assert.ok(
      (api?.activationMs ?? 0) <= 50,
      `o trabalho próprio da ativação levou ${api?.activationMs?.toFixed(1) ?? '?'} ms com ` +
        `${ARQUIVOS} includes apontados — a indexação vazou para o caminho de ativação`,
    )
  })
})
