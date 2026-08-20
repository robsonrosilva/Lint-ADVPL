# Contrato — Índice de includes

**O que este contrato governa**: como o motor descobre **o que existe no disco** sem travar o editor.
É a parte cara desta spec, e a que atravessa o Princípio I inteiro.

## A pergunta que ele responde

> Dado o nome `acadef.ch` escrito num `#include`, qual é o nome **real** do arquivo no disco?

E, tão importante quanto:

> Eu já sei a resposta, ou ainda não indexei?

## Por que não dá para perguntar ao sistema de arquivos

```
No Windows e no macOS padrão, `existsSync('acadef.ch')` responde TRUE
mesmo quando o disco guarda ACADEF.CH.
```

É por isso que o defeito é invisível: o desenvolvedor compila no Windows, o sistema de arquivos
responde "existe" para qualquer caixa, e a falha só aparece no AppServer Linux — longe, tarde, sem
mensagem que ligue uma coisa à outra.

**Qualquer implementação baseada em `stat`, `access` ou `exists` herdaria essa cegueira e a regra
nunca dispararia nas máquinas onde ela é escrita.** Só a **listagem** do diretório devolve o nome
como ele é.

## Os três estados, e por que são três

| Estado | Significa | `PJ0001` |
| ------ | --------- | -------- |
| `ausente` | nenhum diretório utilizável, ou ainda não pedido | cala |
| `construindo` | varredura em curso | cala |
| `pronto` | o índice responde | consulta |

"Ainda não sei" e "já sei que não achei" levam ao mesmo silêncio na tela, por razões opostas.
Colapsá-los produziria o pior resultado possível: a regra disparando sobre um índice pela metade,
acusando ausência de arquivos que existem e ainda não foram lidos.

## As três respostas da consulta

| Resposta | Quando | `PJ0001` |
| -------- | ------ | -------- |
| `encontrado` | existe exatamente um arquivo com aquele nome, ignorando caixa | compara a caixa e decide |
| `ausente` | nenhum arquivo com aquele nome | **cala** — "include faltante" é outra regra (FR-032) |
| `ambíguo` | dois ou mais, com caixas diferentes, em diretórios distintos | **cala** — apontar um seria adivinhação (FR-033) |

## Regras de construção

| # | Regra | Requisito |
| - | ----- | --------- |
| 1 | Construído **sob demanda**, na primeira consulta. NUNCA na ativação | FR-021 |
| 2 | Percurso assíncrono, filtrando por extensão **durante** a varredura | FR-023 |
| 3 | Confere cancelamento entre diretórios e para de fato | FR-022 |
| 4 | Reporta progresso ao usuário | FR-022 |
| 5 | A análise **não espera** por ele: as demais regras publicam normalmente | FR-023 |
| 6 | Falha de leitura degrada em silêncio, com no máximo **um** aviso por sessão | FR-026 |
| 7 | Sem tempo-limite. Árvore grande demora; ela não falha | Princípio I |

A regra 5 é o que impede o índice de virar um bloqueio. Um `await` do índice dentro do caminho de
análise faria a primeira abertura de arquivo esperar por dezenas de milhares de leituras de disco —
e o orçamento "do arquivo aberto ao primeiro diagnóstico ≤ 300 ms" morreria na hora.

## Atualização incremental

| # | Regra | Requisito |
| - | ----- | --------- |
| 1 | Criar, renomear ou apagar um include atualiza o índice **sem reindexar tudo** | FR-024 |
| 2 | A mudança revalida os documentos abertos pelo caminho debounced e cancelável | FR-025 |
| 3 | O observador acompanha **diretórios**, não arquivos individuais | risco declarado no plano |

A regra 3 é a mitigação do risco que o plano registra: observar dezenas de milhares de arquivos é
fonte clássica de travamento — Princípio I sob outro nome. Um evento de diretório invalida aquele
diretório, e só ele.

## O que o índice NÃO faz

| Proibição | Razão |
| --------- | ----- |
| Rodar na ativação | Princípio I, explícito |
| I/O síncrono | Princípio I; imposto por lint |
| Consultar existência pelo nome referenciado | herdaria a cegueira do sistema de arquivos (FR-020) |
| Escolher entre candidatos ambíguos | seria adivinhação (FR-033) |
| Persistir em disco | acrescentaria invalidação entre sessões sem resolver o custo da primeira |
| Guardar conteúdo de arquivo | só nome e diretório |

## Medição

O custo da indexação é medido **em separado** do custo por documento e entra no relatório de linha de
base como campo novo — `schemaVersion` sobe para 2.

São orçamentos diferentes: a indexação acontece uma vez por sessão; a análise, por documento. Somar
os dois esconderia o caro dentro do barato, que é exatamente o erro que o `activationMs` da spec 001
quase cometeu ao misturar carregamento de módulo com trabalho próprio.
