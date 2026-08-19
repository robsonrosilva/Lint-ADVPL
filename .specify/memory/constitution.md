<!--
Sync Impact Report
==================
Versão: 2.1.0 → 2.1.1
Tipo de bump: PATCH — as referências normativas passaram a existir dentro do repositório
(`referencias/totvs/`, release v1.0.1, consultada em 2026-08-19, SHA-256 conferido). Nenhum
princípio mudou; a seção Fontes de Referência passou a citar o caminho local ao lado da URL, e
o TODO(CATALOG_VENDOR) foi fechado.

Histórico: 2.0.0 → 2.1.0 foi MINOR — o catálogo oficial de regras da TOTVS passou a ser fonte normativa
(Princípio III e seção Fontes de Referência materialmente ampliados), e a restrição de encoding
foi **corrigida** de `latin1` para CP1252 com base na documentação oficial.

Emenda de 2026-08-19 (mesma data): o dono localizou o repositório por trás do site da TOTVS —
`github.com/totvs/engpro-advpl-tlpp-skills`, release v1.0.1 de 2026-06-01, com `skills.zip`
(106 arquivos), `AGENTS.md` e `README.md` como ativos baixáveis. Isso resolve o
TODO(TOTVS_SKILLS) da v2.0.0 e traz três consequências normativas:
  1. O catálogo `skills/advpl-tlpp/references/sonarqube-rules-reference.md` (grupos G1–G5, fonte
     `https://sonar-rules.engpro.totvs.com.br`) passa a ser a referência normativa de regra
     `totvs` — não mais o README deste repositório nem o SONNAR-RULES.md.
  2. O encoding correto é **CP1252 (Windows-1252)**, não `latin1`/ISO-8859-1, conforme a TDN
     citada pela skill `utf8-to-cp1252-conversion`. Os dois diferem na faixa 0x80–0x9F, que é
     exatamente onde vivem aspas tipográficas, travessão e o símbolo de euro.
  3. O catálogo oficial contém regras que **não existem** no legado nem no README:
     BG1000, BG1100, BG1200, CS1000, CA2024, CA2025, CA2051, CA2053, CA1005.

Histórico: 1.0.0 → 2.0.0 foi MAJOR — redefinição incompatível do produto governado. A v1.0.0
governava a biblioteca npm `advpl-lint`; a v2.0.0 passou a governar a **extensão VS Code**
escrita do zero neste repositório. O contrato npm deixou de existir (decisão do dono,
2026-08-19: `analise-advpl/` é referência de comportamento, não dependência).

Princípios renomeados / remanejados:
  - I. Toda Regra Tem Identidade Rastreável → IV. Toda Regra Tem Identidade, Severidade e
    Desligamento (ampliado: `Diagnostic.code`, `contributes.configuration`)
  - II. Bilíngue por Construção → V. Bilíngue por Construção (caminhos migrados para o
    mecanismo de NLS da extensão)
  - III. Fixture Antes da Regra → VI. Fixture e Medição Antes da Regra (ampliado: toda regra
    entra com custo medido, não só com comportamento provado)
  - V. Desempenho e Cache São Requisitos → I. O Editor Nunca Trava (promovido a primeiro
    princípio e endurecido em regras verificáveis)

Princípios removidos:
  - IV. A API Pública é Contrato Versionado — o produto deixou de ser pacote npm consumido por
    terceiros. A política de SemVer migrou para os portões de qualidade.

Princípios novos:
  - II. Formatação e Indentação São Produto
  - III. Valor Está no Que o Padrão Não Vê

Seções adicionadas: Fontes de Referência.
Seções mantidas: Restrições Técnicas (reescrita para extensão); Fluxo de Desenvolvimento e
Portões de Qualidade; Governança.

Follow-ups registrados (NÃO executados por /speckit-constitution):
  - TODO(BENCHMARK_BASE): os orçamentos do Princípio I são provisórios. Não há harness de
    medição nem linha de base. A primeira spec de código estabelece ambos e emenda os números.
  - TODO(CORPUS): não existe corpus de fontes ADVPL reais para medir falso positivo (III) e
    desempenho (I). O legado tem 5 arquivos em test/files/, o que não sustenta nenhum dos dois.
  - TODO(CI): decisão em aberto (dono, 2026-08-19). Até existir CI, verificação é local.
  - TODO(SEVERITY_MAP): a tabela SonarQube (CRITICAL/MAJOR/MINOR/INFO) → VS Code
    (Error/Warning/Information/Hint) precisa ser definida e versionada. CA2050/CA2051/CA2052
    são INFO no SonarQube e o próprio catálogo diz que representam alto impacto — mapear por
    tradução literal produziria vulnerabilidade exibida como dica.
  - TODO(REPO_LAYOUT): analise-advpl/ é repositório aninhado dentro deste. Definir se vira
    submódulo, sai do diretório ou permanece como está.

Resolvidos:
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
- **Orçamento provisório**, até a linha de base medida existir (ver TODO(BENCHMARK_BASE)):
  ativação da extensão ≤ 200 ms; reanálise p95 de fonte de 1.000 linhas ≤ 100 ms.

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

- **Toda regra declara sua origem**: `totvs` — e então MUST citar o identificador e o grupo
  (G1 Segurança, G2 Desempenho, G3 Legado, G4 Metadados, G5 Compilação) do catálogo oficial —
  ou `projeto`, regra própria que o padrão não cobre.
