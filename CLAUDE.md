# CLAUDE.md

Orientações ao Claude Code (claude.ai/code) ao trabalhar neste repositório.

## ⇥ Retomando o trabalho? Leia estes dois primeiro

| Arquivo | Para quê |
| ------- | -------- |
| [`memoria/estado-atual.md`](memoria/estado-atual.md) | onde o projeto parou, o que falta, o que espera decisão do dono |
| [`memoria/armadilhas-do-ambiente.md`](memoria/armadilhas-do-ambiente.md) | erros de ferramenta que **já** custaram tempo aqui — leia antes de rodar qualquer comando |

**Resumo de 2026-08-19**: branch `002-correcao-e-portabilidade-include`, nascida da
`001-esqueleto-lsp-harness`. O MVP da spec 001 está pronto e verde (`T001`–`T046` de 86): 139 testes
unitários e 6 de integração passando, cobertura 100/98,47/100. `npm run verify` **falha** de propósito
— encadeia três verificações que ainda não foram escritas (`T067`, `T073`, `T075`). A **spec 002 está
escrita** e sem esclarecimento pendente, mas **parada**: a implementação retoma pela 001, porque a
medição de custo da 002 depende do harness que é a US2 da 001. Nada mergeado.

## Visão Geral

- **Objetivo**: escrever **do zero**, neste repositório (`robsonrosilva/Lint-ADVPL`), uma **extensão
  VS Code de lint ADVPL/TLPP** que substitua a extensão atual. O código **já nasceu** na spec 001,
  em 2026-08-19: monorepo de três workspaces, uma regra do catálogo funcionando ponta a ponta.
- **Governança**: a **constituição** (`.specify/memory/constitution.md`) é a autoridade — leia-a
  antes de propor código.

  Vigente: **v2.2.1**, seis princípios. O primeiro é **"O Editor Nunca Trava"** — leia-o antes de
  escrever qualquer código no caminho de análise; ele lista, com arquivo e linha, os defeitos do
  legado que produziram o travamento.

- **`analise-advpl/`** é o **stack legado congelado**: repositório separado
  (`robsonrosilva/valida-advpl`), biblioteca npm `advpl-lint` v6.2.6, que alimenta a extensão atual.
  Serve como **referência de comportamento**, **nunca** como padrão de código. **Não editar, não
  importar como dependência** — a extensão nova reescreve o motor (decisão do dono, 2026-08-19).

## Estrutura

```text
packages/
  extension/       cliente fino de VS Code — orquestra, NÃO analisa
  server/          o motor (Language Server) — nenhum import de `vscode`
  tooling/         harness e verificações — nunca empacotado, nunca publicado
docs/
  regras/          uma página por identificador de regra (portão 6)
  inventario-legado.md   as 28 críticas do legado, item a item — o "piso" do Princípio III
specs/             Spec-Driven Development — uma pasta por feature; índice em specs/README.md
memoria/           memória entre sessões, versionada — comece por estado-atual.md
referencias/totvs/ cópia byte-idêntica da release v1.0.1 — NÃO editar
.specify/          templates, scripts (PowerShell) e a constituição
.claude/skills/    skills do fluxo Spec-Driven Development
analise-advpl/     LEGADO CONGELADO — repo aninhado, NÃO versionado, referência de comportamento
README.md          ⚠️ ainda descreve a lib LEGADA — reescrever é a tarefa T077
SONNAR-RULES.md    detalhamento das regras TOTVS Code Analyzer (apoio, gerado por IA)
```

**Comandos**: `npm run typecheck` · `lint` · `test:unit` (com o limiar de cobertura) ·
`test:integration` (reconstrói antes) · `build` · `verify` (portão completo — hoje falha nas três
verificações que faltam) · `baseline` (ainda não existe). **F5** abre a instância de desenvolvimento.

## O legado — como consultar sem copiar

**O que perguntar a `analise-advpl/`:**

| Onde                        | O que ele responde                                                       |
| --------------------------- | ------------------------------------------------------------------------ |
| `test/files/`               | fontes ADVPL reais e o que a versão antiga detectava neles                |
| `src/models/params.ts`      | catálogo do que existia — 28 chaves de desligamento de regra              |
| `src/locales/*.json`        | as 33 mensagens de diagnóstico, em pt-br e en                             |
| `src/models/Restritos.ts`   | funções restritas/descontinuadas do Protheus — **dado de domínio**, reusável |
| `src/include.ts`            | regras de include obrigatório/obsoleto/duplicado                          |

**O que NÃO trazer junto** — anti-padrões medidos no legado, e a razão de cada um está na
constituição:

- diagnóstico **sem identificador de regra** (`src/models/Erro.ts` só tem linha, coluna e texto);
- i18n duplicada em dois pares de arquivos (`src/locales/` e `src/prefix/locales/`) sem nada que
  garanta que os quatro concordem;
