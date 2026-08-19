---
description: "Lista de tarefas — spec 002"
---

# Tasks: Ações de correção + portabilidade de include

**Input**: documentos de design em `/specs/002-correcao-e-portabilidade-include/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/)

## ⚠️ Testes NÃO são opcionais

Princípio VI da constituição v2.4.0, **NÃO NEGOCIÁVEL**. Em toda tarefa abaixo:

- **A tarefa de teste vem antes da tarefa de código**, escrita para **falhar primeiro**.
- Asserção sobre diagnóstico compara identificador, severidade, linha e coluna do diagnóstico
  específico. Contagem agregada é proibida.
- **Cobertura mínima de 98%** em linhas, funções e ramos. Exclusão só por
  `coverage-exclusions.json`, com razão — e o runner lê essa lista, não uma cópia.
- ⚠️ **Rodar `npm run verify` ANTES de commitar, e condicionar o commit ao resultado.** Na spec 001
  isso falhou duas vezes por `;` no lugar de `&&`, e um commit afirmou "verify exit 0" sendo falso.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode correr em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1–US4 — rastreia a tarefa até a história da [spec.md](spec.md)
- Todo caminho de arquivo é literal e relativo à raiz do repositório

## Convenções

Monorepo de três workspaces. **Idioma**: identificadores, nomes de arquivo e chaves em inglês;
comentários, nomes de teste e documentação em pt-BR. Fixture autoral traz cabeçalho de autoria e
**no máximo 300 linhas** — caso maior é gerado em tempo de teste.

---

## Phase 1: Setup

**Purpose**: o que precisa existir antes do primeiro teste, sobre a estrutura que a spec 001 deixou.

- [ ] T001 [P] Criar `packages/server/test/fixtures/pj0001-caso-basico.prw`: fixture autoral com
      `#include "acadef.ch"` em caixa baixa e `#include "TOTVS.CH"` em caixa alta, cabeçalho de
      autoria declarado, CRLF
- [ ] T002 [P] Criar `packages/server/test/fixtures/pj0001-ambiguo.prw`: referência a um nome que
      existirá em dois diretórios com caixas diferentes
- [ ] T003 [P] Criar `packages/extension/test/fixtures/servers-com-sentinela.json`: um
      `servers.json` de mentira com `includes` válido E **valor sentinela reconhecível** em
      `savedTokens`, `permissions` e `connectedServer` — é a fixture do SC-016
- [ ] T004 Acrescentar ao manifesto as chaves escritas à mão desta spec em
      `packages/extension/package.json`: `advplLint.includePaths` (array) e
      `advplLint.fixAll.includeRules` (array de identificadores que participam do `source.fixAll`),
      com rótulo nos quatro arquivos `package.nls.*.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: o contrato de regra e a capacidade do servidor. **Bloqueia todas as histórias.**

### O contrato de regra aceita origem `projeto` (R5)

- [ ] T005 [P] Escrever em `packages/server/test/unit/rules/registry.test.ts`: regra `project` com
      `defaultSeverity` declarada é aceita e o registro devolve aquela severidade; regra `project`
      **sem** `defaultSeverity` é **rejeitada** com mensagem que cita o identificador (FR-035)
- [ ] T006 Implementar em `packages/server/src/rules/registry.ts` a exigência de `defaultSeverity`
      em regra `project`, mantendo intacta a derivação por tabela para regra `totvs`
- [ ] T007 Atualizar `specs/001-esqueleto-lsp-harness/contracts/regra.md` com a invariante nova —
      o contrato da 001 é o que o registro implementa, e ele passou a dizer mais

### A capacidade de ação de correção

- [ ] T008 [P] Escrever `packages/server/test/unit/actions/provider.test.ts`: o provedor devolve
      lista vazia quando não há diagnóstico no intervalo, e **não** oferece ação de regra desligada
      (FR-008)
- [ ] T009 Implementar o esqueleto de `packages/server/src/actions/provider.ts` e declarar
      `codeActionProvider` com `codeActionKinds: ['quickfix', 'source.fixAll']` em
      `packages/server/src/server.ts` ([contracts/acao-de-correcao.md](contracts/acao-de-correcao.md))

**Checkpoint**: o registro aceita regra `projeto` e o servidor anuncia que sabe corrigir.

---

## Phase 3: User Story 1 — A lâmpada corrige o `#INCLUDE` (P1) 🎯 MVP

