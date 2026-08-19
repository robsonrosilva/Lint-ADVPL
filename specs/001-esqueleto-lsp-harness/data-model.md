# Phase 1 — Modelo de dados

**Feature**: 001 — Esqueleto vertical da extensão + harness de medição
**Data**: 2026-08-19

Não há banco de dados. As entidades abaixo são estruturas em memória e formatos de arquivo. As
regras de validação vêm dos requisitos da [spec](spec.md).

---

## 1. `RuleDefinition` — a definição de uma regra

Fonte única de identidade. Dela derivam as chaves de configuração, a exigência de documentação e a
validação de que nenhum diagnóstico sai sem identificador.

| Campo | Tipo | Regra de validação |
| ----- | ---- | ------------------ |
| `id` | `string` | Origem `totvs`: identificador do catálogo (`CA3001`). Origem `project`: faixa `PJ####`. Único no registro. FR-010, FR-010a |
| `origin` | `'totvs' \| 'project'` | Obrigatório. FR-012 |
| `group` | `'G1'…'G5' \| null` | Obrigatório quando `origin === 'totvs'`; `null` quando `'project'`. FR-012 |
| `catalogSeverity` | `'CRITICAL' \| 'MAJOR' \| 'MINOR' \| 'INFO' \| null` | Obrigatório quando `origin === 'totvs'`. **Nunca** usado diretamente para exibir. FR-014 |
| `defaultSeverity` | `DiagnosticSeverity` | Derivado de `catalogSeverity` pela tabela do item 4 — nunca escrito à mão. FR-014 |
| `configKey` | `string` | Chave própria em `contributes.configuration`. Única. FR-013 |
| `messageKey` | `string` | Chave de tradução; precisa existir nos **quatro** idiomas — `en`, `pt-br`, `es`, `ru`. FR-015 |
| `docHref` | `string` | URL absoluta de `docs/regras/<id>.md`. FR-011 |
| `projectRationale` | `string \| null` | Obrigatório e não vazio quando `origin === 'project'` — o que pega que o padrão não pega (Princípio III). `null` quando `'totvs'` |

**Invariantes verificadas por teste**

- `id` único; `configKey` única.
- `origin === 'totvs'` ⟹ `group` e `catalogSeverity` preenchidos e `projectRationale === null`.
- `origin === 'project'` ⟹ `id` casa com `/^PJ\d{4}$/` e `projectRationale` não vazio.
- Todo `id` registrado tem `docs/regras/<id>.md`, e todo arquivo lá corresponde a um `id`
  registrado — nos dois sentidos (Portão 6).

**Instância desta spec**

```text
id                CA3001
origin            totvs
group             G3
catalogSeverity   MINOR
defaultSeverity   Information
configKey         advplLint.rules.CA3001
messageKey        rule.CA3001.message
docHref           …/docs/regras/CA3001.md
projectRationale  null
```

---

## 2. `Diagnostic` — a violação encontrada

Estrutura do LSP, restringida pelo nosso contrato (ver [contracts/diagnostico.md](contracts/diagnostico.md)).

| Campo | Tipo | Regra de validação |
| ----- | ---- | ------------------ |
| `code` | `string` | O `id` da regra, **sem prefixo nem qualificação de origem** (D2). Nunca ausente. FR-010, SC-004 |
| `codeDescription.href` | `string` | O `docHref` da regra. FR-011 |
| `severity` | `DiagnosticSeverity` | Vem da configuração do usuário; na falta dela, o `defaultSeverity`. FR-013 |
| `range` | `{ start, end }` | Início e fim exatos, em linha e caractere base zero. Cobre **o token**, não a linha. FR-019 |
| `message` | `string` | Traduzida no idioma efetivo. Nunca literal no código. FR-016 |
| `source` | `string` | Identifica a extensão como emissora |

**Invariantes**

- `code` sempre presente e sempre igual a um `id` registrado.
- `range.end` nunca antes de `range.start`; ambos dentro dos limites do documento.
- Nenhuma mensagem ecoa valor sensível (não se aplica a `CA3001`, mas o contrato já veda).

---

## 3. `AnalyzedDocument` — o documento em análise

O que a análise consome. **Nunca** o arquivo em disco durante a edição — o disco pode estar
desatualizado em relação ao buffer.

| Campo | Tipo | Observação |
| ----- | ---- | ---------- |
| `uri` | `string` | identidade do documento |
| `languageId` | `'advpl' \| 'tlpp'` | |
| `version` | `number` | versão do LSP; resultado de versão vencida é descartado. FR-005 |
| `text` | `string` | já decodificado pelo editor. Ver R0 da [research.md](research.md) |
| `lineOffsets` | `readonly number[]` | calculado **uma vez** por versão; base da conversão deslocamento ⇄ posição |

