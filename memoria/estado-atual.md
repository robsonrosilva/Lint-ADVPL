---
name: estado-atual
description: Onde o projeto parou em 2026-08-20 — o que está pronto, o que falta, e o que está aberto esperando decisão
metadata:
  type: project
---

Retrato do fim da sessão de **2026-08-20**. Este arquivo é o primeiro a ler ao retomar o trabalho.
Ele envelhece: quem avançar o projeto **atualiza aqui**, senão vira mentira.

## Onde estamos

**A spec 001 está mergeada na `master`** (merge `70c5916`, 2026-08-19). A `master` deixou de ser a
biblioteca legada e passou a ser a extensão.

**A spec 002 está COMPLETA**: **78 de 78 tarefas**, ciclo inteiro. `specify`, `plan`, `tasks`,
`implement`, `converge` (7 tarefas anexadas e todas fechadas) e `security-review` **sem nenhum achado
HIGH ou MEDIUM**.

⚠️ **Nada foi enviado ao remoto.** A `master` local continua à frente de `origin/master` — nem a
spec 001, mergeada em 2026-08-19, foi publicada.

`npm run verify` roda **verde**, exit 0, medido nesta máquina sem cano na saída:

| Etapa | Resultado |
| ----- | --------- |
| `typecheck` | ✅ |
| `lint` | ✅ |
| `test:unit` | ✅ **632 testes**, cobertura **99,86 / 98,83 / 99,01** |
| `check:nls` | ✅ quatro idiomas, manifesto em dia com o registro, **e o pacote de tradução onde o manifesto diz** |
| `check:corpus` | ✅ 195 arquivos versionados, nenhum fonte do corpus |
| `check:docs` | ✅ 2 regras, cada uma com página e listada no README |
| `test:integration` | ✅ **45 testes** em VS Code 1.134.0 real |

**Existe CI desde 2026-08-20**: `.github/workflows/verify.yml`, três jobs mais o portão. Ela quebra o
`verify` em pedaços de propósito — encadear a integração logo depois de 632 testes paralelos reprova
por CARGA, não por regressão. O `verify` local continua sendo o portão completo.

## O que a spec 002 entregou

**Correção automática, ponta a ponta.** `quickfix` por diagnóstico e `source.fixAll` para o arquivo —
que é o tipo que o VS Code usa para `editor.codeActionsOnSave`, ou seja: corrigir ao salvar funciona
sem uma linha de código no cliente. A edição é sempre a **mínima** (prefixo e sufixo coincidentes são
descartados), viaja na forma **versionada** do protocolo (o editor recusa se o texto mudou), e
respeita cancelamento parando de fato.

**`PJ0001`, a primeira regra de origem `projeto`.** Compara a referência do `#include` com o **nome
real do arquivo no disco**, lido por **listagem de diretório** — nunca por consulta de existência,
que em Windows responde "existe" para a grafia errada. É o defeito que quebra a compilação no
AppServer Linux em silêncio.

**A cadeia de fontes de include, no cliente**: tds-vscode → advpl-vscode → `advplLint.includePaths` →
workspace, parando na primeira fonte **utilizável** (não na primeira presente). O comando
`advplLint.showIncludeSources` diz qual venceu e quais diretórios ela produziu.

**O índice, no servidor**: sob demanda, cancelável, com invalidação **por diretório** (nunca
reindexação total), e três estados observáveis — a análise **não espera** por ele.

**Duas correções na mesma linha convivem**: `#INCLUDE "acadef.ch"` vira `#include "ACADEF.CH"`, com
intervalos disjuntos e resultado independente da ordem.

## O que existe de produto

Monorepo de três workspaces. **Duas regras**:

| Regra | Origem | Severidade | Padrão |
| ----- | ------ | ---------- | ------ |
| `CA3001` | catálogo TOTVS, G3 | `Information` | ligada |
| `PJ0001` | **projeto** | `Information` | **ligada** — ver [[pj0001-medicao-e-decisao]] |

As duas são `Information` pela MESMA razão, e ela é de volume, não de gravidade: cada uma dispara em
~72% dos fontes do corpus, e `Warning` inflaria a contagem de avisos de quase todo arquivo.

Depuração pronta: **F5** abre a instância de desenvolvimento no workspace de fixtures.

## Defeitos encontrados e corrigidos nesta sessão

Cinco, e nenhum estava previsto. **O mais grave foi achado pela `/speckit-converge`**, não por alguém
olhando:

0. **O observador de sistema de arquivos não chegava ao servidor.** O `LanguageClient` só encaminha
   os eventos dos watchers declarados em `synchronize.fileEvents`, que é fixado na CONSTRUÇÃO do
   cliente — antes de qualquer diretório de include existir. Watcher criado depois disparava no
   processo da extensão e morria ali. Cada elo tinha teste unitário e passava; a corrente inteira
   estava rompida, e o único jeito de ver isso era puxá-la de ponta a ponta num editor de verdade.
   Correção: o cliente manda `workspace/didChangeWatchedFiles` à mão. O teste que estourava 25 s
   passou a levar 415 ms.

