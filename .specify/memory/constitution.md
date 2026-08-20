<!--
Sync Impact Report
==================
Versão: 2.4.0 → 2.5.0
Tipo de bump: MINOR — o Princípio III ganha uma TERCEIRA origem de regra. Nenhum princípio removido
nem redefinido de forma incompatível; `totvs` e `projeto` continuam com as mesmas exigências.
Aprovada pelo dono em 2026-08-20.

Motivo: a taxonomia de origem tinha duas casas e a realidade tem três.

  totvs     regra do catálogo oficial — MUST citar id e grupo G1-G5
  projeto   regra nossa, que o padrão não cobre — MUST dizer o que pega que o padrão não pega
  ???       norma escrita da TOTVS que NÃO está no catálogo

O terceiro caso é real e está documentado: as diretrizes oficiais de ADVPL/TLPP exigem ProtheusDOC
em função, classe, webservice e struct — e **nenhuma dessas exigências tem identificador no catálogo
SonarQube**. Ela não é `totvs`, porque não há id nem grupo a citar. E declará-la `projeto` seria
mentir duas vezes: a regra não é invenção nossa, e a justificativa obrigatória do Princípio III —
"o que ela pega que o padrão não pega" — não se aplica, porque o padrão MANDA fazer, ele só não
oferece um id.

A emenda cria `diretriz`: regra que vem de norma escrita da TOTVS sem entrada no catálogo. Ela MUST
citar o documento e a data da consulta, no lugar do id — e é justamente essa citação que a separa de
uma regra `projeto` disfarçada.

O que NÃO muda: a exigência de identificador na faixa `PJ####` para regra que não é de catálogo, a
severidade declarada com razão escrita, a chave própria de desligamento e a medição de falso positivo
antes de ligar. `diretriz` herda as quatro.

Débito registrado: `TODO(DIRETRIZ_REGISTRY)` — o registro de regras ainda NÃO implementa esta
origem. A implementação vem com a primeira regra que a use, junto das invariantes que só aquela spec
tem como fixar. Decidir a taxonomia agora é o que desbloqueia a spec de ProtheusDOC; implementá-la
sem nenhum consumidor seria fixar invariantes no escuro.

--- Emenda anterior ---
Versão: 2.3.0 → 2.4.0
Tipo de bump: MINOR — o item de ativação do orçamento do Princípio I passa de UM teto não aferido
para DOIS tetos medidos. Nenhum princípio removido nem redefinido de forma incompatível. Aprovada
pelo dono em 2026-08-19, no mesmo dia da v2.3.0.

Motivo: a v2.3.0 marcou "ativação da extensão ≤ 200 ms" como NÃO AFERIDO. Aferir foi a primeira
coisa que reprovou — e o portão fez o trabalho dele.

  medido, seis rodadas:  260, 334, 351, 378, 418, 451 ms   (teto era 200)

Instrumentando o `activate`, o quadro ficou claro e mudou a conclusão:

  corpo do activate      18,4 ms    <- o que ESTE código controla
  resto                 200-430 ms  <- o editor carregando o módulo de 352 KB

O código próprio está com folga de 10x. O custo é ler, compilar e resolver os `require` de um pacote
que é quase todo `vscode-languageclient`. Minificar não muda (377 ms no pacote de produção contra
418 no de desenvolvimento), e separação de código não funciona no formato CommonJS — `await import()`
vira `require` no mesmo arquivo.

Um teto único media as duas coisas juntas e REPROVAVA O CÓDIGO CORRETO pelo custo de carregar uma
dependência necessária. A emenda separa:

  trabalho próprio da ativação     <=  50 ms   (medido 18,4)
  ativação completa no editor      <= 1000 ms  (medido 218-451)

Os 1000 ms têm margem de 2,2x sobre o máximo observado e coincidem com o ponto em que o próprio VS
Code trata uma extensão como lenta. O dono considerou 500 ms — que passava nas medições, mas com 11%
de folga acusaria em máquina mais lenta sem que nada tivesse regredido, e falha assim se lê errado.
A pressão sobre o custo fica onde é honesta: nos 50 ms do trabalho próprio, que o código controla.

Acrescentado também o item "do arquivo aberto ao primeiro diagnóstico <= 300 ms" (SC-001, medido
~112 ms), que já era critério de sucesso da spec 001 e agora tem lugar no orçamento.

Nenhuma dívida TODO mudou de estado. A dívida T088 da spec 001 está CUMPRIDA: a ativação foi medida.

--- Emenda anterior ---

Versão: 2.2.1 → 2.3.0
Tipo de bump: MINOR — ampliação material do Princípio I. Nenhum princípio removido, nenhum
redefinido de forma incompatível. Aprovada pelo dono em 2026-08-19.

Motivo: o orçamento de desempenho do Princípio I era **provisório por escrito** e mandava a si
mesmo ser emendado "com base em medição, não por estimativa". A linha de base da spec 001 produziu
a medição. A emenda executa o que o próprio texto previa — não muda uma regra, cumpre uma.

O que a medição mostrou, e por que o orçamento antigo não servia:

  1. O TAMANHO DE REFERÊNCIA media o arquivo errado. "p95 de fonte de 1.000 linhas" ancorava o
     orçamento em torno do percentil 75 real — entre o p50 (309) e o p90 (1.862). O Princípio I
     existe para proteger a CAUDA: o legado não travava em arquivo mediano, travava no fonte de dez
     mil linhas. O p95 verdadeiro é 3.230 linhas.
  2. O TETO NÃO LIMITAVA NADA. O fonte de p95 é analisado em 0,91 ms contra um teto de 100 ms —
     109 vezes de folga. Uma regressão de TRINTA vezes passaria sem acender luz, e o Portão 4
     ("nenhuma regressão de desempenho não justificada") não tinha como ser cumprido assim. Portão
     que nunca reprova não é frouxo: é enganoso.

