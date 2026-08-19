---
description: "Lista de tarefas — spec 001"
---

# Tasks: Esqueleto vertical da extensão + harness de medição

**Input**: documentos de design em `/specs/001-esqueleto-lsp-harness/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/)

## ⚠️ Testes NÃO são opcionais, e a cobertura mínima é 98%

`.specify/templates/tasks-template.md` (linha 12) e `.claude/skills/speckit-tasks/SKILL.md`
(linha 145) declaram testes opcionais. Isso é o padrão do spec-kit upstream e **contradiz o Princípio
VI**, que é NÃO NEGOCIÁVEL.

Desde a **constituição v2.2.0** (2026-08-19) isso deixou de ser convenção e virou norma escrita: o
Princípio VI diz que template, skill ou ferramenta que declare testes opcionais **está subordinado a
ele e MUST ser contrariado**. Corrigir os dois arquivos é a tarefa **T081**.

Em toda tarefa abaixo:

- **A tarefa de teste vem antes da tarefa de código**, escrita para **falhar primeiro**.
- Asserção sobre diagnóstico compara identificador, severidade, linha e coluna do diagnóstico
  específico; contagem agregada é proibida (FR-029).
- **Cobertura mínima de 98%** em linhas, funções e ramos, com o limiar no próprio runner — abaixo
  dele o processo sai com erro (FR-030). Exclusão só por lista versionada com razão (FR-032).

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode correr em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1, US2, US3 — rastreia a tarefa até a história da [spec.md](spec.md)
- Todo caminho de arquivo é literal e relativo à raiz do repositório

## Convenções de caminho

Monorepo npm de três workspaces ([plan.md](plan.md), R2): `packages/extension` (cliente fino),
`packages/server` (motor, **sem nenhum import de `vscode`**), `packages/tooling` (harness e
verificações, nunca empacotado).

**Idioma (R9, confirmado pelo dono em 2026-08-19)** — a divisão é entre o que a máquina lê e o que a
pessoa lê:

| Em inglês | Em pt-BR |
| --------- | -------- |
| identificadores, nomes de arquivo e diretório, chaves de configuração e de tradução | **comentários dentro do código**, nomes e descrições de teste, documentação, mensagens de commit |

Toda tarefa abaixo que cria arquivo de código entrega **comentários em português** — em especial os
que explicam decisão de desempenho, que é onde o Princípio I depende de o comentário estar bem
escrito e não traduzido.

---

## Phase 1: Setup

**Purpose**: estrutura do monorepo e os portões que precisam existir antes do primeiro arquivo de
teste.

- [X] T001 Criar `.gitattributes` na raiz com `* text=auto eol=lf`, `*.md text eol=lf` e
      `packages/*/test/fixtures/** -text` — **antes de qualquer fixture existir** (R4)
- [X] T002 Confirmar o efeito de T001 rodando `git check-attr text -- packages/server/test/fixtures/x.prw`
      e conferir que devolve `text: unset` — sem isso as fixtures são normalizadas na entrada do repositório
- [X] T003 Criar `package.json` na raiz com `workspaces` e os scripts `build`, `typecheck`, `lint`,
      `test`, `check:nls`, `check:corpus`, `check:docs`, `verify`, `baseline`. O script `test` já
      nasce com os limiares — `--experimental-test-coverage --test-coverage-lines=98
      --test-coverage-functions=98 --test-coverage-branches=98` — e lendo as exclusões de
      `coverage-exclusions.json` (FR-030, FR-031, FR-032)
- [X] T004 [P] Criar `tsconfig.base.json` com alvo `ES2022`, `strict: true`, e um `tsconfig.json` por workspace
- [X] T005 [P] Acrescentar ao `.gitignore`: `out/`, `dist/`, `corpus.local.json`, `.corpus-cache.json`,
      `.fp-review/`, `packages/*/test/fixtures/generated/` (FR-023, FR-026)
- [X] T006 [P] Criar `eslint.config.js` proibindo, em `packages/server/src/**`, todo identificador
      terminado em `Sync` e toda chamada `console.*`; e, em `packages/server/**`, o import de `vscode`
      (FR-007, FR-002, Princípio I)
- [X] T007 Criar `packages/server/package.json` **sem** `vscode` e **sem** `@types/vscode`, e proibir
      o import de `vscode` em `packages/server/**` por `no-restricted-imports` no lint — medido em
      2026-08-19: só omitir a dependência **não** impede o import, porque o içamento de workspaces
      deixa `@types/vscode` visível à resolução do TypeScript (R2)
- [X] T008 [P] Criar `packages/extension/package.json` como manifesto da extensão, com identidade de
      publicação própria e espaço de nomes `advplLint.*` (D1, FR-014a)
- [X] T009 [P] Criar `packages/tooling/package.json`, marcado como privado e fora do empacotamento

**Checkpoint**: `npm install` roda, os três workspaces existem, e o git não normaliza fixtures.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: o contrato de regra, diagnóstico e severidade, mais a codificação. **Nenhuma história
pode começar antes desta fase.**

**⚠️ CRITICAL**: todo par abaixo é teste-primeiro. A tarefa de código só começa com o teste vermelho.

### Codificação CP1252

- [X] T010 [P] Escrever `packages/server/test/unit/text/cp1252.test.ts`: ida e volta **exaustiva** dos
      256 bytes; os cinco sem definição (`0x81`, `0x8D`, `0x8F`, `0x90`, `0x9D`) mapeiam para os pontos
      de controle C1; e a divergência com `latin1` na faixa `0x80`–`0x9F` é explicitamente asserida (FR-003)
- [X] T011 Implementar `packages/server/src/text/cp1252.ts` — tabela local de 256 posições, decodificação
      **e** codificação juntas, sem `iconv-lite` (R1, FR-003)

### Utilitário de asserção de diagnóstico

- [X] T012 [P] Escrever `packages/server/test/unit/support/assert-diagnostic.test.ts`: o utilitário
      acusa divergência em `code`, em `severity`, em linha e em coluna, separadamente (FR-029)
- [X] T013 Implementar `packages/server/test/support/assert-diagnostic.ts` comparando o diagnóstico
      **inteiro**. Não expor nenhuma forma de assertar contagem agregada (FR-029)

### Tabela de severidade

- [X] T014 [P] Escrever `packages/server/test/unit/severity/map.test.ts`: `MINOR` resolve para
      `Information`; severidade de catálogo sem entrada na tabela é **erro de registro**, não valor
      padrão silencioso (FR-014, D3)
- [X] T015 Implementar `packages/server/src/severity/map.ts` com a única entrada `MINOR → Information`
      e as demais deliberadamente ausentes (`TODO(SEVERITY_MAP)`)

### Registro de regras

- [X] T016 [P] Escrever `packages/server/test/unit/rules/registry.test.ts` cobrindo as seis invariantes
      de [contracts/regra.md](contracts/regra.md): unicidade de `id` e `configKey`; origem `totvs` exige
      `group` e `catalogSeverity`; origem `project` exige `id` em `/^PJ\d{4}$/` e `projectRationale` não
      vazio; `messageKey` nos quatro idiomas; documentação existente; severidade mapeável
      (FR-010, FR-010a, FR-012, FR-013)
- [X] T017 Implementar `packages/server/src/rules/registry.ts` como fonte única de identidade de regra

### Canal de log

- [X] T018 [P] Escrever `packages/server/test/unit/logging/channel.test.ts`: com nível `off` — o padrão —
      nada é emitido (FR-007)
- [X] T019 Implementar `packages/server/src/logging/channel.ts` com nível, desligado por padrão

### Idiomas — ponto único de declaração

- [X] T020 [P] Escrever `packages/tooling/test/locales.test.ts`: exatamente quatro idiomas
      (`en`, `pt-br`, `es`, `ru`), `en` como base, e nenhum outro arquivo do repositório enumerando
      idioma (FR-015a, D4)
- [X] T021 Implementar `packages/tooling/src/locales.ts` como ponto único de declaração dos idiomas

### Construção e portão

- [X] T022 Escrever o script de construção: `tsc` para `out/` (portão de tipagem) e `esbuild` gerando
      `extension.js` e `server.js`, CommonJS, `vscode` externo (R2)
- [X] T023 Escrever o orquestrador de `npm run verify` encadeando `typecheck`, `lint`, `test` (com o
      limiar de 98%), `check:nls`, `check:corpus`, `check:docs` — **sem cano na saída**, para o código
      de saída ser o do comando e não o do `tail` (Portão 2 da constituição v2.2.0)

**Checkpoint**: contrato de regra, severidade, codificação e portão prontos. As histórias podem começar.

---

## Phase 3: User Story 1 — O diagnóstico aparece, e o editor não trava (P1) 🎯 MVP

**Goal**: um fonte `.prw` aberto no editor produz o diagnóstico `CA3001` com identificador,
severidade e posição exata, e o editor não engasga nem no maior arquivo do corpus.

**Independent Test**: abrir fixtures numa instância de desenvolvimento e conferir cada `#INCLUDE` em
caixa alta virando diagnóstico com intervalo exato, enquanto se digita continuamente no arquivo
gerado de 24.636 linhas sem travamento.

### Fixtures — antes de qualquer regra (Princípio VI)

- [X] T024 [P] [US1] Criar `packages/server/test/fixtures/ca3001-basic.prw` com `#INCLUDE "TOTVS.CH"`
      na linha 3, coluna 1, gravado em CP1252 com CRLF, abrindo com o cabeçalho de autoria obrigatório (FR-026)
- [X] T025 [P] [US1] Criar `packages/server/test/fixtures/ca3001-comment-and-string.prw` com `#INCLUDE`
      dentro de comentário de linha, de comentário de bloco e de literal de texto (FR-018)
- [X] T026 [P] [US1] Criar `packages/server/test/fixtures/ca3001-cp1252-highrange.prw` com travessão,
      aspas tipográficas e euro (faixa `0x80`–`0x9F`) antes de um `#INCLUDE` em caixa alta (FR-003)
- [X] T027 [P] [US1] Criar `packages/server/test/fixtures/ca3001-eol-lf.prw` e
      `ca3001-eol-mixed.prw` — LF puro e CRLF/LF misto no mesmo arquivo
- [X] T028 [P] [US1] Criar `packages/server/test/fixtures/ca3001-mixed-case.prw` com `#Include` e
      `#InClUdE` (FR-017)
- [X] T029 [US1] Conferir, com `git check-attr`, que **nenhuma** das fixtures de T024–T028 está sujeita
      a normalização — se estiver, T001 não surtiu efeito e todo teste seguinte é falso

### Varredura de comentário e literal

- [X] T030 [P] [US1] Escrever `packages/server/test/unit/analysis/scanner.test.ts`: o classificador
      marca comentário de linha, de bloco e literal de texto numa **única** passagem, e nunca revarre
      a lista de linhas (FR-008)
- [X] T031 [US1] Implementar `packages/server/src/analysis/scanner.ts`, rodando **uma vez por
      documento** — não uma vez por regra, senão o custo vira O(regras × linhas) já na segunda regra

### A regra CA3001

- [X] T032 [P] [US1] Escrever `packages/server/test/unit/rules/ca3001.test.ts` sobre as fixtures
      T024–T028: dispara em qualquer caixa que não seja toda baixa; **não** dispara em comentário nem em
      literal; o intervalo cobre o token do `#` ao fim da palavra, não a linha (FR-017, FR-018, FR-019)
- [X] T033 [US1] Implementar `packages/server/src/rules/ca3001.ts` e registrá-la com origem `totvs`,
      grupo `G3`, catálogo `MINOR` (FR-012)

### Orquestração, cancelamento e tamanho

- [X] T034 [P] [US1] Escrever `packages/server/test/unit/analysis/analyze.test.ts`: a análise cede o
      controle entre blocos e **para de fato** ao ser cancelada, medindo quando o trabalho cessou —
      não apenas que o resultado foi descartado (FR-004, FR-006, SC-009)
- [X] T035 [US1] Implementar `packages/server/src/analysis/cancellation.ts` e
      `packages/server/src/analysis/analyze.ts`
- [X] T036 [P] [US1] Escrever o teste do documento gigante: 24.636 linhas concluem sem erro e **sem
      descarte por tempo-limite** — não existe tempo-limite no desenho (FR-009, SC-010)
- [X] T037 [US1] Implementar `packages/tooling/src/fixtures/generate-large.ts`, que **gera** o arquivo
      em tempo de teste. Arquivo grande é gerado, nunca versionado (FR-026)

### O servidor de linguagem

- [X] T038 [P] [US1] Escrever `packages/server/test/unit/server.test.ts`: `didOpen` e `didChange`
      produzem diagnóstico com `code`, `severity` e `range`; a reanálise é espaçada; e resultado de
      versão vencida **nunca** sobrescreve o da versão atual (FR-005, FR-010, SC-004)
- [X] T039 [US1] Implementar `packages/server/src/server.ts` — conexão LSP, ciclo de vida, debounce,
      publicação de diagnóstico

### Mensagem e documentação

- [X] T040 [P] [US1] Criar `packages/server/l10n/bundle.l10n.json` (en, base) com a mensagem de
      `CA3001`, mais `bundle.l10n.pt-br.json`, `bundle.l10n.es.json` e `bundle.l10n.ru.json` (FR-015, D4)
- [X] T041 [P] [US1] Escrever `docs/regras/CA3001.md`: o que a regra pega, a chave de configuração, a
      severidade mapeada e a citação do catálogo com data de consulta (FR-011, FR-012)

### O cliente fino

- [X] T042 [P] [US1] Escrever o teste de integração em `packages/extension/test/integration/activation.test.ts`:
      abrir `.prw` produz `CA3001` no painel de problemas; abrir `.txt` **não** ativa a extensão
      (FR-001, US1 cenários 1 e 5)
- [X] T043 [US1] Preencher o manifesto em `packages/extension/package.json`: `activationEvents` por
      linguagem — nunca `*` —, as extensões `prw`/`prx`/`prg`/`apw`/`apl`/`tlpp`, e
      `configurationDefaults` com `files.encoding: windows1252` para `[advpl]` e `[tlpp]`
      (FR-001, FR-003, [contracts/configuracao.md](contracts/configuracao.md))
- [X] T044 [US1] Implementar `packages/extension/src/extension.ts` e `packages/extension/src/client.ts` —
      ativação **sem nenhum I/O**, cliente LSP iniciado de forma assíncrona (SC-003)
- [X] T045 [P] [US1] Escrever o teste do guarda de codificação: documento ADVPL cuja codificação efetiva
      não seja `windows1252` gera **um** aviso acionável, uma vez por sessão e nunca por arquivo (FR-003)
- [X] T046 [US1] Implementar `packages/extension/src/encoding-guard.ts`

**Checkpoint**: US1 funciona ponta a ponta. Existe uma extensão de lint ADVPL com uma regra real do
catálogo oficial, sobre a arquitetura que a constituição exige. **Este é o MVP.**

---

## Phase 4: User Story 2 — A linha de base existe, medida sobre fontes reais (P2)

**Goal**: um comando de medição produz o relatório de linha de base sobre o corpus externo, fechando
o `TODO(BENCHMARK_BASE)`.

**Independent Test**: rodar a medição com o corpus configurado e obter relatório com percentis;
rodar sem o corpus e confirmar que avisa, encerra com sucesso, e não quebra a suíte.

### Configuração do corpus

- [X] T047 [P] [US2] Escrever `packages/tooling/test/harness/corpus-config.test.ts`: `ADVPL_LINT_CORPUS`
      vence sobre `corpus.local.json`; sem os dois, o corpus é declarado indisponível (FR-023)
- [X] T048 [US2] Implementar `packages/tooling/src/harness/corpus-config.ts`

### Inventário com cache

- [X] T049 [P] [US2] Escrever `packages/tooling/test/harness/inventory.test.ts`: o percurso filtra por
      extensão **durante** a varredura; o cache é invalidado quando a raiz muda; e o inventário guarda
      **apenas** caminho e tamanho, nunca conteúdo (FR-023)
- [X] T050 [US2] Implementar `packages/tooling/src/harness/inventory.ts` gravando `.corpus-cache.json`
      local e não versionado (R5)

### Amostragem estratificada

- [X] T051 [P] [US2] Escrever `packages/tooling/test/harness/sample.test.ts`: a amostra soma no mínimo
      1.000 fontes e cobre p50, p90, p95, p99 e o maior arquivo — amostragem uniforme sub-representaria
      a cauda, que é onde o Princípio I corre risco (SC-006)
- [X] T052 [US2] Implementar `packages/tooling/src/harness/sample.ts` com estratificação por tamanho em bytes

### Medição

- [X] T053 [P] [US2] Escrever `packages/tooling/test/harness/measure.test.ts`: o cronômetro cobre
      **apenas** a análise, com a leitura de disco fora; o resultado é a mediana de várias repetições;
      e o custo incremental de uma regra é a diferença entre rodar com e sem ela (FR-020, FR-021)
- [X] T054 [US2] Implementar `packages/tooling/src/harness/measure.ts` com pool de `worker_threads`
      dimensionado em `min(12, núcleos - 2)` (R5)

### Relatório

- [X] T055 [P] [US2] Escrever `packages/tooling/test/harness/report.test.ts` validando o esquema de
      [contracts/relatorio-baseline.md](contracts/relatorio-baseline.md) — e, explicitamente, que a
      saída **não contém** caminho de arquivo do corpus, trecho de fonte nem nome de programa
      (FR-022, FR-023)
- [X] T056 [US2] Implementar `packages/tooling/src/harness/report.ts` gerando
      `specs/001-esqueleto-lsp-harness/baseline/AAAA-MM-DD.json` e `.md`
- [X] T057 [US2] Implementar a saída do material de revisão de falso positivo em `.fp-review/`, **local
      e não versionado**. Do relatório sobe apenas o agregado (FR-022)

### Corpus ausente

- [X] T058 [P] [US2] Escrever o teste do caminho sem corpus: a suíte passa inteira e a medição avisa e
      encerra **com sucesso**, não com erro de execução (FR-024)
- [X] T059 [US2] Ligar `npm run baseline` ao encadeamento inventário → amostra → medição → relatório

### Execução real

- [X] T060 [US2] Rodar a medição real sobre `D:\Workspace\FONTES` e commitar
      `baseline/AAAA-MM-DD.{json,md}` (SC-006)
- [X] T061 [US2] Revisar a amostra de disparos de `CA3001`, apurar a taxa de falso positivo e registrar
      **somente o agregado** no relatório (SC-007)
- [X] T062 [US2] Confrontar os números medidos com o orçamento provisório do Princípio I e registrar a
      divergência do "p95 de fonte de 1.000 linhas" contra o p95 real de 2.933 linhas (US2 cenário 5)

**Checkpoint**: existe régua. A partir daqui, toda regra futura entra com custo medido.

---

## Phase 5: User Story 3 — O desenvolvedor manda na regra e no idioma (P3)

**Goal**: a regra é desligável e reconfigurável sem reiniciar o editor, e a mensagem sai nos quatro
idiomas do Protheus.

**Independent Test**: alternar a chave de desligamento e a de severidade e ver o painel reagir; trocar
o idioma do editor e ver a mensagem mudar mantendo identificador e posição.

### Configuração por regra

- [X] T063 [P] [US3] Escrever o teste: `advplLint.rules.CA3001.enabled: false` faz o diagnóstico
      desaparecer **sem reiniciar** o editor (FR-013, US3 cenário 1)
- [X] T064 [P] [US3] Escrever o teste: mudar `advplLint.rules.CA3001.severity` altera a severidade
      exibida **mantendo** `code` e `range` (FR-013, US3 cenário 2)
- [X] T065 [US3] Implementar a resolução de configuração por documento e a revalidação em mudança de
      configuração, passando pelo mesmo caminho debounced e cancelável — configuração não é atalho
      para furar o Princípio I
- [X] T066 [US3] Gerar as chaves de `contributes.configuration` **a partir do registro de regras**, não
      escrevê-las à mão no manifesto — é o que impede manifesto e motor de divergirem
      ([contracts/configuracao.md](contracts/configuracao.md))

### Os quatro idiomas

- [X] T067 [P] [US3] Escrever `packages/tooling/test/checks/nls.test.ts`: a verificação **falha** quando
      uma chave existe em um idioma e falta em qualquer outro, em **qualquer** dos dois mecanismos, e a
      mensagem de erro nomeia a chave e o arquivo (FR-015, SC-005)
- [X] T068 [US3] Implementar `packages/tooling/src/checks/nls.ts` comparando **todos os pares** dos
      quatro idiomas, consumindo a lista única de T021
- [X] T069 [P] [US3] Criar `packages/extension/package.nls.json` (en, base), `package.nls.pt-br.json`,
      `package.nls.es.json` e `package.nls.ru.json` com os rótulos de configuração (FR-015)
- [X] T070 [P] [US3] Escrever o teste de integração de idioma: trocar entre `pt-br`, `es`, `en` e `ru`
      muda a mensagem e **não** muda `code` nem `range` (US3 cenário 3)
- [X] T071 [P] [US3] Escrever o teste do recuo: idioma sem tradução nossa cai no inglês e **nunca**
      exibe o identificador cru da chave (US3 cenário 4)
- [X] T072 [US3] Ajustar o carregamento de tradução para satisfazer T070 e T071

**Checkpoint**: as três histórias funcionam de forma independente.

---

## Phase 6: Portões, documentação e fechamento

**Purpose**: os portões que a constituição exige e as pendências que esta spec abriu.

### Vazamento de corpus

- [X] T073 [P] Escrever `packages/tooling/test/checks/corpus.test.ts`: a verificação **falha** com fonte
      ADVPL versionado fora de `packages/*/test/fixtures/`, com fixture sem cabeçalho de autoria, e com
      fixture acima de 300 linhas (FR-027, SC-008)
- [X] T074 Implementar `packages/tooling/src/checks/corpus.ts`

### Sincronismo de documentação

- [X] T075 [P] Escrever `packages/tooling/test/checks/docs.test.ts`: a verificação **falha** nos dois
      sentidos — regra registrada sem arquivo em `docs/regras/`, e arquivo sem regra correspondente
      (Portão 6)
- [X] T076 Implementar `packages/tooling/src/checks/docs.ts`

### Fechamento

- [ ] T077 Atualizar o `README.md` da raiz: hoje ele descreve a biblioteca legada, e o Portão 6 vale nos
      dois sentidos
- [ ] T078 Rodar `npm run verify` inteiro, **sem cano**, e registrar no relatório ao usuário exatamente
      o que foi executado e o que passou
- [ ] T079 Executar o [quickstart.md](quickstart.md) ponta a ponta, incluindo as validações manuais das
      três histórias
- [x] T080 ~~**Emendar a constituição**~~ — **FEITO em 2026-08-19, constituição na v2.2.0.** Princípio
      V passou a "Multilíngue por Construção" com os quatro idiomas do Protheus (D4); Princípio VI
      passou a "Fixture, Teste e Medição Antes da Regra", com teste não-opcional escrito e cobertura
      de 98% como portão (D5). Bump MINOR. Deixou de bloquear o merge
- [ ] T081 [P] Corrigir a contradição do template: `.specify/templates/tasks-template.md` linha 12 e
      `.claude/skills/speckit-tasks/SKILL.md` linha 145 declaram testes opcionais contra o Princípio VI
- [ ] T082 [P] Atualizar `specs/README.md` e `memoria/` com o que a implementação apurou — em especial
      os números medidos da linha de base

### Cobertura

- [ ] T083 Criar `coverage-exclusions.json` versionado, com **a razão de cada exclusão** registrada.
      Nasce vazio; item entra só quando um ramo for genuinamente inalcançável em teste (FR-032, SC-012)
- [ ] T084 Levar a cobertura a **98% em linhas, funções e ramos** e conferir que o portão falha
      abaixo disso — derrubar o limiar num teste de mesa e confirmar que o processo sai com erro
      (FR-030, SC-011)
- [ ] T085 Registrar em `coverage-exclusions.json` o que a camada de integração com o editor não
      alcançar, **com razão por item**. Baixar o limiar em vez de declarar a exclusão é violação do
      Princípio VI, não atalho

### Fechamento

- [ ] T086 Rodar `/speckit-converge` — **obrigatória**, antes da `/security-review` e do merge

---

## Dependencies & Execution Order

### Entre fases

- **Phase 1 (Setup)**: sem dependência. **T001 e T002 vêm antes de tudo** — fixture criada antes do
  `.gitattributes` nasce corrompida e o teste passa por engano.
- **Phase 2 (Foundational)**: depende da Phase 1. **Bloqueia as três histórias.**
- **Phase 3 (US1)**: depende da Phase 2.
- **Phase 4 (US2)**: depende da Phase 2 e, para medir custo de regra, da existência de `CA3001` (T033).
- **Phase 5 (US3)**: depende da Phase 2 e do diagnóstico já sendo publicado (T039).
- **Phase 6**: depende das histórias desejadas estarem completas.

### Dentro de cada história

Teste primeiro, sempre, e vermelho antes de verde. Fixture antes de regra. Registro antes de regra.
Regra antes de orquestração. Motor antes de cliente.

### Oportunidades de paralelismo

| Bloco | Tarefas |
| ----- | ------- |
| Setup | T004, T005, T006 juntas; T008 e T009 juntas |
| Foundational — testes | T010, T012, T014, T016, T018, T020 juntas |
| US1 — fixtures | T024 a T028 juntas |
| US2 — testes de harness | T047, T049, T051, T053, T055, T058 juntas |
| US3 — traduções e testes | T067, T069, T070, T071 juntas |
| Portões | T073 e T075 juntas; T081 e T082 juntas |

⚠️ **Um par teste/código nunca é paralelo consigo mesmo.** T010 e T011 são sequenciais por
construção — o teste tem de estar vermelho antes de a implementação começar.

---

## Implementation Strategy

### MVP primeiro (só a US1)

1. Phase 1 — Setup
2. Phase 2 — Foundational
3. Phase 3 — US1
4. **PARAR E VALIDAR**: abrir a instância de desenvolvimento e exercitar os seis cenários de aceitação
   da US1 à mão. O Princípio I não se prova só por teste automatizado — travamento se sente digitando.

Neste ponto existe uma extensão de lint ADVPL funcionando, com uma regra real do catálogo oficial,
sobre a arquitetura que a constituição exige. É pouco em cobertura e é tudo em fundação.

### Entrega incremental

1. Setup + Foundational → fundação pronta
2. US1 → validar → **MVP**
3. US2 → existe régua; toda regra futura entra com custo medido
4. US3 → o usuário manda na regra e no idioma
5. Phase 6 → portões, emenda constitucional, convergência

### Um desenvolvedor, não um time

Este projeto é de uma pessoa. As marcações `[P]` indicam **ausência de dependência**, não sugestão de
paralelizar mão de obra. Na prática, servem para escolher a próxima tarefa sem medo de conflito.

---

## Notes

- Um commit por tarefa ou por grupo lógico; um commit por etapa concluída do ciclo.
- **Conferir que o teste falha antes de implementar.** Teste que nasce verde não testa nada.
- **Cobertura é portão, não relatório.** O limiar de 98% vive no próprio runner: abaixo dele o
  processo sai com erro. Se um ramo não for alcançável em teste, ele entra em
  `coverage-exclusions.json` **com a razão escrita**. Baixar o limiar é violação do Princípio VI.
- **Nunca canalizar a saída do teste.** `npm test | tail` devolve o código de saída do `tail` — já
  mascarou suíte que nem chegou a rodar.
- O relatório ao usuário diz o que foi executado e nada além. "Suíte verde" só se a suíte rodou.
- Nada de `analise-advpl/` entra como código ou dependência. Consulta é leitura humana.
- Nenhum fonte de `D:\Workspace\FONTES` entra no repositório, em nenhuma forma, em nenhuma tarefa.
