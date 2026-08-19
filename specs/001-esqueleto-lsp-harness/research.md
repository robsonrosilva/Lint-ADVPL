# Phase 0 — Pesquisa e decisões técnicas

**Feature**: 001 — Esqueleto vertical da extensão + harness de medição
**Data**: 2026-08-19
**Ambiente medido nesta máquina**: Node `v24.18.0`, npm `11.16.0`, VS Code `1.133.0`, 16 núcleos
lógicos, `git config core.autocrlf = true`.

Todas as incógnitas do Technical Context estão resolvidas abaixo. Nenhum `NEEDS CLARIFICATION`
permanece.

---

## R0 — A descoberta que reordena o resto: quem decodifica o CP1252 não somos nós

Esta pesquisa começou pela pergunta "iconv-lite ou tabela local?" e encontrou antes uma pergunta
melhor: **em que ponto do caminho o byte CP1252 vira caractere?**

Durante a edição, o caminho é:

```text
PROG.PRW em disco (bytes CP1252)
        │
        ▼
  VS Code decodifica  ←── usa a configuração files.encoding
        │
        ▼
  string JavaScript
        │
        ▼
  textDocument/didOpen  ──LSP──►  servidor  ──►  análise
```

O servidor **nunca vê o byte**. Ele recebe uma string que o VS Code já decodificou. Se
`files.encoding` estiver em `utf8` — o padrão — e o fonte tiver bytes ≥ 0x80, o editor entrega
mojibake ou `U+FFFD`, e a análise fica errada antes da primeira regra rodar. Pior: sequências que
por acaso formam UTF-8 válido colapsam dois bytes em um caractere e **deslocam a coluna** de todo
diagnóstico depois delas na linha.

### Decisão

O FR-003, no caminho de edição, é atendido **configurando o editor**, não decodificando por conta
própria:

1. A extensão declara, no seu manifesto, `configurationDefaults` com
   `"[advpl]": { "files.encoding": "windows1252" }` (e o mesmo para `tlpp`). É o mecanismo pelo qual
   uma extensão altera o padrão de uma configuração sem sobrescrever escolha do usuário —
   `files.encoding` é `language-overridable`, então a sobreposição por linguagem é legítima.
2. Na abertura de um documento ADVPL/TLPP, a extensão confere a codificação efetiva e, se não for
   `windows1252`, mostra **um** aviso acionável — uma vez por sessão, não por arquivo.

O decodificador CP1252 próprio continua necessário, mas para **outro** caminho: o harness lendo o
corpus do disco, e a futura resolução de includes. Ou seja, ele vive **fora do caminho quente**, o
que enfraquece o argumento de desempenho a favor de uma dependência e fortalece o de simplicidade.

### Propriedade que simplifica tudo depois

CP1252 é codificação de **byte único**, e todos os 256 pontos mapeiam para caracteres do plano
básico, sem pares substitutos. Logo:

```text
deslocamento em bytes  ==  índice de caractere  ==  unidade de código UTF-16
```

As posições do LSP são contadas em unidades de código UTF-16. Com CP1252, os três coincidem — não
há conversão de índice em lugar nenhum, e a aritmética de coluna é trivialmente correta. Isso
**precisa** estar documentado, porque é uma garantia que se perde silenciosamente no dia em que
alguém aceitar um fonte UTF-8.

### Alternativas rejeitadas

- **Decodificar nós mesmos e ignorar `files.encoding`**: impossível. O servidor recebe a string do
  editor pelo protocolo; ele não tem o byte para redecodificar. Reler o arquivo do disco em paralelo
  ao buffer em edição significaria analisar conteúdo diferente do que está na tela.
- **Exigir que o usuário configure na mão**: joga em cima dele um detalhe que a extensão sabe. O
  legado convivia com isso e errava a leitura como `latin1`.

---

## R1 — Decodificação CP1252: tabela local, sem dependência

### Decisão

