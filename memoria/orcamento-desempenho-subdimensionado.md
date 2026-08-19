---
name: orcamento-desempenho-subdimensionado
description: O orçamento provisório do Princípio I erra nas duas metades — o tamanho de referência é pequeno demais e o teto de tempo é 109x o custo real medido
metadata:
  type: project
---

A constituição v2.2.1, Princípio I, fixa como orçamento **provisório**: "ativação da extensão
≤ 200 ms; reanálise p95 de fonte de 1.000 linhas ≤ 100 ms".

**Medido em 2026-08-19** pela linha de base da spec 001 (ver [[distribuicao-tamanho-fontes]]), o
orçamento erra nas **duas** metades:

| | Orçamento | Medido | |
| - | --------- | ------ | - |
| Tamanho de referência | 1.000 linhas | o p95 real é **3.230** | 1.000 fica entre o p50 (309) e o p90 (1.862) |
| Teto de tempo | 100 ms | p95 custa **0,91 ms** | teto **109× maior** que o custo real |

**Why:** um orçamento ancorado em arquivo menor que o p95 declara vitória num tamanho que boa parte
dos fontes ultrapassa. E um teto 109 vezes folgado **não limita nada**: uma regressão de trinta
vezes passaria pelo portão sem acender luz. Orçamento que nunca reprova é decoração — e o Princípio
I existe porque o legado travava o editor sem ninguém saber.

**How to apply:** a emenda ao Princípio I ainda **não foi feita** — depende de decisão do dono, via
`/speckit-constitution`. A proposta, com margem de uma ordem de grandeza sobre o medido, está em
`specs/001-esqueleto-lsp-harness/baseline/CONFRONTO-2026-08-19.md`:

| Item | Proposto | Medido |
| ---- | -------- | ------ |
| Partida do motor | ≤ 100 ms | 41,4 ms |
| Reanálise do p95 (3.230 linhas) | ≤ 10 ms | 0,91 ms |
| Reanálise do maior fonte (27.832 linhas) | ≤ 50 ms | 4,71 ms |
| Parada após cancelamento | ≤ 5 ms | 0,09 ms |

⚠️ **Lacuna conhecida**: o campo `activationMs` do relatório mede a **partida do motor** — subir o
thread e carregar o código —, não a ativação da extensão dentro do editor, que envolve o VS Code e
pertence ao teste de integração. Enquanto essa metade não for medida, o item "ativação ≤ 200 ms" do
Princípio I continua sem verificação própria.
