# Feature Specification: Esqueleto vertical da extensão + harness de medição

**Feature Branch**: `001-esqueleto-lsp-harness`

**Created**: 2026-08-19

**Status**: Draft — pronta para `/speckit-plan`; nenhum ponto de esclarecimento em aberto

**Input**: Descrição do usuário: "Esqueleto vertical da extensão VS Code de lint ADVPL/TLPP, com harness de medição e linha de base. Objetivo: fazer nascer o código da extensão provando ponta a ponta a arquitetura exigida pelo Princípio I da constituição (O Editor Nunca Trava), antes que qualquer regra cara exista."

---

## Contexto

Este repositório não tem código. A extensão anterior existe em `analise-advpl/` (legado congelado)
e foi abandonada porque **travava o editor**. A constituição nasceu dessa falha: o Princípio I
lista, com arquivo e linha, os nove defeitos medidos que produziram o travamento.

Esta é a primeira spec que gera código. Ela não entrega um linter útil — entrega o **menor caminho
completo** do arquivo aberto até o diagnóstico na tela, mais o **instrumento que mede o custo disso**.
A ordem é deliberada: a arquitetura que impede o travamento tem de estar provada, e a régua tem de
existir, **antes** que qualquer regra cara seja escrita. O legado provou o custo de fazer o contrário.

**Regra-piloto**: `CA3001 — Include must be lowercase`, grupo G3 (Legacy and Deprecated Code),
severidade `MINOR` no catálogo. Fonte: `referencias/totvs/sonarqube-rules-reference.md`, linha 53,
release `v1.0.1`, consultada em **2026-08-19**. Escolhida por três razões: está no catálogo oficial,
logo exercita o caminho de origem `totvs` com identificador e grupo citáveis; custa uma passagem por
linha, sem estado entre linhas; e seu único falso positivo plausível — `#INCLUDE` dentro de comentário
ou de literal de texto — é estreito o bastante para virar caso de teste em vez de pesquisa.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — O diagnóstico aparece, e o editor não trava (Priority: P1)

Um desenvolvedor Protheus abre um fonte `.prw` no VS Code. Sem que ele peça nada, a extensão marca as
linhas em que `#INCLUDE` está escrito em caixa alta, mostrando o identificador da regra, a severidade
e a posição exata. Enquanto ele digita, as marcações acompanham o texto. Em nenhum momento o editor
engasga, e isso vale igualmente para um fonte de 300 linhas e para um de 24.636.

**Why this priority**: é a fatia vertical inteira. Se só isto for entregue, existe uma extensão de lint
ADVPL funcionando, com uma regra real do catálogo oficial, sobre a arquitetura que a constituição exige.
Todo o resto do produto se pendura neste caminho.

**Independent Test**: abrir fontes derivados do corpus real em uma instância de desenvolvimento do
editor e conferir que cada `#INCLUDE` em caixa alta produz um diagnóstico com identificador `CA3001`,
severidade definida e intervalo exato — enquanto se digita continuamente no arquivo mais longo
disponível sem perceber travamento.

**Acceptance Scenarios**:

1. **Given** um fonte `.prw` contendo `#INCLUDE "TOTVS.CH"` na linha 3, coluna 1, **When** o
   desenvolvedor abre o arquivo, **Then** aparece um diagnóstico de identificador `CA3001` cujo
   intervalo cobre exatamente o token `#INCLUDE` (linha 3, colunas 1 a 9).
2. **Given** o mesmo fonte, **When** o desenvolvedor corrige para `#include "totvs.ch"`, **Then** o
   diagnóstico desaparece sem exigir salvar o arquivo.
3. **Given** um fonte de 24.636 linhas (o maior do corpus), **When** o desenvolvedor digita
   continuamente por 10 segundos, **Then** nenhuma tecla demora perceptivelmente a aparecer e a
   análise final reflete o texto final.
4. **Given** um fonte gravado em CP1252 com travessão e aspas tipográficas (faixa 0x80–0x9F) antes de
   um `#INCLUDE` em caixa alta, **When** a análise roda, **Then** a coluna do diagnóstico aponta o
   caractere correto — sem o deslocamento que a leitura como ISO-8859-1 produziria.