Seção alterada:
  - Princípio I, item de orçamento: substituído por tabela com quatro tetos aferidos e um NÃO
    aferido, cada um com o valor medido ao lado, e a justificativa da margem de uma ordem de
    grandeza. Removido o bloco ⚠️ que registrava o subdimensionamento — ele deixou de ser
    constatação pendente e virou o próprio orçamento.

Dois itens de orçamento são NOVOS, e cobrem onde o legado falhava:
  - reanálise do maior fonte (27.832 linhas) ≤ 50 ms — o legado REJEITAVA a análise de fonte grande
    com um setTimeout de 1000 ms;
  - parada após cancelamento ≤ 5 ms — o legado descartava o resultado no fim em vez de parar.
  Medir só o p95 deixaria os dois defeitos originais sem portão.

⚠️ LIMITE HONESTO DESTA EMENDA: a ativação da extensão DENTRO do editor continua sem verificação.
Os 41,4 ms medidos são a partida do MOTOR — subir o processo e carregar o código. O item "ativação
≤ 200 ms" PERMANECE no orçamento, marcado como não aferido, porque trocá-lo pelo número do motor
apagaria um item fingindo tê-lo medido. Dívida: tarefa T088 da spec 001.

TODOs atualizados nesta emenda:
  - TODO(BENCHMARK_BASE): **FECHADO**. A linha de base existe, está versionada em
    `specs/001-esqueleto-lsp-harness/baseline/2026-08-19.{json,md}` e produziu os números desta
    emenda. O confronto entre o orçamento antigo e o medido está em `CONFRONTO-2026-08-19.md`.
  - TODO(CORPUS): números atualizados pela medição estratificada — 35.659 fontes inventariados;
    p50 309, p90 1.862, p95 3.230, p99 10.155, máximo 27.832 linhas. A apuração anterior
    (p95 2.933, máximo 24.636) subamostrava a cauda e foi substituída.
  - TODO(SEVERITY_MAP), TODO(CI), TODO(REPO_LAYOUT): intocados.

--- Emenda anterior ---

Versão: 2.2.0 → 2.2.1
Tipo de bump: PATCH — esclarecimento de redação. Nenhum princípio novo, nenhum princípio
alterado, nenhuma mudança de escopo.

Motivo: o dono perguntou em 2026-08-19 se os arquivos da própria extensão precisam ser UTF-8, e a
constituição não respondia. A seção "Arquitetura e Restrições Técnicas" dizia apenas "fontes são
lidas e gravadas em CP1252", sem qualificar A QUE arquivos isso se aplica. Uma leitura desatenta
aplicaria CP1252 ao repositório inteiro — e gravar `package.nls.ru.json` em CP1252 destruiria o
texto em russo, cujo alfabeto não existe naquele code page. A pergunta ser possível já era o
defeito.

Seção alterada: Arquitetura e Restrições Técnicas — o item **Encoding** foi reescrito para separar
explicitamente os DOIS encodings do projeto (CP1252 para o que é analisado, UTF-8 sem BOM para o
que é do repositório) e para registrar que configuração de workspace do VS Code vence o
`configurationDefaults` do manifesto.

Nenhuma dívida `TODO` mudou de estado.

--- Emenda anterior ---

Versão: 2.1.1 → 2.2.0
Tipo de bump: MINOR — duas ampliações materiais de princípio, nenhuma remoção e nenhuma
redefinição incompatível. Decisões do dono em 2026-08-19, durante a spec 001.

Princípios alterados:
  - V. Bilíngue por Construção → **V. Multilíngue por Construção**. O piso passa de dois idiomas
    (pt-BR e en) para os **quatro em que o Protheus é localizado**: português do Brasil, espanhol,
    inglês e russo. O nome deixou de ser verdadeiro quando dois viraram quatro. Acrescentado o
    requisito de ponto único de declaração dos idiomas, para que o quinto seja configuração e não
    código, e registrado o limite honesto: a verificação prova que as chaves batem, não que a
    tradução presta.
  - VI. Fixture e Medição Antes da Regra — ampliado em duas frentes. (a) "Teste nunca é opcional"
    passa a estar **escrito**, não implícito, com a subordinação explícita de template, skill e
    ferramenta que digam o contrário. (b) **Cobertura mínima de 98%** em linhas, funções e ramos
    vira portão de merge, medida pelo mecanismo nativo do Node 24 — sem dependência nova,
    verificado nesta máquina em 2026-08-19.

Seções alteradas:
  - Arquitetura e Restrições Técnicas: acrescentada a convenção de idioma do repositório.
  - Fluxo de Desenvolvimento e Portões de Qualidade: portão 2 passa a exigir cobertura ≥ 98%;
    portão 3 passa a citar os quatro idiomas.
  - Princípio I: registrada a constatação de que o orçamento provisório está subdimensionado.

Motivo da emenda 1 (Princípio VI): o template do spec-kit upstream declara testes opcionais em
dois lugares — `.specify/templates/tasks-template.md` linha 12 e
`.claude/skills/speckit-tasks/SKILL.md` linha 145 — e essa contradição já teve de ser neutralizada
à mão na geração de tarefas da spec 001. Um princípio NÃO NEGOCIÁVEL que depende de alguém lembrar
de contrariar o template não está protegido; agora a subordinação está no texto.

