# Feature Specification: Ações de correção + portabilidade de include

**Feature Branch**: `002-correcao-e-portabilidade-include`

**Created**: 2026-08-19

**Status**: Draft — pronta para `/speckit-plan`; nenhum ponto de esclarecimento em aberto

**Input**: Descrição do usuário: "Ações de correção (codeAction) e regra de portabilidade de include. Escopo decidido pelo dono em 2026-08-19, registrado em `memoria/spec-002-escopo-decidido.md`."

---

## Contexto

A spec 001 entregou o caminho de ida: do arquivo aberto até o diagnóstico na tela, com identificador,
severidade e posição exata. Esta spec entrega o **caminho de volta** — do diagnóstico até a correção
— e a **primeira regra de origem `projeto`** do produto: a primeira coisa que esta extensão faz e que
o TOTVS Code Analyzer não consegue fazer.

As duas metades estão na mesma spec porque tratam do **mesmo objeto**: a linha `#include`. A primeira
é barata e prova o caminho de correção ponta a ponta sobre uma regra que já existe. A segunda é cara,
porque exige que o motor saiba **o que existe no disco** — e é aí que o Princípio I inteiro volta à
mesa: varredura sob demanda, nunca na ativação, cancelável, incremental, sem I/O síncrono.

### Por que a correção mexe na diretiva e nunca no nome do arquivo

Medição de 2026-08-19 sobre o corpus (`memoria/medicao-includes-corpus.md` — 6.000 fontes amostrados,
35.103 arquivos `.ch` no disco, 15.306 diretivas lidas):

| O quê | Resultado |
| ----- | --------- |
| Diretivas em caixa alta (`#INCLUDE`) | 11.006 de 15.306 — **71,9%** |
| Arquivos `.ch` cujo nome real tem maiúscula | 2.475 de 35.103 — **7%** |
| Referências que **quebrariam** se a caixa do nome fosse baixada | **706** |

Corrigir a **diretiva** é provadamente inerte: se o pré-processador do Protheus fosse sensível a
caixa, 71,9% dos fontes do corpus não compilariam. Corrigir o **nome do arquivo** para caixa baixa
**não** é inerte — quebraria 706 referências que hoje resolvem, e quebraria justamente no Linux, onde
o AppServer roda e o sistema de arquivos distingue caixa.

Essa assimetria é o motivo de a spec separar as duas coisas, e é o motivo de a regra de portabilidade
comparar a referência com o **nome real do arquivo**, em vez de exigir caixa baixa.

### Por que a regra de portabilidade é `projeto` e não `totvs`

O defeito que ela pega — referência `acadef.ch` para um arquivo que no disco se chama `ACADEF.CH` —
**já falha hoje, em silêncio, no AppServer Linux**. O TOTVS Code Analyzer não o detecta, e não por
descuido: detectá-lo exige conhecer o diretório de includes do projeto, que é informação local, fora
do fonte analisado. É o Princípio III em estado puro, e é a justificativa obrigatória que o contrato
de regra exige de toda regra `projeto`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A lâmpada corrige o `#INCLUDE` (Priority: P1)

Um desenvolvedor Protheus abre um fonte `.prw` e vê o diagnóstico `CA3001` sobre `#INCLUDE`. Ele põe
o cursor na linha, a lâmpada 💡 aparece, e escolher a única ação oferecida troca `#INCLUDE` por
`#include` — sem tocar em mais nada da linha, sem tocar no nome do arquivo, sem reformatar o
documento. O diagnóstico some sozinho.

**Why this priority**: é a fatia vertical do caminho de correção. Se só isto for entregue, existe uma
extensão que **conserta** o que aponta, sobre uma regra real do catálogo, com o menor risco possível —
a correção provadamente inerte. Todo o resto desta spec se pendura neste caminho.

**Independent Test**: abrir uma fixture com `#INCLUDE` em caixa alta, invocar a ação de correção sobre
o diagnóstico e conferir que o texto resultante difere do original **exatamente** nos caracteres da
diretiva, e que o diagnóstico desaparece sem salvar o arquivo.

**Acceptance Scenarios**:

1. **Given** um fonte com `#INCLUDE "TOTVS.CH"` na linha 3, **When** o desenvolvedor pede as ações de
   correção com o cursor nessa linha, **Then** é oferecida uma ação de correção rápida, com título
   traduzido, associada ao diagnóstico `CA3001`.
2. **Given** essa ação, **When** ele a aplica, **Then** a linha passa a ser `#include "TOTVS.CH"` — o
   nome do arquivo permanece **byte a byte** o que era, inclusive a caixa.
3. **Given** `#InClUdE "totvs.ch"`, **When** a ação é aplicada, **Then** o resultado é
   `#include "totvs.ch"`.
4. **Given** um fonte gravado em CP1252 com CRLF, **When** a ação é aplicada, **Then** o arquivo
   continua em CP1252 com CRLF e nenhuma outra linha é alterada.
5. **Given** um `#INCLUDE` dentro de comentário ou de literal de texto — que não gera diagnóstico —,
   **When** o desenvolvedor pede as ações de correção ali, **Then** nenhuma ação desta extensão é
   oferecida.
6. **Given** um diagnóstico `CA3001` calculado sobre a versão N do documento, **When** o documento já
   mudou para a versão N+1 quando a ação é aplicada, **Then** a edição obsoleta **não** é aplicada e o
   documento não é corrompido.