**Goal**: do diagnóstico até a correção, na regra que já existe e cuja correção é provadamente
inerte.

**Independent Test**: abrir fixture com `#INCLUDE`, invocar a ação e conferir que o texto difere
**exatamente** nos caracteres da diretiva, com o diagnóstico sumindo sem salvar.

- [ ] T010 [P] [US1] Escrever `packages/server/test/unit/actions/ca3001-fix.test.ts`: a edição cobre
      só o token da diretiva; o nome do arquivo permanece byte a byte, inclusive a caixa (FR-010,
      FR-011)
- [ ] T011 [P] [US1] Escrever no mesmo arquivo o caso de idempotência: aplicar a correção a um texto
      já correto produz **zero** edições (FR-012)
- [ ] T012 [P] [US1] Escrever `packages/server/test/unit/actions/provider-quickfix.test.ts`: a ação
      vem com `kind: 'quickfix'`, vinculada ao diagnóstico que a originou, e com o identificador da
      regra visível (FR-004)
- [ ] T013 [P] [US1] Escrever o teste de versão obsoleta: edição calculada sobre a versão N é
      recusada quando o documento está em N+1 (FR-006, R7 — a `WorkspaceEdit` usa a forma
      versionada)
- [ ] T014 [P] [US1] Escrever o teste de preservação: fixture CP1252 com CRLF continua CP1252 com
      CRLF depois da correção, e nenhuma outra linha muda (FR-007)
- [ ] T015 [US1] Implementar `packages/server/src/actions/ca3001-fix.ts`
- [ ] T016 [US1] Ligar a correção ao provedor em `packages/server/src/actions/provider.ts`, com
      `documentChanges` e `OptionalVersionedTextDocumentIdentifier`
- [ ] T017 [P] [US1] Acrescentar a chave de título da ação aos quatro arquivos
      `packages/server/l10n/bundle.l10n*.json` (FR-009)
- [ ] T018 [P] [US1] Escrever o teste de integração em
      `packages/extension/test/integration/code-actions.test.ts`: a lâmpada aparece, aplica, e o
      diagnóstico some sem salvar (US1 cenários 1 e 2)

**Checkpoint**: existe correção automática funcionando ponta a ponta.

---

## Phase 4: User Story 2 — Corrigir todas do arquivo, e ao salvar (P2)

**Goal**: uma ação para o arquivo inteiro, que é o que habilita a correção ao salvar.

**Independent Test**: aplicar "corrigir tudo" numa fixture com N violações e conferir que as N são
corrigidas e revertidas por **um** desfazer.

- [ ] T019 [P] [US2] Escrever `packages/server/test/unit/actions/fix-all.test.ts`: a ação reúne
      todas as correções do documento numa `WorkspaceEdit` só, com as edições **ordenadas por
      posição** (FR-013, FR-016)
- [ ] T020 [P] [US2] Escrever no mesmo arquivo: documento sem violação produz **zero** edições
      (FR-015)
- [ ] T021 [P] [US2] Escrever o teste da chave de participação: regra fora de
      `advplLint.fixAll.includeRules` não entra na correção em massa, mesmo ligada (FR-018)
- [ ] T022 [US2] Implementar `source.fixAll` em `packages/server/src/actions/provider.ts`
- [ ] T023 [US2] Implementar a leitura da chave de participação em
      `packages/server/src/config/settings.ts`
- [ ] T024 [P] [US2] Escrever o teste de integração: "corrigir tudo" é revertido por **um** desfazer;
      `editor.codeActionsOnSave` produz o mesmo resultado (US2 cenários 1 e 2)
- [ ] T025 [P] [US2] Escrever o teste de integração do fonte grande: a correção ao salvar no arquivo
      gerado de 24.636 linhas não acrescenta atraso perceptível (US2 cenário 3, FR-017)

**Checkpoint**: US1 e US2 entregam o MVP desta spec, sem depender do índice.

---