Módulo interno de ~40 linhas: uma tabela dos 32 pontos da faixa `0x80`–`0x9F` (o resto é idêntico a
Latin-1), mais laço de decodificação e de codificação. Sem `iconv-lite`, sem
`@vscode/iconv-lite-umd`.

### Razão

- CP1252 é **totalmente especificado e imutável**. Diverge de ISO-8859-1 em exatamente 32 posições —
  a faixa dos travessões, aspas tipográficas, reticências e do símbolo de euro, que é justamente onde
  o legado errava. Não há evolução futura a acompanhar.
- É **exaustivamente testável**: 256 bytes de entrada, ida e volta, cobertura total num único teste.
  Nenhuma dependência oferece essa garantia de forma verificável no nosso repositório.
- `iconv-lite` traz dezenas de codecs que nunca usaremos. A constituição manda justificar toda
  dependência de runtime contra implementá-la localmente e avaliar seu custo de ativação. Aqui a
  implementação local ganha nos dois eixos.
- Os cinco bytes sem definição em CP1252 (`0x81`, `0x8D`, `0x8F`, `0x90`, `0x9D`) são mapeados para
  os pontos de controle C1 correspondentes, seguindo o padrão de codificação da WHATWG — que é o
  comportamento que navegadores e o próprio VS Code adotam. Decisão registrada e testada, não
  acidente.

### Alternativas rejeitadas

- **`iconv-lite`**: superfície muito maior que a necessidade, e o benefício — corretude — é o que
  conseguimos provar melhor com a tabela local.
- **`Buffer.toString('latin1')`**: é exatamente o defeito do legado. Diverge em 0x80–0x9F.
- **`TextDecoder('windows-1252')`**: existe no Node, e é tentador. Rejeitado por ser **somente
  decodificação** — não há `TextEncoder` para CP1252, e o Princípio II vai exigir **gravar** em
  CP1252 na spec de formatação. Ter metade do par vindo da plataforma e a outra metade escrita à mão
  é pior que ter as duas juntas, testadas pelo mesmo teste de ida e volta.

---

## R2 — Estrutura: monorepo com três workspaces npm

### Decisão

```text
packages/extension   cliente fino de VS Code — ativa, conversa por LSP, não analisa nada
packages/server      o motor — sem nenhum import de 'vscode'
packages/tooling     harness de medição e verificações — nunca empacotado, nunca publicado
```

Workspaces do npm (nativo, sem ferramenta de monorepo adicional). Empacotamento com **esbuild**:
dois pacotes finais (`extension.js` e `server.js`), formato CommonJS, `vscode` marcado como externo,
`minify` na publicação e `sourcemap` no desenvolvimento.

### Razão

- A fronteira precisa ser **estrutural, não disciplinar**. `packages/server` não declara
  `@types/vscode` nem `vscode` como dependência, e um import acidental da API do editor dentro do
  motor **reprova no lint**. O Princípio I ("a camada VS Code é fina e não analisa nada") vira
  invariante verificada por ferramenta em vez de convenção.

  ⚠️ **Corrigido em 2026-08-19, durante a implementação.** A redação original desta decisão dizia que
  o import "falha ao compilar". **Medido: não falha.** Com workspaces do npm, `@types/vscode` é içado
  para o `node_modules` da raiz, e a resolução de módulo do TypeScript encontra
  `node_modules/@types/vscode` de qualquer forma — `types: ["node"]` governa apenas a inclusão
  **global** de pacotes `@types`, não a resolução de `import 'vscode'`. Um arquivo-sonda com
  `import * as vscode from 'vscode'` dentro de `packages/server/src` compilou com saída 0.

  O que realmente fecha a porta é `no-restricted-imports` no lint, restrito a
  `packages/server/**`, verificado disparando sobre o mesmo arquivo-sonda. Continua sendo portão
  automático — só é o lint, e não o compilador, que o executa. A ausência da dependência no
  `package.json` permanece útil como sinal de intenção, mas **não** é o mecanismo.