---

### User Story 2 — Corrigir todos deste arquivo, e ao salvar (Priority: P2)

O desenvolvedor abre um fonte com dezenas de `#INCLUDE` em caixa alta. Em vez de clicar dezenas de
vezes, ele escolhe "corrigir tudo" uma vez e o arquivo inteiro fica consistente. Se preferir, liga a
correção ao salvar e nunca mais pensa no assunto.

**Why this priority**: 71,9% das diretivas do corpus estão em caixa alta — um fonte real tem muitas
ocorrências, e corrigir uma a uma transforma uma correção inerte em trabalho manual. É P2 e não P1
porque depende do caminho de correção individual existir primeiro.

**Independent Test**: abrir uma fixture com várias ocorrências, aplicar a ação de "corrigir tudo" uma
vez e conferir que todas foram corrigidas em **uma** operação de desfazer; depois ligar a correção ao
salvar e conferir que salvar produz o mesmo resultado.

**Acceptance Scenarios**:

1. **Given** um fonte com 12 diretivas em caixa alta, **When** o desenvolvedor aplica "corrigir todos
   deste arquivo", **Then** as 12 são corrigidas e um único desfazer reverte todas.
2. **Given** o mesmo fonte, **When** ele liga a correção automática ao salvar e salva, **Then** o
   arquivo salvo tem as 12 corrigidas.
3. **Given** o maior fonte disponível (24.636 linhas), **When** a correção ao salvar dispara,
   **Then** o salvamento não fica perceptivelmente mais lento e nenhuma correção é perdida.
4. **Given** um fonte **sem** nenhuma violação, **When** a correção ao salvar dispara, **Then**
   nenhuma edição é produzida e o arquivo não é marcado como modificado.
5. **Given** um fonte com uma diretiva em caixa alta **e** uma referência com problema de
   portabilidade na mesma linha, **When** "corrigir tudo" é aplicado, **Then** o resultado é
   determinístico e as duas correções não se sobrepõem nem se anulam.

---

### User Story 3 — A extensão avisa o que o padrão não vê (Priority: P3)

O desenvolvedor escreveu `#include "acadef.ch"`. No Windows compila; no AppServer Linux, onde o
sistema de arquivos distingue caixa, falha — porque o arquivo no disco se chama `ACADEF.CH`. Hoje ele
descobre isso no deploy. Com esta regra, ele descobre enquanto escreve: a referência é marcada, a
mensagem diz qual é o nome real, e o painel mostra o identificador `PJ0001`.

**Why this priority**: é a razão de existir da extensão (Princípio III) e o defeito mais caro dos
quatro, porque falha longe de onde foi escrito. É P3 e não P1 porque exige a metade cara — o índice
do que existe no disco — e porque o caminho de correção precisa existir antes de valer a pena.

**Independent Test**: apontar a extensão para um diretório de includes controlado, contendo
`ACADEF.CH`, abrir uma fixture que referencia `acadef.ch` e conferir que sai um diagnóstico `PJ0001`
com o intervalo exato sobre a referência e o nome real na mensagem — e que referências que batem com o
disco **não** produzem diagnóstico.

**Acceptance Scenarios**:

1. **Given** o disco contém `ACADEF.CH` e o fonte referencia `"acadef.ch"`, **When** a análise roda,
   **Then** sai um diagnóstico `PJ0001` cujo intervalo cobre exatamente o nome referenciado — sem as
   aspas, sem a diretiva — e cuja mensagem cita o nome real, `ACADEF.CH`.
2. **Given** o disco contém `TOTVS.CH` e o fonte referencia `"TOTVS.CH"`, **When** a análise roda,
   **Then** nenhum diagnóstico `PJ0001` é emitido.
3. **Given** o fonte referencia um arquivo que **não existe** em nenhum diretório indexado, **When** a
   análise roda, **Then** nenhum diagnóstico `PJ0001` é emitido — "include faltante" é outra regra,
   fora do escopo desta spec.
4. **Given** dois arquivos de mesmo nome e caixas diferentes em diretórios indexados distintos,
   **When** a análise roda, **Then** nenhum diagnóstico `PJ0001` é emitido, porque a referência é
   ambígua e apontar um dos dois seria adivinhação.
5. **Given** um editor recém-aberto em um projeto grande, **When** o desenvolvedor abre o primeiro
   fonte, **Then** o editor responde imediatamente — a indexação do disco corre em segundo plano, com
   progresso visível e cancelável, e nunca na ativação da extensão.
6. **Given** a indexação ainda em curso, **When** um fonte é analisado, **Then** as demais regras
   produzem seus diagnósticos normalmente e `PJ0001` simplesmente ainda não se pronuncia — a análise
   **não** espera pelo índice.
7. **Given** o índice pronto, **When** um arquivo de include é criado, renomeado ou apagado no disco,
   **Then** o índice reflete a mudança sem reindexar tudo, e os documentos abertos são revalidados.
8. **Given** nenhum diretório de includes disponível ou configurado, **When** o desenvolvedor edita
   normalmente, **Then** a regra fica silenciosa — nenhum diagnóstico, nenhum erro repetido, no
   máximo **um** aviso acionável por sessão.
