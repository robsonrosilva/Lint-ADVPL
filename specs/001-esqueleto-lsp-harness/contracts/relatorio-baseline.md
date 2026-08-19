# Contrato — Relatório de linha de base

**O que este contrato governa**: o formato da linha de base de desempenho. É o comparativo
obrigatório de toda entrega futura (Portão 4 da constituição), então precisa ser legível por máquina
para comparação automática e por humano para revisão.

Duas saídas, mesmo conteúdo, ambas versionadas em
`specs/001-esqueleto-lsp-harness/baseline/AAAA-MM-DD.{json,md}`.

## Esquema

```jsonc
{
  "schemaVersion": 1,
  "measuredAt": "2026-08-19T14:32:00-03:00",

  "environment": {                       // sem isto, comparação futura não significa nada
    "node": "v24.18.0",
    "cpus": 16,
    "os": "win32 10.0.26200",
    "extensionVersion": "0.1.0"
  },

  "corpus": {
    "totalFiles": 35599,                 // fontes ADVPL/TLPP encontrados no inventário
    "sampledFiles": 1200,                // ≥ 1000 exigido por SC-006
    "sampling": "estratificada por tamanho em bytes, N por faixa",
    "repetitions": 5,                    // por arquivo; o relatório usa a mediana
    "note": "corpus externo, local, NÃO versionado"
  },

  "percentiles": [                       // FR-020
    { "percentile": "p50", "lines": 309,   "analysisMs": 0.0 },
    { "percentile": "p90", "lines": 1699,  "analysisMs": 0.0 },
    { "percentile": "p95", "lines": 2933,  "analysisMs": 0.0 },
    { "percentile": "p99", "lines": 7951,  "analysisMs": 0.0 },
    { "percentile": "max", "lines": 24636, "analysisMs": 0.0 }
  ],

  "ruleCost": [                          // FR-021 — com a regra menos sem a regra
    { "ruleId": "CA3001", "incrementalMs": { "p50": 0.0, "p95": 0.0, "max": 0.0 } }
  ],

  "falsePositives": [                    // FR-022 — SOMENTE agregado
    { "ruleId": "CA3001", "hits": 0, "reviewed": 0, "falsePositives": 0, "rate": 0.0 }
  ],

  "activationMs": 0.0,                   // SC-003
  "cancellationStopMs": 0.0              // SC-009
}
```

## Regras

| # | Regra | Requisito |
| - | ----- | --------- |
| 1 | Datado, com ambiente registrado | FR-025 |
| 2 | Declara explicitamente quantos arquivos foram medidos e que houve amostragem | FR-025 |
| 3 | Mede **apenas** a análise — leitura de disco fica fora do cronômetro | — |
| 4 | Usa a **mediana** de várias repetições, não uma medição única | — |
| 5 | Custo por regra é a diferença entre rodar com e sem ela | FR-021 |
| 6 | `falsePositives` carrega **só números**. Nenhum trecho de código | FR-022, FR-023 |

## O que este arquivo nunca pode conter

⚠️ **Nenhum caminho de arquivo do corpus, nenhum trecho de fonte, nenhum nome de programa.**

Apurar taxa de falso positivo exige olhar o código que disparou. Esse material de revisão sai em
diretório **local e não versionado**; do relatório sobe apenas o agregado. Um relatório com trechos
seria uma cópia parcial do corpus dentro do repositório — violando o FR-023 e a restrição de licença
pela porta dos fundos, que é exatamente como esse tipo de vazamento costuma acontecer.

A verificação do FR-027 trata este arquivo como qualquer outro: se aparecer conteúdo com cara de
fonte ADVPL aqui, o portão falha.

## Uso na comparação futura

Entrega que acrescenta regra reconfere a linha de base (Portão 4). O `schemaVersion` existe para que
uma mudança de formato não seja lida como regressão de desempenho — comparar campos que mudaram de
significado produziria alarme falso, e alarme falso é como um portão para de ser levado a sério.