TODOs atualizados nesta emenda:
  - TODO(BENCHMARK_BASE): continua aberto, agora com a constatação de que o orçamento provisório
    do Princípio I está **subdimensionado** — "p95 de fonte de 1.000 linhas" fica entre o p50 (309)
    e o p90 (1.699) reais, e o p95 verdadeiro é 2.933 linhas. A spec 001 produz os números medidos
    e a emenda definitiva.
  - TODO(CORPUS): parcialmente resolvido e materialmente atualizado. O corpus existe e é robusto
    (~27.139 `.prw`, 4.072 `.tlpp`, 3.210 `.prx`, 1.178 `.prg`), mas é **externo, local e nunca
    versionável** — são fontes padrão do Protheus. Amostra de 3.000 fontes medida em 2026-08-19:
    p50 309, p90 1.699, p95 2.933, p99 7.951, máximo 24.636 linhas. Consequência: a linha de base
    não é reproduzível por terceiros.
  - TODO(SEVERITY_MAP): continua aberto, com a **primeira entrada decidida** na spec 001 —
    `MINOR` do catálogo é exibido como `Information`. Faltam as demais, em especial
    `CA2050`/`CA2051`/`CA2052`, que são `INFO` no catálogo e alto impacto na prática.
  - TODO(CI): intocado.
  - TODO(REPO_LAYOUT): intocado.

--- Histórico ---

Versão 2.1.0 → 2.1.1 foi PATCH — as referências normativas passaram a existir dentro do repositório
(`referencias/totvs/`, release v1.0.1, consultada em 2026-08-19, SHA-256 conferido). Nenhum
princípio mudou; a seção Fontes de Referência passou a citar o caminho local ao lado da URL, e
o TODO(CATALOG_VENDOR) foi fechado.

Versão 2.0.0 → 2.1.0 foi MINOR — o catálogo oficial de regras da TOTVS passou a ser fonte normativa
(Princípio III e seção Fontes de Referência materialmente ampliados), e a restrição de encoding
foi **corrigida** de `latin1` para CP1252 com base na documentação oficial.

Emenda de 2026-08-19: o dono localizou o repositório por trás do site da TOTVS —
`github.com/totvs/engpro-advpl-tlpp-skills`, release v1.0.1 de 2026-06-01, com `skills.zip`
(106 arquivos), `AGENTS.md` e `README.md` como ativos baixáveis. Isso resolveu o
TODO(TOTVS_SKILLS) da v2.0.0 e trouxe três consequências normativas:
  1. O catálogo `skills/advpl-tlpp/references/sonarqube-rules-reference.md` (grupos G1–G5, fonte
     `https://sonar-rules.engpro.totvs.com.br`) passa a ser a referência normativa de regra
     `totvs` — não mais o README deste repositório nem o SONNAR-RULES.md.
  2. O encoding correto é **CP1252 (Windows-1252)**, não `latin1`/ISO-8859-1, conforme a TDN
     citada pela skill `utf8-to-cp1252-conversion`. Os dois diferem na faixa 0x80–0x9F, que é
     exatamente onde vivem aspas tipográficas, travessão e o símbolo de euro.
  3. O catálogo oficial contém regras que **não existem** no legado nem no README:
     BG1000, BG1100, BG1200, CS1000, CA2024, CA2025, CA2051, CA2053, CA1005.

Versão 1.0.0 → 2.0.0 foi MAJOR — redefinição incompatível do produto governado. A v1.0.0
governava a biblioteca npm `advpl-lint`; a v2.0.0 passou a governar a **extensão VS Code**
escrita do zero neste repositório. O contrato npm deixou de existir (decisão do dono,
2026-08-19: `analise-advpl/` é referência de comportamento, não dependência).

Princípios renomeados / remanejados na v2.0.0:
  - I. Toda Regra Tem Identidade Rastreável → IV. Toda Regra Tem Identidade, Severidade e
    Desligamento (ampliado: `Diagnostic.code`, `contributes.configuration`)
  - II. Bilíngue por Construção → V. Bilíngue por Construção (caminhos migrados para o
    mecanismo de NLS da extensão)
  - III. Fixture Antes da Regra → VI. Fixture e Medição Antes da Regra (ampliado: toda regra
    entra com custo medido, não só com comportamento provado)
  - V. Desempenho e Cache São Requisitos → I. O Editor Nunca Trava (promovido a primeiro
    princípio e endurecido em regras verificáveis)

Princípio removido na v2.0.0:
  - IV. A API Pública é Contrato Versionado — o produto deixou de ser pacote npm consumido por
    terceiros. A política de SemVer migrou para os portões de qualidade.

Princípios novos na v2.0.0:
  - II. Formatação e Indentação São Produto
  - III. Valor Está no Que o Padrão Não Vê

Resolvidos ao longo do histórico:
  - TODO(TOTVS_SKILLS) — a fonte é `github.com/totvs/engpro-advpl-tlpp-skills`, com ativos de
    release baixáveis. O site `skills.engpro.totvs.io` continua sendo SPA sem API, mas deixou
    de ser o caminho de consulta.
  - TODO(CATALOG_VENDOR) — resolvido na 2.1.1: as referências normativas estão em
    `referencias/totvs/`, cópia byte-idêntica da release v1.0.1, com SHA-256 conferido e
    proveniência registrada em `referencias/totvs/PROVENIENCIA.md`.
-->

# Constituição da Extensão ADVPL Lint

Esta constituição governa a **extensão VS Code de lint e formatação ADVPL/TLPP** escrita neste
repositório (`robsonrosilva/Lint-ADVPL`). O diretório `analise-advpl/` é **legado congelado** —
referência de comportamento, nunca padrão de código e nunca dependência.

## Core Principles

### I. O Editor Nunca Trava (NÃO NEGOCIÁVEL)

Este é o primeiro princípio porque foi a falha que matou a versão anterior. Regras verificáveis:

- **A análise não roda no processo da extensão.** O motor vive em um **Language Server** próprio,
  comunicando por LSP; a camada VS Code é fina e não analisa nada.
- **I/O síncrono é proibido no caminho de análise** — `readFileSync`, `writeFileSync`, `statSync`
  e equivalentes NEVER aparecem em código que roda por documento ou por regra.
- **Log no caminho quente é proibido.** Nada de `console.log` por linha, por regra ou por arquivo.
  Diagnóstico de desenvolvimento sai por canal de log com nível, **desligado por padrão**.