9. **Given** a extensão oficial da TOTVS instalada mas com a lista de includes vazia, e a outra
   extensão ADVPL sem ambiente configurado, **When** a extensão resolve de onde indexar, **Then** ela
   recua pela cadeia até a chave própria e, na falta dela, até o workspace aberto — sem pedir nada ao
   usuário.
10. **Given** que o desenvolvedor quer saber por que `PJ0001` não aponta nada, **When** ele consulta a
    extensão, **Then** ela diz **qual** fonte da cadeia está em uso e **quais** diretórios ela
    produziu.

---

### User Story 4 — A lâmpada ajusta a referência ao nome real (Priority: P4)

Diante do diagnóstico `PJ0001`, o desenvolvedor não precisa abrir o explorador de arquivos para
descobrir a caixa certa. A lâmpada oferece trocar `acadef.ch` pelo nome real, `ACADEF.CH`, que a
extensão leu do disco.

**Why this priority**: fecha o ciclo detectar → corrigir da regra que justifica a spec. É P4 porque a
detecção sozinha já entrega o valor — saber onde está o defeito —, e porque esta é a única correção
das quatro histórias que **não** é inerte: ela muda o nome referenciado.

**Independent Test**: com o diretório de includes controlado, aplicar a ação sobre um diagnóstico
`PJ0001` e conferir que a referência passou a ser exatamente o nome lido do disco, e que o diagnóstico
desapareceu.

**Acceptance Scenarios**:

1. **Given** um diagnóstico `PJ0001` em `#include "acadef.ch"` com `ACADEF.CH` no disco, **When** a
   ação é aplicada, **Then** a linha passa a ser `#include "ACADEF.CH"` e o diagnóstico some.
2. **Given** essa mesma linha com a diretiva em caixa alta (`#INCLUDE "acadef.ch"`), **When** as duas
   correções são aplicadas, **Then** o resultado é `#include "ACADEF.CH"` — as duas ações operam sobre
   trechos disjuntos da linha.
3. **Given** que o arquivo referenciado foi apagado do disco entre a análise e a aplicação da ação,
   **When** a ação é aplicada, **Then** nada é editado e o usuário não fica com uma referência para um
   arquivo inexistente.

---

### Edge Cases

- **Sistema de arquivos insensível a caixa.** No Windows e no macOS padrão, perguntar "o arquivo
  `acadef.ch` existe?" responde **sim** mesmo quando o disco guarda `ACADEF.CH` — e é exatamente esse
  "sim" que faz o defeito ser invisível hoje. O nome real MUST vir da **listagem** do diretório, nunca
  de uma consulta de existência pelo nome referenciado.
- **Duas referências ao mesmo arquivo com caixas diferentes** no mesmo fonte: cada uma é avaliada
  isoladamente; uma pode disparar e a outra não.
- **Mais de um `#include` na mesma linha física** — cada ocorrência tem seu próprio intervalo e sua
  própria correção.
- **Referência com caminho**, e não apenas nome (`#include "..\includes\x.ch"` ou com barra normal):
  a comparação de caixa vale para o nome do arquivo; o que fazer com a caixa dos diretórios do caminho
  precisa ser decidido no plano, não presumido aqui.
- **Referência com sintaxe de colchetes angulares** (`#include <x.ch>`): **não ocorre** — varredura de
  2026-08-19 sobre os `.prw` do corpus não achou nenhuma. Fica **fora de escopo**, com o número
  registrado; se aparecer em `.tlpp` ou `.prg` mais tarde, é regra nova, não correção.
- **Diretório de includes gigantesco**: 35.103 arquivos `.ch` no corpus. Indexar todos de uma vez, de
  forma ingênua, é justamente o defeito do legado (`readFileSync` e `statSync` por fonte do projeto).
- **Diretório de includes em unidade de rede lenta ou indisponível**: a indexação falha ou demora sem
  derrubar a análise nem repetir aviso.
- **Configuração de terceiro presente e vazia** — exatamente o estado medido na máquina de referência:
  `includes: [""]` e `advpl.environments: []`. Presença não é utilidade; a cadeia recua.
- **Configuração de terceiro com formato inesperado** ou arquivo corrompido: recua para a próxima
  fonte, sem erro ao usuário — nenhum dos dois formatos é contrato nosso.
- **A fonte da cadeia muda enquanto o editor está aberto** (o usuário configura o `tds-vscode` depois
  de já estar editando): a resolução é refeita e o índice acompanha.
- **Diretório da cadeia que existe mas não contém nenhum arquivo de include**: fonte utilizável,
  índice vazio — a cadeia **não** recua por índice vazio, só por fonte sem diretório utilizável. São
  coisas diferentes e confundi-las esconderia um diretório mal apontado.
- **O disco muda enquanto o índice é lido** — arquivo apagado no meio da indexação não pode derrubar
  nada.
- **Correção ao salvar em arquivo somente-leitura** ou em salvamento cancelado: nenhuma edição
  perdida, nenhum erro ruidoso.
- **Correção ao salvar disputando com outro formatador** instalado: o resultado precisa ser
  determinístico.
- **Documento fechado antes de a ação ser aplicada**: a aplicação falha silenciosamente, sem exceção
  vazada ao usuário.
- **Regra desligada por configuração**: nenhuma ação de correção correspondente é oferecida — a
  lâmpada não pode ressuscitar regra que o usuário desligou.

---

## Requirements *(mandatory)*

### Functional Requirements — o caminho de correção

