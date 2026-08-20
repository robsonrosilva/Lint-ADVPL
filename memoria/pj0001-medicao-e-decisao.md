---
name: pj0001-medicao-e-decisao
description: A medição de PJ0001 sobre o corpus e por que ela nasce ligada como Information, e não como Warning
metadata:
  type: project
---

Medido em **2026-08-20**, na implementação da spec 002, sobre 1.012 fontes amostrados de um
inventário de 35.659, com o índice construído sobre os **35.103 arquivos de include** do disco.

## Os números

| O que | Resultado |
| ----- | --------- |
| Disparos na amostra | **1.445** |
| Fontes com ao menos um disparo | **738 de 1.012 — 72,9%** |
| Disparos por fonte | p50 **1**, p90 **3**, p99 **5**, máximo **8** |
| Nomes de include distintos envolvidos | **433** |
| O nome mais comum | `protheus.ch` — **559 disparos (38,7%)** |
| Amostra revisada à mão | **120** |
| **Falsos positivos** | **0 (0,00%)** |
| Custo de análise | p50 **0,014 ms**, p95 **0,21 ms** — abaixo de `CA3001` |
| Custo de indexação | 4.353 diretórios, **9,4 s** com cache quente / **22,8 s** frio |

Critério da revisão: um disparo é falso positivo se a linha não é diretiva em código de verdade, se o
nome não existe no disco (deveria calar — FR-032), se a referência é ambígua (FR-033), ou se bate
byte a byte com o nome real. Os 120 eram divergência real de caixa.

## A decisão: LIGADA, exibida como `Information`

**Ligada** porque a taxa é zero e o defeito é real em todos os 120 casos: uma referência que não
resolve no AppServer Linux. Regra com essa taxa que ficasse desligada seria regra que ninguém vê — e
o valor dela não é apontar quando pedem, é apontar antes de o fonte subir.

**`Information` e não `Warning` porque o que decide a severidade é o VOLUME, não a gravidade.** Com
72,9% dos fontes disparando, `Warning` inflaria a contagem de avisos de quase todo arquivo de um
projeto Protheus real — e o Princípio III é explícito: regra que aparece em todo lugar treina o
usuário a ignorar o painel inteiro. É a mesma conclusão a que `CA3001` chegou, com volume parecido
(71,9%).

⚠️ **`Information` sim, `Hint` NUNCA.** O painel de Problemas do VS Code lista `Error`, `Warning` e
`Information`, e **não lista `Hint`** — foi assim que `CA3001`, rebaixada a `Hint` por volume medido,
sumiu da tela em 2026-08-19 e fez a extensão parecer quebrada. Ver [[armadilhas-do-ambiente]].

## A ressalva que fica de pé

A regra depende de a cadeia de fontes apontar a árvore de includes **daquele** ambiente. Numa máquina
cuja cadeia caiu na varredura do workspace, ela pode acusar divergências vindas de uma árvore que não
é a de compilação — ruído de configuração, não de defeito.

A defesa é o comando `advplLint.showIncludeSources`, que diz qual fonte venceu e quais diretórios ela
produziu. **O que resolveria de verdade**: a extensão saber que a cadeia apontou a árvore CERTA, e
não apenas *uma* árvore. Enquanto isso depender de conferência humana, a ressalva vale.

Ver [[fontes-de-diretorios-de-include]] e [[medicao-includes-corpus]]. A página da regra, com a mesma
tabela e o critério da revisão, é `docs/regras/PJ0001.md`.
