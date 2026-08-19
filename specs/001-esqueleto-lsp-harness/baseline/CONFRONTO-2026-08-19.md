# Confronto: orçamento provisório × linha de base medida

**Data**: 2026-08-19 · **Tarefa**: `T062` da spec 001 · **Fonte dos números**:
[2026-08-19.json](2026-08-19.json)

O Princípio I fixa um orçamento **provisório**, e a própria constituição registra que ele está
subdimensionado (`TODO(BENCHMARK_BASE)`). Este documento é o confronto que a `T062` pede: o que o
orçamento diz, o que a medição mostrou, e o que precisa ser emendado.

## O confronto, item a item

| O que o Princípio I fixa | O que foi medido | Veredito |
| ------------------------ | ---------------- | -------- |
| Ativação da extensão ≤ **200 ms** | partida do motor: **41,4 ms** | ✅ dentro, com folga de 4,8× — mas ver a ressalva abaixo |
| Reanálise p95 de fonte de **1.000 linhas** ≤ **100 ms** | p95 real é de **3.230 linhas**, analisado em **0,91 ms** | ⚠️ **as duas metades estão erradas** |

## Erro 1 — o tamanho de referência

**1.000 linhas não é o p95. Nem chega perto.**

| Percentil | Linhas | Análise |
| --------- | ------ | ------- |
| p50 | 309 | 0,09 ms |
| p90 | 1.862 | 0,45 ms |
| **p95** | **3.230** | **0,91 ms** |
| p99 | 10.155 | 2,76 ms |
| máximo | 27.832 | 4,71 ms |

Um fonte de 1.000 linhas fica **entre o p50 e o p90**. Ancorar o orçamento nele declara vitória num
tamanho que cerca de 30% dos fontes do corpus ultrapassa — e a cauda, que é onde o Princípio I
corre risco de verdade, some da conta.

## Erro 2 — o teto de tempo

**100 ms é 109 vezes maior que o custo real do p95.**

O fonte de p95 é analisado em 0,91 ms. O maior fonte do corpus inteiro — 27.832 linhas — leva
**4,71 ms**. Nada no corpus chega perto de 100 ms.

Um teto folgado nessa ordem de grandeza **não limita nada**: qualquer regressão de trinta vezes
passaria pelo portão sem acender luz nenhuma. Um orçamento que nunca reprova não é orçamento, é
decoração.

## Números do corpus que mudaram

A medição anterior (2026-08-19, amostra de 3.000 fontes) e esta (amostra estratificada de 1.012
sobre inventário de 35.659) não concordam:

| Percentil | Medição anterior | Esta medição | Diferença |
| --------- | ---------------- | ------------ | --------- |
| p50 | 309 | 309 | — |
| p90 | 1.699 | 1.862 | +9,6% |
| p95 | 2.933 | 3.230 | +10,1% |
| p99 | 7.951 | 10.155 | +27,7% |
| máximo | 24.636 | 27.832 | +13,0% |

A explicação está no método, e ele mudou: esta amostragem é **estratificada por tamanho**, com os
marcos de percentil forçados dentro da amostra. Ela enxerga a cauda que a amostragem anterior
subamostrava — que é exatamente o motivo de R5 ter rejeitado a amostragem uniforme. **Os números
desta medição são os que valem**, e o p50 idêntico nas duas é indício de que a diferença está na
cauda, não num erro sistemático.

## Ressalva sobre a "ativação"

O campo `activationMs` do relatório **não** mede a ativação da extensão dentro do editor: essa
envolve o VS Code, e quem a mede é o teste de integração. O que está medido aqui é a **partida do
motor** — subir o thread e carregar o código do servidor, 41,4 ms.

É o componente do orçamento que o código deste repositório controla, e é honesto dizer isso em vez
de apresentar o número como se fosse a coisa inteira. Fechar essa lacuna — medir a ativação real no
editor — é trabalho da US3 ou de spec futura, e fica registrado aqui como **pendência**.

## O que mais a medição mostrou

- **Custo de `CA3001`**: 0,02 ms no p50, 0,09 ms no p95, 0,75 ms no maior fonte. É o custo de uma
  regra que faz uma passagem por linha, e serve de unidade de comparação para as próximas.
- **Parada após cancelamento**: **0,09 ms**. A análise para de fato, em menos de um décimo de
  milissegundo — contra o legado, que gastava o tempo inteiro e descartava o resultado no fim.
- **Falso positivo de `CA3001`**: **0 em 120 disparos revisados**, sobre 1.987 disparos na amostra.
  Os 120 eram 105 na forma `#INCLUDE` e 15 na forma `#Include`; nenhum em caixa baixa, nenhum dentro
  de comentário ou literal. A regra pode ficar ligada por padrão (Princípio VI).

## Proposta de emenda ao Princípio I

Números para substituir o orçamento provisório, com margem sobre o medido em vez de chute:

| Item | Hoje | Proposto | Base |
| ---- | ---- | -------- | ---- |
| Ativação | ≤ 200 ms | mantida em ≤ 200 ms **para a extensão no editor**; partida do motor ≤ **100 ms** | medido 41,4 ms |
| Reanálise p95 | fonte de 1.000 linhas ≤ 100 ms | fonte de **3.230 linhas** (p95 real) ≤ **10 ms** | medido 0,91 ms |
| Reanálise do maior fonte | não existia | 27.832 linhas ≤ **50 ms** | medido 4,71 ms |
| Parada após cancelamento | não existia | ≤ **5 ms** | medido 0,09 ms |

As margens propostas são de uma ordem de grandeza sobre o medido — folga para máquina mais lenta e
para as regras que ainda vão entrar, sem virar o teto decorativo que os 100 ms de hoje são.

⚠️ **Emendar a constituição não é tarefa desta spec** e depende de decisão do dono, via
`/speckit-constitution`. Este documento existe para que a decisão seja tomada sobre número medido, e
não sobre estimativa.