## Phase 5: User Story 3 — A extensão avisa o que o padrão não vê (P3)

**Goal**: `PJ0001` — a primeira regra `projeto`, que compara a referência com o nome real no disco.

**Independent Test**: com diretório de includes controlado contendo `ACADEF.CH`, abrir fixture que
referencia `acadef.ch` e conferir o diagnóstico `PJ0001` com o intervalo exato e o nome real na
mensagem.

### A cadeia de fontes, no cliente (R1)

- [ ] T026 [P] [US3] Escrever `packages/extension/test/unit/include-sources/tds-vscode.test.ts`: a
      leitura devolve os caminhos de `includes`; arquivo ausente, JSON inválido e forma inesperada
      devolvem lista vazia **sem lançar** (FR-027d)
- [ ] T027 [P] [US3] Escrever **o teste do SC-016** no mesmo arquivo, usando a fixture do T003: o
      valor sentinela de `savedTokens` NÃO aparece no retorno, **nem no log capturado, nem no texto
      de qualquer exceção** (FR-027b1, FR-027b2)
- [ ] T028 [US3] Implementar `packages/extension/src/include-sources/tds-vscode.ts` — extrai os
      caminhos no ponto de leitura e **descarta o objeto ali**
      ([contracts/fontes-de-diretorios.md](contracts/fontes-de-diretorios.md))
- [ ] T029 [P] [US3] Escrever `packages/extension/test/unit/include-sources/advpl-vscode.test.ts`: lê
      `includeList` do ambiente apontado por `advpl.selectedEnvironment`; ambiente inexistente ou
      lista vazia devolvem vazio
- [ ] T030 [US3] Implementar `packages/extension/src/include-sources/advpl-vscode.ts`
- [ ] T031 [P] [US3] Escrever `packages/extension/test/unit/include-sources/chain.test.ts`: a cadeia
      para na primeira fonte **utilizável**; fonte presente e vazia faz **recuar**; diretório
      inexistente é descartado antes de contar (FR-027, FR-027a)
- [ ] T032 [P] [US3] Escrever no mesmo arquivo o caso medido na máquina de referência: fonte 1 valendo
      `[""]` e fonte 2 valendo `[]` recuam até a chave própria e depois até o workspace
- [ ] T033 [US3] Implementar `packages/extension/src/include-sources/chain.ts`,
      `own-setting.ts` e `workspace-scan.ts`
- [ ] T034 [P] [US3] Escrever o teste do relato ao usuário: a extensão informa **qual fonte** venceu e
      **quais diretórios** ela produziu (FR-027c)
- [ ] T035 [US3] Implementar o comando que exibe a fonte em uso em
      `packages/extension/src/include-sources/chain.ts`, registrado em
      `packages/extension/src/extension.ts`, com título nos quatro idiomas

### O índice, no servidor (R3, R4)

- [ ] T036 [P] [US3] Escrever `packages/server/test/unit/includes/scan.test.ts`: o percurso devolve o
      **nome real** lido da listagem do diretório, e o teste prova que uma consulta de existência
      pelo nome referenciado responderia errado (FR-020, R3)
- [ ] T037 [P] [US3] Escrever no mesmo arquivo: o percurso filtra por extensão **durante** a
      varredura, confere cancelamento entre diretórios e **para de fato** (FR-022, FR-023)
- [ ] T038 [US3] Implementar `packages/server/src/includes/scan.ts` com `opendir` assíncrono
- [ ] T039 [P] [US3] Escrever `packages/server/test/unit/includes/index-store.test.ts`: as três
      respostas — `encontrado`, `ausente`, `ambíguo` — e os três estados — `ausente`, `construindo`,
      `pronto` ([contracts/indice-de-includes.md](contracts/indice-de-includes.md))
- [ ] T040 [US3] Implementar `packages/server/src/includes/index-store.ts`
- [ ] T041 [P] [US3] Escrever `packages/server/test/unit/includes/watcher.test.ts`: criar, renomear e
      apagar invalidam **apenas o diretório afetado**, nunca o índice inteiro (FR-024)