- caminho de cache montado com separador de Windows literal, enquanto a CI roda em imagem Linux;
- pipeline que instala `mocha` e **não executa `npm test`**.

## Spec-Driven Development (spec-kit)

Skills em `.claude/skills/`. **Os scripts aqui são PowerShell** (`.specify/scripts/powershell/*.ps1`)
— esta instalação usou `--script ps` e **não existe** `.specify/scripts/bash/`.

| Skill                | Quando                                                                            |
| -------------------- | --------------------------------------------------------------------------------- |
| `/speckit-specify`   | criar a spec de uma feature                                                       |
| `/speckit-clarify`   | antes do plan — resolver ambiguidades                                             |
| `/speckit-plan`      | gerar o plano de implementação                                                    |
| `/speckit-tasks`     | quebrar em tarefas acionáveis                                                     |
| `/speckit-analyze`   | após tasks — consistência entre spec/plan/tasks                                   |
| `/speckit-implement` | executar a implementação                                                          |
| `/speckit-converge`  | **OBRIGATÓRIA** — após implementar e antes do merge                               |
| `/security-review`   | ao fim, sempre                                                                    |

**`/speckit-converge` não é opcional.** Ela roda **depois do `implement` e antes da
`/security-review` e do merge**, e confere o código entregue contra spec/plan/tasks, anexando em
`tasks.md` o que ficou de fora. Sem ela, o que a implementação deixa para trás não aparece — reaparece
numa convergência geral meses depois.

**Spec grande demais quebra em subspecs** — `005` vira `005.1` e `005.2`. O escopo de cada análise
fica administrável sem perder de vista como o todo está dividido.

### ⚠️ Defeito conhecido do template: teste nasce opcional

`.specify/templates/tasks-template.md` (linha 12) e `.claude/skills/speckit-tasks/SKILL.md`
(linha 145) dizem _"Tests are OPTIONAL — only include them if explicitly requested"_. É o padrão do
spec-kit upstream, e ele **contradiz o Princípio VI da constituição**, que é NÃO NEGOCIÁVEL.

Desde a **v2.2.0** isso não é mais só uma nota deste arquivo: o Princípio VI passou a dizer, por
escrito, que **template, skill ou ferramenta que declare testes opcionais está subordinado a ele e
MUST ser contrariado**. A regra prática não muda, mas agora tem base normativa:

**Ao rodar `/speckit-tasks`, a task de teste vem ANTES da task de código, sempre** — escrita para
falhar primeiro. `tasks.md` com implementação órfã de teste é artefato **a refazer**, não a executar.

Os dois arquivos seguem errados; corrigi-los é a tarefa T081 da spec 001.

## Branch e commit

Projeto de um desenvolvedor: sem coluna de responsável, sem disputa de numeração de spec.

1. **Código vai por branch**, uma por spec (`NNN-nome-da-feature`), nunca direto na `master`.
2. **Um commit por etapa concluída** do ciclo (`specify`, `plan`, `tasks`, `implement`, `converge`).
3. **Ao fim da implementação, pedir confirmação antes de commitar ou mergear.**
4. `.specify/feature.json` é **local, não versionado** — já está no `.specify/.gitignore`. Ele guarda
   qual spec você está tocando agora; os scripts o leem para resolver `FEATURE_DIR`. Se um comando
   reclamar que não há feature, rode `/speckit-specify` ou aponte explicitamente:
   `$env:SPECIFY_FEATURE_DIRECTORY='specs/NNN-nome'; .\.specify\scripts\powershell\check-prerequisites.ps1 -Json`

## Testes

> **Decisão em aberto: não há CI neste repositório** (a do `analise-advpl` só roda `npm run compile`).
> Até existir, **a verificação é local** — e isso é o oposto da regra que vigora no outro projeto do
> dono, onde um pipeline caro justificava proibir execução local.

- **`npm test` roda na máquina, antes do commit.** Num projeto TypeScript custa segundos; não há
  runner para poupar.
- **Teste NUNCA é opcional** (Princípio VI, v2.2.0). Toda tarefa de código é precedida pela sua
  tarefa de teste, escrita para falhar primeiro.
- **Cobertura mínima de 98%** em linhas, funções e ramos. O limiar vive no próprio runner —
  `--experimental-test-coverage` com `--test-coverage-lines/-functions/-branches`, nativo do Node 24,
  **sem dependência nova**. Abaixo do limiar o processo sai com erro; cobertura é portão, não
  relatório. Exclusão só por `coverage-exclusions.json` versionado, **com a razão de cada item** —
  baixar o limiar em vez de declarar a exclusão é violação.
