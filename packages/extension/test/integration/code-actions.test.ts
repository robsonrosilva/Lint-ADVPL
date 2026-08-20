import * as assert from 'node:assert/strict'
import * as path from 'node:path'
import * as vscode from 'vscode'

const WORKSPACE = path.join(__dirname, '..', '..', '..', 'test', 'fixtures', 'workspace')
const CRLF = '\r\n'

function codeValueOf(diagnostic: vscode.Diagnostic): string {
  const code = diagnostic.code
  return typeof code === 'object' && code !== null ? String(code.value) : String(code)
}

async function waitFor(
  uri: vscode.Uri,
  condition: (diagnostics: vscode.Diagnostic[]) => boolean,
  timeoutMs = 15000,
): Promise<vscode.Diagnostic[]> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const found = vscode.languages.getDiagnostics(uri)
    if (condition(found)) return found
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return vscode.languages.getDiagnostics(uri)
}

/** Pede as ações ao editor, pelo mesmo caminho que a lâmpada usa. */
async function codeActionsAt(
  uri: vscode.Uri,
  range: vscode.Range,
  only?: vscode.CodeActionKind,
): Promise<vscode.CodeAction[]> {
  const resultado = await vscode.commands.executeCommand<vscode.CodeAction[]>(
    'vscode.executeCodeActionProvider',
    uri,
    range,
    only?.value,
  )
  return resultado ?? []
}

function nossas(acoes: readonly vscode.CodeAction[]): vscode.CodeAction[] {
  return acoes.filter((a) => a.edit !== undefined && /CA3001|ADVPL Lint|#include/i.test(a.title))
}

function percentil(valores: readonly number[], p: number): number {
  const ordenado = [...valores].sort((a, b) => a - b)
  const indice = Math.min(ordenado.length - 1, Math.max(0, Math.ceil((p / 100) * ordenado.length) - 1))
  return ordenado[indice]!
}

/** Escreve um fonte de teste no workspace e devolve a URI. */
async function escreverFonte(nome: string, linhas: readonly string[]): Promise<vscode.Uri> {
  const fs = await import('node:fs/promises')
  const dir = path.join(WORKSPACE, 'generated')
  await fs.mkdir(dir, { recursive: true })
  const arquivo = path.join(dir, nome)
  await fs.writeFile(arquivo, Buffer.from(linhas.join(CRLF), 'latin1'))
  return vscode.Uri.file(arquivo)
}

const CABECALHO = [
  '// FIXTURE GERADA - advpl-lint - NAO e copia de fonte padrao do Protheus.',
  '// Proposito: exercitar as acoes de correcao da spec 002',
]

suite('US1 — a lâmpada corrige o #INCLUDE', () => {
  const uri = vscode.Uri.file(path.join(WORKSPACE, 'exemplo.prw'))

  suiteSetup(async () => {
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri))
    await waitFor(uri, (d) => d.some((x) => codeValueOf(x) === 'CA3001'))
  })

  test('a lâmpada aparece sobre o diagnóstico CA3001 (US1 cenário 1)', async () => {
    const diagnostico = vscode.languages
      .getDiagnostics(uri)
      .find((d) => codeValueOf(d) === 'CA3001')
    assert.ok(diagnostico, 'nenhum CA3001 no arquivo de exemplo')

    const acoes = nossas(await codeActionsAt(uri, diagnostico.range, vscode.CodeActionKind.QuickFix))

    assert.ok(acoes.length > 0, 'nenhuma ação de correção foi oferecida sobre o diagnóstico')
    const correcao = acoes[0]!
    assert.equal(correcao.kind?.contains(vscode.CodeActionKind.QuickFix), true)
    assert.match(correcao.title, /CA3001/, 'o título não diz qual regra está sendo corrigida')
  })

  test('aplicar a correção troca SÓ a diretiva, e o diagnóstico some sem salvar (US1 cenário 2)', async () => {
    // O ponto do "sem salvar": a análise vê o BUFFER, não o disco. Uma correção
    // que só surtisse efeito depois de gravar deixaria o painel mentindo até lá.
    const alvo = await escreverFonte('correcao-us1.prw', [
      ...CABECALHO,
      '#INCLUDE "ACADEF.CH"',
      'User Function CorrecaoUs1()',
      'Return Nil',
      '',
    ])

    const documento = await vscode.workspace.openTextDocument(alvo)
    await vscode.window.showTextDocument(documento)
    const antes = await waitFor(alvo, (d) => d.some((x) => codeValueOf(x) === 'CA3001'))
    const diagnostico = antes.find((d) => codeValueOf(d) === 'CA3001')!

    const acoes = nossas(await codeActionsAt(alvo, diagnostico.range, vscode.CodeActionKind.QuickFix))
    assert.ok(acoes[0]?.edit, 'a ação veio sem edição')
    assert.equal(await vscode.workspace.applyEdit(acoes[0].edit), true)

    // A diretiva baixou; o NOME do arquivo continua em caixa alta, byte a byte.
    const linha = documento.lineAt(2).text
    assert.equal(linha, '#include "ACADEF.CH"', `a linha ficou: ${JSON.stringify(linha)}`)
    assert.equal(documento.isDirty, true, 'a correção deveria valer no buffer, sem gravar')

    const depois = await waitFor(alvo, (d) => !d.some((x) => codeValueOf(x) === 'CA3001'))
    assert.equal(depois.filter((d) => codeValueOf(d) === 'CA3001').length, 0)
  })

  test('regra desligada não oferece lâmpada (FR-008)', async () => {
    const config = vscode.workspace.getConfiguration('advplLint')
    const diagnostico = vscode.languages
      .getDiagnostics(uri)
      .find((d) => codeValueOf(d) === 'CA3001')
    assert.ok(diagnostico)
    const intervalo = diagnostico.range

    try {
      await config.update('rules.CA3001.enabled', false, true)
      await waitFor(uri, (d) => !d.some((x) => codeValueOf(x) === 'CA3001'))

      const acoes = nossas(await codeActionsAt(uri, intervalo, vscode.CodeActionKind.QuickFix))
      assert.equal(acoes.length, 0, 'a lâmpada ressuscitou uma regra que o usuário desligou')
    } finally {
      await config.update('rules.CA3001.enabled', undefined, true)
      await waitFor(uri, (d) => d.some((x) => codeValueOf(x) === 'CA3001'))
    }
  })
})

