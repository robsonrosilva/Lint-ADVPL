# Implementation Plan: Ações de correção + portabilidade de include

**Branch**: `002-correcao-e-portabilidade-include` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-correcao-e-portabilidade-include/spec.md`

## Summary

Duas entregas sobre o mesmo objeto — a linha `#include`.

A primeira é **barata e prova o caminho de volta**: do diagnóstico até a correção. `CA3001` ganha
lâmpada, e o arquivo inteiro ganha "corrigir tudo", que é o que habilita a correção ao salvar.

A segunda é **cara e é a razão de a extensão existir**: `PJ0001`, a primeira regra de origem
`projeto`, que compara a referência do include com o **nome real do arquivo no disco**. Ela pega um
defeito que já falha hoje, em silêncio, no AppServer Linux — e que o TOTVS Code Analyzer não detecta
porque não conhece o diretório de includes do projeto.

A abordagem técnica, decidida em [research.md](research.md): **o cliente resolve de onde vêm os
diretórios** (três das quatro fontes só existem através da API do editor), **o servidor indexa o
disco** (são dezenas de milhares de arquivos, e isso não pode acontecer no processo da extensão), e
**o nome real vem de listagem de diretório**, nunca de consulta de existência — porque em Windows e
macOS o sistema de arquivos responde "existe" para a grafia errada, que é o mecanismo que torna o
defeito invisível.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node 24, `module: CommonJS`, `target: ES2022`

**Primary Dependencies**: `vscode-languageserver` 9.x e `vscode-languageclient` 9.x — **nenhuma
dependência nova**. `CodeActionKind.QuickFix`, `CodeActionKind.SourceFixAll` e a capacidade
`codeActionProvider` foram verificados como disponíveis nas versões instaladas em 2026-08-19.

**Storage**: índice em memória, no processo do servidor. Sem persistência — ver R4.

**Testing**: `node:test` nativo com cobertura ≥ 98%; integração via `@vscode/test-cli` em VS Code
real; protocolo LSP direto por `vscode-jsonrpc` quando o editor não alcança.

**Target Platform**: VS Code 1.85+, Windows/Linux/macOS. **O comportamento difere por plataforma e
isso é o assunto da spec**: o sistema de arquivos do Windows e do macOS é insensível a caixa; o do
Linux, onde o AppServer roda, não é.

**Project Type**: extensão de editor — monorepo de três workspaces já estabelecido pela spec 001.

**Performance Goals** (constituição v2.4.0, orçamento medido):

| Item | Teto | Como esta spec o afeta |
| ---- | ---- | ---------------------- |
| Trabalho próprio da ativação | ≤ 50 ms | **não pode subir** — nada da indexação acontece na ativação |
| Ativação completa | ≤ 1000 ms | idem |
| Reanálise do p95 (3.230 linhas) | ≤ 10 ms | `PJ0001` acrescenta custo; precisa caber |
| Reanálise do maior fonte (27.832 linhas) | ≤ 50 ms | idem |
| Do arquivo aberto ao 1º diagnóstico | ≤ 300 ms | **a análise não espera pelo índice** |
| Parada após cancelamento | ≤ 5 ms | a indexação também precisa parar |

**Constraints**: sem I/O síncrono em `packages/server/src` (imposto por lint); sem `console.*` no
motor; nenhum import de `vscode` no motor; CP1252 na leitura de fonte; nenhum fonte do corpus
versionado.

**Scale/Scope**: 35.103 arquivos `.ch` no corpus de referência. Uma regra nova, duas ações de
correção, um índice.

## Constitution Check

*GATE: verificado contra a constituição **v2.4.0**.*

### I. O Editor Nunca Trava — **PASSA, e é o princípio que mais governa esta spec**

| Regra | Como esta spec a cumpre |
| ----- | ----------------------- |
| Análise fora do processo da extensão | o índice e a regra vivem no servidor; o cliente só resolve caminhos |
| I/O síncrono proibido | `opendir`/`readdir` assíncronos; o lint reprova `*Sync` em `packages/server/src` |
| Toda análise aceita cancelamento | a indexação confere o token entre diretórios; o cálculo de ações também |
| Nada ocupa o laço por 50 ms sem ceder | a indexação cede entre diretórios, como `analyze` cede entre fatias de linha |
| Varredura de projeto sob demanda, NUNCA na ativação | R4 — o índice nasce na primeira vez que uma regra precisa dele |
| Cache incremental | invalidação por diretório, nunca reindexação total |
| Sem timeout que rejeita | a indexação demora o que demorar; ela não falha por tempo |

**O ponto de atenção declarado**: o observador de sistema de arquivos. Observar dezenas de milhares
de arquivos é fonte clássica de travamento. A mitigação está em R4 — observar **diretórios**, com
padrão restrito, tratando o evento como invalidação de um diretório.

### II. Formatação e Indentação São Produto — **NÃO SE APLICA**

Esta spec não formata. Duas regras dela, porém, protegem o mesmo valor: a edição devolvida é o
**menor conjunto possível** (FR-005) e **não altera encoding nem fim de linha** (FR-007). Substituir
o documento inteiro destruiria dobras, marcadores e histórico de desfazer — o que o Princípio II
proíbe ao formatador, e que vale igualmente para uma correção.

### III. Valor Está no Que o Padrão Não Vê — **PASSA, e é a razão da spec**

`PJ0001` declara origem `projeto` e a justificativa obrigatória, que é literal e não retórica: o
Analyzer não consegue detectar porque **não conhece o diretório de includes do projeto**. O defeito
já falha em produção, em silêncio.

O FR-036 mantém o princípio honesto: sem taxa de falso positivo medida, a regra entra **desligada**.
Regra ruidosa treina o usuário a ignorar o painel inteiro.

