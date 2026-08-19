# ADVPL Lint

Extensão de VS Code para análise de fontes **ADVPL/TLPP** do TOTVS Protheus.

> ⚠️ **Em desenvolvimento, e ainda não publicada.** Hoje o produto entrega **uma** regra, ponta a
> ponta, sobre a arquitetura que o resto vai usar. Este README descreve o que existe — não o que
> está planejado. O que está planejado tem lugar próprio, no fim da página.

## Por que esta extensão existe

A extensão anterior — que ainda vive em [`analise-advpl/`](analise-advpl/) como referência congelada —
foi abandonada porque **travava o editor**. A causa não era mistério: análise no processo da
extensão, `console.log` por linha de cada arquivo, varredura de todas as linhas dentro do laço por
linha, cache inteiro reescrito de forma síncrona a cada arquivo, e um tempo-limite que simplesmente
**rejeitava** a análise de fontes grandes sem avisar ninguém.

Esta versão é reescrita do zero, e o primeiro princípio da sua
[constituição](.specify/memory/constitution.md) é **"O Editor Nunca Trava"** — com cada regra
apontando o defeito medido que a originou.

## O que ela faz hoje

Abrir um fonte `.prw`, `.prx`, `.prg`, `.apw`, `.apl` ou `.tlpp` e ver o diagnóstico aparecer,
enquanto se digita, sem engasgo — em fonte de 300 linhas e em fonte de 27 mil.

### Regras implementadas

<!-- regras:início -->

| Identificador | Origem | Grupo | Severidade | O que aponta |
| ------------- | ------ | ----- | ---------- | ------------ |
| [`CA3001`](docs/regras/CA3001.md) | catálogo TOTVS | G3 — Legacy and Deprecated Code | `Information` | diretiva de inclusão que não está em caixa baixa (`#INCLUDE` em vez de `#include`) |

<!-- regras:fim -->

Uma só, e é proposital: a spec que gerou o código entregou **o caminho completo** do arquivo aberto
até o diagnóstico na tela, mais o instrumento que mede o custo disso, **antes** de qualquer regra
cara existir. A régua tinha de existir primeiro.

### Configuração

| Chave | Padrão | Para quê |
| ----- | ------ | -------- |
| `advplLint.rules.CA3001.enabled` | `true` | liga e desliga a regra |
| `advplLint.rules.CA3001.severity` | `"default"` | severidade exibida; `default` usa a tabela versionada |
| `advplLint.trace.server` | `"off"` | rastreamento do protocolo |
| `advplLint.log.level` | `"off"` | nível do log da extensão |

Mudar qualquer uma faz efeito **sem reiniciar o editor**. Toda regra tem chave própria de
desligamento e severidade configurável — regra sem isso é rejeitada no registro.

### Idiomas

Mensagens em **português do Brasil, espanhol, inglês e russo** — os quatro idiomas em que o Protheus
é localizado. Idioma sem tradução recai no inglês, nunca no identificador cru da chave. Um portão de
build reprova se as chaves divergirem entre quaisquer dois idiomas.

> A verificação prova que as **chaves** batem. Ela não diz nada sobre a **qualidade** do texto:
> espanhol e russo precisam de revisão de quem fala o idioma antes da publicação.

### Codificação

Fonte Protheus é **CP1252 (Windows-1252)** — é o único code page que os compiladores aceitam. A
extensão impõe isso como padrão por linguagem, e avisa uma vez por sessão se o arquivo estiver sendo
lido de outro jeito. Ler como `latin1` **não** é equivalente: os dois divergem em 0x80–0x9F, faixa do
travessão e das aspas tipográficas, e a divergência desloca a coluna do diagnóstico.

## Desempenho, medido

Linha de base de **2026-08-19**, sobre 35.659 fontes reais, amostra estratificada de 1.012 arquivos,
cinco repetições por arquivo (mediana). Relatório completo em
[`specs/001-esqueleto-lsp-harness/baseline/`](specs/001-esqueleto-lsp-harness/baseline/).

