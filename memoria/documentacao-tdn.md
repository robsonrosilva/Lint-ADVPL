---
name: documentacao-tdn
description: A documentação oficial da linguagem ADVPL e TLPP está na TDN — duas páginas informadas pelo dono em 2026-08-19; é onde se responde "como a linguagem funciona"
metadata:
  type: reference
---

Informado pelo dono em **2026-08-19**.

| Fonte | Para quê |
| ----- | -------- |
| `https://tdn.totvs.com/display/tec/AdvPL` | a linguagem ADVPL — sintaxe, funções, comportamento do pré-processador |
| `https://tdn.totvs.com/display/tec/TLPP` | TLPP — orientação a objetos, anotações, o que difere do ADVPL |

## Onde elas entram

A constituição já colocava "documentação TDN" na hierarquia de fontes, **logo abaixo do catálogo
oficial de regras e acima** das skills da TOTVS e dos documentos deste repositório que se declaram
gerados por IA. Faltavam os endereços; agora estão registrados.

**A divisão de trabalho entre as duas famílias de fonte:** o catálogo diz **o que apontar** — id,
título, severidade, API proibida. A TDN diz **como a linguagem funciona**. Regra que dependa de
comportamento do pré-processador, de escopo de variável, de anotação TLPP ou de semântica de função
se decide na TDN, não no catálogo.

Isso já teria ajudado uma vez: a decisão de que baixar a caixa da diretiva `#INCLUDE` é inerte foi
tomada por **inferência estatística** — 71,9% dos fontes do corpus usam caixa alta e compilam, logo
o pré-processador não distingue caixa (ver [[medicao-includes-corpus]]). O raciocínio é sólido, mas
a TDN pode ter a afirmação direta.

**How to apply:** consulta que sustentar decisão de regra entra na spec **com a data**, como a
constituição exige de toda fonte. Página de wiki muda sem aviso e sem versão — diferente de
[[../referencias/totvs/PROVENIENCIA]], que é cópia byte-idêntica com SHA-256 conferido. Se a página
sustentar algo importante, vale copiar o trecho relevante para a spec em vez de só linkar.
