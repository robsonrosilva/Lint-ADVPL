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
    assert.equal(ca3001.severity, vscode.DiagnosticSeverity.Hint)
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