- **FR-001**: O sistema MUST oferecer ações de correção associadas a diagnósticos, no protocolo que o
  editor usa para isso, mantendo o motor fora do processo da extensão (Princípio I).
- **FR-002**: O cálculo das ações MUST respeitar cancelamento: pedido substituído por outro é
  abandonado de fato, não apenas descartado ao final.
- **FR-003**: O cálculo das ações MUST NOT fazer I/O síncrono, MUST NOT registrar log no caminho quente
  e MUST NOT ocupar o laço de eventos por mais de 50 ms sem ceder.
- **FR-004**: Cada ação MUST ser vinculada ao diagnóstico que a originou, com o identificador da regra
  visível na origem — o usuário precisa saber **qual** regra está sendo corrigida.
- **FR-005**: A edição produzida MUST ser o **menor conjunto possível** de alterações de texto.
  Substituir a linha inteira, ou o documento inteiro, é proibido: destrói dobras, marcadores, seleção
  e histórico de desfazer.
- **FR-006**: A edição MUST ser recusada quando calculada sobre uma versão do documento que não é mais
  a atual.
- **FR-007**: A aplicação de uma correção MUST NOT alterar o encoding nem o fim de linha do arquivo,
  nem qualquer caractere fora do intervalo corrigido.
- **FR-008**: Regra desligada por configuração MUST NOT oferecer ação de correção.
- **FR-009**: Todo título de ação de correção MUST existir nos quatro idiomas do Princípio V, pelo
  mecanismo de tradução do produto — nenhuma string literal no código.

### Functional Requirements — a correção de `CA3001`

- **FR-010**: O sistema MUST oferecer, para cada diagnóstico `CA3001`, uma correção que troque a
  diretiva por `#include`, **em caixa baixa**.
- **FR-011**: A correção de `CA3001` MUST NOT alterar o nome do arquivo referenciado, nem sua caixa,
  nem as aspas, nem o espaçamento da linha. O intervalo editado é o token da diretiva.
- **FR-012**: A correção de `CA3001` MUST ser idempotente: aplicá-la a um texto já correto produz
  nenhuma edição.

### Functional Requirements — corrigir tudo, e ao salvar

- **FR-013**: O sistema MUST oferecer uma ação de "corrigir todas as ocorrências deste arquivo" que
  reúna, em **uma** operação de desfazer, as correções automáticas do documento.
- **FR-014**: Essa ação MUST ser exposta de forma que a correção automática ao salvar do editor possa
  acioná-la.
- **FR-015**: "Corrigir tudo" em documento sem violações MUST produzir zero edições e MUST NOT marcar
  o documento como modificado.
- **FR-016**: Quando duas correções incidem sobre a mesma linha, os intervalos MUST ser disjuntos e o
  resultado MUST ser determinístico, independentemente da ordem de aplicação.
- **FR-017**: "Corrigir tudo" MUST respeitar cancelamento e MUST NOT bloquear o salvamento de forma
  perceptível, inclusive no maior fonte do corpus (24.636 linhas).
- **FR-018**: O usuário MUST poder desligar a participação de cada regra na correção em massa
  independentemente de a regra estar ligada — corrigir em massa é mais invasivo que apontar.

### Functional Requirements — o índice de includes do projeto

- **FR-019**: O sistema MUST manter um índice dos arquivos de include disponíveis, capaz de responder,
  para um nome referenciado, **qual é o nome real gravado no disco**.
- **FR-020**: O nome real MUST ser obtido por listagem de diretório. Consulta de existência pelo nome
  referenciado é proibida como fonte do nome real, porque em sistema de arquivos insensível a caixa
  ela responde "existe" para a grafia errada — é o mecanismo que torna o defeito invisível hoje.
- **FR-021**: A indexação MUST ser **sob demanda** e NEVER na ativação da extensão.
- **FR-022**: A indexação MUST reportar progresso e MUST ser cancelável pelo usuário.
- **FR-023**: A indexação MUST NOT usar I/O síncrono e MUST NOT impedir que a análise dos documentos
  abertos prossiga enquanto ela corre.
- **FR-024**: O índice MUST ser atualizado **incrementalmente** quando arquivos de include são criados,
  renomeados ou apagados; reindexação total a cada mudança é proibida.
- **FR-025**: Alteração no índice MUST revalidar os documentos abertos pelo mesmo caminho debounced e
  cancelável da análise normal.
- **FR-026**: Falha ao ler um diretório (inexistente, sem permissão, unidade de rede fora do ar) MUST
  degradar em silêncio para a regra e produzir no máximo **um** aviso acionável por sessão.
- **FR-027**: A origem dos diretórios de includes MUST ser resolvida por **cadeia de precedência com
  recuo** (D8), nesta ordem, parando na primeira fonte que produzir pelo menos um diretório utilizável:

  | Ordem | Fonte | Onde |
  | ----- | ----- | ---- |
  | 1 | Configuração da extensão oficial da TOTVS (`tds-vscode`) | chave `includes` de `servers.json`, no perfil do usuário |
  | 2 | Configuração da outra extensão ADVPL (`advpl-vscode`) | `includeList` do ambiente selecionado em `advpl.environments` |
  | 3 | Chave própria desta extensão | espaço `advplLint.*` |
  | 4 | Varredura do workspace aberto | último recurso |

