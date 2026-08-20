# Research — spec 002

Decisões técnicas tomadas antes de escrever código. Cada uma traz o que foi escolhido, por quê, e o
que foi rejeitado.

Verificado nesta máquina em **2026-08-19**: `vscode-languageserver-types` expõe
`CodeActionKind.QuickFix` (`'quickfix'`) e `CodeActionKind.SourceFixAll` (`'source.fixAll'`);
`vscode-languageserver-protocol` expõe `codeActionProvider` nas capacidades do servidor. Nenhuma
dependência nova é necessária para esta spec.

---

## R1 — Quem resolve a cadeia de fontes de includes: o CLIENTE

### Decisão

A cadeia do FR-027 — tds-vscode → advpl-vscode → chave própria → workspace — é resolvida em
`packages/extension` (o cliente), que envia ao servidor **apenas a lista de diretórios já resolvida**
e o nome da fonte que venceu. O servidor nunca lê configuração de extensão nenhuma.

### Razão

Duas das quatro fontes **só existem através da API do VS Code**:

| Fonte | Onde vive | Quem alcança |
| ----- | --------- | ------------ |
| `advpl-vscode` | `advpl.environments[].includeList`, com o ambiente escolhido em `advpl.selectedEnvironment` | **só o cliente** — é configuração do editor |
| chave própria | `advplLint.includePaths` | só o cliente |
| workspace | pastas abertas no editor | só o cliente |
| `tds-vscode` | arquivo `~/.totvsls/servers.json` | qualquer processo |

