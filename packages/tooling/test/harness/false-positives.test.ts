import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  REVIEW_DIR,
  aggregateHits,
  readVerdict,
  verdictFileName,
  writeReviewMaterial,
  type RuleHit,
} from '../../src/harness/false-positives'

function hits(): RuleHit[] {
  return [
    { ruleId: 'CA3001', path: 'D:\\Workspace\\FONTES\\MATA410.PRW', line: 3, excerpt: '#INCLUDE "TOTVS.CH"' },
    { ruleId: 'CA3001', path: 'D:\\Workspace\\FONTES\\MATA420.PRW', line: 7, excerpt: '#INCLUDE "ACADEF.CH"' },
    { ruleId: 'CA3001', path: 'D:\\Workspace\\FONTES\\MATA430.PRW', line: 1, excerpt: '#INCLUDE "PROTHEUS.CH"' },
  ]
}

describe('Revisão de falso positivo — o material fica FORA do repositório (FR-023)', () => {
  it('grava o material de revisão no diretório local combinado', async () => {
    // Apurar taxa de falso positivo exige olhar o trecho que disparou. Se esse
    // material fosse versionado, ele seria uma cópia parcial do corpus — que é
    // exatamente como esse tipo de vazamento acontece na prática.
    const dir = await mkdtemp(join(tmpdir(), 'advpl-fp-'))
    try {
      const written = await writeReviewMaterial(hits(), { dir, sampleSize: 3 })

      const files = await readdir(dir)
      assert.ok(files.length > 0)
      assert.ok(written.path.startsWith(dir))

      const raw = await readFile(written.path, 'utf8')
      assert.match(raw, /MATA410/, 'o material de revisão PRECISA do trecho — por isso é local')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('o diretório de revisão está ignorado pelo versionamento', async () => {
    const repoRoot = join(__dirname, '..', '..', '..', '..', '..')
    const gitignore = await readFile(join(repoRoot, '.gitignore'), 'utf8')

    assert.ok(gitignore.includes(REVIEW_DIR), `${REVIEW_DIR} precisa estar no .gitignore`)
  })

  it('grava material vazio sem quebrar quando não houve disparo', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'advpl-fp-'))
    try {
      const written = await writeReviewMaterial([], { dir, sampleSize: 10 })

      assert.equal(written.sampled, 0)
      const raw = await readFile(written.path, 'utf8')
      assert.match(raw, /0/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('leva todos os disparos quando a amostra pedida é maior que eles', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'advpl-fp-'))
    try {
      const written = await writeReviewMaterial(hits(), { dir, sampleSize: 99 })

      assert.equal(written.sampled, 3)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('limita o material à amostra pedida', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'advpl-fp-'))
    try {
      const written = await writeReviewMaterial(hits(), { dir, sampleSize: 2 })

      assert.equal(written.sampled, 2)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('Veredito da revisão — o resultado do olho humano volta ao relatório', () => {
  it('não há veredito quando ninguém revisou ainda', async () => {
    // E isso precisa ser distinguível de "revisou e não achou nada": o relatório
    // diz "0 revisados", que é honesto, em vez de uma taxa que ninguém apurou.
    const dir = await mkdtemp(join(tmpdir(), 'advpl-fp-'))
    try {
      assert.equal(await readVerdict(dir, 'CA3001'), null)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('lê o veredito gravado ao lado do material de revisão', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'advpl-fp-'))
    try {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(
        join(dir, verdictFileName('CA3001')),
        JSON.stringify({ reviewed: 120, falsePositives: 0 }),
        'utf8',
      )

      const verdict = await readVerdict(dir, 'CA3001')

      assert.deepEqual(verdict, { reviewed: 120, falsePositives: 0 })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('recusa veredito malformado em vez de tratá-lo como zero', async () => {
    // Um veredito ilegível que virasse "0 revisados" faria o relatório mentir em
    // silêncio — e a taxa de falso positivo decide se a regra fica ligada por
    // padrão (Princípio III).
    const dir = await mkdtemp(join(tmpdir(), 'advpl-fp-'))
    try {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(join(dir, verdictFileName('CA3001')), '{ quebrado', 'utf8')

      await assert.rejects(() => readVerdict(dir, 'CA3001'), /veredito/i)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('recusa veredito com números impossíveis', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'advpl-fp-'))
    try {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(
        join(dir, verdictFileName('CA3001')),
        JSON.stringify({ reviewed: 10, falsePositives: 40 }),
        'utf8',
      )

      await assert.rejects(() => readVerdict(dir, 'CA3001'), /veredito/i)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('recusa veredito sem os dois números', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'advpl-fp-'))
    try {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(join(dir, verdictFileName('CA3001')), JSON.stringify({ reviewed: 10 }), 'utf8')

      await assert.rejects(() => readVerdict(dir, 'CA3001'), /veredito/i)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('Revisão de falso positivo — do relatório sobe só o agregado (FR-022)', () => {
  it('o agregado carrega apenas números e o identificador da regra', () => {
    const aggregate = aggregateHits('CA3001', { hits: 11_006, reviewed: 120, falsePositives: 3 })

    assert.deepEqual(Object.keys(aggregate).sort(), [
      'falsePositives',
      'hits',
      'rate',
      'reviewed',
      'ruleId',
    ])
  })

  it('calcula a taxa sobre o que foi revisado, não sobre o total', () => {
    // A taxa é uma estimativa amostral. Dividir pelo total de disparos daria um
    // número menor e falso — e a decisão de ligar a regra por padrão depende
    // dele (Princípio III).
    const aggregate = aggregateHits('CA3001', { hits: 11_006, reviewed: 120, falsePositives: 3 })

    assert.equal(aggregate.rate, 0.025)
  })

  it('taxa zero quando nada foi revisado, sem divisão por zero', () => {
    const aggregate = aggregateHits('CA3001', { hits: 0, reviewed: 0, falsePositives: 0 })

    assert.equal(aggregate.rate, 0)
  })

  it('recusa contagem impossível de falso positivo', () => {
    assert.throws(
      () => aggregateHits('CA3001', { hits: 10, reviewed: 5, falsePositives: 9 }),
      /revisad/i,
    )
  })

  it('recusa ter revisado mais do que disparou', () => {
    assert.throws(
      () => aggregateHits('CA3001', { hits: 3, reviewed: 8, falsePositives: 0 }),
      /disparo/i,
    )
  })
})

describe('Revisão — um arquivo POR REGRA (spec 002)', () => {
  const misturados: RuleHit[] = [
    { ruleId: 'CA3001', path: 'D:\FONTES\A.PRW', line: 3, excerpt: '#INCLUDE "TOTVS.CH"' },
    { ruleId: 'PJ0001', path: 'D:\FONTES\A.PRW', line: 4, excerpt: '#include "acadef.ch"' },
    { ruleId: 'PJ0001', path: 'D:\FONTES\B.PRW', line: 9, excerpt: '#include "fwmvcdef.ch"' },
  ]

  it('separa os disparos por regra, um arquivo para cada', async () => {
    // Com duas regras, um arquivo só juntaria os disparos das duas sob o nome
    // da primeira — e a taxa apurada falaria de um material que mistura duas
    // perguntas diferentes. O revisor precisa julgar uma regra de cada vez.
    const dir = await mkdtemp(join(tmpdir(), 'advpl-fp-'))
    try {
      const written = await writeReviewMaterial(misturados, { dir, sampleSize: 10 })

      const files = (await readdir(dir)).sort()
      assert.deepEqual(files, ['CA3001.md', 'PJ0001.md'])

      const ca = await readFile(join(dir, 'CA3001.md'), 'utf8')
      const pj = await readFile(join(dir, 'PJ0001.md'), 'utf8')

      assert.match(ca, /#INCLUDE "TOTVS\.CH"/)
      assert.ok(!ca.includes('acadef.ch'), 'disparo de PJ0001 vazou para o material de CA3001')
      assert.match(pj, /acadef\.ch/)
      assert.match(pj, /fwmvcdef\.ch/)
      assert.ok(!pj.includes('#INCLUDE "TOTVS.CH"'))

      assert.equal(written.sampled, 3, 'a contagem devolvida deveria somar as duas regras')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('a amostragem é POR REGRA: a regra rara não some atrás da comum', async () => {
    // Com um teto global, uma regra que dispara dez vezes menos que a outra
    // ficaria com um punhado de casos — e a taxa dela não valeria nada.
    const muitos: RuleHit[] = [
      ...Array.from({ length: 50 }, (_, i) => ({
        ruleId: 'CA3001',
        path: `D:\FONTES\C${i}.PRW`,
        line: 1,
        excerpt: '#INCLUDE "TOTVS.CH"',
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        ruleId: 'PJ0001',
        path: `D:\FONTES\P${i}.PRW`,
        line: 2,
        excerpt: '#include "acadef.ch"',
      })),
    ]

    const dir = await mkdtemp(join(tmpdir(), 'advpl-fp-'))
    try {
      await writeReviewMaterial(muitos, { dir, sampleSize: 10 })

      const pj = await readFile(join(dir, 'PJ0001.md'), 'utf8')
      const linhasDeTabela = pj.split('\n').filter((l) => l.startsWith('| ') && /\| \d+ \|/.test(l))

      assert.equal(linhasDeTabela.length, 5, 'PJ0001 ficou com menos casos do que tinha para revisar')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('sem disparo nenhum, grava um material vazio e não quebra', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'advpl-fp-'))
    try {
      const written = await writeReviewMaterial([], { dir, sampleSize: 10 })

      assert.equal(written.sampled, 0)
      const raw = await readFile(written.path, 'utf8')
      assert.match(raw, /0/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