### IV. Toda Regra Tem Identidade, Severidade e Desligamento — **PASSA, com alteração de contrato**

`PJ0001` tem identificador na faixa reservada, chave própria de desligamento, severidade
configurável e página em `docs/regras/`.

**A alteração**: o registro passa a exigir `defaultSeverity` **declarada** em regra `projeto` — o
caminho não existia, porque a severidade vinha da tabela de catálogo e regra `projeto` não tem
catálogo (R5). Não é exceção ao princípio; é o princípio alcançando um caso que ainda não existia.

### V. Multilíngue por Construção — **PASSA**

Mensagem de `PJ0001` e títulos das ações de correção nos quatro idiomas, nos dois mecanismos. O
portão `check:nls` já reprova divergência de chave, e a lista de idiomas continua com ponto único de
declaração.

### VI. Fixture, Teste e Medição Antes da Regra — **PASSA**

Fixture autoral antes da regra; asserção sobre o diagnóstico específico; custo medido pelo harness
que já existe (R8). Cobertura ≥ 98% continua sendo portão.

**Ponto novo desta spec**: fixture de `servers.json` com valor sentinela, para provar o SC-016.

### Arquitetura — Segurança — **PASSA, com requisito reforçado**

A leitura da fonte 1 toca um arquivo que guarda `savedTokens`. FR-027b1 e FR-027b2, vindos da revisão
de segurança, isolam a leitura numa função que extrai e descarta, e proíbem que qualquer mensagem
ecoe conteúdo. R2 detalha, e o SC-016 exige prova por sentinela.

### Portões de Qualidade — **PASSA**

Portão 4 (regressão contra a linha de base) **passa a existir de verdade** nesta spec: a 001 criou a
linha de base, e esta é a primeira entrega que a reconfere depois de acrescentar uma regra.

**Resultado do portão: PASSA.** Nenhuma violação a justificar; a seção Complexity Tracking fica
vazia.

## Project Structure

### Documentation (this feature)

```text
specs/002-correcao-e-portabilidade-include/
├── plan.md              # este arquivo
├── research.md          # Fase 0 — nove decisões
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/           # Fase 1
│   ├── acao-de-correcao.md
│   ├── indice-de-includes.md
│   └── fontes-de-diretorios.md
└── tasks.md             # gerado por /speckit-tasks
```

### Source Code (repository root)

Arquivos **novos** desta spec, sobre a estrutura que a 001 estabeleceu:

```text
packages/
├── extension/
│   └── src/
│       └── include-sources/          # NOVO — a cadeia do FR-027, resolvida no cliente
│           ├── chain.ts              # precedência e recuo entre as quatro fontes
│           ├── tds-vscode.ts         # fonte 1 — extrai e DESCARTA (FR-027b1)
│           ├── advpl-vscode.ts       # fonte 2 — ambiente selecionado
│           ├── own-setting.ts        # fonte 3 — advplLint.includePaths
│           └── workspace-scan.ts     # fonte 4 — último recurso
│
├── server/
│   └── src/
│       ├── includes/                 # NOVO — o índice
│       │   ├── index-store.ts        # mapa nome→nome real, mais os ambíguos
│       │   ├── scan.ts               # percurso assíncrono, cancelável
│       │   └── watcher.ts            # invalidação por diretório
│       ├── actions/                  # NOVO — as correções
│       │   ├── provider.ts           # quickfix e source.fixAll
│       │   ├── ca3001-fix.ts         # troca a diretiva, só ela
│       │   └── pj0001-fix.ts         # troca o nome pelo real do disco
│       └── rules/
│           └── pj0001.ts             # NOVO — a regra de portabilidade
│
└── tooling/
    └── src/harness/
        └── (medição do índice entra em measure.ts e report.ts)
```

**Structure Decision**: a fronteira nova é `include-sources` no cliente contra `includes` no
servidor, e ela existe pela razão de R1 — três das quatro fontes só existem através da API do
editor, e o arquivo com tokens fica num lugar só, longe do motor. O que atravessa a fronteira é uma
lista de caminhos e o nome da fonte que venceu; nada mais.

## Constitution Check — reavaliação pós-desenho

*Refeito depois da Fase 1, com os contratos e o modelo de dados na mão.*

**Continua PASSANDO.** O desenho não introduziu violação; ao contrário, três decisões da Fase 1
endureceram o que o portão inicial deixava genérico:

| Princípio | O que o desenho acrescentou |
| --------- | --------------------------- |
| I | os **três estados** do índice (`ausente`/`construindo`/`pronto`) tornam verificável o "a análise não espera": a regra cala com conhecimento de causa em vez de bloquear |
| III | as **três respostas** da consulta separam `ausente` de `ambíguo` — o silêncio deixa de ser um só e passa a ter razão declarada |
| Segurança | o contrato de fontes fixou onde a extração acontece e o que NUNCA entra numa mensagem; a prova por sentinela cobre log e exceção, não só o retorno |

**Uma verificação nova apareceu no desenho e vale registrar**: o contrato de ação de correção proíbe
`codeAction/resolve` — não por dogma, mas porque a edição aqui é uma troca de palavra cuja posição o
diagnóstico já carrega. O `resolve` custaria uma ida e volta de protocolo para economizar trabalho
inexistente.

## Complexity Tracking

Vazia. Nenhuma violação constitucional a justificar.

O único item que mereceria discussão — o observador de sistema de arquivos sobre dezenas de milhares
de arquivos — está resolvido por desenho em R4 (observar **diretórios**, não arquivos) e continua
registrado como **o risco a vigiar na implementação**. É Princípio I sob outro nome, e é onde esta
spec tem mais chance de reproduzir o defeito que matou a versão anterior.