- `packages/tooling` fora do empacotamento garante que harness e verificações nunca entrem no `.vsix`
  nem no custo de ativação.
- esbuild produz um arquivo por processo. A ativação carrega **um** módulo, não centenas — que é
  literalmente o que a constituição exige na seção de Restrições Técnicas.

### Orçamento de ativação de 200 ms — como ele é atingido

O cliente na ativação faz o mínimo: registra a linguagem, cria o cliente LSP e **inicia o servidor
como processo filho**. O custo de subir o servidor Node não bloqueia a ativação, porque o
`LanguageClient` do `vscode-languageclient` inicia de forma assíncrona; a ativação retorna sem
esperar o servidor ficar pronto. O que **precisa** ser vigiado é não fazer nada de I/O na ativação —
sem ler configuração de disco, sem varrer projeto, sem carregar catálogo de regras no cliente.

### Alternativas rejeitadas

- **Pacote único** com cliente e servidor no mesmo `src/`: a fronteira viraria convenção. O legado
  mostra onde isso termina.
- **Analisar no processo da extensão, sem LSP**: proibido pelo Princípio I, e é a causa raiz do
  travamento da versão anterior.
- **pnpm/turborepo/nx**: dependência de infraestrutura que três pacotes não justificam.

---

## R3 — Testes: `node:test` no motor, `@vscode/test-cli` na integração

### Decisão

| Camada | Runner | Por quê |
| ------ | ------ | ------- |
| `packages/server` e `packages/tooling` | `node:test` nativo do Node 24 | zero dependência; o motor não precisa do editor para ser testado |
| `packages/extension` | `@vscode/test-cli` + `@vscode/test-electron` | é o único jeito de exercitar a extensão dentro de uma instância real do editor |

Compilação por `tsc` para `out/` (que também é o portão de tipagem), e os testes rodam sobre o
JavaScript gerado. esbuild só entra no empacotamento.

### Razão

A esmagadora maioria dos testes desta spec é do motor: decodificação, detecção de `CA3001`,
posição exata, cancelamento. Nada disso precisa do editor, e pagar a inicialização do Electron para
rodá-los tornaria o laço vermelho-verde-refatora lento o bastante para o desenvolvedor deixar de
rodá-lo — que é como o legado chegou a uma suíte que o pipeline instalava e não executava.

`node:test` é estável no Node 24 e não acrescenta dependência nenhuma. A integração fica reservada
para o que só existe dentro do editor: a ativação restrita por linguagem, o diagnóstico chegando ao
painel de problemas, a chave de configuração fazendo efeito sem reiniciar.

### O formato da asserção — o ponto que o Princípio VI mais cobra

O legado assertava totais de `error`/`warning`/`information`/`hint`. Duas regras quebradas em
direções opostas mantêm essa suíte verde. Aqui, toda asserção sobre diagnóstico compara **o objeto
inteiro do diagnóstico específico**:

```text
{ code: 'CA3001', severity: Information, range: { start: {line, character},
                                                  end: {line, character} } }
```

Um utilitário de teste faz essa comparação e **falha** se o teste tentar assertar apenas contagem.
Contagem agregada é proibida pelo FR-029, e a proibição precisa de dente, não de recomendação.

### Cobertura de 98% — como é medida

A constituição v2.2.0 tornou **98% em linhas, funções e ramos** um portão de merge. A medição usa o
mecanismo **nativo** do Node, confirmado disponível nesta máquina em 2026-08-19:

```text
node --test --experimental-test-coverage \
     --test-coverage-lines=98 \
     --test-coverage-functions=98 \
     --test-coverage-branches=98
```

Abaixo do limiar, o processo sai com código de erro — o portão é o próprio runner, não um passo
extra que alguém pode esquecer de encadear. **Zero dependência nova**, o que era condição: a
constituição proíbe acrescentar dependência para medir cobertura.

Exclusão sai por `--test-coverage-exclude`, alimentado por uma **lista versionada com a razão de
cada item**. Baixar o limiar ou excluir sem justificativa é violação, não ajuste.

