---
name: estado-atual
description: Onde o projeto parou em 2026-08-19 — o que está pronto, o que falta, e o que está aberto esperando decisão
metadata:
  type: project
---

Retrato do fim da sessão de **2026-08-19**. Este arquivo é o primeiro a ler ao retomar o trabalho.
Ele envelhece: quem avançar o projeto **atualiza aqui**, senão vira mentira.

## Onde estamos

Branch **`001-esqueleto-lsp-harness`**, cinco commits à frente da `renew`. Nada mergeado.

O **MVP da spec 001 está pronto e verde**: `T001`–`T046` de 86. Existe uma extensão de lint ADVPL
funcionando, com uma regra real do catálogo, sobre a arquitetura que a constituição exige.

**A US2 também está pronta** — `T047`–`T062`, commit `cea5fe4`. O harness de medição existe e a
**linha de base foi medida sobre o corpus real**: 35.659 fontes inventariados, 1.012 medidos em
amostra estratificada. Relatório em `specs/001-esqueleto-lsp-harness/baseline/2026-08-19.{json,md}`,
confronto com o orçamento do Princípio I em `CONFRONTO-2026-08-19.md`. Falta `T063` em diante.

Última execução, nesta máquina, sem cano na saída:

| Comando | Resultado |
| ------- | --------- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run test:unit` | exit 0 — 139 testes, cobertura 100% linhas / 98,47% ramos / 100% funções |
| `npm run test:integration` | 6 testes verdes em VS Code 1.133.0 real |
| `npm run build` | exit 0 |
| `npm run verify` | **FALHA** — e é esperado, ver abaixo |

`npm run verify` falha porque encadeia `check:nls`, `check:corpus` e `check:docs`, que **ainda não
existem** — são as tarefas `T067`, `T073` e `T075`. Não é regressão.

## O que existe de produto

Monorepo de três workspaces. Uma regra: `CA3001` (diretiva de inclusão em caixa baixa), origem
`totvs`, grupo G3, exibida como `Hint`. Diagnóstico com identificador, severidade, posição exata do
token e link para a documentação. Mensagens nos quatro idiomas. Ativação restrita por linguagem.
`files.encoding: windows1252` imposto por `configurationDefaults`.

Depuração pronta: **F5** abre a instância de desenvolvimento no workspace de fixtures. Há também
"Anexar ao servidor de linguagem" (porta 6011) e o compound "Extensão + servidor" — o motor roda em
outro processo, então depurá-lo exige anexar.

## O que falta na spec 001

| Bloco | Tarefas | O que é |
| ----- | ------- | ------- |
| ~~US2~~ | ~~`T047`–`T062`~~ | ✅ feito em 2026-08-19 — harness, amostragem, linha de base medida |
| US3 | `T063`–`T072` | configuração por regra, troca de idioma, verificação de NLS |
| Portões | `T073`–`T079` | vazamento de corpus, sincronismo de docs, README, quickstart |
| Cobertura | `T083`–`T085` | lista de exclusões e o 98% aferido no fim |
| Fechamento | `T081`, `T082`, `T086` | corrigir o template, atualizar memória, `/speckit-converge` |

`T080` (emenda da constituição) já está **feita**.

## O que está aberto esperando decisão sua

1. **Taxonomia de origem de regra.** As regras de ProtheusDOC são exigidas pelas diretrizes oficiais
   da TOTVS mas **não têm identificador no catálogo SonarQube**. A taxonomia só prevê `totvs` (exige
   id de catálogo) e `projeto` (regra nossa). Norma da TOTVS sem id não é nem uma nem outra. Ou se
   cria uma terceira origem, ou entram como `projeto` citando a diretriz — o que embaralha o
   significado de `projeto`. Detalhe em `docs/inventario-legado.md`.
2. **Ordem do trabalho.** A spec 002 já tem escopo decidido (ver [[spec-002-escopo-decidido]]), mas
   não foi aberta. A alternativa é fechar a 001 antes.
3. **`analise-advpl/` continua repositório aninhado** e fora do versionamento. `TODO(REPO_LAYOUT)`.
4. **CI não existe.** `TODO(CI)`. Verificação é local.

## Fios soltos menores

- `package-lock.json` está no `.gitignore`, herdado do legado. Para uma extensão — que não é
  biblioteca publicada — versionar o lock daria build reproduzível. Não foi mexido: é decisão do dono.
- `.vscode/settings.json` tem `terminal.integrated.shell.windows`, configuração descontinuada pelo
  VS Code. Inofensiva, não foi mexida.
- O `README.md` da raiz ainda descreve a **biblioteca legada**, não a extensão. É a tarefa `T077`, e
  o Portão 6 da constituição bloqueia merge com documentação dessincronizada.

Ver [[armadilhas-do-ambiente]] antes de rodar qualquer coisa.
