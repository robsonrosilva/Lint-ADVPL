---
name: fontes-de-diretorios-de-include
description: De onde a extensão descobre os diretórios de include — cadeia de recuo decidida na spec 002, e os formatos reais das duas extensões de terceiros
metadata:
  type: project
---

Decidido pelo dono em 2026-08-19, ao especificar a spec 002 (registrado lá como **D8**).

O índice de includes — de que a regra `PJ0001` depende — resolve **de onde indexar** por uma cadeia de
recuo, parando na primeira fonte que produzir pelo menos um diretório utilizável:

| Ordem | Fonte | Onde, exatamente | Verificado |
| ----- | ----- | ---------------- | ---------- |
| 1 | `totvs.tds-vscode` | chave `includes` (lista de caminhos) em `~/.totvsls/servers.json` | v2.0.16 |
| 2 | `killerall.advpl-vscode` | `includeList` dentro do ambiente selecionado em `advpl.environments` (`advpl.selectedEnvironment` diz qual) | v0.18.1 |
| 3 | chave própria | espaço `advplLint.*` | — |
| 4 | varredura do workspace aberto | último recurso | — |

**Why:** quem usa este produto **já configurou isso em outro lugar**. Pedir a mesma informação de novo
é atrito, e configuração duplicada diverge em silêncio. A chave própria continua existindo, mas como
terceiro degrau — ela atende quem não usa nenhuma das outras duas extensões.

## Os dois fatos que a medição na máquina trouxe

**1. "Presente" não é "utilizável".** Em 2026-08-19, na máquina do dono, as duas primeiras fontes
existiam e estavam **vazias**: `includes: [""]` em `~/.totvsls/servers.json` e `advpl.environments: []`
nas configurações. Uma cadeia que parasse na presença da chave em vez de na utilidade do conteúdo
deixaria `PJ0001` muda exatamente onde ela foi medida. Daí a regra: descartar entradas vazias, exigir
ao menos um diretório existente, e só então parar de recuar.

**2. A fonte 1 é um arquivo com credenciais.** `~/.totvsls/servers.json` tem, além de `includes`, as
chaves `permissions`, `savedTokens`, `configurations` e `connectedServer`. Ler **só** os caminhos não é
zelo — é requisito, e vale para log, mensagem de erro e objeto repassado adiante.

## O risco que isso cria

Duas das quatro fontes são formato de **terceiro**, que este projeto não controla e que pode mudar sem
aviso. A falha é silenciosa por natureza: a extensão continua funcionando e a regra passa a olhar outra
árvore, ou nenhuma. As mitigações estão na spec — recuo silencioso quando o formato não for legível, e
um jeito de o usuário perguntar **qual fonte venceu e quais diretórios ela produziu**.

**How to apply:** ao atualizar `referencias/totvs/` ou ao ver uma dessas extensões subir de versão,
reconferir as duas chaves acima. Elas são entrada de dado, não dependência de código.

Ver [[medicao-includes-corpus]], [[spec-002-escopo-decidido]] e [[corpus-externo]].