Para `packages/extension`, a cobertura vem do `@vscode/test-cli`, que integra cobertura por V8. É
onde a meta aperta de verdade — a camada de integração tem ramos que só ocorrem sob condição do
próprio editor. A saída prevista pela constituição é exclusão **declarada com razão**, nunca limiar
menor sem registro; a diferença é que a primeira deixa rastro auditável do que não está coberto.

### Alternativas rejeitadas

- **Mocha** (o do legado) ou **Vitest**: ambos funcionam; ambos são dependência que `node:test`
  torna desnecessária no maior volume de testes.
- **Só testes de integração**: laço lento demais, e não isolaria o motor.
- **`c8` ou `nyc` para cobertura**: dependência para um problema que o Node 24 resolve nativamente,
  e a constituição veda explicitamente.
- **Cobertura como relatório informativo**: relatório que não bloqueia vira número que ninguém olha.
  O limiar no próprio runner é o que faz a meta existir.

---

## R4 — `.gitattributes`: primeira tarefa da implementação, não detalhe de configuração

### Decisão

`.gitattributes` na raiz, criado **antes** da primeira fixture existir:

```text
* text=auto eol=lf
*.md text eol=lf

# Fixtures ADVPL/TLPP: os bytes são o objeto do teste. Nunca normalizar.
packages/*/test/fixtures/** -text
```

### Razão

`core.autocrlf` está em `true` nesta máquina — confirmado por medição, não suposto. Sem
`.gitattributes`, o git converte fim de linha na entrada e na saída do repositório. As fixtures desta
spec existem justamente para provar que o motor lida com CRLF, LF, misto, e com bytes CP1252 na
faixa 0x80–0x9F. Normalizadas, elas testariam conteúdo diferente do que o autor escreveu, e o teste
**passaria** — provando algo que não é verdade sobre um arquivo que não existe.

É o pior tipo de defeito: verde enganoso. Por isso é a tarefa T001, antes de qualquer fixture.

### Alternativas rejeitadas

- **`binary` nas fixtures** (equivale a `-text -diff`): descarta a possibilidade de ver diferença em
  revisão. `-text` já impede a conversão e preserva o `diff`.
- **`working-tree-encoding=windows-1252`**: o git guardaria em UTF-8 e converteria na retirada.
  Elegante, mas depende do suporte a iconv na instalação do git e **quebra** nos cinco bytes sem
  definição em CP1252, que são exatamente os que queremos testar.
- **Confiar em `core.autocrlf=false` local**: configuração de máquina não viaja com o repositório.

---

## R5 — Harness sobre ~93.000 arquivos: inventário, estratificação e trabalhadores

A varredura ingênua já foi medida: contar linhas de todos os fontes estourou 2 minutos de relógio.
O desenho abaixo evita repetir isso.

### Decisão — quatro fases

**1. Inventário (uma vez, com cache).** Percurso do diretório com `fs.promises.opendir`, filtrando
por extensão **durante** o percurso — os ~35.000 fontes ADVPL/TLPP interessam, os 35.103 `.ch` e as
imagens não. Colhe `{caminho, tamanhoEmBytes}`. O resultado vai para um inventário local
`.corpus-cache.json`, **não versionado**; execuções seguintes reaproveitam.

**2. Estratificação.** Buckets por tamanho em bytes, que é proxy barato de número de linhas e sai do
`dirent`/`stat` sem abrir o arquivo. Amostra por bucket até somar **no mínimo 1.000 fontes**
(SC-006), garantindo representação de p50, p90, p95, p99 e do maior arquivo.

**3. Medição.** Pool de `worker_threads` dimensionado em `min(12, núcleos - 2)` — aqui, 12 de 16.
Cada trabalhador importa o motor uma vez e cronometra **apenas a análise**, com
`performance.now()`, excluindo a leitura do disco. Cada arquivo é medido em várias repetições e o
relatório usa a mediana, para não confundir custo de análise com variação de agendamento do sistema
operacional. O mesmo conjunto roda **com e sem** `CA3001` ligada — a diferença é o custo incremental
do FR-021.

