---
name: identidade-da-extensao
description: A extensão nova publica com identidade própria e convive com a atual; assumir a identidade antiga é decisão de spec futura
metadata:
  type: project
---

Decisão do dono em 2026-08-19, na spec `001-esqueleto-lsp-harness` (registrada lá como **D1**).

A extensão escrita neste repositório tem **identidade de publicação própria** e convive instalada ao
lado da extensão atual. Nada publicado daqui chega à base instalada da extensão atual como
atualização.

**Why:** a spec 001 entrega **uma** regra. Assumir a identidade atual empurraria, como atualização
automática, uma extensão com 1 diagnóstico onde havia 33 e sem a formatação — que era a melhor
entrega do legado.

**How to apply:** as chaves de `contributes.configuration` vivem em espaço de nomes próprio, sem
colisão com as da extensão atual, e nenhuma configuração da extensão atual é lida ou migrada. A
decisão de assumir a identidade antiga pertence a uma **spec de publicação futura**, quando houver
paridade de regras e a formatação existir — não se antecipa em spec de motor.

Ver [[identificador-de-regra]].
