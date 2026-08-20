import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import {
  DOCS_DIR,
  findDocsProblems,
  findReadmeProblems,
  listRuleDocs,
  readmeRuleIds,
  registeredRuleIds,
} from '../../src/checks/docs'

// __dirname aponta para packages/tooling/out/test/checks — cinco níveis até a raiz.
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..')

describe('Sincronismo de documentação — o repositório de verdade (Portão 6)', () => {
  it('toda regra registrada tem página, e toda página tem regra', async () => {
    const problems = await findDocsProblems({
      ruleIds: registeredRuleIds(),
      docFiles: await listRuleDocs(REPO_ROOT),
    })

    assert.deepEqual(problems, [], `documentação fora de sincronia:\n${problems.join('\n')}`)
  })

  it('encontra as páginas de regra no lugar combinado', async () => {
    const docs = await listRuleDocs(REPO_ROOT)

    assert.ok(docs.includes('CA3001'), `páginas encontradas: ${docs.join(', ')}`)
    assert.equal(DOCS_DIR, 'docs/regras')
  })

  it('lê os identificadores do registro de regras, não de uma lista à mão', () => {
    // Se a lista fosse escrita aqui, ela seria só mais um lugar para esquecer
    // de atualizar — e o portão passaria a proteger a si mesmo em vez do
    // produto.
    assert.deepEqual(registeredRuleIds(), ['CA3001', 'PJ0001'])
  })
})

describe('Sincronismo de documentação — falha nos DOIS sentidos', () => {
  it('acusa regra registrada sem página', async () => {
    // O usuário clica no identificador do diagnóstico e cai numa página que não
    // existe. É pior que não ter link.
    const problems = await findDocsProblems({ ruleIds: ['CA3001', 'PJ0001'], docFiles: ['CA3001'] })

    assert.ok(problems.some((p) => p.includes('PJ0001') && /sem página|não existe/i.test(p)))
  })

  it('acusa página sem regra correspondente', async () => {
    // Documentação de regra que já saiu do produto, ou que nunca entrou:
    // promete ao leitor um comportamento que o código não tem.
    const problems = await findDocsProblems({ ruleIds: ['CA3001'], docFiles: ['CA3001', 'CA9999'] })

    assert.ok(problems.some((p) => p.includes('CA9999') && /não (existe|há) regra|órf/i.test(p)))
  })

  it('não reclama quando os dois lados batem', async () => {
    const problems = await findDocsProblems({ ruleIds: ['CA3001'], docFiles: ['CA3001'] })

    assert.deepEqual(problems, [])
  })

  it('acusa os dois sentidos de uma vez', async () => {
    const problems = await findDocsProblems({ ruleIds: ['CA3001'], docFiles: ['CA9999'] })

    assert.equal(problems.length, 2)
  })

  it('a ordem das listas não importa', async () => {
    const problems = await findDocsProblems({
      ruleIds: ['PJ0001', 'CA3001'],
      docFiles: ['CA3001', 'PJ0001'],
    })

    assert.deepEqual(problems, [])
  })
})

describe('Sincronismo do README (Portão 6, ao pé da letra)', () => {
  it('o README lista exatamente as regras que o produto entrega', async () => {
    // "Regra que existe no código mas não no README, ou descrita no README e
    // ausente do código, bloqueia o merge. Vale nos dois sentidos."
    const { readFile } = await import('node:fs/promises')
    const readme = await readFile(join(REPO_ROOT, 'README.md'), 'utf8')

    const problems = findReadmeProblems(registeredRuleIds(), readme)

    assert.deepEqual(problems, [], `README fora de sincronia:\n${problems.join('\n')}`)
  })

  it('lê os identificadores só da região demarcada', () => {
    // O resto do README fala do backlog à vontade — citar uma regra futura em
    // prosa não pode reprovar o build.
    const readme = [
      'texto solto citando CA9999 no meio da prosa',
      '<!-- regras:início -->',
      '| `CA3001` | ... |',
      '<!-- regras:fim -->',
      'e o backlog menciona PJ0001 e CA2050',
    ].join('\n')

    assert.deepEqual(readmeRuleIds(readme), ['CA3001'])
  })

  it('acusa regra entregue que o README não lista', () => {
    const readme = '<!-- regras:início -->\n| `CA3001` |\n<!-- regras:fim -->'

    const problems = findReadmeProblems(['CA3001', 'PJ0001'], readme)

    assert.ok(problems.some((p) => p.includes('PJ0001')))
  })

  it('acusa regra listada no README que o produto não tem', () => {
    const readme = '<!-- regras:início -->\n| `CA3001` |\n| `CA1004` |\n<!-- regras:fim -->'

    const problems = findReadmeProblems(['CA3001'], readme)

    assert.ok(problems.some((p) => p.includes('CA1004')))
  })

  it('acusa README sem a região demarcada', () => {
    // Sem os marcadores não há o que conferir, e um portão que não confere nada
    // passando em silêncio é pior que portão nenhum.
    const problems = findReadmeProblems(['CA3001'], '# README sem marcadores')

    assert.ok(problems.some((p) => /marcador|regi[ãa]o/i.test(p)))
  })
})