5. **Given** um arquivo `.txt` ou `.js` aberto no editor, **When** o desenvolvedor navega por ele,
   **Then** a extensão não é ativada e nenhum diagnóstico ADVPL é emitido.
6. **Given** um fonte com `#INCLUDE` dentro de um comentário de linha e outro dentro de um literal de
   texto, **When** a análise roda, **Then** nenhum dos dois produz diagnóstico.

---

### User Story 2 — A linha de base existe, medida sobre fontes reais (Priority: P2)

O mantenedor roda um comando de medição na sua máquina, apontando para o diretório local de fontes
ADVPL reais. Sai um relatório com o tempo de análise por percentil de tamanho de arquivo, o custo
isolado da regra `CA3001` e a taxa de falso positivo dela sobre o corpus. Esse relatório é o número
contra o qual toda regra futura será comparada.

**Why this priority**: o Princípio VI proíbe ligar por padrão uma regra cujo custo não foi medido, e o
Princípio I fixa orçamentos que hoje não têm ponto de partida — a constituição registra isso como
`TODO(BENCHMARK_BASE)`. Sem esta história, a P1 não pode ser entregue com a regra ligada por padrão.
Ela é P2 e não P1 apenas porque não é o que o desenvolvedor final vê.

**Independent Test**: executar a medição com o corpus configurado e obter um relatório versionado com
p50, p90, p95 e p99; depois executar a mesma medição **sem** o corpus configurado e confirmar que ela
avisa e encerra sem quebrar a suíte de testes.

**Acceptance Scenarios**:

1. **Given** o caminho do corpus configurado localmente, **When** o mantenedor roda a medição,
   **Then** sai um relatório com tempo de análise nos percentis p50, p90, p95 e p99 de tamanho de
   arquivo, mais o total de arquivos medidos e a data da medição.
2. **Given** o corpus configurado, **When** a medição roda, **Then** o relatório informa o custo
   incremental da regra `CA3001` — a diferença entre analisar com e sem ela.
3. **Given** o corpus configurado, **When** a medição roda, **Then** o relatório informa quantas vezes
   `CA3001` disparou e a taxa de falso positivo apurada por amostragem revisada manualmente.
4. **Given** um clone do repositório **sem** o corpus configurado, **When** o mantenedor roda a suíte
   de testes, **Then** ela passa inteira; e **When** ele roda a medição, **Then** ela informa que o
   corpus não está disponível e encerra sem erro de execução.
5. **Given** a linha de base medida, **When** ela diverge do orçamento provisório da constituição,
   **Then** a divergência é registrada como pendência explícita de emenda constitucional, com os
   números medidos.

---

### User Story 3 — O desenvolvedor manda na regra e no idioma (Priority: P3)

O desenvolvedor decide que `CA3001` não interessa ao time dele e desliga a regra por uma chave de
configuração própria. Outro time prefere vê-la como aviso em vez de dica, e muda só a severidade. Um
consultor em Buenos Aires, um em Moscou e um em Londres leem a mesma violação, cada um no seu idioma
— os quatro em que o Protheus é localizado.

**Why this priority**: é o contrato do Princípio IV (identidade, severidade e desligamento) e do
Princípio V (multilíngue por construção). Ele precisa nascer com a primeira regra, senão a segunda regra
já herda um formato improvisado. É P3 porque a fatia P1 já demonstra o diagnóstico; esta história
demonstra o **controle** sobre ele.

**Independent Test**: alternar a chave de desligamento e a de severidade nas configurações do editor e
observar o painel de problemas reagir; trocar o idioma do editor e observar a mensagem mudar.

**Acceptance Scenarios**:

1. **Given** um fonte com violação de `CA3001` visível no painel de problemas, **When** o
   desenvolvedor desliga a chave de configuração daquela regra, **Then** o diagnóstico desaparece sem
   reiniciar o editor.
2. **Given** a regra ligada, **When** o desenvolvedor muda a severidade configurada, **Then** o
   diagnóstico passa a ser exibido na nova severidade, mantendo identificador e posição.
