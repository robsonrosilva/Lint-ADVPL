---
description: "Lista de tarefas — spec 002"
---

# Tasks: Ações de correção + portabilidade de include

**Input**: documentos de design em `/specs/002-correcao-e-portabilidade-include/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/)

**Revisado pela `/speckit-analyze`** em 2026-08-19: duas lacunas de cobertura viraram tarefa
(`T009`/`T010` para o FR-002, `T047` para o FR-026), o SC-001 ganhou medição em `T021`, e as
citações de requisito passaram a constar em toda tarefa que os realiza.

## ⚠️ Testes NÃO são opcionais

Princípio VI da constituição v2.4.0 e **FR-046** desta spec, **NÃO NEGOCIÁVEL**. Em toda tarefa
abaixo:

- **A tarefa de teste vem antes da tarefa de código**, escrita para **falhar primeiro** (FR-046).
  Este requisito governa o artefato inteiro e por isso não tem tarefa própria — ele é a regra de
  formação da lista, não um item dela.
- Asserção sobre diagnóstico compara identificador, severidade, linha e coluna do diagnóstico
  específico. Contagem agregada é proibida (FR-029 da spec 001).
- **Cobertura mínima de 98%** em linhas, funções e ramos (SC-012). Exclusão só por
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

**Sobre o FR-003** (o cálculo das ações não faz I/O síncrono, não registra log e não ocupa o laço por
mais de 50 ms sem ceder): as duas primeiras metades são impostas por **lint** sobre
`packages/server/src` e não precisam de tarefa própria. A terceira não tem tarefa dedicada porque o
cálculo de uma ação percorre os diagnósticos de um documento, não o texto — se um dia percorrer,
esta decisão precisa ser revista.

---

## Phase 1: Setup

**Purpose**: o que precisa existir antes do primeiro teste, sobre a estrutura que a spec 001 deixou.

- [ ] T001 [P] Criar `packages/server/test/fixtures/pj0001-caso-basico.prw`: fixture **autoral**
      (FR-045, SC-013) com `#include "acadef.ch"` em caixa baixa e `#include "TOTVS.CH"` em caixa
      alta, cabeçalho de autoria declarado, CRLF
- [ ] T002 [P] Criar `packages/server/test/fixtures/pj0001-ambiguo.prw`: fixture **autoral**
      (FR-045, SC-013) com referência a um nome que existirá em dois diretórios com caixas diferentes
- [ ] T003 [P] Criar `packages/extension/test/fixtures/servers-com-sentinela.json`: um
      `servers.json` de mentira com `includes` válido E **valor sentinela reconhecível** em
      `savedTokens`, `permissions` e `connectedServer` — é a fixture do SC-016
- [ ] T004 Acrescentar ao manifesto as chaves escritas à mão desta spec em
      `packages/extension/package.json`: `advplLint.includePaths` (array, definível por workspace —
      FR-027e) e `advplLint.fixAll.includeRules` (array de identificadores que participam do
      `source.fixAll` — FR-018), com rótulo nos quatro arquivos `package.nls.*.json` (SC-011)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: o contrato de regra e a capacidade do servidor. **Bloqueia todas as histórias.**

### O contrato de regra aceita origem `projeto` (R5)

- [ ] T005 [P] Escrever em `packages/server/test/unit/rules/registry.test.ts`: regra `project` com
      `defaultSeverity` declarada é aceita e o registro devolve aquela severidade; regra `project`
      **sem** `defaultSeverity` é **rejeitada** com mensagem que cita o identificador (FR-035)
- [ ] T006 Implementar em `packages/server/src/rules/registry.ts` a exigência de `defaultSeverity`
      em regra `project`, mantendo intacta a derivação por tabela para regra `totvs` (FR-035)
- [ ] T007 Atualizar `specs/001-esqueleto-lsp-harness/contracts/regra.md` com a invariante nova —
      o contrato da 001 é o que o registro implementa, e ele passou a dizer mais

### A capacidade de ação de correção

- [ ] T008 [P] Escrever `packages/server/test/unit/actions/provider.test.ts`: o provedor devolve
      lista vazia quando não há diagnóstico no intervalo, e **não** oferece ação de regra desligada
      (FR-008)
- [ ] T009 [P] Escrever no mesmo arquivo o teste de **cancelamento** (FR-002): pedido de ações
      substituído por outro é **abandonado de fato** — o teste conta o trabalho feito depois do
      cancelamento, não apenas confere que o resultado foi descartado. É a distinção que o Princípio
      I cobra, e é o defeito que matou a versão anterior
