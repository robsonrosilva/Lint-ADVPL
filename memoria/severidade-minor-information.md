---
name: severidade-minor-information
description: Primeira entrada da tabela de mapeamento de severidade — MINOR do catálogo TOTVS é exibido como Information no editor
metadata:
  type: project
---

Decisão do dono em 2026-08-19, na spec `001-esqueleto-lsp-harness` (registrada lá como **D3**).

A tabela versionada de mapeamento de severidade nasce com **uma única entrada**:
`MINOR` (catálogo TOTVS) → `Information` (editor). As demais entradas continuam vazias e pertencem
ao `TODO(SEVERITY_MAP)` da constituição.

**Why:** `Information` mostra a violação no painel de problemas sem contaminar a contagem de erros e
avisos. `Warning` inflaria a contagem — e `#INCLUDE` em caixa alta é pervasivo em fonte legado, então
treinaria o usuário a ignorar o painel inteiro, exatamente o que o Princípio III proíbe. `Hint`
esconderia demais.

**How to apply:** severidade **nunca** é copiada literalmente do catálogo; sai sempre da tabela. Se a
linha de base apurar volume de disparo alto o bastante para inundar o painel, a entrada é revista
**com o número medido na mão**, como emenda explícita da tabela — nunca como ajuste silencioso. O
caso difícil que ainda espera decisão é `CA2050`/`CA2051`/`CA2052`: são `INFO` no catálogo e o
próprio catálogo declara que representam alto impacto.

Ver [[identificador-de-regra]].
