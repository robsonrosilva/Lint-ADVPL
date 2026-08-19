# Data Model — spec 002

As entidades que esta spec acrescenta, com as regras que as governam. Formato em TypeScript porque é
a linguagem do produto; o que importa aqui são as invariantes, não a sintaxe.

---

## `IncludeReference` — uma diretiva vista pelo motor

O que a análise extrai de uma linha `#include`.

```ts
interface IncludeReference {
  /** Intervalo do token da diretiva — `#include`. Alvo da correção de CA3001. */
  readonly directiveRange: Range
  /** A diretiva como escrita, para decidir se CA3001 dispara. */
  readonly directive: string
  /** Nome do arquivo referenciado, SEM aspas e SEM caminho. Alvo de PJ0001. */
  readonly fileName: string
  /** Intervalo do nome do arquivo, só ele. */
  readonly fileNameRange: Range
  /** Caminho antes do nome, se houver: `..\includes\`. Fora do escopo de PJ0001. */
  readonly directoryPath: string | null
}
```

| # | Invariante | Origem |
| - | ---------- | ------ |
| 1 | `directiveRange` cobre do `#` ao fim da palavra, nunca a linha | FR-011, FR-019 da 001 |
| 2 | `fileNameRange` cobre o nome **sem as aspas** | FR-030 |
| 3 | Uma linha pode conter mais de uma referência; cada uma é independente | Edge case |
| 4 | Referência dentro de comentário ou literal **não** é extraída | FR-018 da 001 |

---

## `IncludeIndex` — o que existe no disco

```ts
interface IncludeEntry {
  /** O nome como o disco o escreveu: `ACADEF.CH`. */
  readonly realName: string
  readonly directory: string
}

interface IncludeIndex {
  readonly state: 'ausente' | 'construindo' | 'pronto'
  /** Chave: nome em caixa baixa. Só existe quando `state === 'pronto'`. */
  lookup(fileName: string): IncludeLookup
}

type IncludeLookup =
  | { readonly kind: 'encontrado'; readonly entry: IncludeEntry }
  | { readonly kind: 'ausente' }
  | { readonly kind: 'ambíguo'; readonly candidates: readonly IncludeEntry[] }
```

| # | Invariante | Origem |
| - | ---------- | ------ |
| 1 | O nome real vem de **listagem de diretório**, jamais de consulta de existência | FR-020, R3 |
| 2 | A chave é o nome normalizado para caixa baixa; o valor preserva a caixa real | FR-019 |
| 3 | Dois arquivos de mesmo nome e caixas diferentes ⟹ `ambíguo`, nunca escolha | FR-033 |
| 4 | `state` é observável: a regra precisa distinguir "não achei" de "ainda não sei" | FR-023 |
| 5 | Índice `ausente` ou `construindo` ⟹ `PJ0001` **cala**, e a análise **não espera** | FR-023 |
| 6 | Invalidação é por diretório, nunca reindexação total | FR-024 |

**A distinção do item 4 é o coração do desenho.** "Ainda não indexei" e "indexei e não achei" levam
ao mesmo silêncio na tela, mas por razões opostas — e confundi-las produziria o pior dos mundos: a
regra disparando com base num índice pela metade.

---

## `IncludeSource` — um degrau da cadeia

```ts
interface IncludeSource {
  readonly order: 1 | 2 | 3 | 4
  /** Nome exibível ao usuário — é o que o FR-027c mostra. */
  readonly name: string
  /** Devolve os diretórios utilizáveis. Lista vazia significa "recue". */
  resolve(): Promise<readonly string[]>
}

interface ResolvedSources {
  readonly winner: string | null
  readonly directories: readonly string[]
}
```

| # | Invariante | Origem |
| - | ---------- | ------ |
| 1 | A cadeia para na **primeira fonte utilizável**, não na primeira presente | FR-027a |
| 2 | "Utilizável" = ao menos um diretório existente, após descartar entradas vazias | FR-027a |
| 3 | Formato ilegível ⟹ recuo silencioso para a próxima | FR-027d |
| 4 | Da fonte 1 sai **apenas a lista de caminhos**; o objeto lido morre na função | **FR-027b1** |
| 5 | Mensagem de erro cita caminho e natureza do problema, **nunca conteúdo** | **FR-027b2** |
| 6 | `winner` é observável pelo usuário | FR-027c |

O item 4 é o que a revisão de segurança acrescentou. O arquivo da fonte 1 guarda `savedTokens`, e o
vazamento real não é alguém publicá-lo — é o objeto retido viajar até um log.

---

## `CodeActionOffer` — uma correção oferecida

```ts
interface CodeActionOffer {
  readonly title: string           // traduzido, nos quatro idiomas
  readonly kind: 'quickfix' | 'source.fixAll'
  readonly ruleId: string          // de onde ela veio
  readonly documentVersion: number // guarda contra obsolescência
  readonly edits: readonly TextEdit[]
}
```

| # | Invariante | Origem |
| - | ---------- | ------ |
| 1 | O conjunto de edições é o **menor possível**; nunca o documento inteiro | FR-005 |
| 2 | A edição não altera encoding nem fim de linha | FR-007 |
| 3 | Versão diferente da atual ⟹ a edição é recusada | FR-006, R7 |
| 4 | Regra desligada ⟹ nenhuma ação oferecida | FR-008 |
| 5 | Título passa pelo NLS; nenhuma string literal | FR-009 |
| 6 | Correção de `CA3001` toca **só** a diretiva | FR-011 |
| 7 | Correção de `PJ0001` toca **só** o nome, e só para a grafia real | FR-038 |
| 8 | Edições na mesma linha são disjuntas e ordenadas por posição | FR-016, R6 |

---

## `PJ0001` — a regra

```ts
{
  id: 'PJ0001',
  origin: 'project',
  group: null,
  catalogSeverity: null,
  defaultSeverity: DiagnosticSeverity.Warning,   // DECLARADA — ver R5
  configKey: 'advplLint.rules.PJ0001',
  messageKey: 'rule.PJ0001.message',
  projectRationale: '…o Analyzer não conhece o diretório de includes do projeto…',
}
```

| # | Invariante | Origem |
| - | ---------- | ------ |
| 1 | Dispara quando a referência difere do nome real **apenas na caixa** | FR-028 |
| 2 | **Não** dispara quando o arquivo não é encontrado | FR-032 |
| 3 | **Não** dispara quando a referência é ambígua | FR-033 |
| 4 | A mensagem cita o nome real, nos quatro idiomas | FR-031 |
| 5 | Entra **desligada** até a taxa de falso positivo ser medida | FR-036 |

---

## Alteração no contrato de regra da spec 001

O registro passa a aceitar e **exigir** `defaultSeverity` em regra `projeto`:

| Situação | Antes | Depois |
| -------- | ----- | ------ |
| `origin: 'totvs'` | severidade vem da tabela; `severityOverride` opcional com razão | inalterado |
| `origin: 'project'` | **caminho inexistente** — `catalogSeverity` nulo não tem entrada na tabela | `defaultSeverity` obrigatória; ausência é erro de registro |

É ampliação, não exceção: a tabela continua sendo a única fonte para regra de catálogo, e regra sem
catálogo passa a ter um caminho explícito em vez de nenhum.