3. **Given** o editor em `pt-br`, `es`, `en` ou `ru`, **When** o diagnóstico aparece, **Then** a
   mensagem está no idioma do editor, com o mesmo identificador `CA3001` e a mesma posição nos
   quatro.
4. **Given** o editor em um idioma que a extensão não traduz, **When** o diagnóstico aparece,
   **Then** a mensagem sai em inglês — o idioma base — e nunca como identificador cru de chave.
5. **Given** o diagnóstico exibido, **When** o desenvolvedor aciona o link de documentação do
   identificador, **Then** ele chega à explicação daquela regra sem sair do fluxo de trabalho.
6. **Given** o conjunto de mensagens dos quatro idiomas, **When** uma chave existe em um idioma e
   falta em qualquer outro, **Then** a construção do pacote falha — não é pendência de tradução, é
   erro.

---

### Edge Cases

- **`#INCLUDE` que não é `#INCLUDE`**: dentro de comentário de linha, de bloco, ou de literal de texto.
  Não dispara. É o único falso positivo plausível da regra-piloto e precisa de fixture dedicada.
- **Caixa mista**: `#Include`, `#InClUdE`. O catálogo exige caixa baixa; qualquer desvio dispara.
- **Encoding**: fonte em CP1252 com caracteres na faixa 0x80–0x9F (travessão, aspas tipográficas,
  euro) — onde `latin1` diverge e o legado errava. Também: fonte que chega em UTF-8 por engano, e
  fonte com marca de ordem de byte.
- **Fim de linha**: arquivo só com CRLF, só com LF, e arquivo com os dois misturados. A posição do
  diagnóstico tem de estar certa nos três.
- **Tamanho**: arquivo vazio; arquivo de uma linha; arquivo de 24.636 linhas (máximo observado no
  corpus); arquivo maior que o máximo observado.
- **Ritmo de digitação**: alterações mais rápidas que o intervalo de reanálise. A análise anterior é
  cancelada de fato, e o resultado exibido corresponde ao último texto — nunca a um texto intermediário
  que chegou atrasado.
- **Fechar durante a análise**: documento fechado enquanto a análise dele está em curso.
- **Extensão reconhecida, conteúdo estranho**: arquivo `.prw` contendo texto que não é ADVPL, ou
  binário. Não pode derrubar o motor.
- **Corpus ausente ou vazio**: caminho configurado que não existe, ou existe e não tem fonte nenhum.
- **Corpus enorme**: contar linhas dos ~93.000 arquivos do diretório de fontes estoura 2 minutos de
  relógio numa varredura ingênua. A medição precisa amostrar ou paralelizar, e declarar qual fez.

---

## Requirements *(mandatory)*

### Functional Requirements — o caminho até o diagnóstico

- **FR-001**: A extensão MUST ser ativada somente para as linguagens ADVPL/TLPP, reconhecendo as
  extensões `prw`, `prx`, `prg`, `apw`, `apl` e `tlpp`. Ativação irrestrita é proibida.
- **FR-002**: A análise MUST rodar fora do processo da interface do editor, de modo que nenhuma
  análise possa bloquear a digitação.
- **FR-003**: O sistema MUST ler o conteúdo do fonte como CP1252 (Windows-1252), não como
  ISO-8859-1/`latin1`, e MUST preservar o fim de linha original do arquivo.
- **FR-004**: Toda análise MUST aceitar cancelamento e MUST interromper o trabalho de fato quando
  cancelada — não apenas descartar o resultado ao final.
- **FR-005**: A reanálise por digitação MUST ser espaçada (debounce), e o resultado exibido MUST
  sempre corresponder à versão mais recente do texto.
- **FR-006**: Nenhuma tarefa do caminho de análise MUST ocupar o processamento por mais de 50 ms sem
  ceder o controle.
- **FR-007**: O caminho de análise MUST estar livre de entrada/saída síncrona e de registro de log por
  linha, por regra ou por arquivo. O diagnóstico de desenvolvimento MUST sair por um canal com nível,
  desligado por padrão.
- **FR-008**: Cada regra MUST ver cada linha uma única vez. Passagens de custo quadrático sobre linhas
  são proibidas.
