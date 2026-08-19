import * as assert from 'node:assert/strict'
import * as path from 'node:path'
import * as vscode from 'vscode'

const EXTENSION_ID = 'robsonrosilva.advpl-lint'
const WORKSPACE = path.join(__dirname, '..', '..', '..', 'test', 'fixtures', 'workspace')

/**
 * O cliente LSP mapeia `code` + `codeDescription` do protocolo para um único
 * `code: { value, target }` do lado do VS Code. Estes dois ajudantes leem a
 * forma real da API em vez da forma do protocolo.
 */
function codeValueOf(diagnostic: vscode.Diagnostic): string {
  const code = diagnostic.code
  return typeof code === 'object' && code !== null ? String(code.value) : String(code)
}

function codeTargetOf(diagnostic: vscode.Diagnostic): string {
  const code = diagnostic.code
  return typeof code === 'object' && code !== null ? code.target.toString() : ''
}

/** Espera os diagnósticos aparecerem — a análise é assíncrona por construção. */
async function waitForDiagnostics(uri: vscode.Uri, timeoutMs = 15000): Promise<vscode.Diagnostic[]> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const found = vscode.languages.getDiagnostics(uri)
    if (found.length > 0) return found
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return vscode.languages.getDiagnostics(uri)
}

suite('Ativação', () => {
  test('a extensão NÃO ativa ao abrir um arquivo que não é ADVPL/TLPP', async () => {
    // FR-001. Ativação por `*` é proibida; abrir um .txt não pode acordar nada.
    const extension = vscode.extensions.getExtension(EXTENSION_ID)
    assert.ok(extension, 'extensão não encontrada')

    const doc = await vscode.workspace.openTextDocument(path.join(WORKSPACE, 'notas.txt'))
    await vscode.window.showTextDocument(doc)
    await new Promise((resolve) => setTimeout(resolve, 500))

    assert.equal(extension.isActive, false, 'a extensão ativou com um .txt aberto')
  })

  test('a extensão ativa ao abrir um fonte .prw', async () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID)
    assert.ok(extension)

    const doc = await vscode.workspace.openTextDocument(path.join(WORKSPACE, 'exemplo.prw'))
    await vscode.window.showTextDocument(doc)
    await extension.activate()

    assert.equal(extension.isActive, true)
    assert.equal(doc.languageId, 'advpl', 'a extensão de arquivo .prw não foi associada a advpl')
  })
})

suite('Diagnóstico no painel de problemas', () => {
  test('CA3001 aparece com identificador, severidade e posição exata', async () => {
    // US1, cenário 1. A asserção compara o diagnóstico específico, não uma
    // contagem — contagem agregada é proibida pelo FR-029.
    const uri = vscode.Uri.file(path.join(WORKSPACE, 'exemplo.prw'))
    const doc = await vscode.workspace.openTextDocument(uri)
    await vscode.window.showTextDocument(doc)

    const diagnostics = await waitForDiagnostics(uri)
    const ca3001 = diagnostics.find((d) => codeValueOf(d) === 'CA3001')

    assert.ok(ca3001, `nenhum CA3001 veio; vieram: ${diagnostics.map(codeValueOf).join(', ')}`)
    assert.equal(ca3001.severity, vscode.DiagnosticSeverity.Information)
    assert.equal(ca3001.source, 'advpl-lint')
    assert.equal(ca3001.range.start.line, 2)
    assert.equal(ca3001.range.start.character, 0)
    assert.equal(ca3001.range.end.character, 8, 'o intervalo deveria cobrir só o token #INCLUDE')
  })

  test('o identificador leva à documentação da regra', async () => {
    // FR-011: o usuário descobre o que fazer sem sair do editor.
    const uri = vscode.Uri.file(path.join(WORKSPACE, 'exemplo.prw'))
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri))

    const diagnostics = await waitForDiagnostics(uri)
    const ca3001 = diagnostics.find((d) => codeValueOf(d) === 'CA3001')
    assert.ok(ca3001)
    assert.match(codeTargetOf(ca3001), /docs\/regras\/CA3001\.md$/)
  })

  test('a mensagem não é o identificador cru da chave', () => {
    // Princípio V: chave faltante vaza o identificador para dentro do editor.
    const uri = vscode.Uri.file(path.join(WORKSPACE, 'exemplo.prw'))
    const ca3001 = vscode.languages.getDiagnostics(uri).find((d) => codeValueOf(d) === 'CA3001')
    assert.ok(ca3001)
    assert.notEqual(ca3001.message, 'rule.CA3001.message')
    assert.ok(ca3001.message.length > 10)
  })
})