Três das quatro exigem o cliente. Dividir a resolução entre os dois processos — o cliente lendo três
fontes e o servidor lendo uma — espalharia a regra de precedência por dois lugares e por dois
idiomas de configuração. Pior: o requisito de segurança FR-027b1 ("extrair no ponto de leitura e
descartar o objeto") passaria a valer em dois módulos, e um deles é o motor, que **não tem por que
saber que existe um arquivo com tokens**.

Concentrar no cliente deixa a superfície sensível num arquivo só, auditável de uma vez.

### O que fica no servidor

A **varredura do disco** e o índice. São dezenas de milhares de arquivos, e esse trabalho não pode
acontecer no processo da extensão — é o Princípio I. O servidor recebe os diretórios e indexa.

### Alternativas rejeitadas

- **Servidor lê tudo**: impossível para três das quatro fontes, e colocaria o arquivo com tokens
  dentro do motor.
- **Cliente indexa e envia o mapa pronto**: joga a varredura de dezenas de milhares de arquivos para
  dentro do processo da extensão. É exatamente o defeito que matou a versão anterior.
- **Cliente usa `workspace.findFiles`**: só varre o workspace aberto. A árvore de includes do
  Protheus fica fora dele — foi a razão de a fonte 4 ser o último degrau, não o primeiro.

---

## R2 — Leitura da fonte 1 sem tocar no que não é nosso

### Decisão

Uma função dedicada, com uma responsabilidade: abrir `~/.totvsls/servers.json`, extrair
`includes`, devolver `string[]`. Ela **não devolve o objeto**, não o guarda e não o repassa. O
`JSON.parse` acontece dentro dela e o resultado morre no `return`.

Erro de leitura, JSON inválido ou forma inesperada produzem **recuo silencioso para a próxima
fonte** (FR-027d) e, no máximo, uma linha de log com **o caminho do arquivo e a natureza do
problema** — nunca o conteúdo, nem trecho dele (FR-027b2).

### Razão

O arquivo guarda, ao lado de `includes`, as chaves `permissions`, `savedTokens` e `connectedServer` —
confirmado por inspeção em 2026-08-19. A revisão de segurança apontou os dois caminhos reais de
vazamento, e nenhum deles é "alguém decidiu publicar o arquivo":

1. **o objeto retido viaja** — uma vez guardado num campo, ele aparece em log de depuração, em
   telemetria ou numa mensagem de erro sem que ninguém tenha decidido isso;
2. **a mensagem de erro ecoa a entrada** — o padrão `catch (e) { log(\`falhou: ${raw}\`) }` publica
   tokens no canal de log.

Extrair e descartar remove a possibilidade. Confiar em disciplina em cada ponto seguinte não remove.

### Como isso é provado (SC-016)

Fixture de `servers.json` com **valor sentinela** reconhecível em `savedTokens` e `permissions`. O
teste captura o retorno **e o canal de log** e afirma que a sentinela não aparece em nenhum dos dois,
nem no texto de exceção. Verificar só o retorno não alcança os dois caminhos que importam.

---

## R3 — O nome real vem de LISTAGEM, nunca de consulta de existência

### Decisão

O índice é construído por `readdir` dos diretórios da cadeia. A chave de busca é o nome
**normalizado para caixa baixa**; o valor guardado é o **nome real**, como o disco o escreveu.

### Razão

É o mecanismo central do defeito que `PJ0001` existe para pegar, e ele é contraintuitivo:

```
No Windows e no macOS padrão, perguntar "o arquivo acadef.ch existe?"
responde SIM mesmo quando o disco guarda ACADEF.CH.
```

É por isso que o defeito é invisível hoje: o desenvolvedor compila no Windows, o sistema de arquivos
responde "existe" para qualquer caixa, e a falha só aparece no AppServer Linux — longe, tarde e sem
mensagem que ligue uma coisa à outra.

Qualquer implementação baseada em `stat`, `access` ou `existsSync` herdaria a cegueira do sistema de
arquivos e a regra nunca dispararia nas máquinas onde ela é escrita. Só a listagem do diretório
devolve o nome como ele é.

### Consequência de desenho

O índice precisa guardar **todos** os nomes de um diretório, não consultar sob demanda. Isso torna a
varredura obrigatória — e é o que justifica o custo do R4.

---

## R4 — O índice: sob demanda, incremental, fora do caminho de digitação

### Decisão

| Aspecto | Escolha |
| ------- | ------- |
| Quando | **sob demanda**, na primeira vez que uma regra precisa dele — nunca na ativação |
| Onde | no servidor, em memória |
| Estrutura | `Map<nomeEmCaixaBaixa, { nomeReal, diretorio }>` mais um conjunto de nomes ambíguos |
| Percurso | `opendir` assíncrono, filtrando por extensão **durante** a varredura |
| Cancelamento | `CancellationToken` conferido entre diretórios, com progresso reportado |
| Atualização | incremental, por observador de sistema de arquivos |
| Enquanto indexa | a análise **não espera**: as demais regras publicam, `PJ0001` cala |

### Razão

O corpus tem **35.103 arquivos `.ch`**. Indexar isso na ativação é reproduzir o defeito do legado com
outro nome — e o Princípio I é explícito: "varredura de projeto é sob demanda, com progresso
cancelável, NEVER na ativação".

A estrutura tem duas partes porque **ambiguidade não é ausência**: quando dois diretórios da cadeia
têm `ACADEF.CH` e `acadef.ch`, apontar um seria adivinhação (FR-033). O conjunto de ambíguos deixa a
regra calar com conhecimento de causa, em vez de calar por não ter achado.

A regra "a análise não espera pelo índice" (FR-023, FR-006 do Princípio I) é o que impede o índice de
virar um bloqueio: um `await` do índice dentro do caminho de análise faria a primeira abertura de
arquivo esperar por dezenas de milhares de leituras de disco.

### O observador de sistema de arquivos é o risco desta spec

Observar dezenas de milhares de arquivos é fonte clássica de travamento. A decisão: observar
**diretórios**, não arquivos, com o padrão restrito às extensões de include, e tratar o evento como
**invalidação de um diretório** — não como reindexação total (FR-024).

### Alternativas rejeitadas

- **Indexar na ativação**: proibido pelo Princípio I, e o orçamento de ativação (50 ms de trabalho
  próprio) não comporta nem o começo disso.
- **Consultar o disco por include, sem índice**: um `readdir` por diretiva, em fonte com 40 includes,
  dentro do caminho de análise. É I/O no caminho quente.
- **Cache em disco**: o inventário do harness já faz isso e vale a pena lá, onde a varredura é o
  trabalho todo. Aqui acrescentaria invalidação entre sessões sem resolver o custo da primeira.

---

## R5 — Severidade padrão de regra `projeto`: declarada, com razão obrigatória

### Decisão

O contrato de regra ganha um caminho para `origin: 'project'`: a regra **declara** `defaultSeverity`
diretamente, e o registro **exige** que ela o faça. Regra `projeto` sem severidade declarada é
rejeitada, como já acontece com regra sem chave de configuração.

`PJ0001` declara **`Warning`**.

### Razão

O contrato da spec 001 deriva a severidade padrão de `catalogSeverity` pela tabela versionada — e
`catalogSeverity` é `null` em regra `projeto`, por definição: ela não está no catálogo. O caminho
simplesmente não existe, e `PJ0001` é a primeira regra a percorrê-lo.

Não é a tabela que precisa mudar. A tabela traduz **severidade de catálogo**, e uma regra sem
catálogo não tem o que traduzir. Forçá-la a inventar uma entrada faria a tabela mentir sobre o que
ela mapeia.

`Warning` e não `Information`: o defeito **quebra a compilação no AppServer Linux**. Não é estilo.

### Ressalva registrada

O volume de `PJ0001` no corpus **ainda não foi medido** — e o FR-036 é explícito: sem taxa de falso
positivo medida, a regra entra **desligada por padrão**. A severidade declarada vale para quando ela
for ligada; a decisão de ligar depende do número, não do desejo.

---

## R6 — Correções: `quickfix` por diagnóstico, `source.fixAll` para o arquivo

### Decisão

| Ação | Tipo | Como |
| ---- | ---- | ---- |
| Corrigir uma ocorrência de `CA3001` | `quickfix` | vinculada ao diagnóstico, com `diagnostics: [d]` |
| Corrigir uma ocorrência de `PJ0001` | `quickfix` | idem |
| Corrigir todas do arquivo | `source.fixAll` | reúne as edições numa `WorkspaceEdit` só |

O servidor declara `codeActionProvider` com os dois tipos. `source.fixAll` é o tipo que o VS Code
usa para `editor.codeActionsOnSave` — não é convenção nossa, é o contrato do editor.

### Por que as edições saem prontas, sem `resolve`

O protocolo permite devolver a ação sem edição e completá-la depois (`codeAction/resolve`), o que
vale quando calcular a edição é caro. **Aqui não é**: a edição de `CA3001` é trocar uma palavra cuja
posição o diagnóstico já carrega. O `resolve` acrescentaria uma ida e volta de protocolo para
economizar trabalho que não existe.

### Ordem e sobreposição

Numa linha como `#INCLUDE "acadef.ch"`, as duas regras disparam. As edições são **disjuntas** — uma
cobre a diretiva, a outra o nome do arquivo — e por isso podem entrar na mesma `WorkspaceEdit`. O
requisito de determinismo (FR-016) se resolve **ordenando as edições por posição**, o que também é o
que o editor espera de uma `WorkspaceEdit` com múltiplas alterações no mesmo documento.

### `PJ0001` fora do `source.fixAll` por padrão (D9)

Trocar a diretiva é inerte por medição. Trocar o **nome do arquivo** muda o que o compilador vai
procurar. A participação de cada regra na correção em massa é configurável, e `PJ0001` nasce fora.

---

## R7 — Versão do documento como guarda de obsolescência

### Decisão

Cada ação carrega a versão do documento sobre a qual foi calculada, e a edição é recusada se o
documento tiver mudado (FR-006).

O LSP já resolve isso: `WorkspaceEdit` com `documentChanges` usa `OptionalVersionedTextDocumentIdentifier`,
e **o próprio editor rejeita** a aplicação quando a versão não bate. Não é preciso inventar
verificação — é preciso **usar a forma versionada** em vez da forma simples com `changes`.

### Razão

O caminho de correção é assíncrono por natureza: o usuário pede as ações, pensa, e clica. Entre o
cálculo e a aplicação ele pode ter digitado. Uma edição por deslocamento sobre um texto que mudou
corrompe o arquivo em silêncio.

---

## R8 — Medição: `PJ0001` e o índice entram no harness que já existe

### Decisão

| O que medir | Onde |
| ----------- | ---- |
| Custo de `PJ0001` por documento | `measureSource`, que já mede custo incremental por regra |
| Custo da indexação | **campo novo** no relatório, medido em separado |
| Taxa de falso positivo de `PJ0001` | fluxo de revisão que já existe, com veredito |

O relatório de linha de base sobe de `schemaVersion: 1` para **2**, com o campo de indexação.

### Razão

O harness da spec 001 já faz a subtração com e sem regra — `PJ0001` entra nele sem código novo de
medição, desde que o índice esteja disponível para a regra durante a medição.

O custo de indexação é medido **em separado** porque é outro orçamento: ele acontece uma vez por
sessão, não por documento. Somá-lo ao custo por documento esconderia o caro dentro do barato — e é
exatamente o erro que o `activationMs` da spec 001 quase cometeu ao misturar carregamento de módulo
com trabalho próprio.

O `schemaVersion` existe para isto: uma mudança de formato não pode ser lida como regressão de
desempenho na comparação do Portão 4.

---

## R9 — O que NÃO foi decidido aqui

- **Caixa dos diretórios do caminho** (`#include "..\includes\x.ch"`): a spec limita `PJ0001` ao nome
  do arquivo. Ampliar para os diretórios do caminho é regra nova, não ajuste desta.
- **Formato de terceiros mudando**: FR-027d contém o dano (recua para a próxima fonte), FR-027c torna
  visível qual fonte venceu. Detectar a mudança automaticamente ficaria caro e frágil; a conferência
  é humana, na atualização das referências.
- **Quantos diretórios a cadeia aceita**: sem limite artificial. O custo é medido, e o teto é o
  orçamento do Princípio I — não um número inventado aqui.