suite('SC-001 — o cálculo das ações não é caminho caro', () => {
  // ⚠️ Teto absoluto de tempo mede a MÁQUINA, não o desenho, e já reprovou
  // vários testes deste projeto. Mas RAZÃO com denominador errado é pior: ela
  // parece auto-referente e não é.
  //
  // A primeira versão deste teste comparava o pedido de ações contra "o tempo
  // de reanálise", medido assim: editar e esperar o `CA3001` aparecer. Só que o
  // `CA3001` JÁ ESTAVA no painel — o `waitFor` voltava na primeira volta, e o
  // denominador media um `editor.edit`, não uma reanálise. Enquanto os dois
  // números foram pequenos, ninguém notou; em 2026-08-20 ele acusou 68 ms
  // contra 35 ms e reprovou sem que nada tivesse ficado caro.
  //
  // A formulação certa isola o QUE SE QUER MEDIR: o MESMO comando do editor,
  // sobre o MESMO arquivo, num intervalo COM diagnóstico e num intervalo SEM.
  // A ida e volta do protocolo, a agregação de provedores e o custo do editor
  // são idênticos nos dois; o que difere é exatamente o nosso cálculo. Se
  // alguém puser I/O ou uma varredura de texto ali, a diferença aparece — e
  // nenhuma máquina lenta a esconde, porque ela sobe os dois lados juntos.
  let alvo: vscode.Uri
  let comDiagnostico: vscode.Range
  const linhaLimpa = new vscode.Range(200, 0, 200, 5)

  suiteSetup(async () => {
    // 309 linhas: o fonte de tamanho mediano do corpus.
    alvo = await escreverFonte('acoes-mediano.prw', [
      ...CABECALHO,
      '#INCLUDE "TOTVS.CH"',
      ...Array.from({ length: 305 }, (_, i) => `Local x${i} := "valor ${i}"  // enchimento`),
      'Return',
      '',
    ])
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(alvo))
    const diagnosticos = await waitFor(alvo, (d) => d.some((x) => codeValueOf(x) === 'CA3001'))
    comDiagnostico = diagnosticos.find((d) => codeValueOf(d) === 'CA3001')!.range
  })

  test('pedir ações onde HÁ diagnóstico não é mais caro que onde não há', async () => {
    const medir = async (intervalo: vscode.Range): Promise<number[]> => {
      const amostras: number[] = []
      for (let i = 0; i < 30; i += 1) {
        const marca = performance.now()
        await codeActionsAt(alvo, intervalo, vscode.CodeActionKind.QuickFix)
        amostras.push(performance.now() - marca)
      }
      return amostras
    }

    // Aquece: a primeira ida e volta paga a resolução de provedores do editor.
    await medir(linhaLimpa)

    const semTrabalho = percentil(await medir(linhaLimpa), 95)
    const comTrabalho = percentil(await medir(comDiagnostico), 95)

    // Nenhuma ação nossa deve ser oferecida na linha limpa — senão os dois lados
    // fariam o mesmo trabalho e a comparação não diria nada.
    const naLinhaLimpa = nossas(
      await codeActionsAt(alvo, linhaLimpa, vscode.CodeActionKind.QuickFix),
    )
    assert.equal(naLinhaLimpa.length, 0, 'a linha de base não é uma linha SEM trabalho nosso')

    // O piso existe porque os dois lados são pequenos o bastante para uma razão
    // pura ficar dominada pelo ruído de um único quadro do editor. 20 ms é o
    // mesmo piso que o teste de digitação do SC-002 usa, pela mesma razão.
    const teto = Math.max(20, semTrabalho * 3)
    assert.ok(
      comTrabalho <= teto,
      `pedir ações COM diagnóstico levou ${comTrabalho.toFixed(1)} ms no P95, contra ` +
        `${semTrabalho.toFixed(1)} ms SEM nada a fazer, no mesmo arquivo (teto ${teto.toFixed(1)} ms) ` +
        '— o cálculo das ações virou caminho caro',
    )
  })
})