suite('Extensão de arquivo em caixa alta', () => {
  test('reconhece a linguagem em arquivo .PRX, e não só .prx', async () => {
    // Fonte Protheus vem com a extensão nas duas caixas — no corpus real, boa
    // parte dos `.PRX` e `.PRW` está em maiúscula. Se o editor não casar a
    // extensão sem olhar a caixa, a extensão nunca ativa nesses arquivos e o
    // usuário vê um painel de problemas vazio, sem nenhum erro que explique.
    const uri = vscode.Uri.file(path.join(WORKSPACE, 'EXEMPLO.PRX'))
    const doc = await vscode.workspace.openTextDocument(uri)

    assert.equal(doc.languageId, 'advpl', `linguagem detectada foi "${doc.languageId}"`)
  })

  test('emite diagnóstico em arquivo com extensão em caixa alta', async () => {
    const uri = vscode.Uri.file(path.join(WORKSPACE, 'EXEMPLO.PRX'))
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri))

    const diagnostics = await waitForDiagnostics(uri)
    const encontrados = diagnostics.filter((d) => codeValueOf(d) === 'CA3001')

    assert.equal(encontrados.length, 2, 'as duas diretivas em caixa alta deveriam ser marcadas')
  })
})

suite('Configuração por regra, sem reiniciar (US3)', () => {
  const config = () => vscode.workspace.getConfiguration('advplLint')

  /** Espera o painel refletir a mudança — a revalidação é debounced. */
  async function waitFor(
    uri: vscode.Uri,
    condition: (diagnostics: vscode.Diagnostic[]) => boolean,
    timeoutMs = 15000,
  ): Promise<vscode.Diagnostic[]> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const found = vscode.languages.getDiagnostics(uri)
      if (condition(found)) return found
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return vscode.languages.getDiagnostics(uri)
  }

  teardown(async () => {
    await config().update('rules.CA3001.enabled', undefined, true)
    await config().update('rules.CA3001.severity', undefined, true)
  })

  test('desligar a regra faz o diagnóstico sumir sem reiniciar o editor', async () => {
    // US3, cenário 1. Nada de recarregar janela: o usuário muda a chave e vê.
    const uri = vscode.Uri.file(path.join(WORKSPACE, 'exemplo.prw'))
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri))
    await waitFor(uri, (d) => d.some((x) => codeValueOf(x) === 'CA3001'))

    await config().update('rules.CA3001.enabled', false, true)

    const depois = await waitFor(uri, (d) => !d.some((x) => codeValueOf(x) === 'CA3001'))
    assert.equal(depois.filter((d) => codeValueOf(d) === 'CA3001').length, 0)
  })

  test('mudar a severidade altera só a severidade, sem reiniciar o editor', async () => {
    // US3, cenário 2. Identificador e intervalo são contrato: supressão e
    // filtro do usuário se apoiam neles e não podem mudar junto.
    const uri = vscode.Uri.file(path.join(WORKSPACE, 'exemplo.prw'))
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri))
    const antes = (await waitFor(uri, (d) => d.some((x) => codeValueOf(x) === 'CA3001'))).find(
      (d) => codeValueOf(d) === 'CA3001',
    )
    assert.ok(antes)

    await config().update('rules.CA3001.severity', 'error', true)

    const depois = (
      await waitFor(uri, (d) =>
        d.some((x) => codeValueOf(x) === 'CA3001' && x.severity === vscode.DiagnosticSeverity.Error),
      )
    ).find((d) => codeValueOf(d) === 'CA3001')

    assert.ok(depois)
    assert.equal(depois.severity, vscode.DiagnosticSeverity.Error)
    assert.equal(codeValueOf(depois), codeValueOf(antes))
    assert.deepEqual(depois.range, antes.range)
  })
})

suite('Codificação', () => {
  test('a extensão impõe windows1252 como padrão para advpl', () => {
    // FR-003 no caminho de edição: quem decodifica o byte CP1252 é o VS Code,
    // e é `configurationDefaults` que o instrui a fazer isso.
    const encoding = vscode.workspace
      .getConfiguration('files', { languageId: 'advpl', uri: vscode.Uri.file(WORKSPACE) })
      .get<string>('encoding')
    assert.equal(encoding, 'windows1252')
  })
})