- **FR-009**: Não MUST existir tempo-limite que rejeite ou descarte a análise. Fonte grande demora
  mais; ela não falha.

### Functional Requirements — o contrato do diagnóstico

- **FR-010**: Todo diagnóstico MUST carregar identificador estável, severidade, e posição inicial e
  final exatas (linha e coluna). O identificador exibido MUST ser o do catálogo oficial, sem prefixo
  nem qualificação de origem (D2) — para `CA3001`, exatamente `CA3001`.
- **FR-010a**: Regras de origem `projeto` MUST usar identificadores da faixa reservada `PJ####`, que
  não colide com os prefixos `CA`, `BG` e `CS` do catálogo oficial (D2).
- **FR-011**: O identificador MUST ser navegável até a documentação daquela regra a partir do próprio
  editor.
- **FR-012**: A regra MUST declarar sua origem. `CA3001` é origem `totvs`, grupo G3 do catálogo
  oficial, e a spec MUST citar essa origem com a data de consulta.
- **FR-013**: A regra MUST ser desligável individualmente por chave de configuração própria, e sua
  severidade exibida MUST ser configurável.
- **FR-014**: A severidade exibida MUST resultar de uma tabela de mapeamento versionada, nunca de
  cópia literal da severidade do catálogo. Esta spec preenche uma única entrada:
  `MINOR → Information` (D3). As demais entradas permanecem vazias e pertencem ao
  `TODO(SEVERITY_MAP)`.
- **FR-014a**: A extensão MUST publicar com identidade própria, distinta da extensão atual, e suas
  chaves de configuração MUST viver em espaço de nomes próprio (D1). Nenhuma configuração da
  extensão atual é lida ou migrada.
- **FR-015**: Toda mensagem destinada ao usuário — diagnóstico, rótulo de configuração, descrição de
  comando — MUST existir nos **quatro idiomas do Protheus**: português do Brasil, espanhol, inglês e
  russo (D4). Conjunto de chaves divergente entre quaisquer dois idiomas MUST falhar a construção do
  pacote.
- **FR-015a**: Acrescentar um idioma MUST ser mudança de configuração, não de código. Nenhuma parte
  do motor ou da extensão MUST enumerar os idiomas suportados fora do ponto único que os declara.
- **FR-016**: Nenhuma mensagem MUST ser escrita literalmente no código; todas passam pelo mecanismo de
  tradução.

### Functional Requirements — a regra-piloto CA3001

- **FR-017**: O sistema MUST sinalizar diretiva de inclusão cujo nome não esteja inteiramente em caixa
  baixa (`#INCLUDE`, `#Include`, `#InClUdE`).
- **FR-018**: O sistema MUST NOT sinalizar ocorrências de `#INCLUDE` situadas dentro de comentário ou
  de literal de texto.
- **FR-019**: O intervalo do diagnóstico MUST cobrir exatamente o token da diretiva, não a linha
  inteira.

### Functional Requirements — a medição

- **FR-020**: O sistema MUST oferecer uma medição executável que produza tempo de análise por
  percentil de tamanho de arquivo (p50, p90, p95, p99), sobre corpus de fontes ADVPL reais.
- **FR-021**: A medição MUST informar o custo incremental da regra `CA3001` isoladamente.
- **FR-022**: A medição MUST informar a contagem de disparos de `CA3001` no corpus e a taxa de falso
  positivo apurada sobre amostra revisada.
- **FR-023**: O caminho do corpus MUST vir de configuração local **não versionada**. O repositório
  MUST NOT conter nenhum fonte do corpus.
- **FR-024**: Na ausência do corpus, a suíte de testes MUST passar integralmente e a medição MUST
  informar a indisponibilidade e encerrar sem falha de execução.
- **FR-025**: O relatório de linha de base MUST ser versionado, datado, e MUST registrar quantos
  arquivos foram medidos e se houve amostragem.
- **FR-026**: Fixtures de teste MUST ser código autoral derivado da leitura do corpus. Cópia literal de
  fonte padrão do Protheus para dentro do repositório é proibida.
- **FR-027**: O projeto MUST ter uma verificação que falhe caso qualquer arquivo do corpus seja
  acidentalmente versionado.

