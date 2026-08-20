import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// __dirname aponta para packages/tooling/out/test/checks — cinco níveis até a raiz.
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..')

/**
 * O portão local é a ÚNICA coisa entre o repositório e um merge quebrado —
 * não há integração contínua (`TODO(CI)`). O que ele deixa de fora, ninguém
 * confere.
 *
 * Este teste existe porque isso já falhou: o `verify` encadeava `test:unit` em
 * vez da suíte inteira, e os testes de integração — os que rodam dentro de um
 * VS Code de verdade — ficaram fora do portão. Passou despercebido por semanas
 * de trabalho porque o portão estava sempre verde; quem o lia como "completo",
 * como o quickstart o descreve, confiava em menos do que pensava.
 *
 * Descoberto pela `/speckit-converge` da spec 001, não por alguém olhando.
 */
async function scripts(): Promise<Record<string, string>> {
  const raw = JSON.parse(await readFile(join(REPO_ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>
  }
  return raw.scripts
}

describe('O portão local roda tudo o que promete', () => {
  it('o verify encadeia as duas suítes de teste, não só a unitária', async () => {
    const verify = (await scripts())['verify'] ?? ''

    assert.match(verify, /\btest:unit\b/, 'o verify não roda a suíte unitária')
    assert.match(verify, /\btest:integration\b/, 'o verify não roda a suíte de integração')
  })

  it('o verify encadeia tipagem, lint e as três verificações', async () => {
    const verify = (await scripts())['verify'] ?? ''

    for (const etapa of ['typecheck', 'lint', 'check:nls', 'check:corpus', 'check:docs']) {
      assert.match(verify, new RegExp(`\\b${etapa.replace(':', ':')}\\b`), `o verify não roda ${etapa}`)
    }
  })

  it('encadeia com && — uma etapa que falha PARA o portão', async () => {
    // Com `;` ou `&`, uma etapa vermelha seguiria adiante e o código de saída
    // seria o da última, não o da que falhou. É a mesma família de erro do
    // `npm test | tail`, que devolve o código do `tail`.
    const verify = (await scripts())['verify'] ?? ''

    assert.ok(!verify.includes(';'), 'etapas separadas por ";" não interrompem o portão')
    assert.ok(!/[^&]&[^&]/.test(verify), 'etapas em segundo plano não interrompem o portão')
  })

  it('nenhuma etapa do portão canaliza a saída', async () => {
    // `npm test | tail` devolve o código de saída do `tail`, não do teste — já
    // mascarou suíte que nem chegou a rodar neste repositório.
    const all = await scripts()

    for (const [name, command] of Object.entries(all)) {
      assert.ok(!command.includes('|'), `o script "${name}" canaliza a saída: ${command}`)
    }
  })

  it('a suíte unitária aplica o limiar de cobertura', async () => {
    // O limiar vive no runner, que lê as exclusões da lista versionada. Se o
    // script deixar de chamá-lo, o Portão 2 vira decoração.
    const unit = (await scripts())['test:unit'] ?? ''

    assert.match(unit, /test-unit\.mjs/, 'a suíte unitária não passa pelo runner do limiar')
  })
})

describe('Nenhuma suíte de integração fica de fora do portão', () => {
  /**
   * A configuração do `vscode-test` lista os arquivos de integração **um a um**,
   * porque a ordem entre eles é requisito: a suíte de ativação precisa ser a
   * primeira a rodar, senão ela mede a segunda ativação da sessão e não a
   * primeira.
   *
   * O preço de listar à mão é o defeito clássico: arquivo novo não entra na
   * lista, não roda, e o portão continua verde. Este teste é quem cobra.
   *
   * A alternativa — um glob — foi o que estava em uso e NÃO funciona: medido em
   * 2026-08-20, `glob` devolveu `code-actions.test.js` antes de
   * `activation.test.js`. Ordem de `glob` não é alfabética.
   */
  async function configuredFiles(): Promise<string[]> {
    const raw = await readFile(join(REPO_ROOT, '.vscode-test.mjs'), 'utf8')
    return [...raw.matchAll(/out\/test\/integration\/([\w.-]+)\.test\.js/g)].map((m) => m[1]!)
  }

  async function versionedSuites(): Promise<string[]> {
    const { readdir } = await import('node:fs/promises')
    const dir = join(REPO_ROOT, 'packages', 'extension', 'test', 'integration')
    const entries = await readdir(dir)
    return entries.filter((n) => n.endsWith('.test.ts')).map((n) => n.slice(0, -'.test.ts'.length))
  }

  it('toda suíte de integração versionada está declarada na configuração', async () => {
    const declaradas = new Set(await configuredFiles())
    const faltando = (await versionedSuites()).filter((suite) => !declaradas.has(suite))

    assert.deepEqual(
      faltando,
      [],
      `suíte(s) de integração fora de .vscode-test.mjs, e portanto fora do portão: ${faltando.join(', ')}`,
    )
  })

  it('a suíte de ativação é a PRIMEIRA da lista', async () => {
    // Ela mede a primeira ativação da sessão. Abrir um fonte ADVPL antes dela
    // dispara `onLanguage`, a extensão ativa por fora, e a medição do orçamento
    // do Princípio I deixa de existir.
    const declaradas = await configuredFiles()

    assert.equal(declaradas[0], 'activation', `a lista começa por "${declaradas[0]}"`)
  })

  it('a configuração não declara arquivo que não existe', async () => {
    const versionadas = new Set(await versionedSuites())
    const orfas = (await configuredFiles()).filter((suite) => !versionadas.has(suite))

    assert.deepEqual(orfas, [], `a configuração aponta suíte inexistente: ${orfas.join(', ')}`)
  })
})

describe('A CI roda o que o portão local promete', () => {
  /**
   * O portão local e o pipeline são duas listas que precisam concordar, e
   * ninguém as liga — é a mesma família de defeito que já custou caro aqui: o
   * `verify` encadeava só `test:unit` e a integração ficava de fora sem que o
   * verde denunciasse.
   *
   * ⚠️ A CI **não** chama `npm run verify` de uma vez, e a razão está em
   * `memoria/armadilhas-do-ambiente.md`: os testes de relógio da integração
   * reprovam quando ela roda logo depois de centenas de testes unitários em
   * processos paralelos, sem que nada tenha regredido. Por isso as etapas são
   * quebradas em jobs, cada um numa máquina descansada.
   *
   * O preço dessa quebra é justamente o que este teste cobra: uma etapa pode
   * ficar de fora do pipeline e o verde continuar aparecendo.
   */
  const WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'verify.yml')

  async function workflow(): Promise<string> {
    return readFile(WORKFLOW, 'utf8')
  }

  /**
   * Só o que o pipeline EXECUTA, sem os comentários.
   *
   * O arquivo é comentado de propósito — ele carrega as razões de cada decisão,
   * inclusive a de NÃO rodar a medição. Uma busca de texto no arquivo inteiro
   * confundiria a explicação com a execução.
   */
  async function commandsInWorkflow(): Promise<string> {
    const NL = String.fromCharCode(10)
    return (await workflow())
      .split(NL)
      .filter((line) => !line.trim().startsWith('#'))
      .join(NL)
  }

  /** As etapas que o `verify` encadeia, extraídas dele mesmo. */
  async function verifySteps(): Promise<string[]> {
    const verify = (await scripts())['verify'] ?? ''
    return verify
      .split('&&')
      .map((part) => part.trim().replace(/^npm run /, ''))
      .filter((part) => part.length > 0)
  }

  it('o arquivo do pipeline existe', async () => {
    await assert.doesNotReject(() => workflow(), `esperava o pipeline em ${WORKFLOW}`)
  })

  it('toda etapa do verify aparece no pipeline', async () => {
    const yml = await commandsInWorkflow()
    const faltando = (await verifySteps()).filter((step) => !yml.includes(`npm run ${step}`))

    assert.deepEqual(
      faltando,
      [],
      `etapa(s) do verify fora da CI, e portanto fora do portão remoto: ${faltando.join(', ')}`,
    )
  })

  it('instala com `npm ci`, que exige o lock versionado', async () => {
    // `npm install` aceitaria um `package.json` divergente do lock e resolveria
    // versões diferentes das medidas aqui. `npm ci` reprova nesse caso — que é o
    // motivo de o lock ter passado a ser versionado.
    const yml = await commandsInWorkflow()

    assert.match(yml, /npm ci/)
    assert.ok(!/run: npm install\b/.test(yml), 'a CI usa `npm install`, que não exige o lock')
  })

  it('o `package-lock.json` está versionado', async () => {
    // `npm ci` falha sem ele, e o build deixa de ser reproduzível.
    const gitignore = await readFile(join(REPO_ROOT, '.gitignore'), 'utf8')
    const linhas = gitignore.split(/\r?\n/).map((l) => l.trim())

    assert.ok(
      !linhas.includes('package-lock.json'),
      'o lock voltou para o .gitignore — `npm ci` deixaria de funcionar na CI',
    )
    await assert.doesNotReject(() => readFile(join(REPO_ROOT, 'package-lock.json'), 'utf8'))
  })

  it('a integração roda sob display virtual', async () => {
    // Sem servidor gráfico o VS Code não abre no runner Linux, e a falha não se
    // parece com "falta display" — parece a extensão quebrada.
    const yml = await commandsInWorkflow()

    assert.match(yml, /xvfb-run/, 'a integração roda sem display virtual e morreria na abertura')
  })

  it('NÃO roda a medição de linha de base, que exige corpus local', async () => {
    // O corpus é externo e a constituição proíbe versioná-lo. Rodar `baseline`
    // na CI daria um portão vermelho por ausência de material que ele mesmo
    // proíbe trazer — e portão que fica vermelho à toa deixa de ser levado a
    // sério.
    const yml = await commandsInWorkflow()

    assert.ok(!yml.includes('npm run baseline'), 'a CI tenta medir sem corpus')
  })
})
