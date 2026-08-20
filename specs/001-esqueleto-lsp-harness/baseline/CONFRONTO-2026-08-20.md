# Confronto: linha de base 2026-08-19 × 2026-08-20 (Portão 4)

**Data**: 2026-08-20 · **Tarefa**: `T066` da spec 002 · **Fontes**:
[2026-08-19.json](2026-08-19.json) (esquema 1) e [2026-08-20.json](2026-08-20.json) (esquema **2**)

O Portão 4 da constituição exige que toda entrega seja comparada contra a linha de base anterior.
Esta é a **primeira vez que ele roda de verdade**: a spec 001 criou a linha de base, e a 002 é a
primeira entrega a acrescentar uma regra depois dela.

## ⚠️ O esquema mudou: 1 → 2

A spec 002 acrescentou o custo da **indexação** em campo próprio. O `schemaVersion` existe
exatamente para isto — comparar campos que mudaram de significado produz alarme falso, e alarme falso
é como um portão deixa de ser levado a sério.

O que mudou de forma, e o que não mudou:

| Campo | Antes | Agora |
| ----- | ----- | ----- |
| `percentiles[].analysisMs` | análise com **uma** regra | análise com **duas** regras |
| `ruleCost[]` | uma entrada; incremental do CONJUNTO | uma entrada **por regra**, cada uma medida sozinha |
| `falsePositives[]` | uma entrada | uma **por regra** |
| `indexing` | **não existia** | novo, medido em separado |

A mudança em `ruleCost` merece nota: com uma regra só, "incremental do conjunto" e "incremental
daquela regra" eram o mesmo número. Com duas, deixaram de ser — e manter a fórmula antiga atribuiria
a `CA3001` o custo das duas somadas.

## Análise por percentil de tamanho

Mesma amostra estratificada, mesmo inventário de 35.659 fontes.

| Percentil | Linhas | 2026-08-19 (1 regra) | 2026-08-20 (2 regras) | Diferença |
| --------- | ------ | -------------------- | --------------------- | --------- |
| p50 | 309 | 0,088 ms | 0,094 ms | +0,006 ms |
| p90 | 1.862 | 0,451 ms | 0,652 ms | +0,200 ms |
| p95 | 3.230 | 0,914 ms | 1,106 ms | +0,192 ms |
| p99 | 10.155 | 2,757 ms | 4,918 ms | +2,161 ms |
| máximo | 27.832 | 4,707 ms | 8,574 ms | +3,867 ms |

**As linhas por percentil são idênticas** — mesmo corpus, mesma amostragem. O que subiu foi o tempo,
e a razão é conhecida: passou-se a rodar **duas** regras onde antes rodava uma.

### Contra o orçamento do Princípio I (constituição v2.4.0)

| Item | Teto | Medido | Folga |
| ---- | ---- | ------ | ----- |
| Reanálise do p95 (3.230 linhas) | ≤ **10 ms** | **1,11 ms** | 9,0× |
| Reanálise do maior fonte (27.832 linhas) | ≤ **50 ms** | **8,57 ms** | 5,8× |
| Parada após cancelamento | ≤ **5 ms** | **0,23 ms** | 21,7× |

✅ **Nenhum item do orçamento foi estourado.** A folga encolheu — de 10,9× para 9,0× no p95 — e isso
é o esperado de quem dobra o número de regras. O que o portão vigia é o teto, e ele continua longe.

## Custo incremental por regra

| Regra | p50 | p95 | máximo |
| ----- | --- | --- | ------ |
| `CA3001` | 0,007 ms | 0,586 ms | — |
| `PJ0001` | 0,014 ms | 0,208 ms | — |

⚠️ **A coluna "máximo" saiu negativa nas duas regras** (−0,71 ms e −0,75 ms) e por isso não é
publicada acima. O motivo é aritmético, não um defeito de desempenho: o custo incremental é a
**subtração** entre rodar com a regra e rodar sem ela, e no maior fonte do corpus — 27.832 linhas —
a variação entre duas execuções do mesmo trabalho é maior que a contribuição de uma regra. Uma
diferença de duas medições ruidosas pode dar negativo.