- [ ] T010 Implementar `packages/server/src/actions/provider.ts` com o esqueleto e o respeito ao
      `CancellationToken` (FR-001, FR-002), e declarar `codeActionProvider` com
      `codeActionKinds: ['quickfix', 'source.fixAll']` em `packages/server/src/server.ts`
      ([contracts/acao-de-correcao.md](contracts/acao-de-correcao.md))

**Checkpoint**: o registro aceita regra `projeto` e o servidor anuncia que sabe corrigir.

---

## Phase 3: User Story 1 — A lâmpada corrige o `#INCLUDE` (P1) 🎯 MVP

**Goal**: do diagnóstico até a correção, na regra que já existe e cuja correção é provadamente
inerte.

**Independent Test**: abrir fixture com `#INCLUDE`, invocar a ação e conferir que o texto difere
**exatamente** nos caracteres da diretiva, com o diagnóstico sumindo sem salvar.

- [ ] T011 [P] [US1] Escrever `packages/server/test/unit/actions/ca3001-fix.test.ts`: a edição cobre
      só o token da diretiva e é o **menor conjunto possível**; o nome do arquivo permanece byte a
      byte, inclusive a caixa (FR-005, FR-010, FR-011, SC-002)
- [ ] T012 [P] [US1] Escrever no mesmo arquivo o caso de idempotência: aplicar a correção a um texto
      já correto produz **zero** edições (FR-012)
- [ ] T013 [P] [US1] Escrever `packages/server/test/unit/actions/provider-quickfix.test.ts`: a ação
      vem com `kind: 'quickfix'`, vinculada ao diagnóstico que a originou, e com o identificador da
      regra visível (FR-004)
- [ ] T014 [P] [US1] Escrever o teste de versão obsoleta: edição calculada sobre a versão N é
      recusada quando o documento está em N+1 (FR-006, R7 — a `WorkspaceEdit` usa a forma
      versionada)
- [ ] T015 [P] [US1] Escrever o teste de preservação: fixture CP1252 com CRLF continua CP1252 com
      CRLF depois da correção, e nenhuma outra linha muda (FR-007)
- [ ] T016 [US1] Implementar `packages/server/src/actions/ca3001-fix.ts`
- [ ] T017 [US1] Ligar a correção ao provedor em `packages/server/src/actions/provider.ts`, com
      `documentChanges` e `OptionalVersionedTextDocumentIdentifier`
- [ ] T018 [P] [US1] Acrescentar a chave de título da ação aos quatro arquivos
      `packages/server/l10n/bundle.l10n*.json` (FR-009, SC-011)
- [ ] T019 [P] [US1] Escrever o teste de integração em
      `packages/extension/test/integration/code-actions.test.ts`: a lâmpada aparece, aplica, e o
      diagnóstico some sem salvar (US1 cenários 1 e 2)
- [ ] T020 [US1] Acrescentar ao mesmo teste a **medição do SC-001**: o tempo entre pedir as ações e
      recebê-las fica dentro do orçamento de reanálise vigente para o tamanho do arquivo.
      ⚠️ Usar **comparação relativa ou percentil**, nunca teto absoluto — três testes da spec 001
      caíram medindo a máquina em vez do desenho

**Checkpoint**: existe correção automática funcionando ponta a ponta.

---

## Phase 4: User Story 2 — Corrigir todas do arquivo, e ao salvar (P2)

**Goal**: uma ação para o arquivo inteiro, que é o que habilita a correção ao salvar.

**Independent Test**: aplicar "corrigir tudo" numa fixture com N violações e conferir que as N são
corrigidas e revertidas por **um** desfazer.

- [ ] T021 [P] [US2] Escrever `packages/server/test/unit/actions/fix-all.test.ts`: a ação reúne
      todas as correções do documento numa `WorkspaceEdit` só, com as edições **ordenadas por
      posição** e disjuntas (FR-013, FR-016)
- [ ] T022 [P] [US2] Escrever no mesmo arquivo: documento sem violação produz **zero** edições e não
      marca o documento como modificado (FR-015)
- [ ] T023 [P] [US2] Escrever o teste da chave de participação: regra fora de
      `advplLint.fixAll.includeRules` não entra na correção em massa, mesmo ligada (FR-018)
- [ ] T024 [US2] Implementar `source.fixAll` em `packages/server/src/actions/provider.ts`, exposta de
      forma que `editor.codeActionsOnSave` a acione (FR-014)
- [ ] T025 [US2] Implementar a leitura da chave de participação em
      `packages/server/src/config/settings.ts` (FR-018)