### Functional Requirements — ordem de trabalho

- **FR-028**: Toda regra e todo comportamento MUST entrar com teste escrito antes do código e falhando
  primeiro. Teste NUNCA é opcional — template ou ferramenta que diga o contrário está subordinado ao
  Princípio VI.
- **FR-029**: Toda asserção de teste sobre diagnóstico MUST verificar identificador, severidade, linha
  e coluna do diagnóstico específico. Asserção sobre contagem agregada de diagnósticos é proibida.
- **FR-030**: A suíte MUST atingir **98% de cobertura em linhas, funções e ramos**. Abaixo disso, o
  portão local falha e o merge está bloqueado.
- **FR-031**: A medição de cobertura MUST usar o mecanismo nativo do ambiente de execução, sem
  acrescentar dependência.
- **FR-032**: Exclusão de arquivo da medição de cobertura MUST constar de lista versionada, com a
  razão de cada item registrada. Baixar o limiar ou excluir sem justificativa é violação.

### Key Entities

- **Diagnóstico**: uma violação encontrada num fonte. Carrega identificador, origem (`totvs` com grupo,
  ou `projeto`), severidade exibida, intervalo exato no documento e mensagem traduzida.
- **Regra**: a definição do que é violação. Carrega identificador, origem, grupo do catálogo quando
  aplicável, severidade de catálogo, chave de configuração própria e custo medido.
- **Documento analisado**: o fonte em memória, com seu encoding de origem, seu fim de linha e sua
  versão corrente. É o que a análise consome; nunca o arquivo em disco durante a edição.
- **Linha de base**: o registro datado do custo de análise por percentil de tamanho, o custo por regra
  e a taxa de falso positivo por regra. É o comparativo obrigatório de toda entrega futura.
- **Corpus**: conjunto externo de fontes ADVPL/TLPP reais, apontado por caminho local. Nunca versionado.
  Serve para medir, e como material de leitura do qual se derivam fixtures autorais.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Abrir um fonte de tamanho mediano (309 linhas) e ver o primeiro diagnóstico leva no
  máximo 300 ms desde a abertura.
- **SC-002**: Digitar continuamente por 10 segundos num fonte do percentil 99 (7.951 linhas) não
  produz nenhuma interrupção perceptível na digitação.
- **SC-003**: A extensão fica pronta para uso em no máximo 200 ms após ser ativada.
- **SC-004**: 100% dos diagnósticos emitidos carregam identificador, severidade e posição inicial e
  final. Nenhum diagnóstico sem identificador é emitido.
- **SC-005**: O conjunto de chaves de mensagem é idêntico nos quatro idiomas (pt-BR, es, en, ru) —
  zero divergências, em qualquer par.
- **SC-006**: A linha de base é registrada com no mínimo 1.000 fontes reais medidos, cobrindo p50,
  p90, p95 e p99.
- **SC-007**: A taxa de falso positivo de `CA3001`, medida sobre amostra revisada do corpus, é no
  máximo 1%.
- **SC-008**: Zero arquivos do corpus presentes no repositório, verificado automaticamente.
- **SC-009**: Uma análise cancelada para de consumir processamento em no máximo 50 ms após o
  cancelamento.
- **SC-010**: Analisar o maior fonte do corpus (24.636 linhas) conclui sem erro e sem descarte por
  tempo-limite.
- **SC-011**: A cobertura de testes é de no mínimo 98% em linhas, funções e ramos, e o portão falha
  automaticamente abaixo disso.
- **SC-012**: Toda exclusão da medição de cobertura tem razão registrada em lista versionada — zero
  exclusões sem justificativa.

---

## Escopo

### Dentro

Ativação restrita; motor de análise fora do processo da interface; leitura CP1252 com preservação de
fim de linha; cancelamento e reanálise espaçada; a regra `CA3001` ponta a ponta com identificador,
severidade configurável, chave de desligamento própria e mensagem nos quatro idiomas; a medição sobre
corpus externo com relatório de linha de base versionado; e a estrutura de teste que o Princípio VI
exige.

### Fora

