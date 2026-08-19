# Specification Quality Checklist: Esqueleto vertical da extensão + harness de medição

**Purpose**: validar completude e qualidade da especificação antes de seguir para o planejamento
**Created**: 2026-08-19
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Sem detalhes de implementação (linguagens, frameworks, APIs)
- [x] Focada em valor para o usuário e necessidade de negócio
- [x] Escrita para quem não vai implementar
- [x] Todas as seções obrigatórias preenchidas

## Requirement Completeness

- [x] Nenhum marcador [NEEDS CLARIFICATION] pendente
- [x] Requisitos testáveis e sem ambiguidade
- [x] Critérios de sucesso mensuráveis
- [x] Critérios de sucesso independentes de tecnologia
- [x] Todos os cenários de aceitação definidos
- [x] Casos de borda identificados
- [x] Escopo delimitado, com "fora" explícito
- [x] Dependências e premissas identificadas

## Feature Readiness

- [x] Todo requisito funcional tem critério de aceitação claro
- [x] As histórias cobrem os fluxos principais
- [x] A feature atende aos resultados mensuráveis definidos
- [x] Nenhum detalhe de implementação vazou para a especificação

## Notes

**Iteração 1 (2026-08-19)** — três correções aplicadas antes de fechar:

1. *Detalhe de implementação vazado*: a redação original citava o mecanismo de comunicação entre
   processos e o formato do pacote. Reescrito para o resultado observável — "a análise roda fora do
   processo da interface, de modo que nenhuma análise possa bloquear a digitação" (FR-002). A
   arquitetura permanece obrigatória, mas por força da constituição e do plano, não da spec.
2. *Critério de sucesso técnico demais*: "tempo de resposta do servidor de linguagem" virou
   SC-001/SC-002, expressos como o que o desenvolvedor percebe — ver o primeiro diagnóstico, digitar
   sem engasgo.
3. *Requisito não testável*: "desempenho adequado" virou orçamento numérico ancorado nos percentis
   medidos do corpus (SC-001, SC-002, SC-010).

**Iteração 2 (2026-08-19)** — os três marcadores [NEEDS CLARIFICATION] foram resolvidos por decisão
do dono e escritos de volta na spec como **D1**, **D2** e **D3**, cada um com a razão registrada:

| # | Decisão | Efeito na spec |
| - | ------- | -------------- |
| D1 | Extensão nasce com identidade de publicação independente | FR-014a; premissa de não-migração de configuração |
| D2 | Identificador exibido é o id puro do catálogo (`CA3001`); regras `projeto` na faixa `PJ####` | FR-010, FR-010a |
| D3 | `MINOR` do catálogo é exibido como `Information` | FR-014 |

**Resultado**: todos os itens do checklist passam. A spec está pronta para `/speckit-plan`.
`/speckit-clarify` deixou de ser necessária — as três ambiguidades que a justificariam já foram
respondidas e registradas.

**Iteração 3 (2026-08-19)** — duas decisões tomadas durante o plano e as tarefas voltaram para a
spec, e ambas produziram emenda da constituição (**v2.2.0**):

| # | Decisão | Efeito na spec | Efeito na constituição |
| - | ------- | -------------- | ---------------------- |
| D4 | Quatro idiomas do Protheus (`en`, `pt-br`, `es`, `ru`) | FR-015, FR-015a; SC-005 | Princípio V → *Multilíngue por Construção* |
| D5 | Teste nunca opcional + cobertura mínima de 98% | FR-028 a FR-032; SC-011, SC-012 | Princípio VI → *Fixture, **Teste** e Medição*; Portão 2 |

A spec chegou a ficar deliberadamente **à frente** da constituição entre o plano e a emenda. Isso foi
registrado no texto em vez de silenciado, e a emenda fechou a diferença antes da implementação
começar — que era o ponto.