**4. Relatório.** Duas saídas: `baseline/AAAA-MM-DD.json` legível por máquina, para comparação
automática em entregas futuras, e `baseline/AAAA-MM-DD.md` legível por humano. Ambos versionados,
ambos datados, ambos declarando quantos arquivos foram medidos e que houve amostragem.

### Cuidado que só apareceu ao desenhar a taxa de falso positivo

O FR-022 pede a taxa de falso positivo apurada sobre **amostra revisada**. Revisar exige olhar o
trecho de código que disparou. Se esse material de revisão for gravado no repositório, ele é uma
cópia parcial do corpus — e viola o FR-023 e a restrição de licença, pela porta dos fundos.

**Decisão**: o artefato de revisão sai em diretório local ignorado pelo versionamento. Do relatório
versionado sobe **apenas o agregado**: quantos disparos houve, quantos foram revisados, quantos eram
falsos positivos, e a taxa. Nenhum trecho de fonte padrão entra no repositório em nenhuma hipótese.

### Configuração do corpus

Precedência: variável de ambiente `ADVPL_LINT_CORPUS` vence; senão, `corpus.local.json` na raiz;
senão, corpus indisponível. Ambos ignorados pelo versionamento. Corpus ausente faz a **medição**
avisar e encerrar com sucesso, e **não** afeta a suíte de testes (FR-024).

### Alternativas rejeitadas

- **Medir os 35.000 fontes**: desnecessário para estabilizar percentis, e transformaria a medição num
  ritual que ninguém executa.
- **`child_process` por arquivo**: custo de subir processo domina o que se quer medir.
- **Amostragem uniformemente aleatória**: sub-representa a cauda, que é exatamente onde o Princípio I
  corre risco. Daí a estratificação por tamanho.

---

## R6 — Verificação de vazamento do corpus (FR-027)

### Decisão

Script `tooling/verificacoes/corpus.ts`, integrado ao `npm run verify`, que falha se:

1. Existir arquivo versionado com extensão `prw`/`prx`/`prg`/`apw`/`apl`/`tlpp`/`ch` **fora** de
   `packages/*/test/fixtures/`.
2. Uma fixture não trouxer o cabeçalho de autoria obrigatório.
3. Uma fixture ultrapassar **300 linhas**.

### Razão

A regra 1 pega o acidente óbvio — arrastar um fonte do corpus para dentro do repositório.

A regra 2 ataca o que nenhuma verificação automática consegue julgar: se a fixture foi **escrita** ou
**copiada**. Toda fixture abre com um cabeçalho declarando que é autoral, qual construção do corpus
ela reproduz e qual teste a consome. Não prova autoria, mas força a declaração no momento em que a
cópia seria feita — que é quando a decisão é tomada.

A regra 3 é o limite prático: fonte padrão do Protheus tem mediana de 309 linhas, e fixture autoral
que passe de 300 quase certamente foi colada. Casos grandes de propósito — o teste de 24.636 linhas
do SC-010 — são **gerados em tempo de teste** por script, nunca versionados.

### Alternativas rejeitadas

- **Só `.gitignore`**: não protege contra `git add -f` nem contra fixture criada dentro do diretório
  permitido.
- **Gancho de pré-commit**: não há CI e ganchos não viajam com o clone. `npm run verify` roda no
  portão local, que é onde a verificação vale hoje.

---

## R7 — Quatro idiomas, com falha de construção na divergência

### Decisão

Os idiomas são os **quatro em que o Protheus é localizado** (D4): português do Brasil, espanhol,
inglês e russo. Inglês é a base.

Dois mecanismos, porque o VS Code tem dois lugares distintos onde string aparece:

