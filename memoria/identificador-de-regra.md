---
name: identificador-de-regra
description: O Diagnostic.code exibido é o id puro do catálogo TOTVS; regras de origem projeto usam a faixa reservada PJ####
metadata:
  type: project
---

Decisão do dono em 2026-08-19, na spec `001-esqueleto-lsp-harness` (registrada lá como **D2**).

O identificador exibido no painel de problemas é o **id puro do catálogo oficial**, sem prefixo e
sem qualificação de origem: `CA3001`, não `totvs/CA3001` nem `advpl-lint/CA3001`.

Regras de origem `projeto` — as que o catálogo TOTVS não cobre — usam a faixa reservada **`PJ####`**.

**Why:** `CA3001` é literalmente o que o desenvolvedor Protheus já lê no SonarQube da TOTVS. Um
identificador que ele pode copiar do editor e pesquisar sem tradução mental vale mais que a origem
visível no rótulo. A origem continua obrigatória pelo Princípio III, mas vive nos metadados da regra
e na documentação.

**How to apply:** toda regra nova de catálogo entra com o id do catálogo. Toda regra própria pega o
próximo número livre da faixa `PJ####`. Renomear identificador depois é bump MAJOR — os prefixos em
uso no catálogo oficial são `CA`, `BG` e `CS`, e `PJ` está livre, mas isso não é garantido para
sempre: ao atualizar `referencias/totvs/`, conferir colisão de prefixo é item obrigatório.

Ver [[identidade-da-extensao]] e [[severidade-minor-information]].