- **Toda análise aceita e respeita `CancellationToken`.** Digitar cancela a análise anterior; a
  reanálise é debounced. Análise cancelada MUST parar de fato, não apenas descartar o resultado.
- **Nenhuma tarefa pode ocupar o event loop por mais de 50 ms sem ceder.** Varredura de projeto é
  sob demanda, com progresso cancelável, NEVER na ativação.
- **Nenhuma passagem O(n²) sobre linhas.** Cada regra vê cada linha (ou nó) **uma vez**. Busca em
  lista de termos usa estrutura indexada, não varredura linear por linha.
- **Cache é incremental.** NEVER reescrever o cache inteiro para gravar um arquivo. Escrita é
  assíncrona e a chave combina hash do conteúdo com versão da extensão.
- **Não existe timeout que rejeita a análise.** Fonte grande demora mais; ela não falha.
- **Orçamento medido.** Os tetos abaixo saem da linha de base de 2026-08-19, versionada em
  `specs/001-esqueleto-lsp-harness/baseline/2026-08-19.json` — 35.659 fontes reais inventariados,
  amostra estratificada de 1.012 arquivos, cinco repetições cada, mediana.

  | Item | Teto | Medido | Estado |
  | ---- | ---- | ------ | ------ |
  | **Trabalho próprio da ativação** — o que o `activate` executa | ≤ **50 ms** | 18,4 ms | aferido |
  | **Ativação completa no editor** — inclui carregar o módulo | ≤ **1000 ms** | 218–451 ms | aferido |
  | Partida do motor — subir o processo e carregar o código | ≤ **100 ms** | 41,4 ms | aferido |
  | Reanálise do p95 — fonte de **3.230 linhas** | ≤ **10 ms** | 0,91 ms | aferido |
  | Reanálise do maior fonte — 27.832 linhas | ≤ **50 ms** | 4,71 ms | aferido |
  | Do arquivo aberto ao primeiro diagnóstico — fonte mediano | ≤ **300 ms** | ~112 ms | aferido |
  | Parada após cancelamento | ≤ **5 ms** | 0,09 ms | aferido |

  **A ativação são DOIS números porque são duas coisas, e só uma está sob controle deste código.**
  O `activate` executa em 18,4 ms — criar o cliente, registrar a guarda de codificação e disparar o
  servidor sem esperar por ele. Os outros 200 a 430 ms são o editor **carregando o módulo**: ler,
  compilar e resolver os `require` de um pacote de 352 KB que é quase todo `vscode-languageclient`.
  Minificar não muda isso (377 ms com o pacote de produção contra 418 com o de desenvolvimento), e
  reduzi-lo exigiria separação de código — que no formato CommonJS não funciona, porque
  `await import()` vira `require` no mesmo arquivo.

  Um teto único de 200 ms para a soma media as duas coisas juntas e **reprovava o código correto**
  pelo custo de carregar uma dependência necessária. Separá-las mantém a proteção onde ela morde:
  um `await` indevido no caminho de ativação estoura os 50 ms na hora, e nenhum ruído de disco
  esconde isso.

  **Os 1000 ms da ativação completa têm margem de 2,2× sobre o máximo observado** (451 ms), e o
  número não é arbitrário: é o ponto em que o próprio VS Code passa a tratar uma extensão como lenta.
  Acima disso, o problema deixa de ser nosso orçamento e vira reclamação do editor ao usuário.

  A decisão foi do dono em 2026-08-19, depois de considerar 500 ms — que passava nas medições, mas
  com 11% de folga acusaria em máquina mais lenta ou com disco frio, e uma falha dessas se lê como
  regressão sem ser. **A pressão sobre o custo de carregamento fica onde ela é honesta: nos 50 ms do
  trabalho próprio**, que o código controla de verdade. Se um dia o item de cima acusar e o de baixo
  seguir verde, a leitura é ambiente, não regressão — é para isso que a decomposição existe.

  **A margem é de uma ordem de grandeza sobre o medido, e o número tem razão.** Ela precisa absorver
  máquina mais lenta que a da medição, as dezenas de regras que ainda vão entrar e a variação entre
  execuções. O teto anterior era 100 ms contra 0,91 ms reais — **109 vezes** o custo — e uma folga
  dessa ordem deixaria passar uma regressão de trinta vezes sem acender luz nenhuma. Portão que
  nunca reprova não é frouxo: é **enganoso**, porque produz a sensação de proteção. Afrouxar teto
  depois é pior que apertá-lo agora.

  **Os dois itens do meio são novos**, e cobrem exatamente onde o legado falhava: ele rejeitava a
  análise de fonte grande com um `setTimeout` de 1000 ms, e descartava o resultado no fim em vez de
  parar quando cancelado. Medir só o p95 deixaria os dois defeitos originais sem portão.

⚠️ **A ativação da extensão continua SEM VERIFICAÇÃO, e o item permanece no orçamento por isso.**
Os 41,4 ms medidos são a **partida do motor** — subir o processo e carregar o código. A ativação
dentro do editor envolve o VS Code e nada a mede hoje. Trocar um número pelo outro apagaria um item
do orçamento fingindo tê-lo aferido. Dívida registrada: tarefa `T088` da spec 001.

⚠️ **Os números do corpus mudaram junto com o método.** A apuração anterior dava p95 de 2.933 linhas
e máximo de 24.636; a estratificada dá **3.230** e **27.832**. A primeira subamostrava a cauda — o
defeito que a estratificação por tamanho existe para evitar. Os desta tabela são os que valem. Ver
`memoria/distribuicao-tamanho-fontes.md`.

Rationale — cada regra acima corresponde a um defeito medido em `analise-advpl/`, e é por isso que
elas são específicas em vez de "escreva código rápido":