- Formatação e indentação (Princípio II) — spec própria.
- O restante do catálogo G1–G5 da TOTVS e as regras de origem `projeto` herdadas do legado.
- A tabela completa de mapeamento de severidade (`TODO(SEVERITY_MAP)`). Esta spec cria a **estrutura**
  da tabela e preenche **apenas a entrada que a regra-piloto exige**; o preenchimento completo,
  incluindo o caso espinhoso de `CA2050`/`CA2051`/`CA2052`, fica para spec própria.
- Análise de projeto inteiro, varredura em lote e cache entre sessões.
- Ações de correção automática.
- Publicação no Marketplace.

---

## Assumptions

- **Severidade da tabela de mapeamento**: a estrutura da tabela nasce aqui com a única entrada
  `MINOR → Information` (D3). Isso não antecipa nem restringe as decisões do `TODO(SEVERITY_MAP)`
  para as demais severidades — em especial o caso `CA2050`/`CA2051`/`CA2052`, que são `INFO` no
  catálogo e alto impacto na prática.
- **Documentação da regra**: o destino do link de documentação é um documento versionado neste
  repositório, com âncora por identificador de regra. Não depende de site publicado, que não existe.
- **Corpus**: o corpus vive em `D:\Workspace\FONTES` na máquina do dono — ~27.139 `.prw`, 4.072
  `.tlpp`, 3.210 `.prx`, 1.178 `.prg`. A amostra de 3.000 fontes medida em 2026-08-19 deu p50 309,
  p90 1.699, p95 2.933, p99 7.951 e máximo 24.636 linhas. Ver `memoria/corpus-externo.md`.
- **Orçamento da constituição**: o Princípio I fixa "p95 de fonte de 1.000 linhas", número que fica
  entre o p50 e o p90 reais. Esta spec assume que a medição vai produzir a emenda desses números, e
  registra a divergência como saída esperada, não como falha. Ver
  `memoria/orcamento-desempenho-subdimensionado.md`.
- **Verificação é local**: não há integração contínua neste repositório (`TODO(CI)`). Os portões são
  executados na máquina antes do commit, e o relatório ao usuário diz exatamente o que foi executado.
- **Legado**: `analise-advpl/` é consultado por leitura humana. Nada dele entra como dependência nem
  como código copiado. O que se reaproveita é dado de domínio.
- **Sem migração automática de configuração**: a extensão nova tem identidade própria (D1), então as
  configurações da extensão atual não são lidas nem migradas. Quem usa as duas mantém dois conjuntos
  de chaves durante a transição — aceito, porque a transição é temporária e a alternativa era
  atualizar a base instalada para uma extensão com uma regra só.
- **Faixa `PJ` livre hoje, não garantida amanhã**: os prefixos do catálogo oficial são `CA`, `BG` e
  `CS`. A reserva de `PJ` para regras de origem `projeto` (D2) vale enquanto a TOTVS não usar esse
  prefixo. Detectar a colisão é responsabilidade da atualização de `referencias/totvs/`, que a
  constituição já obriga a virar item de backlog.

---

## Dependências e Riscos

- **Decodificação CP1252**: não é nativa no ambiente de execução. Vai exigir dependência dedicada, o
  que precisa ser justificado contra a alternativa de implementar localmente uma tabela de 256
  posições — que é pequena e totalmente especificada. A decisão pertence ao plano.
- **Corpus indisponível para terceiros**: a linha de base não é reproduzível por quem não tem o
  diretório de fontes. O relatório precisa ser autoexplicativo o bastante para servir de comparativo
  mesmo sem nova execução.
- **Medição sobre corpus grande**: varredura ingênua dos ~93.000 arquivos estoura minutos de relógio.
  A estratégia de amostragem afeta a confiabilidade do número e precisa ser declarada no relatório.
- **Risco de vazamento do corpus**: fonte padrão do Protheus dentro do repositório é problema de
  licença e de exposição. A verificação do FR-027 é mitigação, não conveniência.

---

## Rastreabilidade constitucional

