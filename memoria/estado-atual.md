---
name: estado-atual
description: Onde o projeto parou em 2026-08-19 — o que está pronto, o que falta, e o que está aberto esperando decisão
metadata:
  type: project
---

Retrato do fim da sessão de **2026-08-19**. Este arquivo é o primeiro a ler ao retomar o trabalho.
Ele envelhece: quem avançar o projeto **atualiza aqui**, senão vira mentira.

## Onde estamos

**A spec 001 foi MERGEADA na `master`** em 2026-08-19 — merge `70c5916`, com `--no-ff`, 28 commits e
196 arquivos. A `master` deixou de ser a biblioteca legada e passou a ser **a extensão**. O legado
continua no histórico abaixo do merge, e em `analise-advpl/` como referência de comportamento.

`npm run verify` roda **verde na master**. As branches `001-esqueleto-lsp-harness` e `renew` foram
removidas por já estarem mergeadas; a `002-correcao-e-portabilidade-include` **continua**, com dois
commits próprios que ainda não estão na master.

⚠️ **Nada foi enviado ao remoto.** A `master` local está 29 commits à frente de `origin/master`.

**A spec 001 está COMPLETA**: 90 tarefas, nenhuma pendente. O ciclo inteiro rodou — `specify`,
`plan`, `tasks`, `implement`, `converge` e `security-review`.

`npm run verify` passa **inteiro**, em ~34 s: tipagem, lint, 351 testes unitários com cobertura
99,81/98,80/99,47, as três verificações e 16 testes de integração em VS Code real. As verificações
reprovam de verdade — cada uma foi testada com uma quebra proposital.

A `/speckit-converge` anexou 7 tarefas (`T087`–`T093`) e todas foram fechadas. A mais séria era o
`verify` não rodar a integração: dez testes ficavam fora do portão de merge enquanto o quickstart o
chamava de completo.

A **revisão de segurança** não encontrou vulnerabilidade no código entregue. O único risco real que
ela apontou é futuro e pertence à spec 002 — ler `~/.totvsls/servers.json`, que guarda `savedTokens`.
Virou FR-027b1, FR-027b2 e um SC-016 reforçado, já registrados naquela spec.

**O que falta é a decisão de merge, e ela é sua.**

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

| Bloco | Tarefas | Estado |
| ----- | ------- | ------ |
| ~~US2 — harness e linha de base~~ | ~~`T047`–`T062`~~ | ✅ |
| ~~US3 — configuração e idiomas~~ | ~~`T063`–`T072`~~ | ✅ |
| ~~Portões, README e quickstart~~ | ~~`T073`–`T079`~~ | ✅ |
| ~~Template, memória e cobertura~~ | ~~`T081`–`T085`~~ | ✅ |
| **`/speckit-converge`** | `T086` | **é o que falta** |

`T080` (emenda da constituição) já estava feita.

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