| Defeito no legado                                                       | Onde                       |
| ----------------------------------------------------------------------- | -------------------------- |
| `console.log` por linha de cada arquivo, mais um breakpoint esquecido    | `validaAdvpl.ts:121-124`   |
| 66 `console.log` no motor, sem nível nem chave de desligamento           | `src/` inteiro             |
| `for (var key in linhas)` — `for-in` sobre array                         | `validaAdvpl.ts:120`       |
| varredura de **todas** as linhas dentro do laço por linha — O(n²)        | `validaAdvpl.ts:459`       |
| 171 funções restritas percorridas linearmente a cada linha               | `models/Restritos.ts`      |
| cache inteiro serializado e escrito **síncrono** a cada arquivo          | `cache.ts:54-64`           |
| paliativo `gravacoesCache < 30` — a gravação já era cara demais          | `models/fila.ts:38`        |
| `readFileSync` e `statSync` por fonte do projeto                         | `validaProjeto.ts:124,189` |
| `setTimeout` de 1000 ms que **rejeita** a análise                        | `validaAdvpl.ts:57`        |

### II. Formatação e Indentação São Produto

A indentação foi o que a versão anterior fez bem, e é entrega de primeira classe — não acessório
do linter. Regras:

- A extensão MUST fornecer `DocumentFormattingEditProvider` e
  `DocumentRangeFormattingEditProvider`. Formatação ao digitar é opcional e, se existir, obedece
  ao Princípio I como qualquer outro caminho quente.
- **Formatar é idempotente**: formatar duas vezes produz exatamente o mesmo texto que formatar uma
  vez. Verificado por teste, em toda fixture de formatação.
- **Formatar NEVER altera semântica**: o fonte formatado MUST produzir o mesmo conjunto de
  diagnósticos que o original. Um formatador que muda o resultado da análise é defeito grave.
- **Preserva o que não é seu**: encoding e fim de linha do arquivo original são mantidos. Fonte
  Protheus é **CP1252**, frequentemente com CRLF; formatar NEVER pode gravar UTF-8, porque o
  compilador Protheus só aceita CP1252 e o arquivo deixa de compilar.
- **Devolve o menor conjunto de `TextEdit` possível.** Substituir o documento inteiro destrói
  dobras, marcadores, seleção e histórico de desfazer.

### III. Valor Está no Que o Padrão Não Vê

A outra força da versão anterior eram críticas que o TOTVS Code Analyzer não faz. Isso é a razão
de a extensão existir, e MUST ser protegido explicitamente:

- **Toda regra declara sua origem**, e são **três**:

  | Origem | O que é | O que ela MUST citar |
  | ------ | ------- | -------------------- |
  | `totvs` | regra do catálogo oficial | o **identificador** e o **grupo** (G1 Segurança, G2 Desempenho, G3 Legado, G4 Metadados, G5 Compilação) |
  | `diretriz` | norma escrita da TOTVS **sem entrada no catálogo** | o **documento** de origem e a **data da consulta** |
  | `projeto` | regra própria, que o padrão não cobre | **o que ela pega que o padrão não pega** |

- **Regra `projeto` MUST documentar o que pega que o padrão não pega.** Sem essa frase, ela é
  duplicata não declarada e MUST ser rejeitada.
- **Regra `diretriz` MUST citar o documento e a data.** Sem a citação, ela é indistinguível de uma
  regra `projeto` — e é exatamente essa distinção que a origem existe para fazer.

  A origem existe porque a taxonomia de duas casas não descrevia a realidade. As diretrizes oficiais
  de ADVPL/TLPP exigem ProtheusDOC em função, classe, webservice e struct, e **nenhuma dessas
  exigências tem id no catálogo SonarQube**. Não é `totvs`, porque não há id nem grupo a citar. E não
  é `projeto`, porque a regra não é invenção nossa e a justificativa "o que ela pega que o padrão não
  pega" não se aplica: o padrão MANDA fazer, ele só não oferece um identificador.

  `diretriz` herda de `projeto` tudo o mais: identificador na faixa reservada, **severidade declarada
  com razão escrita**, chave própria de desligamento, e medição de falso positivo antes de ser ligada.

  ⚠️ `TODO(DIRETRIZ_REGISTRY)`: o registro de regras ainda **não** implementa esta origem. A
  implementação vem com a primeira regra que a use, junto das invariantes que só aquela spec tem como
  fixar. Decidir a taxonomia desbloqueia a spec de ProtheusDOC; implementá-la sem consumidor seria
  fixar invariante no escuro.
- **A severidade do SonarQube não é copiada; é mapeada por tabela versionada.** CA2050, CA2051 e
  CA2052 são `INFO` no catálogo, que ao mesmo tempo declara que representam alto impacto —
  tradução literal exibiria SQL Injection e senha em código como dica de estilo.
- **Nenhuma regra é ligada por padrão sem taxa de falso positivo medida** sobre corpus de fontes
  reais. Regra ruidosa treina o usuário a ignorar o painel inteiro.
- **Dois pisos, nenhum teto.** O legado (28 chaves de desligamento, 33 mensagens) é o piso do que
  já se entregava; o catálogo oficial G1–G5 é o piso do que o padrão exige. Perder item de
  qualquer um dos dois na reescrita exige decisão registrada, nunca omissão.
- **Regra do catálogo oficial ausente do legado é lacuna conhecida, não descoberta.** BG1000,
  BG1100, BG1200, CS1000, CA2024, CA2025, CA2051, CA2053 e CA1005 não existem em
  `analise-advpl/` nem no README deste repositório; entram no backlog por esta constituição.

### IV. Toda Regra Tem Identidade, Severidade e Desligamento

Todo diagnóstico MUST carregar identificador estável, severidade, localização exata (linha e
coluna, inicial e final) e mensagem internacionalizada.

- O identificador vai no `Diagnostic.code` do VS Code, com `target` apontando para a documentação
  daquela regra — é assim que o usuário descobre o que fazer sem sair do editor.
