# Índice de specs

Fonte única de progresso do Spec-Driven Development. Uma linha por spec; o detalhe mora na pasta dela.

Ciclo de cada spec: `specify` → `clarify` → `plan` → `tasks` → `implement` → `converge` →
`security-review`. A `/speckit-converge` é obrigatória, roda depois do implement e antes do merge.

| Spec | Título | Estado | Etapa atual |
| ---- | ------ | ------ | ----------- |
| [001](001-esqueleto-lsp-harness/) | Esqueleto vertical da extensão + harness de medição | Draft | `specify` concluído; pronta para `plan` |

## Backlog de specs previstas

Derivado da constituição v2.1.1 e das dívidas registradas nela. Ordem indicativa, não compromisso.

| Tema | Origem | Observação |
| ---- | ------ | ---------- |
| Formatação e indentação | Princípio II | era a força do legado; entrega de primeira classe |
| Tabela de mapeamento de severidade | `TODO(SEVERITY_MAP)` | `CA2050`/`CA2051`/`CA2052` são INFO no catálogo e alto impacto na prática |
| Catálogo G1 — Segurança | Princípio III | inclui SQL Injection e senha em código; mensagem nunca ecoa o valor sensível |
| Catálogo G2 — Desempenho e laços | Princípio III | |
| Catálogo G3 — Legado e descontinuado | Princípio III | `CA3001` já entregue na 001 |
| Catálogo G4 — Metadados | Princípio III | |
| Catálogo G5 — Compilação / clean code | Princípio III | |
| Regras `projeto` herdadas do legado | Princípio III, "dois pisos" | as 33 mensagens e 28 chaves do legado são o piso |
| Regras de include obrigatório/obsoleto/duplicado | legado `src/include.ts` | |
| Análise de projeto e cache incremental | Princípio I | varredura sob demanda, cancelável, nunca na ativação |
| Ações de correção automática | — | depende do contrato de diagnóstico da 001 |

## Regras de numeração

Numeração sequencial de três dígitos, definida em `.specify/init-options.json`
(`feature_numbering: sequential`). Spec grande demais quebra em subspecs — `005` vira `005.1` e
`005.2` — para manter o escopo de cada análise administrável sem perder de vista a divisão do todo.