0b. **Descarte duplo dos watchers.** Eles eram empilhados em `context.subscriptions` a cada resolução
   da cadeia e descartados à mão. Em Windows isso saía como
   `PostQueuedCompletionStatus: (6) Identificador inválido` e código de saída de abort **depois de
   todos os testes passarem**.

E os três já registrados:

1. **`"l10n": "./l10n"` no manifesto apontava para um diretório que não existe.** A tradução de
   runtime da extensão **nunca carregava** — `l10n.t('encoding.wrongEncoding')` devolvia a chave
   crua. É o modo de falha que o Princípio V existe para impedir, e passou despercebido porque
   `check:nls` confere paridade de chaves, não se o pacote é encontrado. Corrigido para `./dist/l10n`.

2. **A configuração do `vscode-test` usava um glob, e `glob` não devolve em ordem alfabética.** Com
   um arquivo de integração só, a fragilidade não tinha como aparecer; com o segundo, `code-actions`
   passou a rodar antes de `activation` e os dois testes de ativação reprovaram na hora. Agora a
   lista é explícita e ordenada, e `verify-gate.test.ts` confere que toda suíte versionada está lá.

3. **O material de revisão de falso positivo era escrito num arquivo só**, nomeado pela primeira
   regra. Com duas regras, os disparos de `PJ0001` iam para dentro de `CA3001.md`. Agora é um arquivo
   por regra, com amostragem por regra.

## Decisões tomadas em 2026-08-20

Quatro que estavam abertas foram fechadas pelo dono nesta sessão:

| Assunto | Decisão |
| ------- | ------- |
| `PJ0001` ligada por padrão? | **ligada**, como `Information` — ver [[pj0001-medicao-e-decisao]] |
| Taxonomia de origem de regra | terceira origem **`diretriz`**, constituição **v2.5.0**. ⚠️ `TODO(DIRETRIZ_REGISTRY)`: o registro ainda não a implementa — isso vem com a primeira regra que a use |
| `package-lock.json` | **versionado**. `npm ci` na CI depende dele |
| `analise-advpl/` | **fica como está** — repositório aninhado, não versionado, só fonte de conhecimento. NÃO vira submódulo |
| CI | **criada** — `.github/workflows/verify.yml` |

## O que continua aberto

1. **Publicar no remoto.** Nada foi enviado, nem a spec 001.
2. **Mapa de severidade** — falta decidir `CA2050`/`CA2051`/`CA2052`, que são `INFO` no catálogo e
   alto impacto na prática.
3. **A cadeia aponta a árvore CERTA?** `PJ0001` está ligada e depende disso. Hoje só o comando
   `advplLint.showIncludeSources` distingue "não dispara" de "dispara sobre a árvore errada", e quem
   confere é o humano. É a ressalva registrada na página da regra.
4. **Revisão humana de `es` e `ru`.** As chaves são verificadas por build; a QUALIDADE do texto, não.

## Ressalvas honestas da medição

Registradas em `specs/001-esqueleto-lsp-harness/baseline/CONFRONTO-2026-08-20.md`:

- **O custo máximo por regra sai NEGATIVO** e não serve como aferidor. É limite do método: no maior
  fonte do corpus, a variação entre duas execuções é maior que a contribuição de uma regra, e a
  subtração pode dar negativo. O p50 e o p95, que são medianas de cinco repetições, valem.
- **O `activationMs` do harness subiu de 41 ms para 244 ms** — mas ele roda logo depois de uma
  varredura de 35 mil arquivos, e é isso que ele está medindo. Quem afere a ativação de verdade é o
  teste de integração, que continua cobrando 50 ms de trabalho próprio e 1000 ms de ativação
  completa, e continua verde. Rodar a medição de partida ANTES da indexação é a correção provável.
- **O custo de indexação varia 2,4×** com o cache do sistema de arquivos (9,4 s quente, 22,8 s frio).
  O número a acompanhar é o de cache quente.

## Fios soltos menores

- `package-lock.json` está no `.gitignore`, herdado do legado. Para uma extensão — que não é
  biblioteca publicada — versionar o lock daria build reproduzível. Decisão do dono.
- `.vscode/settings.json` tem `terminal.integrated.shell.windows`, configuração descontinuada.
- A tradução de `es` e `ru` é verificada por chave, nunca por qualidade. Antes de publicar, revisão
  humana de quem fala o idioma.

Ver [[armadilhas-do-ambiente]] antes de rodar qualquer coisa — ela ganhou duas entradas hoje, sobre
teste de relógio com piso e sobre a integração reprovar quando roda logo depois da suíte unitária.