| Princípio | Onde esta spec o atende |
| --------- | ----------------------- |
| I — O Editor Nunca Trava | FR-001 a FR-009; SC-001, SC-002, SC-003, SC-009, SC-010 |
| II — Formatação é Produto | fora de escopo, spec própria |
| III — Valor no que o padrão não vê | FR-012 (origem declarada), FR-022 (falso positivo medido) |
| IV — Identidade, Severidade e Desligamento | FR-010, FR-010a, FR-011 a FR-014, FR-014a; SC-004 |
| V — Multilíngue por Construção | FR-015, FR-015a, FR-016; SC-005 |
| VI — Fixture, Teste e Medição Antes da Regra | FR-020 a FR-022, FR-026, FR-028 a FR-032; SC-006, SC-007, SC-011, SC-012 |

**Emendas constitucionais produzidas por esta spec** — feitas em 2026-08-19, constituição na
**v2.2.0**: Princípio V passou a **Multilíngue por Construção**, com os quatro idiomas do Protheus
(D4); Princípio VI passou a **Fixture, Teste e Medição Antes da Regra**, com "teste nunca é
opcional" escrito e **cobertura mínima de 98%** como portão de merge (D5).

**Dívidas da constituição tocadas por esta spec**: `TODO(BENCHMARK_BASE)` — fechada.
`TODO(CORPUS)` — parcialmente fechada: o corpus existe e é robusto, mas é externo e não reproduzível
por terceiros. `TODO(SEVERITY_MAP)` — apenas a estrutura, uma entrada. `TODO(CI)` — intocada.
`TODO(REPO_LAYOUT)` — intocada.

---

## Fontes consultadas

| Fonte | O que forneceu | Data |
| ----- | -------------- | ---- |
| `referencias/totvs/sonarqube-rules-reference.md` (release v1.0.1), linha 53 | `CA3001`, grupo G3, severidade MINOR, padrão proibido e alternativa | 2026-08-19 |
| `.specify/memory/constitution.md` v2.2.0 | os seis princípios e os orçamentos provisórios | 2026-08-19 |
| `D:\Workspace\FONTES` (corpus local, não versionado) | distribuição de tamanho e volume por extensão | 2026-08-19 |
| `analise-advpl/test/files/` | os 5 fontes de teste do legado, para dimensionar o que ele cobria | 2026-08-19 |

---

## Decisões resolvidas

Três decisões de contrato de longo prazo, decididas pelo dono em **2026-08-19**. Registradas aqui
porque nenhuma delas tem padrão razoável e todas mudam o resultado da implementação.

### D1 — Identidade da extensão: **independente**

A extensão nova nasce com identidade de publicação própria e **convive** com a atual instalada. A
extensão atual não recebe atualização vinda deste repositório.

*Razão*: a 001 entrega uma regra. Assumir a identidade atual empurraria, como atualização automática,
uma extensão que tem 1 diagnóstico onde havia 33 e nenhuma formatação onde havia a melhor entrega do
legado. Assumir a identidade antiga é decisão de uma spec de publicação futura, quando houver
paridade — não desta.

*Consequência*: chaves de configuração vivem em espaço de nomes próprio, sem colisão com as da
extensão atual. Não há migração automática de configuração nesta spec (ver Assumptions).

### D2 — Identificador de regra: **id puro do catálogo**

O `Diagnostic.code` exibido é o identificador do catálogo, sem qualificação: `CA3001`. Regras de
origem `projeto` usam a faixa reservada **`PJ####`**.

*Razão*: `CA3001` é literalmente o que o desenvolvedor Protheus já lê no SonarQube da TOTVS —
pesquisável e reconhecível sem tradução mental. A origem da regra continua obrigatória (Princípio
III), mas vive nos metadados da regra e na documentação, não no rótulo do painel.

*Razão da faixa `PJ`*: os prefixos em uso no catálogo oficial são `CA`, `BG` e `CS`. `PJ` está livre
hoje. **Risco aceito**: a TOTVS pode vir a usar `PJ`. A mitigação é a verificação de sincronismo do
catálogo — ao atualizar `referencias/totvs/`, colisão de identificador é item de backlog obrigatório,
como já exige a constituição para regra nova ou alterada.

### D3 — `MINOR` do catálogo é exibido como **Information**

Primeira e única entrada da tabela de mapeamento nesta spec.

