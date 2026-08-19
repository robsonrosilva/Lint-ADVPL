---
name: severidade-minor-information
description: A tabela mapeia MINOR para Information; CA3001 sobrepõe para Hint por volume medido, com razão obrigatória
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

**How to apply:** severidade **nunca** é copiada literalmente do catálogo; sai sempre da tabela. O
caso difícil que ainda espera decisão é `CA2050`/`CA2051`/`CA2052`: são `INFO` no catálogo e o
próprio catálogo declara que representam alto impacto.

## Emenda de 2026-08-19: a tabela não bastava

A ressalva desta decisão dizia que a entrada seria revista "com o número medido na mão" se o volume
ameaçasse inundar o painel. O número chegou: **71,9% das diretivas `#include` do corpus estão em
caixa alta** (ver [[medicao-includes-corpus]]).

Mas mudar a tabela seria errado. Ela mapeia **severidade de catálogo**, e rebaixar `MINOR` para
`Hint` rebaixaria junto toda regra `MINOR` futura — inclusive `CA1004` (proibição de `ConOut`), que
merece bem mais visibilidade. O que exige `Hint` em `CA3001` não é a severidade: é o **volume**, e
volume é propriedade da REGRA, não da severidade de catálogo.

**Desenho adotado:** a tabela continua `MINOR → Information`. Regras `totvs` podem declarar
`severityOverride`, com **razão obrigatória e não vazia** — o registro rejeita sobreposição sem
justificativa, porque sobreposição silenciosa é a cópia literal disfarçada que o Princípio III veda.
`CA3001` sobrepõe para `Hint` com a medição citada no próprio código.

Regra de origem `projeto` **não** sobrepõe: ela não tem tabela de onde sair, declara a severidade
direto.

Ver [[identificador-de-regra]].