**Propriedade que o desenho depende** (R0): em CP1252, deslocamento em bytes, índice de caractere e
unidade de código UTF-16 coincidem. Por isso `lineOffsets` em caracteres serve diretamente às
posições do LSP, sem conversão. Essa garantia **se perde** se algum dia um fonte UTF-8 for aceito —
está registrada aqui para que a perda seja notada.

---

## 4. `SeverityMap` — a tabela versionada de severidade

| Severidade do catálogo | Severidade exibida | Estado |
| ---------------------- | ------------------ | ------ |
| `MINOR` | `Information` | **decidida** (D3) |
| `CRITICAL` | — | `TODO(SEVERITY_MAP)` |
| `MAJOR` | — | `TODO(SEVERITY_MAP)` |
| `INFO` | — | `TODO(SEVERITY_MAP)` — caso difícil: `CA2050`/`CA2051`/`CA2052` são `INFO` e alto impacto |

**Invariante**: registrar regra cuja `catalogSeverity` não tem entrada na tabela é **erro em tempo de
registro**, não valor padrão silencioso. É o que impede a próxima spec de "resolver" o mapeamento por
omissão.

---

## 5. `RuleSettings` — a configuração efetiva

Resolvida por documento, a partir das configurações do editor.

| Campo | Tipo | Padrão |
| ----- | ---- | ------ |
| `enabled` | `boolean` | `true` |
| `severity` | `DiagnosticSeverity \| 'default'` | `'default'` — usa o `defaultSeverity` da regra |

Mudança de configuração revalida os documentos abertos sem reiniciar o editor (US3, cenário 1 e 2).

---

## 6. `CorpusConfig` — onde está o corpus

**Nunca versionado.** Precedência: `ADVPL_LINT_CORPUS` (variável de ambiente) → `corpus.local.json`
na raiz → indisponível.

| Campo | Tipo | Observação |
| ----- | ---- | ---------- |
| `root` | `string` | caminho absoluto do diretório de fontes |
| `extensions` | `string[]` | padrão: `prw`, `prx`, `prg`, `apw`, `apl`, `tlpp` |

Corpus indisponível: a suíte de testes passa inteira; a medição avisa e encerra com sucesso (FR-024).

---

## 7. `CorpusInventory` — o inventário com cache

Arquivo local `.corpus-cache.json`, **não versionado**. Evita repetir o percurso de ~93.000 arquivos.

| Campo | Tipo |
| ----- | ---- |
| `root` | `string` |
| `scannedAt` | `string` (ISO-8601) |
| `files` | `Array<{ path: string, size: number }>` |

Invalidado quando `root` muda. **Nunca** guarda conteúdo de arquivo — só caminho e tamanho.

---

## 8. `Baseline` — o relatório de linha de base

Versionado, datado, em `specs/001-esqueleto-lsp-harness/baseline/`. Esquema completo em
[contracts/relatorio-baseline.md](contracts/relatorio-baseline.md).

| Campo | Tipo | Observação |
| ----- | ---- | ---------- |
| `measuredAt` | `string` | data da medição. FR-025 |
| `environment` | `{ node, cpus, os }` | sem número de ambiente, comparação futura não significa nada |
| `corpus` | `{ totalFiles, sampledFiles, sampling }` | declara explicitamente que houve amostragem. FR-025 |
| `percentiles` | `{ p50, p90, p95, p99, max }` | linhas **e** tempo de análise em cada faixa. FR-020 |
| `ruleCost` | `Array<{ ruleId, incrementalMs }>` | custo isolado por regra. FR-021 |
| `falsePositives` | `Array<{ ruleId, hits, reviewed, falsePositives, rate }>` | **somente agregado**. FR-022 |

⚠️ **`falsePositives` não carrega trecho de código.** Revisar exige olhar o fonte que disparou; esse
material sai em diretório local não versionado. Trecho de fonte padrão do Protheus dentro do
repositório viola o FR-023 e a restrição de licença — pela porta dos fundos, que é como esse tipo de
vazamento acontece.

---

## Relações

```text
RuleDefinition ──1:N──► Diagnostic          o code do diagnóstico é o id da regra
RuleDefinition ──1:1──► RuleSettings        cada regra tem sua chave de configuração
RuleDefinition ──N:1──► SeverityMap         catalogSeverity resolve para defaultSeverity
RuleDefinition ──1:1──► docs/regras/<id>.md correspondência obrigatória nos dois sentidos

CorpusConfig ──► CorpusInventory ──► amostra ──► medição ──► Baseline
AnalyzedDocument ──► análise ──► Diagnostic[]
```