- **FR-027a**: "Fonte utilizável" MUST significar **pelo menos um diretório existente depois de
  descartadas as entradas vazias**. Configuração presente e vazia MUST recuar para a próxima fonte —
  na máquina de referência, medido em 2026-08-19, a fonte 1 vale `[""]` e a fonte 2 vale `[]`, e uma
  cadeia que parasse na simples presença da chave deixaria a regra muda para sempre.
- **FR-027b**: Ao ler configuração de outra extensão, o sistema MUST ler **exclusivamente** o que
  descreve diretórios de include. O arquivo da fonte 1 guarda também servidores, permissões e tokens
  salvos; nada além dos caminhos MUST ser lido, retido, registrado em log ou exibido.
- **FR-027c**: O sistema MUST informar ao usuário, sob demanda, **qual** fonte da cadeia está em uso e
  quais diretórios ela produziu. Sem isso, "a regra não dispara" e "a regra dispara sobre a árvore
  errada" são indistinguíveis para quem usa.
- **FR-027d**: Formato de terceiro que não puder ser lido — arquivo ausente, JSON inválido, forma
  inesperada — MUST recuar para a próxima fonte da cadeia, sem erro ao usuário. As fontes 1 e 2 são
  formatos que este projeto **não controla** e podem mudar sem aviso.
- **FR-027e**: A chave própria da fonte 3 MUST aceitar mais de um diretório, e MUST poder ser definida
  por workspace — é a única fonte da cadeia que o usuário deste produto controla diretamente.

### Functional Requirements — a regra `PJ0001`

- **FR-028**: O sistema MUST emitir o diagnóstico `PJ0001` quando o nome referenciado em uma diretiva
  de inclusão diferir, **apenas na caixa**, do nome real do arquivo no disco.
- **FR-029**: `PJ0001` MUST declarar origem `projeto` e MUST documentar, no registro da regra, o que
  ela pega que o padrão não pega — o Analyzer não conhece o diretório de includes do projeto
  (Princípio III).
- **FR-030**: O intervalo do diagnóstico MUST cobrir exatamente o nome referenciado, sem as aspas e
  sem a diretiva.
- **FR-031**: A mensagem MUST citar o nome real lido do disco, nos quatro idiomas.
- **FR-032**: `PJ0001` MUST NOT disparar quando o arquivo referenciado não é encontrado — ausência é
  outra regra, fora do escopo.
- **FR-033**: `PJ0001` MUST NOT disparar quando a referência é ambígua: mais de um arquivo com o mesmo
  nome em caixas diferentes entre os diretórios indexados.
- **FR-034**: `PJ0001` MUST ter chave própria de desligamento e severidade configurável, como toda
  regra (Princípio IV).
- **FR-035**: A severidade padrão de uma regra de origem `projeto` MUST ter caminho declarado no
  registro de regras — hoje a tabela de severidade só mapeia severidade de catálogo, e regra `projeto`
  não tem uma. O caminho MUST exigir razão escrita, como já exige a sobreposição de severidade.
- **FR-036**: `PJ0001` MUST ter **taxa de disparo e de falso positivo medidas sobre o corpus** antes de
  ser ligada por padrão. Sem a medição, ela entra **desligada** (Princípio VI).

### Functional Requirements — a correção de `PJ0001`

- **FR-037**: O sistema MUST oferecer, para cada diagnóstico `PJ0001`, uma correção que substitua o
  nome referenciado pelo nome real lido do disco.
- **FR-038**: A correção de `PJ0001` MUST NOT baixar a caixa do nome, MUST NOT alterar a diretiva e
  MUST NOT alterar o caminho — apenas o nome do arquivo, e apenas para a grafia real medida.
- **FR-039**: A correção de `PJ0001` MUST ser recusada se o arquivo de destino não estiver mais no
  índice no momento da aplicação.
- **FR-040**: `PJ0001` MUST ficar **fora** da correção em massa e da correção ao salvar **por padrão**,
  disponível apenas pela ação individual — e MUST haver chave que a inclua, para quem confia no índice
  (D9). Trocar o nome do arquivo não é inerte como trocar a diretiva: aplicar em massa, ao salvar, sem
  o usuário olhar, propagaria um índice errado pelo arquivo inteiro.

### Functional Requirements — medição, documentação e portões

- **FR-041**: O custo que `PJ0001` acrescenta ao tempo de análise MUST ser medido contra a linha de
  base, e o resultado MUST ser registrado (Princípio VI, Portão 4).
- **FR-042**: O custo da indexação MUST ser medido separadamente do custo por documento — são orçamentos
  diferentes e misturá-los esconde o caro dentro do barato.
- **FR-043**: A linha de base MUST ser reconferida nesta entrega, porque uma regra nova foi acrescentada
  (Portão 4).
- **FR-044**: `PJ0001` MUST ter página própria em `docs/regras/`, e o link de documentação do
  diagnóstico MUST apontar para ela (Portão 6).
- **FR-045**: Toda fixture desta spec MUST ser autoral, derivada do corpus por leitura, NEVER cópia
  literal de fonte padrão do Protheus.
- **FR-046**: Toda tarefa de implementação MUST ser precedida por sua tarefa de teste, escrita para
  falhar primeiro (Princípio VI).

### Key Entities

- **Ação de correção**: proposta de edição vinculada a um diagnóstico. Tem título traduzido, o
  identificador da regra de origem, a versão do documento sobre a qual foi calculada e o conjunto
  mínimo de alterações de texto.