- **Toda regra MUST ser desligável individualmente** por chave em `contributes.configuration`, e
  a severidade MUST ser configurável. Regra sem chave própria MUST ser rejeitada.
- O texto da mensagem é traduzido e reescrito; ele NEVER serve de contrato. Supressão, filtro e
  configuração se dão por identificador.

### V. Multilíngue por Construção

Nenhuma string destinada ao usuário é escrita literalmente no código. Toda mensagem — diagnóstico,
título de code action, rótulo de configuração, descrição de comando — MUST existir nos **quatro
idiomas em que o Protheus é localizado**, pelo mecanismo de NLS da extensão:

| Idioma | Identificador de localidade | Papel |
| ------ | --------------------------- | ----- |
| Inglês | `en` | **base** — é para onde todo idioma sem tradução recai |
| Português do Brasil | `pt-br` | |
| Espanhol | `es` | |
| Russo | `ru` | |

- Conjunto de chaves divergente entre **quaisquer dois** idiomas é **falha de build**, não
  pendência de tradução.
- Idioma sem tradução MUST recair no inglês. NEVER exibir o identificador cru da chave.
- **O conjunto de idiomas MUST viver em ponto único de declaração.** Acrescentar o quinto idioma é
  acrescentar um arquivo e uma entrada nessa lista — NEVER mexer em código. Nenhum outro lugar do
  repositório enumera idioma.

Rationale: o produto atende quem trabalha com Protheus, e o Protheus fala esses quatro idiomas.
Parar em dois deixaria de fora as bases hispano-americana e russa, que usam o mesmo catálogo de
regras da TOTVS. Chave faltante não degrada elegantemente — ela vaza o identificador cru para
dentro do editor, e com quatro idiomas em dois mecanismos são oito arquivos de tradução, o que faz
a verificação deixar de ser zelo e virar necessidade aritmética.

⚠️ **Limite honesto deste princípio**: a verificação prova que as **chaves** batem. Ela não diz
nada sobre a **qualidade** do texto. Tradução para espanhol e russo MUST ser revisada por quem fala
o idioma antes da publicação. Nenhum portão automático substitui isso, e fingir o contrário
entregaria texto que ninguém leu.

### VI. Fixture, Teste e Medição Antes da Regra (NÃO NEGOCIÁVEL)

Toda regra nova ou alterada MUST entrar com **três** coisas, nesta ordem:

1. **Fixture** — fonte ADVPL/TLPP real que a exercita, escrita **antes** da implementação e
   falhando primeiro.
2. **Asserção sobre o diagnóstico específico** — identificador, severidade, linha e coluna. NEVER
   apenas contagem agregada: contagem esconde regra que parou de funcionar enquanto outra passou a
   disparar a mais.
3. **Custo medido** — o quanto aquela regra acrescenta ao tempo de análise do corpus. Regra cujo
   custo não foi medido não pode ser ligada por padrão.

#### Teste NEVER é opcional

- **Toda tarefa de implementação MUST ser precedida pela sua tarefa de teste**, escrita para falhar
  primeiro. Artefato de tarefas com implementação órfã de teste é artefato **a refazer**, não a
  executar.
- **Template, skill, gerador ou ferramenta que declare testes opcionais está subordinado a este
  princípio e MUST ser contrariado.** Onde a ferramenta e esta constituição discordarem, esta vence
  e a ferramenta MUST ser corrigida.

Rationale desta cláusula: o template do spec-kit upstream declara testes opcionais em dois lugares
— `.specify/templates/tasks-template.md` (linha 12) e `.claude/skills/speckit-tasks/SKILL.md`
(linha 145) — e a contradição já teve de ser neutralizada à mão na geração de tarefas da spec 001.
Um princípio NÃO NEGOCIÁVEL que depende de alguém lembrar de contrariar o padrão da ferramenta não
está protegido. Agora a subordinação está escrita, e corrigir os dois arquivos é dívida registrada.

#### Cobertura mínima de 98%

- A suíte MUST atingir **98% de cobertura em linhas, em funções e em ramos**. Abaixo disso, o
  merge está bloqueado.
- A medição usa o mecanismo **nativo** do Node — `--experimental-test-coverage` com
  `--test-coverage-lines`, `--test-coverage-functions` e `--test-coverage-branches`. Verificado
  disponível em 2026-08-19. NEVER acrescentar dependência para medir cobertura.
- **Exclusão de arquivo da medição MUST constar de lista versionada, com a razão de cada item.**
  Baixar o limiar, excluir arquivo sem justificativa, ou desligar a verificação são violações —
  não ajustes.

⚠️ **Ressalva honesta**: a camada de integração com o editor tem ramos genuinamente difíceis de
cobrir — caminhos que só ocorrem sob condição do próprio VS Code. A saída para isso é **exclusão
declarada com razão registrada**, NEVER limiar mais baixo sem registro. A diferença importa: a
primeira deixa rastro auditável do que não está coberto e por quê; a segunda apaga a informação.

Rationale geral: o legado assertava apenas totais de `error`/`warning`/`information`/`hint` sobre
cinco arquivos, e o pipeline instalava `mocha` sem nunca executar `npm test`. Com esse desenho, duas
regras quebradas em direções opostas mantêm a suíte verde, nenhum custo individual jamais aparece, e
a cobertura real é desconhecida — que é exatamente como se chega a um motor que trava o editor sem
ninguém saber qual regra o fez.

## Arquitetura e Restrições Técnicas

- **Forma**: extensão VS Code em TypeScript, com o motor em Language Server próprio (LSP).
- **Ativação**: `activationEvents` restrito às linguagens ADVPL/TLPP. Ativação por `*` é proibida.
  A extensão é empacotada (bundler) — carregar centenas de arquivos na ativação é custo direto no
  orçamento do Princípio I.