- **Regra `projeto` MUST documentar o que pega que o padrão não pega.** Sem essa frase, ela é
  duplicata não declarada e MUST ser rejeitada.
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

### V. Bilíngue por Construção

Nenhuma string destinada ao usuário é escrita literalmente no código. Toda mensagem — diagnóstico,
título de code action, rótulo de configuração, descrição de comando — MUST existir em **pt-BR e
en**, pelo mecanismo de NLS da extensão. Conjuntos de chaves divergentes entre idiomas são falha
de build, não pendência de tradução.

Rationale: o produto atende equipes Protheus brasileiras e internacionais no mesmo pacote. Chave
faltante não degrada elegantemente — ela vaza o identificador cru para dentro do editor.

### VI. Fixture e Medição Antes da Regra (NÃO NEGOCIÁVEL)

Toda regra nova ou alterada MUST entrar com **três** coisas, nesta ordem:

1. **Fixture** — fonte ADVPL/TLPP real que a exercita, escrita **antes** da implementação e
   falhando primeiro.
2. **Asserção sobre o diagnóstico específico** — identificador, severidade, linha e coluna. NEVER
   apenas contagem agregada: contagem esconde regra que parou de funcionar enquanto outra passou a
   disparar a mais.
3. **Custo medido** — o quanto aquela regra acrescenta ao tempo de análise do corpus. Regra cujo
   custo não foi medido não pode ser ligada por padrão.

Rationale: o legado assertava apenas totais de `error`/`warning`/`information`/`hint` sobre cinco
arquivos. Com esse desenho, duas regras quebradas em direções opostas mantêm a suíte verde, e
nenhum custo individual jamais aparece — que é exatamente como se chega a um motor que trava o
editor sem ninguém saber qual regra o fez.

## Arquitetura e Restrições Técnicas

- **Forma**: extensão VS Code em TypeScript, com o motor em Language Server próprio (LSP).
- **Ativação**: `activationEvents` restrito às linguagens ADVPL/TLPP. Ativação por `*` é proibida.
  A extensão é empacotada (bundler) — carregar centenas de arquivos na ativação é custo direto no
  orçamento do Princípio I.
- **Sem dependência do legado**: `advpl-lint` NEVER entra como dependência. `analise-advpl/` é
  consultado por leitura humana; o que for reaproveitado é **dado de domínio** (lista de funções
  restritas, catálogo de includes, mensagens), nunca código.
- **Encoding**: fontes são lidas e gravadas em **CP1252 (Windows-1252)** — é o único code page
  que os compiladores Protheus aceitam (TDN, citada pela skill `utf8-to-cp1252-conversion`).
  `latin1` do Node é ISO-8859-1 e **não** é equivalente: os dois divergem em 0x80–0x9F, faixa
  das aspas tipográficas, travessão e euro. O legado lia como `latin1`; isso é defeito a não
  repetir. Node não traz CP1252 nativo, então a decodificação exige dependência dedicada —
  justificada por esta restrição.
- **Extensões reconhecidas**: `prw`, `prx`, `prg`, `apw`, `apl`, `tlpp`. Ampliar exige regra e
  fixture.
- **Dependências**: conjunto mínimo. Toda dependência de runtime nova MUST ser justificada no PR
  contra a alternativa de implementá-la localmente, e MUST ser avaliada pelo custo de ativação.
- **Portabilidade**: caminhos são montados com `path.join`. O legado montava com separador de
  Windows literal, e isso quebra fora do Windows.
- **Segurança**: regra que detecta credencial ou SQL Injection NEVER ecoa o valor sensível na
  mensagem — apenas a localização.

## Fluxo de Desenvolvimento e Portões de Qualidade

Trabalho de feature segue o ciclo do Spec Kit: `/speckit-specify` → `/speckit-plan` →
`/speckit-tasks` → `/speckit-implement` → `/speckit-converge` → `/security-review`. Correções
pontuais e ajustes de texto estão dispensados do ciclo completo.

Portões obrigatórios antes de qualquer merge:

1. Compilação TypeScript sem erros.
2. Suíte de testes verde.
3. Regra nova acompanhada de fixture, asserção específica, custo medido, chave de configuração
   própria e strings nos dois idiomas.
4. **Nenhuma regressão de desempenho não justificada** contra a linha de base — e a linha de base
   é reconferida quando uma spec acrescenta regra, porque orçamento com ponto de partida
   envelhecido não limita nada.
5. Decisão de SemVer registrada e `package.json` atualizado: MAJOR para remoção ou renomeação de
   chave de configuração ou de identificador de regra; MINOR para regra nova ou configuração
   nova; PATCH para correção de falso positivo/negativo e ajuste de texto.
6. Documentação sincronizada: regra que existe no código mas não no README, ou descrita no README
   e ausente do código, bloqueia o merge. Vale nos dois sentidos.

Enquanto não houver CI (decisão em aberto, ver TODO(CI)), os portões são verificados localmente e
o relatório ao usuário MUST dizer exatamente o que foi executado.

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

## Governança

Esta constituição prevalece sobre qualquer prática, convenção ou preferência adotada no
repositório. Em conflito entre esta constituição e outro documento, esta vence e o outro MUST ser
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
comportamento do produto e o catálogo de regras; `.specify/` para templates e scripts do ciclo SDD.

**Version**: 2.1.1 | **Ratified**: 2026-08-19 | **Last Amended**: 2026-08-19