| Onde | Mecanismo | Arquivos |
| ---- | --------- | -------- |
| Contribuições do manifesto (rótulos de configuração, títulos de comando) | NLS do manifesto | `package.nls.json` (en, base), `package.nls.pt-br.json`, `package.nls.es.json`, `package.nls.ru.json` |
| Strings em tempo de execução (mensagem de diagnóstico, aviso de codificação) | `@vscode/l10n` | `l10n/bundle.l10n.json` (en), `bundle.l10n.pt-br.json`, `bundle.l10n.es.json`, `bundle.l10n.ru.json` |

O servidor usa `@vscode/l10n` diretamente — ele não tem acesso à API `vscode`, e o pacote existe
exatamente para esse caso. O idioma efetivo chega ao servidor nas opções de inicialização do LSP.

**Um único ponto declara os idiomas** (FR-015a): uma lista em `tooling`, consumida pela verificação e
pelos scripts de construção. Nenhum outro lugar enumera idioma. Acrescentar um quinto é acrescentar
um arquivo e uma entrada nessa lista — não é mexer em código.

Verificação `tooling/checks/nls.ts`, no `npm run verify`, que **falha a construção** quando os
conjuntos de chaves divergem entre **quaisquer dois** dos quatro idiomas, em qualquer um dos dois
mecanismos. A mensagem de erro nomeia a chave e o arquivo em que ela falta.

Idioma não traduzido recai no inglês, que é o comportamento nativo do NLS do VS Code — **nunca** no
identificador cru da chave.

### Razão

O Princípio V é explícito: conjunto divergente é falha de build, não pendência de tradução. Chave
faltante não degrada com elegância, ela vaza o identificador cru para dentro do editor. O legado
tinha i18n duplicada em **dois** pares de arquivos sem nada que garantisse que os quatro
concordassem; com quatro idiomas em dois mecanismos são **oito** arquivos, e a chance de deriva
cresce — a verificação deixa de ser zelo e passa a ser necessidade aritmética.

Os identificadores de localidade do VS Code são `pt-br` (minúsculo, com hífen), `es` e `ru`. Errar a
caixa produz um arquivo que nunca é carregado **e nenhum erro** — outra razão para a lista única.

### Limite honesto desta decisão

A verificação prova que as **chaves** batem. Ela não diz nada sobre a **qualidade** do texto. As
traduções de espanhol e russo precisam de revisão por quem fala o idioma antes da publicação, e isso
é trabalho humano que nenhum portão automático substitui. Registrado na spec (D4) como risco
assumido, não como pendência esquecida.

### Alternativas rejeitadas

- **Manter só pt-BR e en**, como a constituição hoje diz: deixaria de fora as bases hispano-americana
  e russa do Protheus, que usam o mesmo catálogo de regras. O dono decidiu ampliar; a constituição é
  que precisa ser emendada.
- **`vscode-nls`**: caminho anterior, superado pelo `l10n` desde o VS Code 1.73. Não faz sentido
  nascer legado.
- **`i18n`** (o do legado): dependência de runtime para um problema que a plataforma resolve.
- **Tradução automática em tempo de construção**: produz texto que ninguém revisou e esconde o
  problema em vez de expô-lo.

---

## R8 — Documentação por regra: um arquivo por identificador

### Decisão

`docs/regras/<ID>.md` — um arquivo por regra, nomeado pelo identificador. O `codeDescription.href`
do diagnóstico aponta para a URL do arquivo no GitHub.

Verificação `tooling/verificacoes/docs.ts`, no `npm run verify`, exigindo correspondência **nos dois
sentidos**: toda regra registrada no motor tem seu arquivo, e todo arquivo em `docs/regras/`
corresponde a uma regra registrada.

### Razão

O Portão 6 da constituição diz que regra no código sem documentação, ou documentação sem regra,
bloqueia o merge — e vale nos dois sentidos. Com um arquivo por identificador, esse portão é uma
comparação de dois conjuntos de nomes: mecânico, rápido, sem interpretação. Um documento único com
âncoras exigiria analisar o markdown para descobrir quais âncoras existem, e é frágil.