- **Índice de includes**: mapa do que existe no disco, do nome comparável (indiferente à caixa) para o
  **nome real**. Sabe responder também "há mais de um candidato?", que é o que distingue silêncio de
  ambiguidade.
- **Fonte de diretórios de include**: um degrau da cadeia de FR-027. Tem ordem, um jeito de ser lida,
  a resposta "produziu diretório utilizável?" e um nome exibível — é o que FR-027c mostra ao usuário.
- **Referência de include**: ocorrência dentro de um fonte. Tem a diretiva (com sua caixa), o caminho
  opcional, o nome do arquivo e o intervalo exato de cada uma dessas partes.
- **Regra `PJ0001`**: primeira regra de origem `projeto`. Além do que toda regra tem, carrega a
  justificativa obrigatória do Princípio III e depende do índice para se pronunciar.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em um fonte com diagnóstico, a lâmpada de correção aparece sem espera perceptível — o
  cálculo das ações fica dentro do orçamento de reanálise vigente para o tamanho do arquivo.
- **SC-002**: Aplicar a correção de `CA3001` altera **exatamente** os caracteres da diretiva: a
  comparação byte a byte entre original e resultado difere só nesse intervalo, em 100% das fixtures.
- **SC-003**: "Corrigir tudo" em um fonte com N violações corrige as N e é revertido por **um** único
  desfazer.
- **SC-004**: A correção ao salvar no maior fonte disponível (24.636 linhas) não acrescenta atraso
  perceptível ao salvamento.
- **SC-005**: Abrir o editor em um projeto com dezenas de milhares de arquivos de include não atrasa a
  ativação da extensão além do orçamento vigente, e o primeiro diagnóstico das demais regras aparece
  **antes** de a indexação terminar.
- **SC-006**: A indexação pode ser cancelada pelo usuário e para de fato — nenhuma leitura de disco
  continua depois do cancelamento.
- **SC-007**: Criar, renomear ou apagar um arquivo de include reflete no diagnóstico dos documentos
  abertos sem reiniciar o editor.
- **SC-008**: `PJ0001` acerta 100% das fixtures de aceitação — dispara nas divergências de caixa,
  silencia nas coincidências, nas ausências e nas ambiguidades.
- **SC-009**: A taxa de disparo e a de falso positivo de `PJ0001` sobre o corpus estão medidas e
  registradas; o estado de ligada-por-padrão decorre desse número, e não de preferência.
- **SC-010**: O custo acrescentado por `PJ0001` ao tempo de análise por documento está medido contra a
  linha de base, e o custo da indexação está medido em separado.
- **SC-011**: Todo título de ação e toda mensagem nova existem nos quatro idiomas; conjunto de chaves
  divergente reprova o build.
- **SC-012**: A suíte fica verde com cobertura ≥ 98% em linhas, funções e ramos, com exclusões — se
  houver — declaradas com razão.
- **SC-013**: Nenhuma fixture desta spec contém trecho literal de fonte padrão do Protheus.
- **SC-014**: A cadeia de FR-027 resolve corretamente os quatro degraus e os casos de recuo — incluindo
  o estado real da máquina de referência, em que as duas primeiras fontes existem e estão vazias.
- **SC-015**: O usuário consegue descobrir, sem ler código, qual fonte da cadeia venceu e quais
  diretórios ela produziu.
- **SC-016**: Nada além de caminhos de diretório é lido dos arquivos de configuração de terceiros —
  verificável por teste sobre um arquivo que contenha também tokens e credenciais.

---

## Escopo

### Dentro

- Ações de correção rápida para `CA3001` e para `PJ0001`.
- Ação de "corrigir todas deste arquivo", habilitando a correção automática ao salvar.
- A regra `PJ0001` — portabilidade de caixa entre a referência e o nome real no disco.
- O índice de includes do projeto: sob demanda, cancelável, incremental.
- A cadeia de resolução dos diretórios de includes (D8), com o que ela expõe ao usuário.
- Medição do custo da regra e da indexação; reconferência da linha de base.
- Documentação da regra, chaves de configuração e traduções nos quatro idiomas.

### Fora

- **Baixar a caixa do nome do arquivo** referenciado. Proibido por medição: quebraria 706 referências.
- **Renomear arquivos no disco**. A extensão nunca grava fora do documento em edição.
- **Include faltante, obsoleto, duplicado, desnecessário e `totvs.ch` obrigatório** — cinco regras que
  o legado tinha e que o catálogo não cobre. Backlog próprio; esta spec só trata de caixa.
- **Formatação e indentação** (Princípio II) — spec própria.
- **Correções para outras regras do catálogo**, que ainda não existem no produto.
- **Resolução completa do pré-processador** — esta spec olha a diretiva e o nome, não expande macro
  nem resolve include aninhado.
- **Ordenar, agrupar ou reescrever o bloco de includes.**

---

## Assumptions

- **A extensão nunca escreve fora do documento aberto.** Toda correção é uma edição de texto no
  documento em edição, aplicada pelo editor, desfazível pelo usuário. Nenhuma ação toca o sistema de
  arquivos do projeto.
- **Include não encontrado é silêncio, não erro.** A regra "include faltante" existe no backlog
  (`specs/README.md`) e tem custo e taxa de falso positivo próprios — antecipá-la aqui misturaria duas
  medições.