- [ ] T026 [P] [US2] Escrever o teste de integração: "corrigir tudo" é revertido por **um** desfazer;
      `editor.codeActionsOnSave` produz o mesmo resultado (US2 cenários 1 e 2, SC-003)
- [ ] T027 [P] [US2] Escrever o teste de integração do fonte grande: a correção ao salvar no arquivo
      gerado de 24.636 linhas não acrescenta atraso perceptível (US2 cenário 3, FR-017, SC-004)

**Checkpoint**: US1 e US2 entregam o MVP desta spec, sem depender do índice.

---

## Phase 5: User Story 3 — A extensão avisa o que o padrão não vê (P3)

**Goal**: `PJ0001` — a primeira regra `projeto`, que compara a referência com o nome real no disco.

**Independent Test**: com diretório de includes controlado contendo `ACADEF.CH`, abrir fixture que
referencia `acadef.ch` e conferir o diagnóstico `PJ0001` com o intervalo exato e o nome real na
mensagem.

### A cadeia de fontes, no cliente (R1)

- [ ] T028 [P] [US3] Escrever `packages/extension/test/unit/include-sources/tds-vscode.test.ts`: a
      leitura devolve **apenas** os caminhos de `includes` (FR-027b); arquivo ausente, JSON inválido
      e forma inesperada devolvem lista vazia **sem lançar** (FR-027d)
- [ ] T029 [P] [US3] Escrever **o teste do SC-016** no mesmo arquivo, usando a fixture do T003: o
      valor sentinela de `savedTokens` NÃO aparece no retorno, **nem no log capturado, nem no texto
      de qualquer exceção** (FR-027b1, FR-027b2, SC-016)
- [ ] T030 [US3] Implementar `packages/extension/src/include-sources/tds-vscode.ts` — extrai os
      caminhos no ponto de leitura e **descarta o objeto ali** (FR-027b, FR-027b1, FR-027b2,
      [contracts/fontes-de-diretorios.md](contracts/fontes-de-diretorios.md))
- [ ] T031 [P] [US3] Escrever `packages/extension/test/unit/include-sources/advpl-vscode.test.ts`: lê
      `includeList` do ambiente apontado por `advpl.selectedEnvironment`; ambiente inexistente ou
      lista vazia devolvem vazio (FR-027)
- [ ] T032 [US3] Implementar `packages/extension/src/include-sources/advpl-vscode.ts`
- [ ] T033 [P] [US3] Escrever `packages/extension/test/unit/include-sources/chain.test.ts`: a cadeia
      para na primeira fonte **utilizável**; fonte presente e vazia faz **recuar**; diretório
      inexistente é descartado antes de contar (FR-027, FR-027a, SC-014)
- [ ] T034 [P] [US3] Escrever no mesmo arquivo o caso medido na máquina de referência: fonte 1 valendo
      `[""]` e fonte 2 valendo `[]` recuam até a chave própria e depois até o workspace (FR-027a,
      SC-014)
- [ ] T035 [US3] Implementar `packages/extension/src/include-sources/chain.ts`,
      `own-setting.ts` (FR-027e) e `workspace-scan.ts`
- [ ] T036 [P] [US3] Escrever o teste do relato ao usuário: a extensão informa **qual fonte** venceu e
      **quais diretórios** ela produziu (FR-027c, SC-015)
- [ ] T037 [US3] Implementar o comando que exibe a fonte em uso em
      `packages/extension/src/include-sources/chain.ts`, registrado em
      `packages/extension/src/extension.ts`, com título nos quatro idiomas (FR-027c, SC-011)

### O índice, no servidor (R3, R4)

- [ ] T038 [P] [US3] Escrever `packages/server/test/unit/includes/scan.test.ts`: o percurso devolve o
      **nome real** lido da listagem do diretório, e o teste prova que uma consulta de existência
      pelo nome referenciado responderia errado (FR-019, FR-020, R3)
- [ ] T039 [P] [US3] Escrever no mesmo arquivo: o percurso filtra por extensão **durante** a
      varredura, confere cancelamento entre diretórios e **para de fato** (FR-022, FR-023, SC-006)
- [ ] T040 [US3] Implementar `packages/server/src/includes/scan.ts` com `opendir` assíncrono
      (FR-020, FR-023)
- [ ] T041 [P] [US3] Escrever `packages/server/test/unit/includes/index-store.test.ts`: as três
      respostas — `encontrado`, `ausente`, `ambíguo` — e os três estados — `ausente`, `construindo`,
      `pronto` (FR-019, [contracts/indice-de-includes.md](contracts/indice-de-includes.md))
