# Implementation Plan: Esqueleto vertical da extensão + harness de medição

**Branch**: `001-esqueleto-lsp-harness` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-esqueleto-lsp-harness/spec.md`

## Summary

Fazer nascer o código da extensão pela fatia vertical mais fina que prova a arquitetura inteira: um
fonte ADVPL aberto no editor, analisado por um servidor de linguagem em processo próprio, produz um
diagnóstico `CA3001` com identificador, severidade mapeada e posição exata — desligável por chave de
configuração e legível em dois idiomas. Junto vem o harness que mede quanto isso custa sobre ~35.000
fontes reais, estabelecendo a linha de base que ainda não existe.

A abordagem técnica está detalhada em [research.md](research.md). Três pontos a destacar, porque
mudam o desenho:

1. **O byte CP1252 é decodificado pelo VS Code, não por nós** (R0). No caminho de edição, o
   FR-003 se atende configurando `files.encoding` por linguagem via `configurationDefaults` do
   manifesto. Nosso decodificador próprio serve ao harness e à futura resolução de includes — fora do
   caminho quente. Como CP1252 é de byte único e todos os pontos são do plano básico, deslocamento em
   bytes, índice de caractere e unidade de código UTF-16 coincidem, e a aritmética de coluna fica
   trivialmente correta.
2. **A fronteira cliente/motor é garantida pelo compilador** (R2). `packages/server` não declara
   `vscode` nem `@types/vscode`; um import acidental da API do editor dentro do motor não compila. O
   "a camada VS Code é fina e não analisa nada" do Princípio I deixa de ser disciplina.
3. **`.gitattributes` é a primeira tarefa** (R4). `core.autocrlf=true` está confirmado nesta máquina.
   Sem ele, as fixtures de fim de linha e de codificação seriam normalizadas na entrada do
   repositório e os testes passariam sobre conteúdo que ninguém escreveu.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 24 (medido: `v24.18.0`). Alvo de compilação
`ES2022`, módulo `CommonJS` no que é empacotado para o editor.

**Primary Dependencies**:

| Pacote | Onde | Por quê |
| ------ | ---- | ------- |
| `vscode-languageclient` | `extension` | cliente LSP |
| `vscode-languageserver` + `vscode-languageserver-textdocument` | `server` | servidor LSP e o buffer sincronizado |
| `@vscode/l10n` | `server` | mensagens em tempo de execução, fora do processo do editor |
| `esbuild`, `typescript` | desenvolvimento | empacotamento e portão de tipagem |
| `@vscode/test-cli`, `@vscode/test-electron`, `@types/vscode`, `@types/node` | desenvolvimento | testes de integração e tipos |

**Nenhuma dependência de runtime para decodificar CP1252** — tabela local (R1). **Nenhum runner de
teste** no motor — `node:test` nativo (R3). `analise-advpl` **não** é dependência, em nenhuma forma.

**Storage**: nenhum banco. Artefatos em arquivo: relatório de linha de base versionado
(`baseline/*.json` e `baseline/*.md`); inventário do corpus e material de revisão de falso positivo
em arquivos locais **não versionados**.

**Testing**: `node:test` (Node 24, nativo) em `server` e `tooling`; `@vscode/test-cli` com
`@vscode/test-electron` em `extension`. Compilação por `tsc` para `out/`, testes sobre o JavaScript
gerado.

**Target Platform**: VS Code 1.85+ em desktop (Windows, Linux, macOS), servidor em Node. Ambiente web
do VS Code **fora de escopo** — o servidor precisa de `worker_threads` e de sistema de arquivos.

**Project Type**: extensão de editor com servidor de linguagem — monorepo npm de três workspaces.

**Performance Goals**: ativação ≤ 200 ms (SC-003); primeiro diagnóstico em fonte de 309 linhas
≤ 300 ms (SC-001); digitação sem engasgo em fonte de 7.951 linhas (SC-002); cancelamento efetivo em
≤ 50 ms (SC-009); fonte de 24.636 linhas conclui sem descarte (SC-010).

**Constraints**: sem I/O síncrono no caminho de análise; sem log por linha, por regra ou por arquivo;
nenhuma tarefa ocupa o processamento por mais de 50 ms sem ceder; cada regra vê cada linha uma vez;
nenhum tempo-limite rejeita a análise; caminhos montados com `path.join`.

**Scale/Scope**: uma regra (`CA3001`); corpus de medição com ~27.139 `.prw`, 4.072 `.tlpp`, 3.210
`.prx` e 1.178 `.prg`; amostra medida de no mínimo 1.000 fontes; distribuição de tamanho conhecida —
p50 309, p90 1.699, p95 2.933, p99 7.951, máximo 24.636 linhas.

## Constitution Check

*GATE: passou antes da Phase 0 e reavaliado após a Phase 1. Constituição v2.1.1.*

### I. O Editor Nunca Trava — **PASSA**

| Regra da constituição | Como o desenho atende | Verificado por |
| --------------------- | --------------------- | -------------- |
| Análise fora do processo da extensão, por LSP | `packages/server` em processo próprio; `packages/extension` só orquestra | fronteira imposta pelo compilador (R2) |
| I/O síncrono proibido no caminho de análise | o motor só consome o texto que chega pelo LSP; não abre arquivo | regra de lint que proíbe `*Sync` em `packages/server/src` |
| Log no caminho quente proibido | canal de log com nível, padrão desligado | mesma regra de lint proíbe `console.*` no motor |
| `CancellationToken` respeitado de fato | verificação de cancelamento entre blocos de linhas, não só ao final | teste que cancela no meio e mede quando o trabalho parou |
| ≤ 50 ms sem ceder | análise em blocos, com cessão entre eles | teste de cancelamento (SC-009) |
| Nenhuma passagem O(n²) | `CA3001` é uma varredura única, sem estado entre linhas | revisão + custo medido no harness |
| Cache incremental | **não se aplica**: esta spec não tem cache | — |
| Sem tempo-limite que rejeita | não existe tempo-limite no desenho | teste do arquivo de 24.636 linhas (SC-010) |
| Orçamento de ativação e reanálise | ativação sem I/O; medição registra a linha de base | harness |

### II. Formatação e Indentação São Produto — **NÃO SE APLICA**

Fora de escopo declarado da spec. Nenhuma decisão deste plano fecha porta para ela; ao contrário, a
escolha de manter **codificação e decodificação** CP1252 juntas (R1) existe porque o Princípio II vai
exigir gravar em CP1252.

### III. Valor Está no Que o Padrão Não Vê — **PASSA**

`CA3001` declara origem `totvs`, grupo G3, com data de consulta. A faixa `PJ####` fica reservada
para regras de origem `projeto`, que só entram em specs futuras e aí precisarão documentar o que
pegam que o padrão não pega. A severidade sai de tabela versionada, nunca de cópia literal. A taxa de
falso positivo é medida antes de a regra ser considerada apta a ficar ligada por padrão.

### IV. Toda Regra Tem Identidade, Severidade e Desligamento — **PASSA**

Contrato em [contracts/diagnostico.md](contracts/diagnostico.md) e
[contracts/regra.md](contracts/regra.md). O registro de regras é a fonte única: dele saem as chaves
de `contributes.configuration`, a exigência de documentação e a validação de que nenhum diagnóstico
sai sem identificador.

### V. Bilíngue por Construção — **EXCEDIDO; exige emenda MINOR antes do merge**

A spec adota os **quatro idiomas do Protheus** (D4): `en` como base, mais `pt-br`, `es` e `ru`. O
Princípio V hoje diz literalmente "pt-BR e en", então o desenho vai **além** do que a constituição
exige — o que não é violação, mas também não é silêncio aceitável: ampliação material de escopo é
bump **MINOR** e MUST ser feita por `/speckit-constitution` antes do merge.

O mecanismo: dois pares de arquivos por idioma (manifesto e tempo de execução), oito arquivos ao
todo, com **um único ponto** declarando a lista de idiomas (FR-015a) e verificação que **falha a
construção** na divergência de chaves entre quaisquer dois (R7). É a resposta direta ao defeito
medido no legado, que tinha quatro arquivos de tradução e nada que garantisse que concordassem — com
oito, a verificação deixa de ser zelo e vira necessidade.

**Limite declarado**: o portão prova que as chaves batem, não que a tradução presta. `es` e `ru`
precisam de revisão humana antes da publicação.

### VI. Fixture e Medição Antes da Regra — **PASSA**

A ordem das tarefas põe fixture e teste antes de cada implementação. A asserção compara o diagnóstico
inteiro; contagem agregada é proibida pelo FR-029 e o utilitário de teste não a oferece. O custo de
`CA3001` é medido isoladamente pelo harness antes de a regra ser declarada apta.

⚠️ **Conflito conhecido com o template**: `.specify/templates/tasks-template.md` (linha 12) e
`.claude/skills/speckit-tasks/SKILL.md` (linha 145) declaram testes opcionais. Isso contradiz o
Princípio VI, que é NÃO NEGOCIÁVEL. Ao rodar `/speckit-tasks`, a tarefa de teste vem **antes** da
tarefa de código, sempre.

### Restrições Técnicas — **PASSA**

Ativação restrita às linguagens ADVPL/TLPP, nunca `*`. Empacotamento por esbuild. Sem dependência do
legado. CP1252, não `latin1`. Extensões `prw`, `prx`, `prg`, `apw`, `apl`, `tlpp`. Dependências
mínimas, cada uma justificada em [research.md](research.md). `path.join` em todo caminho. Regra de
segurança que não ecoa valor sensível não se aplica a `CA3001`, mas o contrato de mensagem já a
prevê.

### Portões de Qualidade — **PASSA, com uma ressalva**

`npm run verify` reúne os portões executáveis: tipagem, lint, testes, divergência de NLS, vazamento
de corpus, sincronismo de documentação. O portão 4 (regressão de desempenho contra a linha de base)
**só passa a existir depois** desta spec — é ela que cria a linha de base. Registrado como esperado,
não como violação.

**Resultado do portão: PASSA, com uma emenda pendente.** Nenhuma violação a justificar — a seção
Complexity Tracking fica vazia. A única divergência com a constituição é o Princípio V sendo
**excedido** (quatro idiomas onde ele exige dois), e a correção é emendar a constituição por
`/speckit-constitution`, bump MINOR, antes do merge desta spec.

## Project Structure

### Documentation (this feature)

```text
specs/001-esqueleto-lsp-harness/
├── plan.md              # este arquivo
├── spec.md
├── research.md          # Phase 0 — dez decisões técnicas
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
│   ├── diagnostico.md
│   ├── regra.md
│   ├── configuracao.md
│   └── relatorio-baseline.md
├── checklists/
│   └── requirements.md
├── baseline/            # saída do harness, versionada, criada na implementação
└── tasks.md             # Phase 2 — criado por /speckit-tasks
```

### Source Code (repository root)

```text
.gitattributes                      # T001 — antes de qualquer fixture
package.json                        # workspaces npm + scripts de portão
tsconfig.base.json
eslint.config.js                    # regras que impõem o Princípio I no motor

docs/
└── regras/
    └── CA3001.md                   # um arquivo por identificador de regra

packages/
├── extension/                      # cliente fino — orquestra, não analisa
│   ├── package.json                # manifesto da extensão
│   ├── package.nls.json            # en (base)
│   ├── package.nls.pt-br.json      # os quatro idiomas do Protheus (D4)
│   ├── package.nls.es.json
│   ├── package.nls.ru.json
│   ├── src/
│   │   ├── extension.ts            # activate/deactivate
│   │   ├── client.ts               # criação e ciclo de vida do cliente LSP
│   │   └── encoding-guard.ts       # confere files.encoding e avisa uma vez
│   └── test/integration/
│
├── server/                         # o motor — nenhum import de 'vscode'
│   ├── package.json
│   ├── l10n/
│   │   ├── bundle.l10n.json        # en (base)
│   │   ├── bundle.l10n.pt-br.json
│   │   ├── bundle.l10n.es.json
│   │   └── bundle.l10n.ru.json
│   ├── src/
│   │   ├── server.ts               # conexão LSP, ciclo de vida, debounce
│   │   ├── analysis/
│   │   │   ├── analyze.ts          # orquestra regras, cede a cada bloco
│   │   │   ├── cancellation.ts
│   │   │   └── scanner.ts          # classifica comentário e literal, uma passagem
│   │   ├── rules/
│   │   │   ├── registry.ts         # fonte única de identidade das regras
│   │   │   └── ca3001.ts
│   │   ├── severity/
│   │   │   └── map.ts              # tabela versionada; hoje só MINOR → Information
│   │   ├── text/
│   │   │   └── cp1252.ts           # tabela local de 256 posições, ida e volta
│   │   └── logging/
│   │       └── channel.ts          # nível, desligado por padrão
│   └── test/
│       ├── unit/
│       └── fixtures/               # -text no .gitattributes; autoria declarada
│
└── tooling/                        # nunca empacotado, nunca publicado
    ├── package.json
    └── src/
        ├── harness/
        │   ├── inventory.ts        # percurso com cache local
        │   ├── sample.ts           # estratificação por tamanho
        │   ├── measure.ts          # pool de worker_threads
        │   └── report.ts           # baseline .json e .md
        ├── locales.ts              # ponto ÚNICO que declara en, pt-br, es, ru (FR-015a)
        ├── checks/
        │   ├── nls.ts              # divergência de chave entre os 4 idiomas falha a construção
        │   ├── corpus.ts           # FR-027 — vazamento de corpus
        │   └── docs.ts             # portão 6 — regra ⟺ documentação
        └── fixtures/
            └── generate-large.ts   # fonte de 24.636 linhas, gerado e não versionado
```

**Structure Decision**: monorepo npm de três workspaces, escolhido para que a separação exigida pelo
Princípio I entre camada de editor e motor de análise seja **imposta pelo grafo de dependências**, e
não pela disciplina de quem escreve. `packages/server` não tem acesso ao tipo `vscode`; `tooling`
fica fora do empacotamento e portanto fora do custo de ativação. O detalhe de cada escolha está em
[research.md](research.md), R2.

## Complexity Tracking

> Sem violações da constituição a justificar. Seção intencionalmente vazia.