- **Ambiguidade é silêncio.** Com dois candidatos de caixas diferentes, apontar um seria adivinhação;
  e regra ruidosa treina o usuário a ignorar o painel inteiro (Princípio III).
- **`PJ0001` é o próximo identificador livre da faixa `PJ####`**, reservada para regras de origem
  `projeto` (`memoria/identificador-de-regra.md`). É o primeiro em uso.
- **Severidade padrão proposta para `PJ0001`: aviso.** O defeito quebra a compilação no destino real
  de produção, mas só nele; e o volume no corpus ainda não foi contado. A decisão final decorre de
  FR-036 — se o volume for alto, o caminho é sobreposição com razão escrita, como se fez com `CA3001`
  (`memoria/severidade-minor-information.md`).
- **A correção de `CA3001` é segura por medição, não por opinião**: 71,9% das diretivas do corpus estão
  em caixa alta e os fontes compilam, logo o pré-processador não distingue caixa na diretiva.
- **O corpus mede, as fixtures testam.** Nada do corpus entra no repositório
  (`memoria/corpus-externo.md`).
- **Verificação é local**, não há CI (`TODO(CI)`), e o relatório ao usuário diz exatamente o que foi
  executado.
- **A base é a branch `001-esqueleto-lsp-harness`**, cujo MVP está entregue e verde. As tarefas
  `T047`–`T086` da 001 seguem pendentes e **não** são pré-requisito desta spec, com uma exceção
  registrada em `## Dependências e Riscos`.

---

## Dependências e Riscos

- **Dependência real da spec 001**: a reconferência da linha de base (FR-043, Portão 4) e a medição de
  custo (FR-041, FR-042) usam o harness de medição, que é a **US2 da 001** — tarefas `T047`–`T062`,
  ainda não implementadas. Ou elas entram antes, ou esta spec as absorve. É a única amarra entre as
  duas specs, e o plano precisa resolvê-la explicitamente.
- **Custo de indexação em árvore grande**: 35.103 arquivos `.ch`. Listar diretórios é mais barato que
  ler arquivos, mas em unidade de rede o custo muda de ordem de grandeza. O risco não é o tempo total —
  é ele acontecer no lugar errado (na ativação, no laço de eventos, no caminho de digitação).
- **Acoplamento a formato de terceiros** (D8): as duas primeiras fontes da cadeia pertencem a
  extensões que este projeto não controla — `totvs.tds-vscode` e `killerall.advpl-vscode`. Elas podem
  renomear a chave, mudar o arquivo ou sumir. FR-027d limita o dano a "recua para a próxima", mas a
  regressão é silenciosa por natureza: a extensão continua funcionando e a regra passa a olhar outra
  árvore. O plano precisa dizer como isso é detectado — FR-027c é a primeira metade da resposta.
- **Leitura de arquivo com credenciais**: a fonte 1 é o mesmo arquivo onde a extensão da TOTVS guarda
  servidores, permissões e tokens salvos. FR-027b restringe a leitura aos caminhos; o risco é de
  vazamento por descuido — log, mensagem de erro que ecoa o arquivo, objeto inteiro carregado e
  repassado adiante.
- **Vigilância do sistema de arquivos**: manter o índice incremental exige observar mudanças no disco.
  Observador mal dimensionado sobre dezenas de milhares de arquivos é fonte clássica de travamento — é
  Princípio I sob outro nome.
- **Correção ao salvar disputando com outros formatadores**: se o usuário tem outra extensão que
  formata ADVPL ao salvar, a ordem das operações pode variar. O resultado precisa ser determinístico,
  e o plano precisa dizer como.
- **Caminho dentro da referência**: `#include "..\includes\x.ch"` levanta a mesma pergunta de caixa
  para os diretórios do caminho. A spec limita a regra ao nome do arquivo; ampliar depois é regra nova,
  não ajuste.
- **Lacuna no contrato de regra da 001** (FR-035): o registro deriva a severidade padrão de
  `catalogSeverity`, que é nulo em regra `projeto`. `PJ0001` é a primeira a exercitar esse caminho, e
  ele não existe — é alteração de contrato, não configuração.

---

## Rastreabilidade constitucional

| Princípio | Onde esta spec o atende |
| --------- | ----------------------- |
| I — O Editor Nunca Trava | FR-002, FR-003, FR-017, FR-021 a FR-026; SC-001, SC-004, SC-005, SC-006 |
| II — Formatação é Produto | fora de escopo; FR-005 e FR-007 garantem que a correção não vire formatação disfarçada |
| III — Valor no que o padrão não vê | FR-029 (justificativa obrigatória), FR-032, FR-033, FR-036; SC-008, SC-009 |
| IV — Identidade, Severidade e Desligamento | FR-004, FR-008, FR-034, FR-035, FR-044; SC-007 |
| V — Multilíngue por Construção | FR-009, FR-031; SC-011 |
| VI — Fixture, Teste e Medição Antes da Regra | FR-036, FR-041 a FR-043, FR-045, FR-046; SC-009, SC-010, SC-012, SC-013 |
| Arquitetura — Segurança | FR-027b; SC-016 — o arquivo da fonte 1 guarda tokens, e só os caminhos são lidos |
| Arquitetura — Portabilidade | FR-019, FR-020, FR-028 — a regra existe porque o AppServer roda em Linux e o sistema de arquivos lá distingue caixa |

