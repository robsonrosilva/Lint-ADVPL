import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import {
  createTranslator,
  loadBundles,
  normalizeLocale,
  MissingBaseBundleError,
} from '../../../src/l10n/messages'

const L10N_DIR = join(__dirname, '..', '..', '..', '..', 'l10n')

describe('Mensagens — carregamento dos pacotes', () => {
  it('carrega o pacote de cada um dos quatro idiomas', async () => {
    for (const locale of ['en', 'pt-br', 'es', 'ru']) {
      const { localized } = await loadBundles([L10N_DIR], locale)
      assert.ok(localized['rule.CA3001.message'], `faltou a mensagem de CA3001 em ${locale}`)
    }
  })

  it('entrega mensagens DIFERENTES em idiomas diferentes', async () => {
    // Sem isto, quatro arquivos idênticos passariam por "traduzido".
    const messages = await Promise.all(
      ['en', 'pt-br', 'es', 'ru'].map(async (l) => (await loadBundles([L10N_DIR], l)).localized['rule.CA3001.message']),
    )
    assert.equal(new Set(messages).size, 4, 'há idiomas com a mesma mensagem')
  })

  it('idioma desconhecido não quebra — recai no inglês', async () => {
    const { base, localized } = await loadBundles([L10N_DIR], 'ja')
    const t = createTranslator(base, localized)
    assert.equal(t('rule.CA3001.message'), base['rule.CA3001.message'])
  })
})

describe('Mensagens — tradução', () => {
  it('usa o idioma pedido quando ele tem a chave', () => {
    const t = createTranslator({ k: 'base' }, { k: 'traduzido' })
    assert.equal(t('k'), 'traduzido')
  })

  it('recai no inglês quando o idioma não tem a chave', () => {
    const t = createTranslator({ k: 'base' }, {})
    assert.equal(t('k'), 'base')
  })

  it('NUNCA devolve a chave crua enquanto o pacote base estiver íntegro', async () => {
    // O modo de falha que o Princípio V existe para impedir: identificador de
    // chave vazando para dentro do painel de problemas.
    const { base, localized } = await loadBundles([L10N_DIR], 'ru')
    const t = createTranslator(base, localized)
    const message = t('rule.CA3001.message')
    assert.notEqual(message, 'rule.CA3001.message')
    assert.ok(message.length > 0)
  })

  it('substitui argumentos nomeados', () => {
    const t = createTranslator({ k: 'valor {nome} e {outro}' }, {})
    assert.equal(t('k', { nome: 'A', outro: 2 }), 'valor A e 2')
  })

  it('deixa intacto o marcador cujo argumento não veio', () => {
    const t = createTranslator({ k: 'valor {nome}' }, {})
    assert.equal(t('k', { outro: 1 }), 'valor {nome}')
  })

  it('devolve a chave apenas se o pacote base estiver quebrado', () => {
    // Último degrau. Mensagem estranha é melhor que exceção no meio da análise.
    const t = createTranslator({}, {})
    assert.equal(t('k.desconhecida'), 'k.desconhecida')
  })
})

describe('Mensagens — identificador de localidade', () => {
  it('normaliza a caixa, porque errá-la não produz erro nenhum', () => {
    assert.equal(normalizeLocale('pt-BR'), 'pt-br')
    assert.equal(normalizeLocale('PT-br'), 'pt-br')
    assert.equal(normalizeLocale('ru'), 'ru')
  })

  it('sem idioma informado, usa inglês', () => {
    assert.equal(normalizeLocale(undefined), 'en')
    assert.equal(normalizeLocale(''), 'en')
  })
})

describe('Mensagens — pacote base ausente', () => {
  it('LANÇA em vez de degradar em silêncio', async () => {
    // Regressão de 2026-08-19: a versão anterior devolvia {} quando não achava
    // o arquivo. O servidor empacotado procurava no lugar errado, ninguém foi
    // avisado, e o painel de problemas do VS Code exibiu "rule.CA3001.message"
    // para o usuário. Falhar na inicialização, com o caminho no erro, é melhor
    // que virar texto estranho na tela.
    await assert.rejects(() => loadBundles([join(__dirname, 'nao-existe')], 'pt-br'), MissingBaseBundleError)
  })

  it('a mensagem do erro diz ONDE procurou', async () => {
    await assert.rejects(
      () => loadBundles([join(__dirname, 'nao-existe')], 'en'),
      /nao-existe/,
    )
  })

  it('usa o primeiro candidato que tiver o pacote base', async () => {
    const { base } = await loadBundles([join(__dirname, 'nao-existe'), L10N_DIR], 'en')
    assert.ok(base['rule.CA3001.message'])
  })
})