suite('US2 — corrigir todas do arquivo, e ao salvar', () => {
  const config = () => vscode.workspace.getConfiguration()

  teardown(async () => {
    await config().update('editor.codeActionsOnSave', undefined, true)
  })

  test('"corrigir tudo" é revertido por UM desfazer (US2 cenário 1, SC-003)', async () => {
    // Se precisar de N desfazeres, as edições não foram agrupadas — e o usuário
    // desiste no meio do Ctrl+Z, deixando o arquivo num estado que ele não
    // escolheu.
    const alvo = await escreverFonte('fix-all-us2.prw', [
      ...CABECALHO,
      '#INCLUDE "A.CH"',
      '#INCLUDE "B.CH"',
      '#INCLUDE "C.CH"',
      'User Function FixAllUs2()',
      'Return Nil',
      '',
    ])

    const documento = await vscode.workspace.openTextDocument(alvo)
    await vscode.window.showTextDocument(documento)
    await waitFor(alvo, (d) => d.filter((x) => codeValueOf(x) === 'CA3001').length === 3)

    const original = documento.getText()
    const todoOArquivo = new vscode.Range(0, 0, documento.lineCount, 0)
    const acoes = await codeActionsAt(alvo, todoOArquivo, vscode.CodeActionKind.SourceFixAll)
    const corrigirTudo = acoes.find((a) => a.kind?.contains(vscode.CodeActionKind.SourceFixAll))

    assert.ok(corrigirTudo?.edit, 'nenhuma ação de "corrigir tudo" foi oferecida')
    assert.equal(await vscode.workspace.applyEdit(corrigirTudo.edit), true)

    for (const linha of [2, 3, 4]) {
      assert.match(documento.lineAt(linha).text, /^#include /, `a linha ${linha + 1} não foi corrigida`)
    }

    // UM desfazer, e as três voltam juntas.
    await vscode.commands.executeCommand('undo')

    assert.equal(
      documento.getText(),
      original,
      'um único desfazer não reverteu tudo — as edições não foram agrupadas numa operação só',
    )
  })

  test('editor.codeActionsOnSave produz o mesmo resultado (US2 cenário 2)', async () => {
    // `source.fixAll` não é convenção nossa: é o tipo que o VS Code procura ao
    // salvar. Este teste é o que prova que declará-lo bastou — não há nenhuma
    // linha de código do lado do cliente para isso funcionar.
    const alvo = await escreverFonte('fix-on-save-us2.prw', [
      ...CABECALHO,
      '#INCLUDE "A.CH"',
      '#INCLUDE "B.CH"',
      'User Function FixOnSaveUs2()',
      'Return Nil',
      '',
    ])

    const documento = await vscode.workspace.openTextDocument(alvo)
    const editor = await vscode.window.showTextDocument(documento)
    await waitFor(alvo, (d) => d.filter((x) => codeValueOf(x) === 'CA3001').length === 2)

    await config().update('editor.codeActionsOnSave', { 'source.fixAll': true }, true)
    // Salvar só faz efeito com o documento sujo.
    await editor.edit((builder) => builder.insert(new vscode.Position(1, 0), '// '))
    assert.equal(await documento.save(), true)

    assert.match(documento.lineAt(2).text, /^#include "A\.CH"$/)
    assert.match(documento.lineAt(3).text, /^#include "B\.CH"$/)
  })

  test('documento sem violação não é sujado por "corrigir tudo" (FR-015)', async () => {
    // Salvar um arquivo limpo não pode marcá-lo como modificado. Uma ação com
    // zero edições oferecida ao salvamento faria exatamente isso.
    const alvo = await escreverFonte('sem-violacao-us2.prw', [
      ...CABECALHO,
      '#include "a.ch"',
      'User Function SemViolacaoUs2()',
      'Return Nil',
      '',
    ])

    const documento = await vscode.workspace.openTextDocument(alvo)
    await vscode.window.showTextDocument(documento)
    await new Promise((resolve) => setTimeout(resolve, 800))

    const todoOArquivo = new vscode.Range(0, 0, documento.lineCount, 0)
    const acoes = await codeActionsAt(alvo, todoOArquivo, vscode.CodeActionKind.SourceFixAll)
    const corrigirTudo = acoes.find((a) => a.kind?.contains(vscode.CodeActionKind.SourceFixAll))

    assert.equal(corrigirTudo, undefined, 'foi oferecida correção num arquivo que não tem o que corrigir')
    assert.equal(documento.isDirty, false)
  })
})

suite('US2 cenário 3 — corrigir ao salvar no maior fonte do corpus (FR-017, SC-004)', () => {
  // 24.636 linhas: o maior fonte observado no corpus. GERADO, nunca versionado.
  const LINHAS = 24_636
  const A_CADA = 50
  const config = () => vscode.workspace.getConfiguration()

  let alvo: vscode.Uri
  let documento: vscode.TextDocument
  let editor: vscode.TextEditor

  suiteSetup(async () => {
    const corpo = Array.from({ length: LINHAS - CABECALHO.length }, (_, i) => {
      const linha = i + CABECALHO.length
      return linha % A_CADA === 0
        ? '#INCLUDE "TOTVS.CH"'
        : `Local xVar${linha} := "valor ${linha}"  // comentario da linha ${linha}`
    })
    alvo = await escreverFonte('grande-fix-on-save.prw', [...CABECALHO, ...corpo])
    documento = await vscode.workspace.openTextDocument(alvo)
    editor = await vscode.window.showTextDocument(documento)
    await waitFor(alvo, (d) => d.some((x) => codeValueOf(x) === 'CA3001'), 30000)
  })

  teardown(async () => {
    await config().update('editor.codeActionsOnSave', undefined, true)
  })

  test('salvar não fica perceptivelmente mais lento com a correção ligada', async () => {
    // ⚠️ Teto absoluto mede a MÁQUINA. A aferição é RELATIVA: mede-se o mesmo
    // salvamento, no mesmo arquivo, na mesma máquina, com e sem a correção.
    assert.equal(documento.lineCount, LINHAS, 'o fonte gerado não tem o tamanho esperado')

    // Linha de base: salvar sem a correção ao salvar.
    const semCorrecao: number[] = []
    for (let i = 0; i < 3; i += 1) {
      await editor.edit((builder) => builder.insert(new vscode.Position(0, 0), '//'))
      const marca = performance.now()
      await documento.save()
      semCorrecao.push(performance.now() - marca)
    }

    await config().update('editor.codeActionsOnSave', { 'source.fixAll': true }, true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    const comCorrecao: number[] = []
    for (let i = 0; i < 3; i += 1) {
      await editor.edit((builder) => builder.insert(new vscode.Position(0, 0), '//'))
      const marca = performance.now()
      await documento.save()
      comCorrecao.push(performance.now() - marca)
    }

    // A correção realmente aconteceu — sem isto o teste passaria não fazendo nada.
    const diretivasEmCaixaAlta = documento.getText().match(/#INCLUDE\b/g)?.length ?? 0
    assert.equal(diretivasEmCaixaAlta, 0, 'a correção ao salvar não corrigiu as diretivas')

    const base = Math.max(...semCorrecao)
    const medido = Math.max(...comCorrecao)

    // O piso existe porque a linha de base é pequena o bastante para uma razão
    // pura ficar dominada pelo ruído de um único quadro. 300 ms é o mesmo
    // limiar que a constituição usa para "do arquivo aberto ao primeiro
    // diagnóstico" — acima disso a espera deixa de ser imperceptível.
    const teto = Math.max(300, base * 4)
    assert.ok(
      medido <= teto,
      `salvar com correção levou ${medido.toFixed(1)} ms contra ${base.toFixed(1)} ms sem ela ` +
        `(teto ${teto.toFixed(1)} ms) num fonte de ${LINHAS} linhas`,
    )
  })
})
