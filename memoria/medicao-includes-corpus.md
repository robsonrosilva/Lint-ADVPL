---
name: medicao-includes-corpus
description: Medição de 2026-08-19 sobre includes no corpus — 71,9% das diretivas em caixa alta, e baixar a caixa do NOME quebraria 706 referências
metadata:
  type: project
---

Medição feita em 2026-08-19 sobre o corpus externo (ver [[corpus-externo]]): 6.000 fontes
amostrados, 18.277 arquivos de include no disco, 15.306 diretivas `#include` lidas.

| O quê | Resultado |
| ----- | --------- |
| Arquivos `.ch` no disco, total | 35.103 |
| — nome todo em caixa baixa | 32.623 (93%) |
| — **nome com maiúscula** | **2.475 (7%)** |
| Diretivas `#include` lidas | 15.306 |
| — **diretiva em caixa alta** (`#INCLUDE`) | **11.006 (71,9%)** |
| — nome do arquivo com maiúscula | 11.502 (75,1%) |
| **Referências que quebrariam se a caixa do NOME fosse baixada** | **706** |

## As três conclusões

**1. `CA3001` dispara em 71,9% das linhas de include.** Por isso ela é exibida como `Hint` e não
`Information`, por sobreposição declarada da tabela de severidade — ver
[[severidade-minor-information]]. Como `Information`, uma regra `MINOR` de estilo dominaria o painel
de problemas de qualquer projeto Protheus real.

**2. Corrigir automaticamente o NOME do include é inseguro.** No Linux o sistema de arquivos é
sensível a caixa, e 7% dos includes têm maiúscula no nome real (`ACADEF.CH`, `AdvCtrls.ch`,
`ECD.CH`, `TchGridObj.CH`). Baixar a caixa quebraria 706 referências que hoje resolvem. Corrigir a
**diretiva** é seguro — se o pré-processador fosse sensível a caixa, 72% dos fontes não compilariam.

**3. Existe um defeito de portabilidade já presente e invisível.** Foram encontradas referências em
caixa baixa cujo arquivo no disco tem maiúscula — `acadef.ch` → `ACADEF.CH`. **Isso já falha no
AppServer Linux hoje**, em silêncio. Detectar isso exige comparar a referência com o nome real do
arquivo, o que o TOTVS Code Analyzer não consegue fazer porque não conhece o diretório de includes
do projeto. É candidata forte a regra de origem `projeto` (faixa `PJ####`) — Princípio III em estado
puro.

## Contexto externo

A documentação do `tds-vscode`, a extensão oficial da TOTVS, recomenda que pastas e arquivos
"sempre estejam em caixa baixa" por interoperabilidade entre sistemas operacionais. A recomendação
existe, mas **não foi seguida na prática** — daí os 7%.

O script de medição não é versionado (ele lê o corpus). Refazer a medição custa alguns minutos; os
números acima valem como linha de base até haver motivo para remedir.