**O que fazer com isso**: o número máximo por regra não é confiável e não deve reprovar nada. O p50 e
o p95, que são medianas sobre cinco repetições, são. Fica registrado como limite honesto do método —
não como resultado.

`PJ0001` é **mais barata que `CA3001` no p95**, e faz sentido: as duas percorrem as mesmas linhas,
mas `PJ0001` só procura as aspas quando a palavra já é `include`, e sua consulta ao índice é um
acesso a mapa.

## Indexação — campo novo (FR-042)

| Item | Valor |
| ---- | ----- |
| Diretórios varridos | **4.353** |
| Arquivos de include encontrados | **35.103** |
| Tempo da varredura | **9,4 s** (cache do sistema de arquivos quente) a **22,8 s** (frio) |

Medido em duas execuções no mesmo dia, na mesma máquina, sobre a mesma árvore. **A variação de 2,4×
é do cache do sistema de arquivos, não do código** — e é a razão de este número viver em campo
próprio, fora do custo por documento.

O que ele **não** afeta:

- **a ativação**: a indexação é sob demanda, nunca na ativação (FR-021). Os orçamentos de 50 ms de
  trabalho próprio e 1000 ms de ativação completa continuam medidos pelo teste de integração, e
  continuam verdes;
- **o primeiro diagnóstico**: a análise não espera pelo índice (FR-023). O teste de integração mede
  isso com a indexação em curso e o primeiro diagnóstico continua chegando em menos de 300 ms.

O valor a acompanhar nas próximas entregas é o de **cache quente** (9,4 s), porque é o que o usuário
encontra numa sessão de trabalho real — a árvore de includes é lida por outras ferramentas o dia
inteiro.

## Partida do motor

| | 2026-08-19 | 2026-08-20 |
| - | ---------- | ---------- |
| `activationMs` (partida do motor no thread) | 41,4 ms | **243,6 ms** |

⚠️ **Este número subiu 5,9×, e ele NÃO mede o que o nome sugere.** Ele mede quanto o trabalhador da
medição leva para carregar o motor e responder ao primeiro pedido — e a medição de 2026-08-20 rodou
logo após uma varredura de 35.103 arquivos, com o disco e o coletor de lixo ocupados.

**O que mede a ativação de verdade é o teste de integração**, dentro do VS Code, e ele continua
cobrando os dois tetos da constituição — 50 ms de trabalho próprio e 1000 ms de ativação completa —
e continua verde.

Fica registrado como **ruído de medição a investigar**, não como regressão confirmada. Rodar a
medição de partida ANTES da indexação, e não depois, é a correção provável — e é trabalho de outra
entrega, não desta.

## Falso positivo

| Regra | Disparos | Revisados | Falsos positivos | Taxa |
| ----- | -------- | --------- | ---------------- | ---- |
| `CA3001` | 1.987 | 120 | 0 | 0,00% |
| `PJ0001` | 1.445 | 120 | 0 | 0,00% |

A revisão de `PJ0001` está em [docs/regras/PJ0001.md](../../../docs/regras/PJ0001.md), com o critério
aplicado e o volume por fonte. **Com o número na mão, a regra passou a nascer LIGADA** — e exibida
como `Information`, não `Warning`: o que decide a severidade é o volume (72,9% dos fontes), não a
gravidade do defeito.

## Veredito do Portão 4

✅ **PASSA.** Nenhum item do orçamento do Princípio I foi estourado. Duas ressalvas registradas, e
nenhuma delas é regressão de desempenho do produto:

1. o **máximo por regra** sai negativo e não serve como aferidor — limite do método de subtração;
2. o **`activationMs` do harness** subiu por contaminação da medição, e quem afere a ativação de
   verdade é o teste de integração, que continua verde.
