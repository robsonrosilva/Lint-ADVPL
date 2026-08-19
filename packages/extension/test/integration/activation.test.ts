import * as assert from 'node:assert/strict'
import * as path from 'node:path'
import * as vscode from 'vscode'

const EXTENSION_ID = 'robsonrosilva.advpl-lint'
const WORKSPACE = path.join(__dirname, '..', '..', '..', 'test', 'fixtures', 'workspace')

/** Fim de linha das fixtures geradas — fonte Protheus é CRLF. */
const CRLF = '\r\n'

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

  test('a ativação cabe no orçamento, nas suas DUAS metades (SC-003)', async () => {
    // A constituição v2.4.0 orça a ativação em dois números porque são duas
    // coisas, e só uma está sob controle deste código:
    //
    //   trabalho próprio do `activate`   <=  50 ms   (medido 18,4)
    //   ativação completa no editor      <= 1000 ms  (medido 218-451)
    //
    // O segundo inclui o editor LER, COMPILAR e resolver os `require` de um
    // pacote de 352 KB que é quase todo `vscode-languageclient`. Um teto único
    // de 200 ms media os dois juntos e reprovava o código correto pelo custo de
    // carregar uma dependência necessária.
    //
    // Este teste precisa ser o PRIMEIRO a ativar: ele vem depois do teste do
    // `.txt`, que garante extensão inativa, e antes de qualquer `.prw` ser
    // aberto — abrir um fonte dispara `onLanguage` e a ativação começaria por
    // fora, tornando a medição uma corrida.
    const extension = vscode.extensions.getExtension(EXTENSION_ID)
    assert.ok(extension)
    assert.equal(
      extension.isActive,
      false,
      'a extensão já estava ativa: esta medição precisa da PRIMEIRA ativação',
    )

    const started = performance.now()
    const api = (await extension.activate()) as { activationMs?: number } | undefined
    const total = performance.now() - started

    assert.equal(extension.isActive, true)

    // O que o código faz. Um `await` indevido no caminho de ativação estoura
    // isto na hora, e nenhum ruído de disco esconde.
    assert.equal(typeof api?.activationMs, 'number', 'a extensão não expôs o tempo do próprio activate')
    assert.ok(
      api!.activationMs! <= 50,
      `o trabalho próprio da ativação levou ${api!.activationMs!.toFixed(1)} ms, acima dos 50 ms`,
    )

    // O que o usuário espera. 1000 ms é o ponto em que o próprio VS Code passa
    // a tratar uma extensão como lenta — acima disso o problema deixa de ser o
    // nosso orçamento e vira reclamação do editor. Se ESTE falhar e o de cima
    // passar, leia como ambiente: o código não regrediu, a máquina está lenta.
    assert.ok(
      total <= 1000,
      `a ativação completa levou ${total.toFixed(1)} ms, acima do teto de 1000 ms ` +
        `(trabalho próprio: ${api?.activationMs?.toFixed(1) ?? '?'} ms — se este estiver dentro ` +
        `dos 50 ms, o excesso é do carregamento do módulo, não do código)`,
    )
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

suite('Do arquivo aberto ao primeiro diagnóstico (SC-001)', () => {
  // O fonte de tamanho MEDIANO do corpus tem 309 linhas — e é por isso que ele
  // é gerado aqui em vez de versionado: `check:corpus` reprova fixture acima de
  // 300 linhas, porque fixture autoral desse tamanho quase certamente foi
  // colada. O limite e este teste não se contradizem; o caso grande de propósito
  // é sempre gerado.
  const GERADO = path.join(WORKSPACE, 'generated')
  const MEDIANO = path.join(GERADO, 'mediano.prw')

  suiteSetup(async () => {
    const fs = await import('node:fs/promises')
    await fs.mkdir(GERADO, { recursive: true })
    const linhas = [
      '// FIXTURE GERADA - advpl-lint - NAO e copia de fonte padrao do Protheus.',
      '// Proposito: tamanho MEDIANO do corpus (309 linhas) para medir o SC-001',
      '#INCLUDE "TOTVS.CH"',
      ...Array.from({ length: 305 }, (_, i) => `Local x${i} := "valor ${i}"  // linha de enchimento`),
      'Return',
    ]
    await fs.writeFile(MEDIANO, Buffer.from(linhas.join('\r\n'), 'latin1'))
  })

  test('o primeiro diagnóstico aparece em no máximo 300 ms', async () => {
    // A extensão e o servidor já estão de pé aqui — é o estado em que o
    // desenvolvedor abre o segundo arquivo do dia, e é dele que o SC-001 fala.
    // Medir a primeira abertura da sessão misturaria a subida do servidor, que
    // tem orçamento próprio.
    const uri = vscode.Uri.file(MEDIANO)

    const started = performance.now()
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri))
    const diagnostics = await waitForDiagnostics(uri)
    const elapsed = performance.now() - started

    assert.ok(
      diagnostics.some((d) => codeValueOf(d) === 'CA3001'),
      'nenhum CA3001 veio do fonte mediano',
    )
    assert.ok(
      elapsed <= 300,
      `levou ${elapsed.toFixed(1)} ms entre abrir o fonte de 309 linhas e ver o diagnóstico`,
    )
  })
})

