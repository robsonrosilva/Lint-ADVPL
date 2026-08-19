---
name: orcamento-desempenho-subdimensionado
description: O orçamento provisório do Princípio I usa "fonte de 1.000 linhas" como p95, mas o p95 real do corpus é 2.933 linhas
metadata:
  type: project
---

A constituição v2.1.1, Princípio I, fixa como orçamento provisório
"reanálise p95 de fonte de 1.000 linhas ≤ 100 ms".

**Descoberta em 2026-08-19**: no corpus real (ver [[distribuicao-tamanho-fontes]]),
1.000 linhas fica entre o p50 (309) e o p90 (1.699). O p95 verdadeiro é **2.933
linhas** — quase 3× o número da constituição — e a cauda vai a 24.636 linhas.

**Why:** um orçamento ancorado em arquivo menor que o p95 real declara vitória num
tamanho que 40% dos fontes ultrapassam. O Princípio I existe porque o legado travava
o editor; medir no arquivo errado reproduz o mesmo cego com número novo.

**How to apply:** a spec que estabelecer a linha de base (TODO(BENCHMARK_BASE)) MUST
medir nos percentis reais — p50/p90/p95/p99 — e emendar o Princípio I por
`/speckit-constitution` com os números medidos, não manter "1.000 linhas".