| Percentil de tamanho | Linhas | Análise |
| -------------------- | ------ | ------- |
| p50 | 309 | 0,09 ms |
| p90 | 1.862 | 0,45 ms |
| p95 | 3.230 | 0,91 ms |
| p99 | 10.155 | 2,76 ms |
| maior fonte | 27.832 | 4,71 ms |

Partida do motor: **41 ms**. Parada após cancelamento: **0,09 ms** — digitar interrompe a análise em
curso de fato, e não "descarta o resultado no fim", que era o comportamento do legado.

O corpus de medição é externo, local e **nunca versionado**: são fontes padrão do Protheus. Um portão
do build reprova se qualquer um deles entrar no repositório.

## Arquitetura

```text
packages/
  extension/   cliente fino de VS Code — orquestra, NÃO analisa
  server/      o motor, em Language Server próprio — nenhum import de `vscode`
  tooling/     harness de medição e portões — nunca empacotado, nunca publicado
```

O motor **não roda no processo da extensão**. Ele vive em processo próprio, fala LSP, aceita
cancelamento em toda análise, cede o laço de eventos a cada fatia de trabalho e nunca faz I/O
síncrono no caminho quente. Não há tempo-limite que rejeite a análise: fonte grande demora mais, ela
não falha.

## Desenvolvimento

Requer Node 24 ou mais novo.

```bash
npm install
npm run verify          # o portão completo: tipos, lint, testes com cobertura, as três
                        # verificações e a suíte de integração. ~23 s.
```

| Comando | O que faz |
| ------- | --------- |
| `npm run typecheck` | compila os três workspaces |
| `npm run lint` | ESLint, incluindo as regras que impedem I/O síncrono e log no motor |
| `npm run test:unit` | testes unitários **com o limiar de cobertura de 98%** |
| `npm run test:integration` | reconstrói e roda dentro de um VS Code real |
| `npm run build` | empacota com esbuild |
| `npm run baseline` | mede o corpus e gera a linha de base (precisa do corpus configurado) |

**F5** abre a instância de desenvolvimento com o workspace de fixtures. A extensão **não** está
instalada no seu VS Code — ela só existe sob F5 ou empacotada em `.vsix`.

Para rodar a medição, aponte o corpus: variável `ADVPL_LINT_CORPUS` ou um `corpus.local.json` na
raiz. Sem corpus, a medição avisa e encerra com sucesso — a suíte de testes não depende dele.

### Como o projeto é conduzido

- A [**constituição**](.specify/memory/constitution.md) é a autoridade: seis princípios, dois deles
  não negociáveis. Leia antes de propor código.
- O trabalho segue **Spec-Driven Development**: uma pasta por feature em [`specs/`](specs/), com
  índice em [`specs/README.md`](specs/README.md).
- **Teste nunca é opcional.** Toda tarefa de código é precedida pela sua tarefa de teste, escrita
  para falhar primeiro. Cobertura mínima de 98% em linhas, funções e ramos é portão de merge, e
  exclusão só existe declarada com razão em [`coverage-exclusions.json`](coverage-exclusions.json).
- Toda regra entra com **fixture, asserção específica e custo medido**. Nenhuma regra é ligada por
  padrão sem taxa de falso positivo apurada sobre fontes reais.

## O que vem a seguir

O backlog completo está em [`specs/README.md`](specs/README.md). Em ordem indicativa:

- **ações de correção** — a lâmpada que conserta `#INCLUDE`, e "corrigir todas deste arquivo";
- **portabilidade de include** — referência cujo nome não bate com a caixa do arquivo no disco, que
  já falha hoje no AppServer Linux, em silêncio;
- **formatação e indentação**, que era a força da versão anterior;
- o restante do catálogo TOTVS (G1 a G5) e as 28 críticas próprias herdadas do legado, inventariadas
  em [`docs/inventario-legado.md`](docs/inventario-legado.md).

## Referências

O catálogo oficial da TOTVS e as diretrizes estão versionados em
[`referencias/totvs/`](referencias/totvs/), em cópia byte-idêntica da release `v1.0.1`, com
proveniência registrada. Em conflito, o catálogo oficial vence — inclusive sobre os documentos deste
repositório que se declaram gerados por IA.

## Licença

MIT.
