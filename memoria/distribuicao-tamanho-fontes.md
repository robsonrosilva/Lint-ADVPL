---
name: distribuicao-tamanho-fontes
description: Distribuição real de tamanho dos fontes ADVPL/TLPP — números da linha de base de 2026-08-19, amostra estratificada sobre 35.659 arquivos
metadata:
  type: project
---

**Números válidos** — medidos pelo harness em 2026-08-19, sobre inventário de **35.659** fontes
`.prw`/`.prx`/`.prg`/`.apw`/`.apl`/`.tlpp` do corpus externo (ver [[corpus-externo]]), com amostra
**estratificada por tamanho** de 1.012 arquivos:

| Percentil | Linhas | Análise |
| --------- | ------ | ------- |
| p50       |    309 | 0,09 ms |
| p90       |  1.862 | 0,45 ms |
| p95       |  3.230 | 0,91 ms |
| p99       | 10.155 | 2,76 ms |
| máximo    | 27.832 | 4,71 ms |

Relatório completo: `specs/001-esqueleto-lsp-harness/baseline/2026-08-19.{json,md}`.

## Estes números substituíram os anteriores, e a diferença tem causa

A primeira apuração (amostra de 3.000 fontes, método não estratificado) dava p90 1.699, p95 2.933,
p99 7.951 e máximo 24.636. **A cauda estava subamostrada** — que é exatamente o defeito que R5
previu ao rejeitar a amostragem uniforme. O p50 bateu igual nas duas (309), o que indica diferença
concentrada na cauda e não erro sistemático.

**How to apply:** ao citar tamanho de fonte para dimensionar orçamento, fixture ou teste, usar a
tabela acima. Quem refizer a medição atualiza aqui — número de linha de base envelhecido não avisa
que envelheceu.

A varredura ingênua dos ~93 mil arquivos do diretório estoura 2 minutos só para contar linhas; o
inventário do harness filtra por extensão **durante** o percurso e guarda cache local, e por isso a
medição inteira leva menos de um minuto.

Ver [[orcamento-desempenho-subdimensionado]].
