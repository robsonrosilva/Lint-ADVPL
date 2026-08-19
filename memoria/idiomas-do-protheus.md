---
name: idiomas-do-protheus
description: A extensão acompanha os quatro idiomas do Protheus — pt-BR, espanhol, inglês e russo — o que excede o Princípio V e exige emenda da constituição
metadata:
  type: project
---

Decisão do dono em 2026-08-19, durante a spec `001-esqueleto-lsp-harness` (registrada lá como **D4**).

A extensão é localizada nos **quatro idiomas em que o Protheus é localizado**: português do Brasil,
espanhol, inglês e russo. Identificadores de localidade do VS Code: `pt-br`, `es`, `ru`, com `en`
como idioma base.

**Why:** o produto atende quem trabalha com Protheus, e o Protheus fala esses quatro idiomas. Ficar
em pt-BR e inglês deixaria de fora as bases hispano-americana e russa, que usam o mesmo catálogo de
regras da TOTVS.

**Emenda FEITA em 2026-08-19.** A v2.1.1 dizia literalmente que toda mensagem "MUST existir em
pt-BR e en". Quatro idiomas era ampliação material de escopo, então a constituição foi para a
**v2.2.0** e o Princípio V passou de "Bilíngue por Construção" a **"Multilíngue por Construção"**.
A spec deixou de estar à frente da constituição.

**How to apply:** o conjunto de idiomas vive em **um único ponto de declaração** (`tooling/locales.ts`,
FR-015a) — nenhum outro lugar enumera idioma. São oito arquivos de tradução: quatro do NLS do
manifesto (`package.nls*.json`) e quatro do runtime (`l10n/bundle.l10n*.json`). A verificação compara
os conjuntos de chaves entre **todos os pares** e falha a construção na divergência. Acrescentar um
quinto idioma é acrescentar um arquivo e uma entrada na lista, nunca mexer em código.

**Limite honesto:** o portão prova que as chaves batem, não que a tradução presta. Espanhol e russo
precisam de revisão por quem fala o idioma antes da publicação.

Ver [[identificador-de-regra]] e [[severidade-minor-information]].