- [ ] T042 [US3] Implementar `packages/server/src/includes/watcher.ts`, observando **diretórios**
- [ ] T043 [US3] Ligar o índice ao servidor em `packages/server/src/server.ts`: recebe os diretórios
      do cliente, indexa **sob demanda**, e revalida os documentos abertos quando o índice muda
      (FR-021, FR-025)

### A regra

- [ ] T044 [P] [US3] Escrever `packages/server/test/unit/rules/pj0001.test.ts`: dispara na
      divergência de caixa, com intervalo cobrindo **só o nome**, sem aspas e sem a diretiva
      (FR-028, FR-030)
- [ ] T045 [P] [US3] Escrever no mesmo arquivo os três silêncios: arquivo não encontrado (FR-032),
      referência ambígua (FR-033), e índice ainda não pronto (FR-023)
- [ ] T046 [US3] Implementar `packages/server/src/rules/pj0001.ts`, com `origin: 'project'`,
      `defaultSeverity: Warning` e a justificativa obrigatória do Princípio III
- [ ] T047 [US3] Registrar `PJ0001` **desligada por padrão** até a medição do T057 (FR-036)
- [ ] T048 [P] [US3] Acrescentar `rule.PJ0001.message` aos quatro `bundle.l10n*.json`, citando o nome
      real (FR-031)
- [ ] T049 [P] [US3] Escrever `docs/regras/PJ0001.md` — **o `check:docs` reprova sem isso**
- [ ] T050 [US3] Acrescentar `PJ0001` à região demarcada do `README.md` — **o `check:docs` também
      reprova sem isso**
- [ ] T051 [P] [US3] Escrever o teste de integração em
      `packages/extension/test/integration/pj0001.test.ts`: com diretório controlado, o diagnóstico
      aparece com o nome real na mensagem; a análise **não espera** pelo índice (US3 cenários 1 e 6)

**Checkpoint**: a extensão passa a apontar o que o padrão não vê.

---

## Phase 6: User Story 4 — A lâmpada ajusta a referência ao nome real (P4)

**Goal**: fechar o ciclo detectar → corrigir na regra que justifica a spec.

**Independent Test**: aplicar a ação sobre um `PJ0001` e conferir que a referência virou o nome real
lido do disco.

- [ ] T052 [P] [US4] Escrever `packages/server/test/unit/actions/pj0001-fix.test.ts`: a edição troca
      o nome pelo real e **não** toca na diretiva, no caminho nem nas aspas (FR-037, FR-038)
- [ ] T053 [P] [US4] Escrever no mesmo arquivo: a correção é **recusada** se o arquivo saiu do índice
      entre o diagnóstico e a aplicação (FR-039)
- [ ] T054 [US4] Implementar `packages/server/src/actions/pj0001-fix.ts`
- [ ] T055 [US4] Manter `PJ0001` **fora** do `source.fixAll` por padrão, com a chave que permite
      incluí-la (FR-040, D9)
- [ ] T056 [P] [US4] Escrever o teste de integração das duas correções na mesma linha: aplicar as
      duas produz `#include "ACADEF.CH"`, com intervalos disjuntos (US4 cenário 2)

---

## Phase 7: Medição, portões e documentação

**Purpose**: o Portão 4 da constituição — a linha de base reconferida porque uma regra entrou.

- [ ] T057 [P] Escrever `packages/tooling/test/harness/report.test.ts` para o esquema **versão 2**:
      campo novo com o custo da indexação, medido em separado do custo por documento (R8, FR-042)
- [ ] T058 Implementar o campo em `packages/tooling/src/harness/report.ts` e subir
      `SCHEMA_VERSION` para 2
- [ ] T059 Medir o custo de `PJ0001` e o da indexação sobre o corpus, com o harness que já existe
      (FR-041, FR-042)
- [ ] T060 Revisar a amostra de disparos de `PJ0001`, apurar a taxa de falso positivo e gravar o
      veredito em `.fp-review/PJ0001.verdict.json` (FR-036)
- [ ] T061 Decidir, **com o número na mão**, se `PJ0001` passa a ligada por padrão — e registrar a
      decisão na página da regra (FR-036)
- [ ] T062 Reconferir a linha de base e commitar
      `specs/001-esqueleto-lsp-harness/baseline/AAAA-MM-DD.{json,md}` novo (FR-043, Portão 4)
