---
name: orcamento-desempenho-subdimensionado
description: RESOLVIDO em 2026-08-19 — o orçamento do Princípio I foi emendado com os números medidos; a ativação virou dois tetos separados (constituição v2.4.0)
metadata:
  type: project
---

> ✅ **Resolvido em 2026-08-19.** A constituição foi emendada para a **v2.3.0** e depois **v2.4.0** e o
> `TODO(BENCHMARK_BASE)` está fechado. O nome deste arquivo ficou histórico — ele descreve o
> problema que existiu, e a última seção diz o que vale hoje.

## O problema que existiu

A constituição, até a v2.2.1, fixava um orçamento **provisório**: "ativação da extensão ≤ 200 ms;
reanálise p95 de fonte de 1.000 linhas ≤ 100 ms". O próprio texto mandava emendá-lo com base em
medição. Quando a medição chegou, ele errava nas **duas** metades:

| | Constituição dizia | Medido |
| - | ------------------ | ------ |
| Tamanho de referência | p95 = 1.000 linhas | p95 real = **3.230** (1.000 fica entre o p50 e o p90) |
| Teto de tempo | ≤ 100 ms | **0,91 ms** — teto **109×** o custo real |

**Why:** um orçamento ancorado abaixo do p90 declara vitória onde o problema não estava — o legado
travava no fonte de dez mil linhas, não no mediano. E um teto 109 vezes folgado deixaria passar uma
regressão de **trinta vezes** sem acender luz. Portão que nunca reprova não é frouxo: é enganoso,
porque produz a sensação de proteção.

## O orçamento que vale hoje (constituição v2.4.0)

| Item | Teto | Medido | Estado |
| ---- | ---- | ------ | ------ |
| Partida do motor | ≤ 100 ms | 41,4 ms | aferido |
| Reanálise do p95 — 3.230 linhas | ≤ 10 ms | 0,91 ms | aferido |
| Reanálise do maior fonte — 27.832 linhas | ≤ 50 ms | 4,71 ms | aferido |
| Parada após cancelamento | ≤ 5 ms | 0,09 ms | aferido |
| Trabalho próprio da ativação | ≤ 50 ms | 18,4 ms | aferido |
| Ativação completa no editor | ≤ 1000 ms | 218–451 ms | aferido |
| Do arquivo aberto ao 1º diagnóstico | ≤ 300 ms | ~112 ms | aferido |

A margem é de cerca de uma ordem de grandeza sobre o medido: absorve máquina mais lenta, as regras
que ainda vão entrar e a variação entre execuções, e ainda assim **reprova** uma regressão real. Os
itens do maior fonte e do cancelamento cobrem onde o legado falhava — `setTimeout` que rejeitava
fonte grande, e resultado descartado no fim em vez de análise interrompida.

## A ativação virou dois números (constituição v2.4.0)

O item "ativação ≤ 200 ms" foi aferido em 2026-08-19 e **reprovou**: 218 a 451 ms em seis medições.
Instrumentando o `activate`, a razão apareceu — o corpo dele custa **18,4 ms**, e os 200 a 430 ms
restantes são o editor **carregando o módulo**, um pacote de 352 KB que é quase todo
`vscode-languageclient`.

**Why:** um teto único media as duas coisas juntas e reprovava o código correto pelo custo de
carregar uma dependência necessária. Minificar não resolve (377 ms em produção contra 418 em
desenvolvimento) e separação de código não funciona em CommonJS — `await import()` vira `require` no
mesmo arquivo.

**How to apply:** a extensão expõe `activationMs` na sua API pública, e é ele que guarda os 50 ms.
Sem esse número, um `await` indevido no caminho de ativação se esconderia dentro da variação do
carregamento, que depende do disco e do estado do editor. Se um dia o teto de 1000 ms acusar e o de
50 ms seguir verde, a leitura é **ambiente**, não regressão.

Ver [[distribuicao-tamanho-fontes]] e o confronto completo em
`specs/001-esqueleto-lsp-harness/baseline/CONFRONTO-2026-08-19.md`.
