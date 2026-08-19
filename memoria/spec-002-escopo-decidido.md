---
name: spec-002-escopo-decidido
description: Escopo da spec 002 já decidido pelo dono em 2026-08-19 — ações de correção mais a regra de portabilidade de include, na mesma spec
metadata:
  type: project
---

Decidido pelo dono em 2026-08-19, **antes** de a spec ser aberta. A spec 002 ainda **não existe**;
este arquivo guarda o escopo para que ele não se perca entre sessões.

## O que entra

**1. Ações de correção (`textDocument/codeAction`).** A lâmpada 💡 que oferece corrigir a violação.

- `CA3001` ganha correção automática: `#INCLUDE` → `#include`. **Só a diretiva.**
- `source.fixAll` para "corrigir todos deste arquivo", que também habilita
  `editor.codeActionsOnSave`.

**2. Regra de portabilidade de include**, origem `projeto`, faixa `PJ####`: a caixa da referência não
bate com o nome real do arquivo no disco.

## Por que a correção NÃO mexe no nome do arquivo

Medido sobre o corpus em 2026-08-19 (ver [[medicao-includes-corpus]]):

- 2.475 dos 35.103 includes do disco têm **maiúscula no nome real** — `ACADEF.CH`, `AdvCtrls.ch`,
  `ECD.CH`, `TchGridObj.CH`;
- baixar a caixa automaticamente **quebraria 706 referências** que hoje resolvem;
- no Linux o sistema de arquivos é sensível a caixa, e o AppServer roda em Linux.

Corrigir a **diretiva** é provadamente inerte: se o pré-processador fosse sensível a caixa, 71,9% dos
fontes do corpus não compilariam. Corrigir o **nome** não é. A assimetria é o motivo de a spec
separar as duas coisas.

## O que a regra de portabilidade pega, e o padrão não

Referência em caixa baixa cujo arquivo no disco tem maiúscula — `acadef.ch` → `ACADEF.CH`. **Isso já
falha no AppServer Linux hoje, em silêncio.** O TOTVS Code Analyzer não consegue detectar porque não
conhece o diretório de includes do projeto. É Princípio III em estado puro, e é a justificativa
obrigatória que toda regra `projeto` precisa declarar.

## O que isso puxa de arquitetura

A regra de portabilidade precisa de um **índice do diretório de includes do projeto** — e isso
atravessa o Princípio I inteiro: varredura sob demanda e nunca na ativação, progresso cancelável,
cache incremental, nada de I/O síncrono. É a parte cara da spec, e o motivo de ela não ser pequena.

## Já decidido junto

`CA3001` é exibida como `Hint`, não `Information` — ver [[severidade-minor-information]]. A lâmpada
de correção aparece do mesmo jeito; o que muda é o painel de problemas não ser dominado por ela.
