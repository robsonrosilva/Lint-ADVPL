# Índice de specs

Fonte única de progresso do Spec-Driven Development. Uma linha por spec; o detalhe mora na pasta dela.

Ciclo de cada spec: `specify` → `clarify` → `plan` → `tasks` → `implement` → `converge` →
`security-review`. A `/speckit-converge` é obrigatória, roda depois do implement e antes do merge.

| Spec | Título | Estado | Etapa atual |
| ---- | ------ | ------ | ----------- |
| [001](001-esqueleto-lsp-harness/) | Esqueleto vertical da extensão + harness de medição | **Pronta para merge** | 90 tarefas, nenhuma pendente. Ciclo completo, incluindo `converge` (7 tarefas anexadas e fechadas) e `security-review` sem achados. `npm run verify` verde em ~34 s |
| [002](002-correcao-e-portabilidade-include/) | Ações de correção + portabilidade de include | **Pronta para merge** | **78 de 78 tarefas**, ciclo completo. Duas correções automáticas (`quickfix` e `source.fixAll`), a cadeia de fontes de include no cliente, o índice no servidor e a regra `PJ0001`. A `converge` anexou 7 tarefas e **achou um defeito real** — o observador não chegava ao servidor. A `security-review` não achou nada HIGH nem MEDIUM. `npm run verify` **verde**: 632 unitários com cobertura 99,86/98,83/99,01, mais 45 de integração em VS Code real. Linha de base reconferida (esquema **2**) |

A spec 002 produziu **uma** emenda na constituição:

- **v2.5.0** (2026-08-20) — o Princípio III ganha uma **terceira origem de regra**, `diretriz`: norma
  escrita da TOTVS **sem entrada no catálogo**, que cita documento e data no lugar do id. A taxonomia
  de duas casas não descrevia a realidade — ProtheusDOC é exigido pelas diretrizes oficiais e não tem
  id no SonarQube, então não era `totvs` nem `projeto`. ⚠️ `TODO(DIRETRIZ_REGISTRY)`: o registro
  ainda não implementa a origem; isso vem com a primeira regra que a use.

A spec 001 produziu **quatro**, todas em 2026-08-19:

- **v2.2.0** — Princípio V passou a *Multilíngue por Construção* (os quatro idiomas do Protheus) e
  Princípio VI passou a *Fixture, Teste e Medição Antes da Regra*, com cobertura mínima de 98% como
  portão de merge.
- **v2.2.1** — os dois encodings do projeto separados por escrito (CP1252 para o que é analisado,
  UTF-8 sem BOM para o que é do repositório).
- **v2.3.0** — o orçamento de desempenho do Princípio I trocado por números **medidos**, fechando o
  `TODO(BENCHMARK_BASE)`. O teto anterior era 109× o custo real.
- **v2.4.0** — a ativação virou **dois** orçamentos, depois de medida e reprovada: 50 ms para o
  trabalho próprio do código e 1000 ms para a ativação completa, que inclui o editor carregar o
  módulo. Um teto único reprovava o código correto pelo custo de uma dependência necessária.

## Backlog de specs previstas

Derivado da constituição v2.2.0 e das dívidas registradas nela. Ordem indicativa, não compromisso.

| Tema | Origem | Observação |
| ---- | ------ | ---------- |
| Formatação e indentação | Princípio II | era a força do legado; entrega de primeira classe |
| Tabela de mapeamento de severidade | `TODO(SEVERITY_MAP)` | `CA2050`/`CA2051`/`CA2052` são INFO no catálogo e alto impacto na prática |
| Catálogo G1 — Segurança | Princípio III | inclui SQL Injection e senha em código; mensagem nunca ecoa o valor sensível |
| Catálogo G2 — Desempenho e laços | Princípio III | |
| Catálogo G3 — Legado e descontinuado | Princípio III | `CA3001` já entregue na 001 |
| Catálogo G4 — Metadados | Princípio III | |
| Catálogo G5 — Compilação / clean code | Princípio III | |
| **Críticas próprias herdadas do legado** | Princípio III, "dois pisos" | **inventariadas item a item em [docs/inventario-legado.md](../docs/inventario-legado.md)** — 28 chaves, zero implementadas |
| Includes: falta `totvs.ch`, obsoleto, duplicado, faltante, desnecessário | legado `src/include.ts` | 5 regras que o catálogo **não** tem; ele só tem `CA3001` |
| ~~Portabilidade de include: caixa da referência vs arquivo no disco~~ | medição de 2026-08-19 | ✅ **entregue na 002** como `PJ0001`, desligada por padrão |
| ProtheusDOC: função/classe/webservice/struct sem documentação | diretrizes TOTVS | ⚠️ norma TOTVS **sem id no catálogo** — taxonomia de origem precisa de decisão |
| SQL: sem Embedded, `DELETE FROM`, `SELECT *`, schema, tabela fixa | legado | mais específicas que `CA2050`/`CS1000` |
| Projeto: função e arquivo duplicados | legado | exige índice do projeto |
| Higiene: conflito de merge esquecido, `CRLF`, parâmetro descontinuado | legado | |
| Análise de projeto e cache incremental | Princípio I | varredura sob demanda, cancelável, nunca na ativação |
| ~~Ações de correção automática~~ | — | ✅ **entregue na 002**: `quickfix` por diagnóstico e `source.fixAll` para o arquivo, que é o que habilita a correção ao salvar |
| Análise de projeto: índice de includes | Princípio I | ✅ **parte entregue na 002** — o índice existe, é sob demanda, cancelável e incremental por diretório |

## Regras de numeração

Numeração sequencial de três dígitos, definida em `.specify/init-options.json`
(`feature_numbering: sequential`). Spec grande demais quebra em subspecs — `005` vira `005.1` e
`005.2` — para manter o escopo de cada análise administrável sem perder de vista a divisão do todo.
