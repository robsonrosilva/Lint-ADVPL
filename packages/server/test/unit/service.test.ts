import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DiagnosticSeverity, type Diagnostic } from 'vscode-languageserver-types'

import { DiagnosticsService, DEFAULT_DEBOUNCE_MS, type PublishedDiagnostics } from '../../src/service'
import { RuleRegistry } from '../../src/rules/registry'
void DEFAULT_DEBOUNCE_MS
import { ca3001 } from '../../src/rules/ca3001'
import { assertDiagnostics } from '../support/assert-diagnostic'

function serviceWith(overrides: { debounceMs?: number } = {}) {
  const registry = new RuleRegistry()
  registry.register(ca3001)

  const published: PublishedDiagnostics[] = []
  const service = new DiagnosticsService({
    registry,
    publish: (payload) => published.push(payload),
    translate: (rule) => `mensagem de ${rule.id}`,
    docHrefOf: (rule) => `https://docs/${rule.id}.md`,
    isEnabled: () => true,
    severityOf: (rule) => rule.defaultSeverity,
    debounceMs: overrides.debounceMs ?? 1,
  })
  return { service, published }
}

const DOC = { uri: 'file:///p.prw', languageId: 'advpl', version: 1 }

function lastOf(published: PublishedDiagnostics[]): Diagnostic[] {
  return published[published.length - 1]?.diagnostics ?? []
}

describe('Serviço — publicação de diagnóstico', () => {
  it('publica o diagnóstico ao abrir o documento', async () => {
    const { service, published } = serviceWith()
    service.open({ ...DOC, text: '// topo\n#INCLUDE "TOTVS.CH"\n' })
    await service.whenIdle()

    assert.equal(published.length, 1)
    assert.equal(published[0]?.uri, DOC.uri)
    assertDiagnostics(lastOf(published), [
      {
        code: 'CA3001',
        severity: DiagnosticSeverity.Information,
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 8 } },
      },
    ])
  })

  it('some com o diagnóstico quando o texto é corrigido, sem salvar', async () => {
    // US1, cenário 2. A análise vê o BUFFER, não o disco.
    const { service, published } = serviceWith()
    service.open({ ...DOC, text: '#INCLUDE "TOTVS.CH"\n' })
    await service.whenIdle()
    assert.equal(lastOf(published).length, 1)

    service.change({ ...DOC, version: 2, text: '#include "totvs.ch"\n' })
    await service.whenIdle()
    assertDiagnostics(lastOf(published), [])
  })

  it('limpa os diagnósticos ao fechar o documento', async () => {
    const { service, published } = serviceWith()
    service.open({ ...DOC, text: '#INCLUDE "X.CH"\n' })
    await service.whenIdle()

    service.close(DOC.uri)
    assertDiagnostics(lastOf(published), [])
  })
})

describe('Serviço — reanálise espaçada', () => {
  it('agrupa uma rajada de digitação numa análise só', async () => {
    // FR-005. Sem debounce, cada tecla dispararia uma análise completa — que é
    // como o editor engasga.
    const { service, published } = serviceWith({ debounceMs: 20 })
    service.open({ ...DOC, text: '#INCLUDE "A.CH"\n' })
    await service.whenIdle()
    const afterOpen = published.length

    for (let version = 2; version <= 12; version += 1) {
      service.change({ ...DOC, version, text: `#INCLUDE "A.CH"\n// tecla ${version}\n` })
    }
    await service.whenIdle()

    assert.equal(
      published.length - afterOpen,
      1,
      `11 alterações produziram ${published.length - afterOpen} publicações; deveriam produzir 1`,
    )
  })

  it('o resultado publicado corresponde ao ÚLTIMO texto, não a um intermediário', async () => {
    const { service, published } = serviceWith({ debounceMs: 10 })
    service.open({ ...DOC, text: '#INCLUDE "A.CH"\n' })
    await service.whenIdle()

    service.change({ ...DOC, version: 2, text: '#INCLUDE "A.CH"\n#INCLUDE "B.CH"\n' })
    service.change({ ...DOC, version: 3, text: '#include "a.ch"\n' })
    await service.whenIdle()

    // A versão 3 não tem violação nenhuma. Se o resultado da versão 2 vazasse,
    // apareceriam dois diagnósticos sobre um texto que já não está na tela.
    assertDiagnostics(lastOf(published), [])
    assert.equal(published[published.length - 1]?.version, 3)
  })

  it('nunca publica resultado de versão vencida', async () => {
    const { service, published } = serviceWith({ debounceMs: 1 })
    service.open({ ...DOC, text: '#INCLUDE "A.CH"\n' })
    await service.whenIdle()

    service.change({ ...DOC, version: 2, text: Array.from({ length: 8000 }, () => '#INCLUDE "A.CH"').join('\n') })
    service.change({ ...DOC, version: 3, text: '// sem violacao\n' })
    await service.whenIdle()

    const versions = published.map((p) => p.version)
    assert.deepEqual(
      [...versions].sort((a, b) => a - b),
      versions,
      `as versões publicadas andaram para trás: ${versions.join(', ')}`,
    )
    assertDiagnostics(lastOf(published), [])
  })
})