- **Sem dependência do legado**: `advpl-lint` NEVER entra como dependência. `analise-advpl/` é
  consultado por leitura humana; o que for reaproveitado é **dado de domínio** (lista de funções
  restritas, catálogo de includes, mensagens), nunca código.
- **Encoding — são DOIS, e eles nunca se confundem.**

  **1. Fontes ADVPL/TLPP analisados** (`prw`, `prx`, `prg`, `apw`, `apl`, `tlpp`, `ch`): lidos e
  gravados em **CP1252 (Windows-1252)** — é o único code page que os compiladores Protheus
  aceitam (TDN, citada pela skill `utf8-to-cp1252-conversion`). `latin1` do Node é ISO-8859-1 e
  **não** é equivalente: os dois divergem em 0x80–0x9F, faixa das aspas tipográficas, travessão e
  euro. O legado lia como `latin1`; isso é defeito a não repetir.

  **2. Arquivos do próprio repositório** — código TypeScript, JSON, Markdown e, em especial, os
  arquivos de tradução `package.nls.*.json` e `l10n/bundle.l10n.*.json`: **UTF-8, sem marca de
  ordem de byte (BOM)**. É requisito da plataforma, não preferência: JSON de interchange é UTF-8
  por especificação, o VS Code lê os arquivos de NLS e de l10n como UTF-8, e o compilador
  TypeScript assume UTF-8. Gravar um arquivo de tradução em CP1252 **destruiria o russo**, cujo
  alfabeto não existe naquele code page. BOM é proibido porque quebra a análise de JSON em alguns
  leitores e polui a comparação em revisão.

  ⚠️ **Consequência prática, medida em 2026-08-19**: configuração de workspace do VS Code **vence**
  o `configurationDefaults` que a extensão declara no manifesto. Um `"files.encoding": "utf8"` no
  `.vscode/settings.json` do repositório sobrepõe o padrão CP1252 que a extensão empurra, e faz a
  própria instância de desenvolvimento ler errado as fixtures. A correção é sobrepor **por
  linguagem** no mesmo arquivo — `"[advpl]": { "files.encoding": "windows1252" }` e o equivalente
  para `tlpp` — e essa configuração NEVER deve ser removida.

  Verificação registrada em 2026-08-19: os 109 arquivos versionados de código, configuração e
  documentação do repositório foram conferidos — zero com BOM, zero inválidos como UTF-8.
- **Extensões reconhecidas**: `prw`, `prx`, `prg`, `apw`, `apl`, `tlpp`. Ampliar exige regra e
  fixture.
- **Dependências**: conjunto mínimo. Toda dependência de runtime nova MUST ser justificada no PR
  contra a alternativa de implementá-la localmente, e MUST ser avaliada pelo custo de ativação.
- **Portabilidade**: caminhos são montados com `path.join`. O legado montava com separador de
  Windows literal, e isso quebra fora do Windows.
- **Segurança**: regra que detecta credencial ou SQL Injection NEVER ecoa o valor sensível na
  mensagem — apenas a localização.
- **Idioma do repositório** (decisão do dono, 2026-08-19). A divisão NEVER é "código versus
  documentação" — é **o que a máquina interpreta versus o que uma pessoa lê**:

  | Em inglês | Em pt-BR |
  | --------- | -------- |
  | identificadores — variáveis, funções, tipos, classes | **comentários dentro do código** |
  | nomes de arquivo e de diretório | nomes e descrições de teste |
  | chaves de configuração e de tradução | documentação e mensagens de commit |

  Rationale: a API do VS Code, o LSP e o npm são em inglês, e identificador em português produz
  híbrido — defeito que o legado tinha (`validaAdvpl.ts` ao lado de `cache.ts`). Comentário é outra
  coisa: existe para explicar **por que** o código é assim a quem for mantê-lo, e quem mantém este
  repositório pensa em português. Comentário em inglês forçado sai mais raso e vira paráfrase da
  linha seguinte — e o Princípio I depende de comentários que expliquem decisões contraintuitivas
  de desempenho. Mensagem destinada ao usuário final NEVER entra nesta regra: ela passa pelo NLS e
  existe nos quatro idiomas do Princípio V.

## Fluxo de Desenvolvimento e Portões de Qualidade

Trabalho de feature segue o ciclo do Spec Kit: `/speckit-specify` → `/speckit-plan` →
`/speckit-tasks` → `/speckit-implement` → `/speckit-converge` → `/security-review`. Correções
pontuais e ajustes de texto estão dispensados do ciclo completo.

Portões obrigatórios antes de qualquer merge:

1. Compilação TypeScript sem erros.
2. **Suíte de testes verde E cobertura ≥ 98%** em linhas, funções e ramos. Exclusão da medição
   apenas por lista versionada com razão registrada (Princípio VI).
3. Regra nova acompanhada de fixture, asserção específica, custo medido, chave de configuração
   própria e strings nos **quatro** idiomas.
4. **Nenhuma regressão de desempenho não justificada** contra a linha de base — e a linha de base
   é reconferida quando uma spec acrescenta regra, porque orçamento com ponto de partida
   envelhecido não limita nada.
5. Decisão de SemVer registrada e `package.json` atualizado: MAJOR para remoção ou renomeação de
   chave de configuração ou de identificador de regra; MINOR para regra nova ou configuração
   nova; PATCH para correção de falso positivo/negativo e ajuste de texto.
6. Documentação sincronizada: regra que existe no código mas não no README, ou descrita no README
   e ausente do código, bloqueia o merge. Vale nos dois sentidos.

Enquanto não houver CI (decisão em aberto, ver TODO(CI)), os portões são verificados localmente e
o relatório ao usuário MUST dizer exatamente o que foi executado. Saída de teste NEVER é canalizada
— `npm test | tail` devolve o código de saída do `tail`, não do teste, e isso já mascarou suíte que
nem chegou a rodar.

## Fontes de Referência