- **Laço TDD sobre o arquivo-alvo daquele passo**, e só ele. Vermelho → verde → segue.
- **O relatório ao usuário diz o que foi rodado, e nada além.** "Suíte verde" só se a suíte rodou.
- ⚠️ **Cuidado ao interpretar execução com pipe**: `npm test | tail` devolve o código de saída do
  `tail`, não do teste. Um "exit code 0" já mascarou suíte que nem chegou a rodar.
- Quando a CI existir, esta seção é reescrita e o portão de merge passa a ser dela.

## Memória do projeto (versionada)

A memória entre sessões vive **versionada no repositório**, em **`memoria/`** — índice em
`memoria/MEMORY.md`, um arquivo por fato. **Não** usar a auto-memória global do Claude Code
(`~/.claude/projects/.../memory/`), que não é versionada. Ao aprender algo durável sobre o projeto,
registrar em `memoria/` e apontar no índice; ao retomar trabalho, consultar lá.

## Idioma

Toda saída ao usuário é em **pt-BR** — inclusive o relatório da `/security-review` (o prompt interno do
comando pode estar em inglês, mas os achados, severidades e recomendações entregues DEVEM ser em
português).

## Decisões em aberto

| Assunto                        | Estado                                                                     |
| ------------------------------ | --------------------------------------------------------------------------- |
| **Taxonomia de origem de regra** | ⚠️ **bloqueia a spec de ProtheusDOC.** As diretrizes da TOTVS exigem ProtheusDOC, mas isso **não tem id no catálogo SonarQube**. A taxonomia só prevê `totvs` (exige id) e `projeto` (regra nossa) — norma da TOTVS sem id não é nem uma nem outra. Criar terceira origem, ou aceitar como `projeto`? Ver [docs/inventario-legado.md](docs/inventario-legado.md) |
| ~~**Ordem do trabalho**~~      | ✅ resolvido — **especificar a 002 primeiro** (feito), **implementar a 001 primeiro**. A [spec 002](specs/002-correcao-e-portabilidade-include/) espera pronta para `/speckit-plan` |
| CI                             | não decidida — verificação local vale até lá                                |
| `tasks-template` teste opcional| a v2.2.0 subordinou o template ao Princípio VI; falta corrigir os 2 arquivos (T081) |
| Mapa de severidade             | 1ª entrada decidida (`MINOR` → `Information`); faltam as demais, em especial `CA2050`/`CA2051`/`CA2052` |
| Linha de base de desempenho    | orçamento provisório **subdimensionado**: o p95 real é 2.933 linhas, não 1.000 |
| `analise-advpl/` no repo raiz  | repo aninhado; definir se vira submódulo, sai do diretório ou fica assim    |
| Revisão de tradução `es` e `ru`| chaves são verificadas por build; a **qualidade** do texto exige revisão humana antes de publicar |
| `package-lock.json` ignorado   | herdado do legado; para extensão (não é lib publicada) versionar daria build reproduzível |
| ~~Índice de specs~~            | ✅ resolvido — [specs/README.md](specs/README.md) é a fonte única de progresso |

## Fontes de Referência

A hierarquia normativa está na constituição (seção *Fontes de Referência*). Em resumo: o catálogo
oficial da TOTVS vence, e `SONNAR-RULES.md` e o PDF **deste** repositório são apoio — os dois se
declaram gerados por IA e já divergem do catálogo.

**As referências normativas da TOTVS estão no repositório**, em [referencias/totvs/](referencias/totvs/)
— cópia byte-idêntica da release `v1.0.1`, consultada em 2026-08-19, com SHA-256 conferido.
Proveniência e o que **não** foi trazido: [PROVENIENCIA.md](referencias/totvs/PROVENIENCIA.md).

| Arquivo local                                | Para quê                                          |
| -------------------------------------------- | ------------------------------------------------- |
| `sonarqube-rules-reference.md`               | catálogo G1–G5: id, título, severidade, API proibida |
| `totvs-advpl-tlpp-guidelines.md`             | notação húngara, nomes, tipos, ProtheusDOC, encoding |
| `skill-code-review.md`, `skill-sql-code-review.md` | como a TOTVS revisa ADVPL/TLPP e SQL         |
| `advpl-tlpp-skills-reference.md`             | índice do pacote — o que existe e não foi trazido |

Fora do repositório: `https://code.visualstudio.com/api` (providers, LSP, ativação) e
`github.com/totvs/engpro-advpl-tlpp-skills` (origem das cópias, caminho de atualização).

⚠️ **Não edite os arquivos de `referencias/totvs/`.** São cópia fiel; correção vive em documento
próprio, senão some na próxima atualização.

⚠️ **`skills.engpro.totvs.io` é SPA sem API** — toda rota devolve o mesmo shell HTML. Consulte o
repositório GitHub, nunca o site.

⚠️ **Encoding é CP1252, não `latin1`.** O compilador Protheus só aceita CP1252, e `latin1` do Node
é ISO-8859-1 — divergem em 0x80–0x9F. O legado errava nisso.
