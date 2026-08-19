---
name: distribuicao-tamanho-fontes
description: Distribuição real de tamanho dos fontes ADVPL/TLPP medida em amostra de 3.000 arquivos do corpus
metadata:
  type: project
---

Amostra de 3.000 fontes `.prw`/`.tlpp` do corpus externo (ver [[corpus-externo]]),
medida em 2026-08-19:

| Percentil | Linhas |
| --------- | ------ |
| p50       |    309 |
| p90       |  1.699 |
| p95       |  2.933 |
| p99       |  7.951 |
| máximo    | 24.636 |

Serve para dimensionar orçamento de desempenho e para escolher tamanhos de fixture
sintética. A varredura completa dos ~93 mil arquivos do diretório estoura 2 minutos
de wall-clock só para contar linhas — medição sobre o corpus inteiro precisa ser
amostrada ou paralelizada, nunca ingênua.