*Razão*: mostra a violação no painel de problemas sem contaminar a contagem de erros e avisos.
`Warning` inflaria a contagem, e `#INCLUDE` em caixa alta é pervasivo em fonte legado — treinar o
usuário a ignorar o painel é exatamente o que o Princípio III proíbe. `Hint` esconderia demais.

*Ressalva registrada*: se a linha de base da US2 apurar volume de disparo alto o bastante para
inundar o painel, a entrada `MINOR → Information` é revista **com o número na mão** — e a revisão
entra como emenda da tabela, não como ajuste silencioso. O critério de decisão é o dado do
FR-022, não a impressão.

### D4 — Idiomas: os **quatro do Protheus**, não dois

A extensão acompanha os idiomas em que o Protheus é localizado: **português do Brasil, espanhol,
inglês e russo**. Identificadores de localidade do VS Code: `pt-br`, `es`, `ru`, com `en` como base.

*Razão*: o produto atende quem trabalha com Protheus, e o Protheus fala esses quatro idiomas. Uma
extensão bilíngue deixaria de fora as bases hispano-americana e russa, que existem e usam as mesmas
regras de catálogo. Decidido pelo dono em 2026-08-19.

> ✅ **Emenda feita.** A constituição foi para a **v2.2.0** em 2026-08-19: o Princípio V passou de
> "Bilíngue por Construção" (pt-BR e en) para **"Multilíngue por Construção"**, com os quatro
> idiomas do Protheus. A spec deixou de estar à frente da constituição.

*Consequência de desenho*: o conjunto de idiomas vive em **um único ponto de declaração**
(FR-015a). A verificação de divergência de chaves compara todos os pares, não um par. Acrescentar um
quinto idioma passa a ser acrescentar um arquivo e uma linha de configuração.

*Risco assumido, e é honesto declará-lo*: a qualidade das traduções de espanhol e russo não pode ser
atestada por quem escreve esta spec. As chaves e o mecanismo ficam corretos e verificados; **o texto
em `es` e `ru` precisa de revisão por quem fala o idioma** antes da publicação. A verificação
automática pega chave faltante, não tradução ruim.

### D5 — Teste nunca é opcional, e a cobertura mínima é **98%**

Decidido pelo dono em 2026-08-19. Duas partes:

1. **Teste nunca é opcional.** Toda tarefa de implementação é precedida pela sua tarefa de teste,
   escrita para falhar primeiro. Template, skill ou ferramenta que declare o contrário está
   subordinado ao Princípio VI e MUST ser contrariado.
2. **Cobertura mínima de 98%** em linhas, funções e ramos, como portão de merge.

*Razão da parte 1*: o template do spec-kit declara testes opcionais em dois lugares, e essa
contradição já teve de ser neutralizada à mão ao gerar as tarefas desta spec. Princípio NÃO
NEGOCIÁVEL que depende de alguém lembrar de contrariar a ferramenta não está protegido.

*Razão da parte 2*: o legado assertava totais sobre cinco arquivos e o pipeline instalava `mocha`
sem executar `npm test` — cobertura real desconhecida. Um limiar que **falha o processo** é o que
transforma cobertura de relatório decorativo em portão.

*Mecanismo*: `--experimental-test-coverage` com `--test-coverage-lines`, `--test-coverage-functions`
e `--test-coverage-branches`, nativo do Node 24 e confirmado disponível nesta máquina. **Sem
dependência nova** — era condição, e a constituição passou a vedá-la explicitamente.

*Ressalva registrada*: a camada de integração com o editor tem ramos que só ocorrem sob condição do
próprio VS Code. A saída é **exclusão declarada com razão em lista versionada** (FR-032), nunca
limiar mais baixo sem registro. A diferença importa: a primeira deixa rastro auditável do que não
está coberto e por quê; a segunda apaga a informação.

> ✅ **Emenda feita.** Constituição na **v2.2.0**, 2026-08-19: o Princípio VI passou a
> "Fixture, **Teste** e Medição Antes da Regra", com as duas cláusulas acima escritas, e o portão 2
> do fluxo passou de "suíte verde" para "suíte verde **E** cobertura ≥ 98%".
