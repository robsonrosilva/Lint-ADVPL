---
name: orcamento-desempenho-subdimensionado
description: RESOLVIDO em 2026-08-19 — o orçamento do Princípio I foi emendado com os números medidos (constituição v2.3.0); resta a ativação da extensão, ainda sem verificação
metadata:
  type: project
---

> ✅ **Resolvido em 2026-08-19.** A constituição foi emendada para a **v2.3.0** e o
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

## O orçamento que vale hoje (constituição v2.3.0)

| Item | Teto | Medido | Estado |
| ---- | ---- | ------ | ------ |
| Partida do motor | ≤ 100 ms | 41,4 ms | aferido |
| Reanálise do p95 — 3.230 linhas | ≤ 10 ms | 0,91 ms | aferido |
| Reanálise do maior fonte — 27.832 linhas | ≤ 50 ms | 4,71 ms | aferido |
| Parada após cancelamento | ≤ 5 ms | 0,09 ms | aferido |
| **Ativação da extensão no editor** | ≤ 200 ms | — | ⚠️ **não aferido** |

A margem é de uma ordem de grandeza sobre o medido: absorve máquina mais lenta, as regras que ainda
vão entrar e a variação entre execuções, e ainda assim **reprova** uma regressão real. Os dois itens
do meio são novos e cobrem onde o legado falhava — `setTimeout` que rejeitava fonte grande, e
resultado descartado no fim em vez de análise interrompida.

## O que continua aberto

⚠️ **A ativação da extensão dentro do editor não é medida por nada.** Os 41,4 ms são a partida do
**motor** — subir o processo e carregar o código. A ativação envolve o VS Code e pertence ao teste
de integração. O item permanece no orçamento marcado como não aferido, de propósito: trocá-lo pelo
número do motor apagaria um item fingindo tê-lo medido.

**How to apply:** a dívida é a tarefa **`T088`** da spec 001. Enquanto ela não fechar, ninguém pode
afirmar que o orçamento do Princípio I está inteiramente verificado.

Ver [[distribuicao-tamanho-fontes]] e o confronto completo em
`specs/001-esqueleto-lsp-harness/baseline/CONFRONTO-2026-08-19.md`.
