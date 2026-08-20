# Specification Quality Checklist: Ações de correção + portabilidade de include

**Purpose**: Validar completude e qualidade da especificação antes do planejamento
**Created**: 2026-08-19
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Sem detalhes de implementação (linguagens, frameworks, APIs)
- [x] Focada em valor ao usuário e necessidade de negócio
- [x] Escrita para quem decide, não só para quem implementa
- [x] Todas as seções obrigatórias preenchidas

## Requirement Completeness

- [x] **Nenhum marcador `[NEEDS CLARIFICATION]` restante** — os dois foram resolvidos pelo dono em
      2026-08-19 e viraram as decisões **D8** (cadeia de resolução dos diretórios de includes) e
      **D9** (`PJ0001` fora da correção em massa por padrão)
- [x] Requisitos testáveis e não ambíguos
- [x] Critérios de sucesso mensuráveis
- [x] Critérios de sucesso independentes de tecnologia
- [x] Cenários de aceitação definidos para as quatro histórias
- [x] Casos de borda identificados
- [x] Escopo delimitado — seção `## Escopo` com "Dentro" e "Fora"
- [x] Dependências e premissas identificadas

## Feature Readiness

- [x] Todo requisito funcional tem critério de aceitação correspondente
- [x] As histórias cobrem os fluxos principais e são independentemente testáveis
- [x] A feature atende aos resultados mensuráveis de `## Success Criteria`
- [x] Nenhum detalhe de implementação vazou para a especificação

## Conformidade constitucional (v2.2.1)

- [x] I — orçamento, cancelamento, sem I/O síncrono, indexação sob demanda e nunca na ativação
- [x] II — a correção devolve o menor conjunto de edições e preserva encoding e fim de linha
- [x] III — `PJ0001` declara origem `projeto` e a justificativa obrigatória; falso positivo medido
      antes de ligar por padrão
- [x] IV — identificador, severidade configurável, chave própria de desligamento, documentação
- [x] V — títulos de ação e mensagens nos quatro idiomas
- [x] VI — fixture antes da regra, teste antes da implementação, custo medido, cobertura ≥ 98%

## Notas

- **Terminologia de protocolo**: a spec fala em "ações de correção" e "corrigir todas deste arquivo"
  em vez dos nomes técnicos do protocolo, deliberadamente. Os nomes concretos pertencem ao plano.
- **Amarra com a spec 001**: FR-041 a FR-043 dependem do harness de medição, que é a US2 da 001
  (`T047`–`T062`, não implementada). Registrado em `## Dependências e Riscos`; o plano precisa
  resolver — puxar as tarefas da 001 ou absorvê-las aqui.
- **Alteração de contrato**: FR-035 muda o contrato de registro de regra da 001. É a primeira regra
  `projeto` do produto e o caminho de severidade padrão para ela não existe.
- **Formatos alheios no caminho de leitura** (D8, FR-027): duas das quatro fontes de diretórios
  pertencem a extensões de terceiros. Os formatos foram conferidos nas versões instaladas
  (`totvs.tds-vscode` v2.0.16, `killerall.advpl-vscode` v0.18.1) em 2026-08-19; não são contrato e
  podem mudar. FR-027d contém o dano, FR-027c torna a mudança visível.
- **Uma fonte da cadeia contém credenciais**: FR-027b e SC-016 restringem a leitura aos caminhos.
  Convém repassar isso no `/security-review` do fim da spec.