- [ ] T063 [P] Atualizar `README.md` com as ações de correção e a configuração nova
- [ ] T064 Rodar `npm run verify` inteiro, **sem cano**, e registrar no relatório o que foi executado

---

## Phase 8: Fechamento

- [ ] T065 [P] Atualizar `specs/README.md` e `memoria/` com o que a implementação produziu
- [ ] T066 Rodar `/speckit-converge` — **obrigatória**, antes da revisão e do merge
- [ ] T067 Rodar `/security-review`, com atenção ao FR-027b1 e FR-027b2

---

## Dependencies & Execution Order

### Entre fases

- **Phase 1 (Setup)**: sem dependência
- **Phase 2 (Foundational)**: depende da Phase 1. **BLOQUEIA todas as histórias**
- **Phase 3 (US1)**: depende da Phase 2
- **Phase 4 (US2)**: depende da US1 — o "corrigir tudo" reúne correções que precisam existir
- **Phase 5 (US3)**: depende da Phase 2. **NÃO depende da US1 nem da US2**
- **Phase 6 (US4)**: depende da US3 (a regra) e da US1 (o caminho de correção)
- **Phase 7**: depende de US3 e US4
- **Phase 8**: por último

### A corrente mais longa

`T005 → T006` (contrato) → `T026…T033` (cadeia) → `T036…T043` (índice) → `T044…T047` (regra) →
`T052…T055` (correção) → `T059…T062` (medição). É o caminho crítico da spec, e o índice é a parte
cara.

### Oportunidades de paralelismo

| Bloco | Tarefas que correm juntas |
| ----- | ------------------------- |
| Fixtures | T001, T002, T003 |
| Testes da US1 | T010, T011, T012, T013, T014 |
| Testes da US2 | T019, T020, T021 |
| Cadeia de fontes | T026, T027, T029, T031, T032, T034 |
| Índice | T036, T037, T039, T041 |
| Regra | T044, T045 |
| Documentação | T048, T049, T063 |

⚠️ **Um par teste/código nunca é paralelo consigo mesmo.** T010 e T015 são sequenciais por
construção — o teste precisa estar vermelho antes de a implementação começar.

---

## Implementation Strategy

### MVP primeiro (US1 + US2)

As duas primeiras histórias **não dependem do índice** e entregam a extensão consertando o que
aponta. É metade da spec, pela metade do risco.

### Entrega incremental

1. Fases 1 e 2 → o contrato aceita regra `projeto` e o servidor sabe corrigir
2. US1 → existe correção automática
3. US2 → existe correção em massa, e a correção ao salvar passa a funcionar
4. US3 → a extensão aponta o que o padrão não vê **(a parte cara)**
5. US4 → o ciclo fecha
6. Fases 7 e 8 → medido, documentado, convergido e revisado

### O que vigiar durante a implementação

- **O observador de sistema de arquivos** (T042) é onde esta spec tem mais chance de reproduzir o
  defeito que matou a versão anterior. Observar diretórios, nunca arquivos.
- **A análise não pode esperar pelo índice** (T043). Um `await` ali faz a primeira abertura de
  arquivo esperar por dezenas de milhares de leituras de disco.
- **O teste do SC-016** (T027) precisa capturar log e exceção, não só o retorno. É onde o vazamento
  aconteceria de verdade.
- **`check:docs` reprova** assim que `PJ0001` for registrada e antes de T049 e T050. É esperado — o
  portão está fazendo o trabalho dele.

## Notes

- **Nunca canalizar a saída do teste.** `npm test | tail` devolve o código de saída do `tail`.
- **Rodar `npm run verify` antes de commitar, com o commit condicionado ao resultado** — em
  QUALQUER branch. O `.gitignore` viaja com a branch, e uma branch antiga tem regras antigas.
- **Teto absoluto de tempo em teste mede a máquina.** Três testes da spec 001 caíram nisso. Use
  comparação relativa ou percentil.
- Nada de `analise-advpl/` entra como código ou dependência.
- Nenhum fonte do corpus entra no repositório, em nenhuma forma.