describe('Serviço — linguagens', () => {
  it('analisa advpl e tlpp', async () => {
    const { service, published } = serviceWith()
    service.open({ uri: 'file:///a.tlpp', languageId: 'tlpp', version: 1, text: '#INCLUDE "X.CH"\n' })
    await service.whenIdle()
    assert.equal(lastOf(published).length, 1)
  })

  it('ignora documento de linguagem que não é nossa', async () => {
    // Defesa em profundidade: a ativação já é restrita por linguagem, mas o
    // servidor não confia nisso para decidir o que analisar.
    const { service, published } = serviceWith()
    service.open({ uri: 'file:///a.js', languageId: 'javascript', version: 1, text: '#INCLUDE "X.CH"\n' })
    await service.whenIdle()
    assert.equal(published.length, 0)
  })
})

describe('Serviço — ciclo de vida', () => {
  it('descarta trabalho pendente ao ser encerrado', async () => {
    // Encerrar o servidor com análise agendada não pode deixar temporizador
    // vivo nem publicar depois do adeus.
    const { service, published } = serviceWith({ debounceMs: 50 })
    service.open({ ...DOC, text: '#INCLUDE "A.CH"\n' })
    await service.whenIdle()
    const afterOpen = published.length

    service.change({ ...DOC, version: 2, text: '#INCLUDE "A.CH"\n#INCLUDE "B.CH"\n' })
    service.dispose()
    await new Promise((resolve) => setTimeout(resolve, 120))

    assert.equal(published.length, afterOpen, 'publicou depois do dispose')
  })

  it('fechar documento que nunca foi aberto não quebra', () => {
    const { service, published } = serviceWith()
    service.close('file:///nunca-aberto.prw')
    assert.equal(published.length, 1, 'fechar sempre limpa o painel daquele documento')
    assertDiagnostics(lastOf(published), [])
  })

  it('alterar documento de linguagem não suportada é ignorado', () => {
    const { service, published } = serviceWith()
    service.change({ uri: 'file:///a.md', languageId: 'markdown', version: 2, text: '#INCLUDE "X.CH"' })
    assert.equal(published.length, 0)
  })

  it('whenIdle retorna de imediato quando não há nada pendente', async () => {
    const { service } = serviceWith()
    const started = performance.now()
    await service.whenIdle()
    assert.ok(performance.now() - started < 50)
  })

  it('não publica análise de documento fechado no meio do caminho', async () => {
    // O usuário fecha a aba enquanto a análise roda. Publicar depois disso
    // repovoaria o painel com um arquivo que já não está aberto.
    const { service, published } = serviceWith({ debounceMs: 5 })
    service.open({ ...DOC, text: Array.from({ length: 5000 }, () => '#INCLUDE "A.CH"').join('\n') })
    service.close(DOC.uri)
    await service.whenIdle()

    assertDiagnostics(lastOf(published), [])
  })
})

describe('Serviço — padrões', () => {
  it('usa o espaçamento padrão quando nenhum é informado', async () => {
    // O padrão precisa ser exercitado: se ele estivesse errado, todos os testes
    // acima continuariam verdes, porque todos informam o valor.
    const registry = new RuleRegistry()
    registry.register(ca3001)
    const published: PublishedDiagnostics[] = []
    const service = new DiagnosticsService({
      registry,
      publish: (payload) => published.push(payload),
      translate: (rule) => rule.id,
      docHrefOf: (rule) => rule.id,
      isEnabled: () => true,
      severityOf: (rule) => rule.defaultSeverity,
    })

    service.open({ ...DOC, text: '#INCLUDE "X.CH"\n' })
    await service.whenIdle()
    assert.equal(lastOf(published).length, 1)
    service.dispose()
  })

  it('encerrar sem nada pendente não quebra', () => {
    const { service } = serviceWith()
    assert.doesNotThrow(() => service.dispose())
  })

  it('uma nova alteração durante a análise não perde o agendamento', async () => {
    const { service, published } = serviceWith({ debounceMs: 2 })
    service.open({ ...DOC, text: '#INCLUDE "A.CH"\n' })
    service.change({ ...DOC, version: 2, text: '#INCLUDE "A.CH"\n#INCLUDE "B.CH"\n' })
    await service.whenIdle()
    assert.equal(lastOf(published).length, 2)
    assert.equal(published[published.length - 1]?.version, 2)
  })
})
