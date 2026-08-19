---
name: cobertura-minima-98
description: Teste nunca é opcional e a cobertura mínima é 98% em linhas, funções e ramos — portão de merge desde a constituição v2.2.0
metadata:
  type: feedback
---

Decisão do dono em 2026-08-19, emendada na constituição **v2.2.0** (Princípio VI, que passou a
chamar-se "Fixture, **Teste** e Medição Antes da Regra").

Duas cláusulas:

1. **Teste nunca é opcional.** Toda tarefa de implementação é precedida pela sua tarefa de teste,
   escrita para falhar primeiro. Template, skill, gerador ou ferramenta que declare o contrário
   **está subordinado ao princípio e deve ser contrariado**.
2. **Cobertura mínima de 98%** em linhas, funções e ramos, como portão de merge.

**Why (cláusula 1):** o template do spec-kit upstream declara testes opcionais em
`.specify/templates/tasks-template.md` linha 12 e `.claude/skills/speckit-tasks/SKILL.md` linha 145.
Essa contradição já teve de ser neutralizada à mão ao gerar as tarefas da spec 001. Um princípio NÃO
NEGOCIÁVEL que depende de alguém lembrar de contrariar o padrão da ferramenta não está protegido —
por isso a subordinação virou texto da constituição.

**Why (cláusula 2):** o legado assertava apenas totais sobre cinco arquivos e o pipeline instalava
`mocha` sem executar `npm test`; a cobertura real era desconhecida. Um limiar que **falha o
processo** é o que transforma cobertura de relatório decorativo em portão.

**How to apply:** medir com o mecanismo **nativo** do Node 24 —
`--experimental-test-coverage` com `--test-coverage-lines=98`, `--test-coverage-functions=98` e
`--test-coverage-branches=98`. Confirmado disponível nesta máquina em 2026-08-19. **Nunca
acrescentar dependência para medir cobertura**; a constituição veda.

Exclusão de arquivo só por lista versionada (`coverage-exclusions.json`) **com a razão de cada
item**. A camada de integração com o editor tem ramos que só ocorrem sob condição do próprio VS
Code — a saída para eles é exclusão declarada, **nunca limiar mais baixo sem registro**. A diferença
importa: a primeira deixa rastro auditável do que não está coberto e por quê; a segunda apaga a
informação.

Ver [[idiomas-do-protheus]] e [[convencao-de-idioma-no-codigo]], decididos na mesma sessão.