- [ ] T042 [US3] Implementar `packages/server/src/includes/index-store.ts` (FR-019)
- [ ] T043 [P] [US3] Escrever `packages/server/test/unit/includes/watcher.test.ts`: criar, renomear e
      apagar invalidam **apenas o diretório afetado**, nunca o índice inteiro (FR-024, SC-007)
- [ ] T044 [US3] Implementar `packages/server/src/includes/watcher.ts`, observando **diretórios**
      (FR-024)
- [ ] T045 [US3] Ligar o índice ao servidor em `packages/server/src/server.ts`: recebe os diretórios
      do cliente, indexa **sob demanda**, e revalida os documentos abertos quando o índice muda
      (FR-021, FR-025)
- [ ] T046 [P] [US3] Escrever o teste do aviso único (FR-026): diretório inexistente, sem permissão
      ou em unidade fora do ar produz **no máximo um** aviso acionável por sessão — nunca um por
      arquivo aberto — e a regra segue calada sem erro repetido
- [ ] T047 [US3] Implementar o aviso único e a degradação silenciosa da falha de leitura em
      `packages/server/src/includes/index-store.ts` (FR-026)

### A regra

- [ ] T048 [P] [US3] Escrever `packages/server/test/unit/rules/pj0001.test.ts`: dispara na
      divergência de caixa, com intervalo cobrindo **só o nome**, sem aspas e sem a diretiva
      (FR-028, FR-030, SC-008)
- [ ] T049 [P] [US3] Escrever no mesmo arquivo os três silêncios: arquivo não encontrado (FR-032),
      referência ambígua (FR-033), e índice ainda não pronto (FR-023). **Os três com razão
      distinta** — é o que separa "não achei" de "ainda não sei" (SC-008)
- [ ] T050 [US3] Implementar `packages/server/src/rules/pj0001.ts`, com `origin: 'project'`,
      `defaultSeverity: Warning` e a justificativa obrigatória do Princípio III (FR-029, FR-034)
- [ ] T051 [US3] Registrar `PJ0001` **desligada por padrão** até a medição do T060 (FR-036)
- [ ] T052 [P] [US3] Acrescentar `rule.PJ0001.message` aos quatro `bundle.l10n*.json`, citando o nome
      real (FR-031, SC-011)
- [ ] T053 [P] [US3] Escrever `docs/regras/PJ0001.md` (FR-044) — **o `check:docs` reprova sem isso**
- [ ] T054 [US3] Acrescentar `PJ0001` à região demarcada do `README.md` (FR-044) — **o `check:docs`
      também reprova sem isso**
- [ ] T055 [P] [US3] Escrever o teste de integração em
      `packages/extension/test/integration/pj0001.test.ts`: com diretório controlado, o diagnóstico
      aparece com o nome real na mensagem; a análise **não espera** pelo índice (US3 cenários 1 e 6,
      SC-005)

**Checkpoint**: a extensão passa a apontar o que o padrão não vê.

---

## Phase 6: User Story 4 — A lâmpada ajusta a referência ao nome real (P4)

**Goal**: fechar o ciclo detectar → corrigir na regra que justifica a spec.

**Independent Test**: aplicar a ação sobre um `PJ0001` e conferir que a referência virou o nome real
lido do disco.

- [ ] T056 [P] [US4] Escrever `packages/server/test/unit/actions/pj0001-fix.test.ts`: a edição troca
      o nome pelo real e **não** toca na diretiva, no caminho nem nas aspas (FR-037, FR-038)
- [ ] T057 [P] [US4] Escrever no mesmo arquivo: a correção é **recusada** se o arquivo saiu do índice
      entre o diagnóstico e a aplicação (FR-039)
- [ ] T058 [US4] Implementar `packages/server/src/actions/pj0001-fix.ts` (FR-037, FR-038)
- [ ] T059 [US4] Manter `PJ0001` **fora** do `source.fixAll` por padrão, com a chave que permite
      incluí-la (FR-040, D9)
- [ ] T060 [P] [US4] Escrever o teste de integração das duas correções na mesma linha: aplicar as
      duas produz `#include "ACADEF.CH"`, com intervalos disjuntos (US4 cenário 2, FR-016)

---

## Phase 7: Medição, portões e documentação

**Purpose**: o Portão 4 da constituição — a linha de base reconferida porque uma regra entrou.

- [ ] T061 [P] Escrever `packages/tooling/test/harness/report.test.ts` para o esquema **versão 2**:
      campo novo com o custo da indexação, medido em separado do custo por documento (R8, FR-042)
