# Contrato — Regra

**O que este contrato governa**: como uma regra é declarada e executada. O registro de regras é a
**fonte única** de identidade: dele saem as chaves de configuração, a exigência de documentação e a
validação do diagnóstico.

## Declaração

```ts
interface RuleDefinition {
  readonly id: string                 // 'CA3001' | /^PJ\d{4}$/
  readonly origin: 'totvs' | 'project'
  readonly group: 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | null
  readonly catalogSeverity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO' | null
  readonly configKey: string          // 'advplLint.rules.CA3001'
  readonly messageKey: string         // chave de tradução
  readonly projectRationale: string | null
  run(ctx: RuleContext): void
}
```

`defaultSeverity` **não** é declarado: ele é derivado de `catalogSeverity` pela tabela versionada, no
momento do registro. Registrar regra cuja severidade de catálogo não tem entrada na tabela é **erro
de registro**, não valor padrão silencioso — é assim que a próxima spec fica impedida de "resolver" o
`TODO(SEVERITY_MAP)` por omissão.

## Validação no registro

| # | Invariante |
| - | ---------- |
| 1 | `id` único; `configKey` única |
| 2 | `origin === 'totvs'` ⟹ `group` e `catalogSeverity` preenchidos, `projectRationale === null` |
| 3 | `origin === 'project'` ⟹ `id` casa `/^PJ\d{4}$/`, `group` e `catalogSeverity` nulos, e `projectRationale` **não vazio** — o que ela pega que o padrão não pega (Princípio III) |
| 4 | `messageKey` existe nos quatro idiomas |
| 5 | `docs/regras/<id>.md` existe |
| 6 | `catalogSeverity` tem entrada na tabela de severidade |

## Execução

```ts
interface RuleContext {
  readonly document: AnalyzedDocument   // texto, versão, deslocamentos de linha
  readonly token: CancellationToken
  report(range: Range, args?: Record<string, unknown>): void
}
```

| # | Regra | Requisito |
| - | ----- | --------- |
| 1 | A regra vê cada linha **uma vez**. Sem varredura da lista de linhas dentro do laço por linha | FR-008 |
| 2 | Busca em lista de termos usa estrutura indexada, nunca varredura linear por linha | Princípio I |
| 3 | A regra **não** faz I/O. Nada de `readFileSync`, nada de rede | FR-007 |
| 4 | A regra **não** registra log. Nem `console.*`, nem canal, nem por linha | FR-007 |
| 5 | A regra consulta `token` entre blocos e retorna quando cancelada | FR-004 |
| 6 | A regra chama `report` com o intervalo; **não** monta a mensagem — quem traduz é o emissor | FR-016 |

As regras 3 e 4 são impostas por lint sobre `packages/server/src`, não por revisão. Foram dois dos
nove defeitos medidos no legado (66 `console.log` no motor; `readFileSync` por fonte do projeto).

## A regra desta spec

```text
CA3001 — a diretiva de inclusão precisa estar em caixa baixa
origem     totvs, grupo G3, catálogo MINOR → exibida como Information
dispara    #INCLUDE, #Include, #InClUdE — qualquer caixa que não seja toda baixa
não dispara dentro de comentário de linha, de bloco, ou de literal de texto
intervalo  o token da diretiva, do '#' ao fim da palavra
custo      uma passagem, sem estado entre linhas
```

O "não dispara" é o único falso positivo plausível da regra e tem fixture dedicada. O classificador
de comentário e literal é compartilhado — mora em `analysis/scanner.ts` e roda **uma vez** por
documento, não uma vez por regra; senão o custo vira O(regras × linhas) já na segunda regra.
