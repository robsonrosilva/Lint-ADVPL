# Contrato — Fontes de diretórios de include

**O que este contrato governa**: de onde saem os diretórios que o índice varre, e — a parte que a
revisão de segurança endureceu — **o que NÃO pode sair junto**.

Duas das quatro fontes são formato de terceiro. Uma delas guarda tokens.

## A cadeia (D8)

Resolvida no **cliente**, porque três das quatro fontes só existem através da API do editor.

| Ordem | Fonte | Onde | Formato |
| ----- | ----- | ---- | ------- |
| 1 | `totvs.tds-vscode` | `~/.totvsls/servers.json`, chave `includes` | lista de caminhos |
| 2 | `killerall.advpl-vscode` | `advpl.environments[]`, campo `includeList` do ambiente em `advpl.selectedEnvironment` | texto com separador |
| 3 | própria | `advplLint.includePaths` | lista de caminhos |
| 4 | workspace | pastas abertas | varredura |

Verificado em 2026-08-19 nas versões instaladas: `tds-vscode` v2.0.16 e `advpl-vscode` v0.18.1.

## Parar na primeira fonte UTILIZÁVEL, não na primeira presente

| # | Regra | Requisito |
| - | ----- | --------- |
| 1 | "Utilizável" = ao menos um diretório **existente**, após descartar entradas vazias | FR-027a |
| 2 | Configuração presente e vazia ⟹ **recua** | FR-027a |
| 3 | Formato ilegível ⟹ recua em silêncio, sem erro ao usuário | FR-027d |
| 4 | Diretório existente mas sem includes **não** faz recuar — fonte utilizável, índice vazio | edge case |

A regra 2 não é preciosismo: na máquina de referência, medido em 2026-08-19, **as duas primeiras
fontes existem e estão vazias** — `includes: [""]` e `advpl.environments: []`. Uma cadeia que
parasse na presença da chave deixaria `PJ0001` muda exatamente onde ela foi medida.

A regra 4 separa duas coisas que se parecem: "esta fonte não serve" e "esta fonte serve e não há
includes lá". Confundi-las esconderia um diretório mal apontado atrás de um recuo silencioso.

## Segurança: o arquivo da fonte 1 guarda credenciais

`~/.totvsls/servers.json` contém, além de `includes`, as chaves `permissions`, `savedTokens` e
`connectedServer` — confirmado por inspeção em 2026-08-19.

| # | Regra | Requisito |
| - | ----- | --------- |
| 1 | Ler **exclusivamente** o que descreve diretórios | FR-027b |
| 2 | Extrair no **ponto de leitura** e descartar o objeto ali mesmo | **FR-027b1** |
| 3 | Nada além dos caminhos é guardado em variável, campo, cache ou estrutura que sobreviva à função | **FR-027b1** |
| 4 | Mensagem de erro cita **caminho e natureza do problema**, nunca conteúdo | **FR-027b2** |

### Por que a regra 2 existe, e não basta "tomar cuidado"

O risco não é ler o arquivo — é o **objeto completo viajar**. Uma vez retido num campo, ele acaba
em log de depuração, em telemetria ou numa mensagem de erro sem que ninguém tenha decidido isso.
Extrair e descartar **remove a possibilidade**; confiar em disciplina em cada ponto seguinte não.

### Por que a regra 4 é a mais importante

É o vazamento mais provável de todos, e tem forma conhecida:

```ts
catch (e) { log(`falhou ao ler: ${raw}`) }   // ← publica os tokens no log
```

O FR-027d já mandava recuar em silêncio quando o formato não é legível. O que a regra 4 acrescenta é
que a **mensagem** desse recuo também não carregue nada.

## Prova (SC-016)

Fixture de `servers.json` com **valor sentinela** reconhecível em `savedTokens` e `permissions`. O
teste afirma que a sentinela não aparece em **lugar nenhum**:

| Onde procurar | Por quê |
| ------------- | ------- |
| valor devolvido | o óbvio |
| canal de log | um dos dois caminhos reais |
| texto da exceção | o outro |

Verificar só o valor devolvido não alcança os dois caminhos que importam — e são justamente eles.

## O que o usuário consegue ver (FR-027c)

Sob demanda: **qual fonte venceu** e **quais diretórios ela produziu**.

Sem isso, "a regra não dispara" e "a regra dispara sobre a árvore errada" são indistinguíveis para
quem usa. Também é a única defesa prática contra o risco de o formato de terceiro mudar sem aviso: a
extensão continuaria funcionando e passaria a olhar outra árvore, em silêncio.

## O que atravessa a fronteira cliente → servidor

```ts
{ winner: string | null, directories: readonly string[] }
```

Nada mais. O motor **não sabe** que existe um arquivo com tokens, e não tem por que saber.