O `href` precisa ser uma URL absoluta: o diagnóstico é exibido na máquina do usuário, que não tem
este repositório. Apontar para o GitHub é a única opção que funciona hoje — não existe site
publicado.

### Alternativas rejeitadas

- **`docs/regras.md#ca3001`**: portão passa a depender de analisar markdown.
- **URL do catálogo da TOTVS**: explica a regra do SonarQube, não o que **esta** extensão faz com
  ela — nem a chave de configuração, nem a severidade mapeada, nem o que ela deixa de pegar.

---

## R9 — Idioma: a divisão é entre **o que a máquina lê** e **o que a pessoa lê**

### Decisão

| Em **inglês** | Em **pt-BR** |
| ------------- | ------------ |
| identificadores (variáveis, funções, tipos, classes) | **comentários dentro do código** |
| nomes de arquivo e de diretório | documentação (`docs/`, `specs/`, `README.md`) |
| chaves de configuração e de tradução | mensagens ao usuário (via NLS, nos quatro idiomas) |
| mensagens de erro internas e de teste | mensagens de commit |
| | nomes de teste e descrições de `describe`/`it` |

A linha não é "código versus documentação" — é **o que a máquina interpreta versus o que uma pessoa
lê**. Comentário é para pessoa; ele fica em pt-BR, junto com o nome do teste, que também é prosa
lida por gente.

```ts
// A varredura classifica comentário e literal numa única passagem. Rodar isto
// por regra faria o custo virar O(regras × linhas) já na segunda regra.
export function scanDocument(document: AnalyzedDocument): ScanResult {
```

### Razão

A API do VS Code, o LSP e o ecossistema npm são em inglês; identificador em português produz híbrido
do tipo `validaDocument`, que o legado tinha (`validaAdvpl.ts`, `Restritos.ts` e `Erro.ts` ao lado de
`cache.ts` e `params.ts`).

Comentário é outra coisa: ele existe para explicar **por que** o código é assim a quem for mantê-lo,
e quem mantém este repositório escreve e pensa em português. Comentário em inglês forçado é
comentário pior — mais raso, mais genérico, mais fácil de virar paráfrase da linha seguinte. O
Princípio I depende de comentários que expliquem decisões contraintuitivas de desempenho; esses
precisam ser bem escritos, não traduzidos.

**Confirmada pelo dono em 2026-08-19**, antes da T001 e com zero linha de código escrita — inclusive
a distinção sobre comentários. Reverter depois passa a ser renomeação em massa.

---

## Resumo das decisões

| # | Decisão |
| - | ------- |
| R0 | Codificação no caminho de edição é resolvida por `configurationDefaults` + aviso, não por decodificação própria |
| R1 | Tabela CP1252 local de 256 posições; sem `iconv-lite`; sem `TextDecoder`, por causa da gravação |
| R2 | Monorepo npm com `extension` / `server` / `tooling`; esbuild; fronteira garantida pelo compilador |
| R3 | `node:test` no motor, `@vscode/test-cli` na integração; asserção de diagnóstico inteiro, contagem proibida; cobertura de 98% pelo mecanismo nativo do Node, sem dependência |
| R4 | `.gitattributes` com `-text` nas fixtures, criado antes da primeira fixture |
| R5 | Inventário com cache, estratificação por tamanho, `worker_threads`, relatório em JSON e markdown |
| R6 | Verificação de vazamento com três regras; fixture declara autoria; fixture grande é gerada, não versionada |
| R7 | Quatro idiomas do Protheus (`en` base, `pt-br`, `es`, `ru`) em dois mecanismos; lista única; divergência de chave falha a construção |
| R8 | Um arquivo de documentação por identificador de regra; portão mecânico nos dois sentidos |
| R9 | Inglês no que a máquina lê (identificadores, arquivos, chaves); pt-BR no que a pessoa lê (comentários, nomes de teste, documentação, commits) |