suite('Digitar num fonte grande não engasga (SC-002)', () => {
  // O critério: "digitar continuamente por 10 segundos num fonte do percentil 99
  // não produz nenhuma interrupção perceptível na digitação".
  //
  // A armadilha aqui já custou caro duas vezes neste projeto: teto absoluto de
  // tempo mede a MÁQUINA, não o desenho, e reprova no dia em que o ambiente
  // fica ocupado. A saída é a mesma que funcionou lá — comparar contra uma
  // linha de base tirada no mesmo momento, na mesma máquina.
  //
  // Aqui a linha de base é a MESMA digitação com a regra DESLIGADA. Se a
  // análise fosse a culpada por um engasgo, a latência subiria ao ligá-la. Se as
  // duas sobem juntas, o custo é do editor e não nosso.
  const GERADO = path.join(WORKSPACE, 'generated')
  const P99 = path.join(GERADO, 'p99.prw')
  const config = () => vscode.workspace.getConfiguration('advplLint')

  /** Digita durante o tempo pedido e devolve a latência de cada tecla. */
  async function digitarPor(editor: vscode.TextEditor, ms: number): Promise<number[]> {
    const latencias: number[] = []
    const fim = Date.now() + ms
    while (Date.now() < fim) {
      const started = performance.now()
      await editor.edit((builder) => builder.insert(new vscode.Position(2, 0), 'x'))
      latencias.push(performance.now() - started)
      // ~20 teclas por segundo: digitação rápida de verdade.
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    return latencias
  }

  function mediana(valores: readonly number[]): number {
    const ordenado = [...valores].sort((a, b) => a - b)
    const meio = ordenado.length >> 1
    return ordenado.length % 2 === 1
      ? ordenado[meio]!
      : (ordenado[meio - 1]! + ordenado[meio]!) / 2
  }

  suiteSetup(async () => {
    const fs = await import('node:fs/promises')
    await fs.mkdir(GERADO, { recursive: true })
    // 10.155 linhas: o p99 medido do corpus.
    const linhas = [
      '// FIXTURE GERADA - advpl-lint - NAO e copia de fonte padrao do Protheus.',
      '// Proposito: percentil 99 do corpus (10.155 linhas) para medir o SC-002',
      '#INCLUDE "TOTVS.CH"',
      ...Array.from({ length: 10_151 }, (_, i) =>
        i % 50 === 0 ? '#INCLUDE "OUTRO.CH"' : `Local x${i} := "valor ${i}"  // enchimento`,
      ),
      'Return',
    ]
    await fs.writeFile(P99, Buffer.from(linhas.join(CRLF), 'latin1'))
  })

  teardown(async () => {
    await config().update('rules.CA3001.enabled', undefined, true)
  })

  test('digitar 10 segundos no p99 não fica pior do que digitar sem análise', async () => {
    const editor = await vscode.window.showTextDocument(
      await vscode.workspace.openTextDocument(vscode.Uri.file(P99)),
    )

    // Linha de base: a mesma digitação, sem análise nenhuma por trás.
    await config().update('rules.CA3001.enabled', false, true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    const semAnalise = await digitarPor(editor, 2000)

    // Agora com a regra ligada, pelos 10 segundos que o critério pede.
    await config().update('rules.CA3001.enabled', true, true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    const comAnalise = await digitarPor(editor, 10_000)

    const base = mediana(semAnalise)
    const medida = mediana(comAnalise)
    const pior = Math.max(...comAnalise)

    assert.ok(comAnalise.length > 100, `só ${comAnalise.length} teclas em 10 s — a digitação parou?`)

    // O piso de 20 ms existe porque a linha de base é pequena o bastante para
    // uma razão pura ficar absurdamente sensível ao ruído de um único quadro.
    const teto = Math.max(20, base * 3)
    assert.ok(
      medida <= teto,
      `com análise, a mediana por tecla foi ${medida.toFixed(1)} ms contra ${base.toFixed(1)} ms ` +
        `sem análise (teto ${teto.toFixed(1)} ms) — a análise está atrapalhando a digitação`,
    )

    // Nenhuma tecla isolada pode travar de forma perceptível. 100 ms é o limiar
    // clássico em que a pessoa deixa de sentir a resposta como imediata.
    assert.ok(
      pior <= 100,
      `a tecla mais lenta levou ${pior.toFixed(1)} ms (mediana ${medida.toFixed(1)} ms, ` +
        `base sem análise ${base.toFixed(1)} ms)`,
    )
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

suite('Todo diagnóstico carrega o contrato completo (SC-004)', () => {
  test('nenhum diagnóstico sai sem identificador, severidade e posição', async () => {
    // Cada teste desta suíte confere o SEU diagnóstico. Este varre TODOS os que
    // a extensão emitiu na sessão — em todos os arquivos abertos até aqui — e
    // cobra o contrato de cada um. É a diferença entre "os que eu olhei estão
    // certos" e "nenhum sai errado", que é o que o SC-004 pede.
    const todos = vscode.languages
      .getDiagnostics()
      .filter(([, diagnostics]) => diagnostics.length > 0)

    const nossos = todos.flatMap(([uri, diagnostics]) =>
      diagnostics.filter((d) => d.source === 'advpl-lint').map((d) => ({ uri, d })),
    )

    assert.ok(nossos.length > 0, 'nenhum diagnóstico nosso na sessão — o teste não provaria nada')

    for (const { uri, d } of nossos) {
      const onde = `${path.basename(uri.fsPath)} linha ${d.range.start.line + 1}`

      assert.ok(d.code !== undefined && d.code !== null, `diagnóstico sem identificador em ${onde}`)
      assert.match(codeValueOf(d), /^(CA|BG|CS|PJ)\d{4}$/, `identificador fora do padrão em ${onde}`)
      assert.ok(d.severity !== undefined, `diagnóstico sem severidade em ${onde}`)

      // Posição inicial E final: um intervalo degenerado não sublinha nada, e um
      // que cobre a linha toda esconde onde o problema está.
      assert.ok(Number.isInteger(d.range.start.line), `linha inicial inválida em ${onde}`)
      assert.ok(Number.isInteger(d.range.start.character), `coluna inicial inválida em ${onde}`)
      assert.ok(
        d.range.end.character > d.range.start.character || d.range.end.line > d.range.start.line,
        `intervalo vazio em ${onde}`,
      )

      assert.ok(d.message.length > 10, `mensagem curta demais em ${onde}: "${d.message}"`)
      assert.doesNotMatch(d.message, /^rule\..+\.message$/, `chave crua vazou em ${onde}`)
    }
  })
})

suite('Nenhuma configuração da extensão antiga é lida (FR-014a)', () => {
  test('a extensão publica com identidade própria', async () => {
    // D1 da spec: a extensão nova publica com identidade distinta da atual. Sem
    // isso, instalar as duas seria conflito, e migrar seria obrigatório.
    const extension = vscode.extensions.getExtension(EXTENSION_ID)

    assert.ok(extension, `a extensão deveria se chamar ${EXTENSION_ID}`)
    assert.notEqual(EXTENSION_ID, 'robsonrosilva.advpl-sintaxe')
  })

  test('todas as chaves contribuídas ficam sob advplLint', async () => {
    // A segunda metade do FR-014a: "suas configurações não são lidas nem
    // migradas". Não dá para provar uma ausência varrendo o código, mas dá para
    // travar a superfície: se a extensão só declara chaves sob o próprio espaço
    // de nomes, ler a configuração alheia exigiria código explícito — e passaria
    // por revisão em vez de entrar pela conveniência.
    const extension = vscode.extensions.getExtension(EXTENSION_ID)
    assert.ok(extension)

    const contributes = extension.packageJSON.contributes as {
      configuration?: { properties?: Record<string, unknown> }
    }
    const chaves = Object.keys(contributes.configuration?.properties ?? {})

    assert.ok(chaves.length > 0, 'a extensão não contribui configuração nenhuma')
    for (const chave of chaves) {
      assert.ok(chave.startsWith('advplLint.'), `a chave "${chave}" está fora do espaço advplLint`)
    }
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
