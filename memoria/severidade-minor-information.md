---
name: severidade-minor-information
description: A tabela mapeia MINOR para Information; CA3001 chegou a sobrepor para Hint e foi revertida — o painel de Problemas do VS Code não lista Hint
metadata:
  type: project
---

> ⚠️ **Reversão de 2026-08-19, no mesmo dia.** `CA3001` voltou a `Information`: o painel de Problemas
> do VS Code lista `Error`, `Warning` e `Information` e **não lista `Hint`**. Ver a última seção —
> ela é a que vale hoje.

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
`CA3001` sobrepôs para `Hint` com a medição citada no próprio código — **e essa parte foi revertida
horas depois**, ver a seção seguinte.

Regra de origem `projeto` **não** sobrepõe: ela não tem tabela de onde sair, declara a severidade
direto.

Ver [[identificador-de-regra]].

## Emenda de 2026-08-19, mais tarde: `Hint` foi revertido

`CA3001` voltou a `Information`, e o `severityOverride` saiu do código. **Esta é a decisão vigente.**

**O que aconteceu:** o dono abriu um fonte real do corpus — 9.636 linhas, seis `#INCLUDE` em caixa
alta nas seis primeiras linhas — e o editor não mostrou crítica nenhuma. A única que aparecia era de
outra extensão.

**A causa:** o painel de Problemas do VS Code lista `Error`, `Warning` e `Information`. Ele **não
lista `Hint`**. No editor, `Hint` é um sublinhado pontilhado discreto, fácil de não notar. O
diagnóstico estava sendo emitido corretamente — o motor foi verificado sobre aquele mesmo arquivo e
achou os seis em 4,49 ms —, mas sumia do lugar onde o usuário procura.

**Why:** a medição de volume (71,9%) estava certa e continua valendo; a conclusão tirada dela é que
não estava. Trocar visibilidade por silêncio deixou a única regra do produto praticamente invisível,
e uma extensão que parece não fazer nada é pior que uma que fala demais.

**A resposta certa para o volume não é a severidade** — é a ação de "corrigir todas deste arquivo",
da spec 002. Com ela, dezenas de ocorrências viram um clique e o volume deixa de ser argumento.

**How to apply:** ao decidir severidade, conferir **como o editor exibe aquela severidade**, e não
só o quanto a regra dispara. Volume é argumento para correção em massa e para chave de desligamento;
não é argumento para esconder. Quem quiser o comportamento antigo tem a chave
`advplLint.rules.CA3001.severity: "hint"`.

O mecanismo de `severityOverride` continua existindo, testado e exigindo razão registrada — só não é
usado por esta regra.