- [ ] T062 Implementar o campo em `packages/tooling/src/harness/report.ts` e subir
      `SCHEMA_VERSION` para 2 (FR-042)
- [ ] T063 Medir o custo de `PJ0001` e o da indexação sobre o corpus, com o harness que já existe
      (FR-041, FR-042, SC-010)
- [ ] T064 Revisar a amostra de disparos de `PJ0001`, apurar a taxa de falso positivo e gravar o
      veredito em `.fp-review/PJ0001.verdict.json` (FR-036, SC-009)
- [ ] T065 Decidir, **com o número na mão**, se `PJ0001` passa a ligada por padrão — e registrar a
      decisão na página da regra (FR-036, SC-009)
- [ ] T066 Reconferir a linha de base e commitar
      `specs/001-esqueleto-lsp-harness/baseline/AAAA-MM-DD.{json,md}` novo (FR-043, Portão 4)
- [ ] T067 [P] Atualizar `README.md` com as ações de correção e a configuração nova (Portão 6)
- [ ] T068 Rodar `npm run verify` inteiro, **sem cano**, e registrar no relatório o que foi executado
      (SC-011, SC-012, SC-013 — as três verificações do portão)

---

## Phase 8: Fechamento

- [ ] T069 [P] Atualizar `specs/README.md` e `memoria/` com o que a implementação produziu
- [ ] T070 Rodar `/speckit-converge` — **obrigatória**, antes da revisão e do merge
- [ ] T071 Rodar `/security-review`, com atenção ao FR-027b1 e FR-027b2

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

`T005 → T006` (contrato) → `T028…T035` (cadeia) → `T038…T045` (índice) → `T048…T051` (regra) →
`T056…T059` (correção) → `T063…T066` (medição). É o caminho crítico da spec, e o índice é a parte
cara.

### Oportunidades de paralelismo

| Bloco | Tarefas que correm juntas |
| ----- | ------------------------- |
| Fixtures | T001, T002, T003 |
| Testes da fundação | T005, T008, T009 |
| Testes da US1 | T011, T012, T013, T014, T015 |
| Testes da US2 | T021, T022, T023 |
| Cadeia de fontes | T028, T029, T031, T033, T034, T036 |
| Índice | T038, T039, T041, T043, T046 |
| Regra | T048, T049 |
| Documentação | T052, T053, T067 |

⚠️ **Um par teste/código nunca é paralelo consigo mesmo.** T011 e T016 são sequenciais por
construção — o teste precisa estar vermelho antes de a implementação começar.

---

## Implementation Strategy

### MVP primeiro (US1 + US2)

As duas primeiras histórias **não dependem do índice** e entregam a extensão consertando o que
aponta. É metade da spec, pela metade do risco.

### Entrega incremental

1. Fases 1 e 2 → o contrato aceita regra `projeto` e o servidor sabe corrigir, respeitando cancelamento
2. US1 → existe correção automática
3. US2 → existe correção em massa, e a correção ao salvar passa a funcionar
4. US3 → a extensão aponta o que o padrão não vê **(a parte cara)**
5. US4 → o ciclo fecha
6. Fases 7 e 8 → medido, documentado, convergido e revisado

### O que vigiar durante a implementação

- **O observador de sistema de arquivos** (T044) é onde esta spec tem mais chance de reproduzir o
  defeito que matou a versão anterior. Observar diretórios, nunca arquivos.
- **A análise não pode esperar pelo índice** (T045). Um `await` ali faz a primeira abertura de
  arquivo esperar por dezenas de milhares de leituras de disco.
- **O cancelamento das ações** (T009) precisa ser testado contando trabalho feito depois do
  cancelamento — "descartou o resultado" não é "parou".
- **O teste do SC-016** (T029) precisa capturar log e exceção, não só o retorno. É onde o vazamento
  aconteceria de verdade.
- **`check:docs` reprova** assim que `PJ0001` for registrada e antes de T053 e T054. É esperado — o
  portão está fazendo o trabalho dele.

## Notes

- **Nunca canalizar a saída do teste.** `npm test | tail` devolve o código de saída do `tail`.
- **Rodar `npm run verify` antes de commitar, com o commit condicionado ao resultado** — em
  QUALQUER branch. O `.gitignore` viaja com a branch, e uma branch antiga tem regras antigas.
- **Teto absoluto de tempo em teste mede a máquina.** Três testes da spec 001 caíram nisso. Use
  comparação relativa ou percentil.
- Nada de `analise-advpl/` entra como código ou dependência.
- Nenhum fonte do corpus entra no repositório, em nenhuma forma.
