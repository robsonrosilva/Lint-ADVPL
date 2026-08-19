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