Fonte consultada para decidir regra ou API MUST ser citada na spec, **com a data da consulta**.

As referências normativas da TOTVS estão **no repositório**, em `referencias/totvs/` — cópia
byte-idêntica da release `v1.0.1`, consultada em 2026-08-19, com SHA-256 conferido e proveniência
em `referencias/totvs/PROVENIENCIA.md`.

| Fonte                                                    | Autoridade sobre                                      |
| -------------------------------------------------------- | ----------------------------------------------------- |
| `referencias/totvs/sonarqube-rules-reference.md`         | **normativa** — id, título, severidade e API proibida por regra (G1–G5) |
| `referencias/totvs/totvs-advpl-tlpp-guidelines.md`       | **normativa** — notação húngara, nomes de fonte, tipos, ProtheusDOC, encoding |
| `referencias/totvs/skill-code-review.md` e `skill-sql-code-review.md` | como a própria TOTVS revisa ADVPL/TLPP e SQL |
| `referencias/totvs/advpl-tlpp-skills-reference.md`       | índice do que existe no pacote e não foi trazido       |
| `github.com/totvs/engpro-advpl-tlpp-skills`              | origem das cópias acima — caminho de atualização       |
| `https://sonar-rules.engpro.totvs.com.br`                | origem declarada do catálogo de regras                 |
| `https://code.visualstudio.com/api`                      | **normativa** — providers de linguagem, LSP, ativação  |
| `SONNAR-RULES.md` e o PDF do Guia TOTVS neste repositório | apoio; gerados por IA, NEVER prevalecem sobre o catálogo |
| `analise-advpl/`                                         | comportamento da versão anterior — nunca código        |

**As cópias em `referencias/totvs/` NEVER são editadas.** Correção, complemento ou interpretação
vive em documento próprio — editar a cópia faz a correção sumir sem aviso na próxima atualização.

**Hierarquia, e ela decide conflito**: catálogo oficial > documentação TDN > skills da TOTVS >
`SONNAR-RULES.md` e o PDF deste repositório > legado. Os dois documentos deste repositório
declaram-se gerados por IA e já divergem do catálogo oficial — não podem arbitrar nada.

**Referência usada como base de regra MUST estar no repositório**, com a **tag da release** e a
**data da consulta**. O site `skills.engpro.totvs.io` é uma aplicação React sem renderização no
servidor — nenhuma rota expõe conteúdo legível por ferramenta —, e por isso o caminho de consulta
é o repositório GitHub e seus ativos de release, nunca o site. Referência que só existe atrás de
JavaScript, ou só na máquina de quem consultou, não é verificável em revisão.

**Atualizar as cópias é mudança de requisito, não de documentação.** Regra nova, removida ou com
severidade alterada no catálogo MUST virar item de backlog na mesma entrega que atualiza o arquivo.

## Corpus de Medição

O corpus de fontes ADVPL/TLPP reais usado para medir desempenho e falso positivo é **externo,
local e NEVER versionável** — são fontes padrão do Protheus, e versioná-las é problema de licença
e de exposição.

- O caminho do corpus MUST vir de configuração local não versionada.
- Fonte padrão do Protheus NEVER entra no repositório, em nenhuma forma — nem como fixture, nem
  como amostra, nem como trecho em relatório de medição.
- O corpus serve como **material de leitura do qual se derivam fixtures autorais**. Fixture é
  código escrito por nós que reproduz a construção observada, NEVER cópia literal.
- A linha de base medida sobre ele **não é reproduzível por terceiros**. O relatório MUST ser
  autoexplicativo o bastante para servir de comparativo mesmo sem nova execução.

Estado apurado em 2026-08-19: ~27.139 `.prw`, 4.072 `.tlpp`, 3.210 `.prx`, 1.178 `.prg` e 35.103
`.ch`.

**Distribuição medida pelo harness**, sobre inventário de **35.659** fontes analisáveis, com amostra
**estratificada por tamanho** de 1.012 arquivos: p50 **309**, p90 **1.862**, p95 **3.230**, p99
**10.155**, máximo **27.832** linhas.

⚠️ Estes números **substituem** a apuração anterior (p90 1.699, p95 2.933, p99 7.951, máximo
24.636), feita sobre amostra de 3.000 fontes sem estratificação. A diferença está toda na cauda,
e a causa é o método: amostragem uniforme sub-representa os arquivos grandes, que são exatamente
os que o Princípio I existe para proteger. O p50 idêntico nas duas apurações é o indício de que a
divergência é de cauda, não erro sistemático.

## Governança

Esta constituição prevalece sobre qualquer prática, convenção, template ou ferramenta adotada no
repositório. Em conflito entre esta constituição e outro artefato, esta vence e o outro MUST ser
corrigido.

**Emendas**: toda alteração MUST ser feita via `/speckit-constitution`, MUST declarar o tipo de
bump com justificativa e MUST atualizar o Sync Impact Report no topo deste arquivo. Emenda MAJOR
MUST enumerar o que passa a ser permitido e o que deixa de ser.

**Versionamento desta constituição**: MAJOR para remoção ou redefinição incompatível de princípio;
MINOR para princípio ou seção nova, ou ampliação material de escopo; PATCH para esclarecimento ou
correção de redação. É independente da versão da extensão publicada.

**Conformidade**: toda revisão MUST verificar aderência aos seis princípios. Violação deliberada
MUST ser documentada com a razão e o custo de fazer o contrário. Os itens `TODO` do Sync Impact
Report são dívidas conhecidas: NEVER servem de precedente para novas violações.

**Orientação de runtime**: `CLAUDE.md` para o modo de trabalhar no repositório; `README.md` para o
comportamento do produto e o catálogo de regras; `.specify/` para templates e scripts do ciclo SDD;
`memoria/` para a memória versionada entre sessões.

**Version**: 2.5.0 | **Ratified**: 2026-08-19 | **Last Amended**: 2026-08-20