---

## Fontes consultadas

| Fonte | O que sustenta | Data |
| ----- | -------------- | ---- |
| `memoria/medicao-includes-corpus.md` | 71,9% de diretivas em caixa alta; 7% de nomes com maiúscula; 706 referências que quebrariam | 2026-08-19 |
| `memoria/spec-002-escopo-decidido.md` | o escopo desta spec, decidido antes de ela ser aberta | 2026-08-19 |
| `memoria/identificador-de-regra.md` | faixa `PJ####` reservada para origem `projeto` | 2026-08-19 |
| `memoria/severidade-minor-information.md` | sobreposição de severidade exige razão escrita | 2026-08-19 |
| `memoria/corpus-externo.md` | o corpus é externo e nunca versionado | 2026-08-19 |
| `specs/001-esqueleto-lsp-harness/contracts/regra.md` | contrato de registro de regra e a lacuna de FR-035 | 2026-08-19 |
| `specs/001-esqueleto-lsp-harness/contracts/configuracao.md` | espaço de nomes `advplLint.*` e reação a mudança de configuração | 2026-08-19 |
| `.specify/memory/constitution.md` v2.2.1 | os seis princípios e os seis portões | 2026-08-19 |
| `analise-advpl/src/include.ts` | como o legado tratava includes — comportamento de referência, nunca código | 2026-08-19 |
| corpus local `D:\Workspace\FONTES` (varredura própria) | zero ocorrências de `#include <...>` nos `.prw` — sintaxe angular fora de escopo | 2026-08-19 |
| `totvs.tds-vscode` v2.0.16, manifesto e `~/.totvsls/servers.json` | fonte 1 da cadeia: chave `includes`, lista de caminhos, no perfil do usuário; o mesmo arquivo guarda permissões e tokens | 2026-08-19 |
| `killerall.advpl-vscode` v0.18.1, manifesto | fonte 2 da cadeia: `includeList` dentro do ambiente selecionado em `advpl.environments` | 2026-08-19 |
| configurações da máquina de referência | as duas primeiras fontes existem e estão **vazias** — sustenta FR-027a | 2026-08-19 |

---

## Decisões resolvidas

### D6 — A correção mexe na **diretiva**, nunca no **nome do arquivo**

Decidido pelo dono em 2026-08-19, com medição.

Baixar a caixa do nome quebraria **706 referências** que hoje resolvem, e quebraria no Linux — onde o
AppServer roda. Baixar a caixa da diretiva é inerte, e a prova é que 71,9% dos fontes do corpus a usam
em caixa alta e compilam.

**Consequência**: `CA3001` ganha correção automática; a caixa do nome do arquivo **nunca** é
"normalizada". O que o produto faz com o nome é outra coisa — alinhar ao que está no disco (D7), que é
o oposto de normalizar.

### D7 — A regra de portabilidade é `PJ0001`, origem `projeto`

Decidido pelo dono em 2026-08-19.

Ela compara a referência com o **nome real no disco**. O TOTVS Code Analyzer não consegue fazer isso
porque não conhece o diretório de includes do projeto — é a justificativa obrigatória do Princípio III,
e ela é literal, não retórica: o defeito **já falha hoje, em silêncio, no AppServer Linux**.

**Consequência**: primeira regra `projeto` do produto; primeira a exercitar a faixa `PJ####`; primeira
a exigir que o motor conheça o disco, o que arrasta o Princípio I inteiro para dentro desta spec.

### D8 — Os diretórios de includes vêm de uma **cadeia de recuo**, não de uma fonte só

Decidido pelo dono em 2026-08-19, ao especificar: **tds-vscode → advpl-vscode → chave própria →
varredura do workspace**, parando na primeira fonte utilizável.

A razão é que o usuário deste produto **já configurou isso em outro lugar** — pedir para configurar de
novo é atrito por nada, e configuração duplicada diverge em silêncio. A chave própria continua
existindo, mas como terceiro degrau: ela atende quem não usa nenhuma das outras extensões.

Estado medido na máquina de referência em 2026-08-19, e é ele que justifica o FR-027a: as duas
primeiras fontes **existem e estão vazias** — `includes: [""]` em `~/.totvsls/servers.json` e
`advpl.environments: []` nas configurações. Uma cadeia que parasse na presença da chave em vez de na
utilidade do conteúdo deixaria `PJ0001` muda exatamente onde ela foi medida.

**Consequência**: duas fontes de formato alheio entram no caminho de leitura, e nenhuma delas é
contrato nosso — daí FR-027b (ler só os caminhos, nunca os tokens vizinhos), FR-027c (dizer qual fonte
venceu) e FR-027d (recuar em silêncio quando o formato mudar).

### D9 — A correção de `PJ0001` fica **fora** da correção em massa por padrão

Decidido pelo dono em 2026-08-19.

`CA3001` corrige a diretiva, e isso é inerte por medição. `PJ0001` corrige o **nome** — muda o que o
compilador vai procurar. Aplicar isso em massa, ao salvar, sem o usuário olhar, propaga um índice
errado ou um diretório errado pelo arquivo inteiro. Quem confia no índice liga a chave.

**Consequência**: FR-018 deixa de ser precaução genérica e vira requisito com caso concreto — a
participação de cada regra na correção em massa é configurável, e `PJ0001` nasce desligada nela.
