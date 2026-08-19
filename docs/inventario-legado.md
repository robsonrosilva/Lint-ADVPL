# Inventário do legado — o piso que não se pode perder

O Princípio III da constituição fala em **dois pisos, nenhum teto**: o legado (28 chaves de
desligamento, 33 mensagens) é o piso do que **já se entregava**; o catálogo oficial G1–G5 é o piso do
que o **padrão exige**. Perder item de qualquer um dos dois na reescrita exige **decisão registrada,
nunca omissão**.

Este documento é o instrumento dessa exigência. Sem ele, "está no backlog" é uma frase; com ele, é
uma lista conferível.

**Estado em 2026-08-19**: das 28 críticas do legado, **zero** estão implementadas. A spec 001
entregou uma única regra, `CA3001`, que é do catálogo e **não** faz parte deste piso.

Fontes: `analise-advpl/src/models/params.ts` (as 28 chaves) e `analise-advpl/src/locales/pt-br.json`
(as 33 mensagens), lidos em 2026-08-19.

---

## A parte que o catálogo TOTVS já cobre

Estas viram regras de origem `totvs`, com o identificador do catálogo. Não são perda: são
**reclassificação**.

| Chave do legado | O que criticava | Vira |
| --------------- | --------------- | ---- |
| `conout` | uso de `ConOut`; manda usar `FWLogMsg` | `CA1004` — G3, MINOR |
| `putSX1` | uso de `PutSX1` | `CA2014` — G3, INFO |
| `Isam` | driver ISAM; manda usar `FWTemporaryTable` | `CA1000` — G3, MAJOR |
| `dictionaryUse` | acesso direto ao dicionário (SX*) | grupo **G4** inteiro — `CA2000`…`CA2013`, `CA2021` |
| `msgBox` | `MsgBox` descontinuada no Protheus 12 | `CA1006`/`CA2020` ou `BG1100` — função obsoleta |
| `restrictUse` (msg) | função de uso restrito | `CA2022`, `CA2023` + a lista de 171 restritos de `models/Restritos.ts` |
| `deprecated` + `newfunction` (msg) | função obsoleta e sua substituta | `CA1006`/`CA2020`, `BG1100` |

---

## A parte que é VALOR PRÓPRIO — o padrão não vê

Estas são a razão de a extensão existir (Princípio III). Viram regras de origem `projeto`, faixa
`PJ####`, e cada uma **precisa declarar o que pega que o padrão não pega**.

### Includes — o bloco mais valioso

O catálogo tem **uma** regra de include: `CA3001`, caixa baixa. O legado tinha **cinco**, e nenhuma
delas está no catálogo.

| Chave do legado | O que criticava | Por que o padrão não pega |
| --------------- | --------------- | ------------------------- |
| `faltaTOTVS` | falta o include `totvs.ch` | exige conhecer a convenção do projeto |
| `includeObsoleto` | include obsoleto substituído por `totvs.ch` | exige a tabela de includes obsoletos → moderno |
| `includeDuplicidade` | mesmo include declarado duas vezes | análise do arquivo inteiro, não de uma linha |
| `includeFalta` | falta importar um include que o fonte usa | exige saber o que cada include define |
| `includeDesnecessario` | include não usado, ou já contido em outro | exige o grafo de inclusão do projeto |

⚠️ **Somar a estas a regra de portabilidade descoberta em 2026-08-19**: referência de include cuja
caixa não bate com o nome real do arquivo no disco. Já falha no AppServer Linux, em silêncio. Ver
`memoria/medicao-includes-corpus.md`.

### Documentação — ProtheusDOC

| Chave do legado | O que criticava |
| --------------- | --------------- |
| `functionNoCommented` | função sem bloco ProtheusDOC |
| `flassNoCommented` | classe sem bloco ProtheusDOC |
| `webServiceNoCommented` | web service sem bloco ProtheusDOC |
| `structNoCommented` | struct sem bloco ProtheusDOC |
| `commentNoFunction` | bloco de comentário órfão, sem função abaixo |
| `padComment` | bloco fora do padrão |

### SQL — mais específico que o catálogo

O catálogo tem `CA2050`/`CA2051` (injeção) e `CS1000` (query direta). Nenhuma delas é o que estas
pegam.

| Chave do legado | O que criticava |
| --------------- | --------------- |
| `queryNoEmbedded` | query fora de `BeginSQL … EndSQL` |
| `deleteFrom` | uso de `DELETE FROM` |
| `selectAll` | `SELECT *` |
| `noSchema` | uso de schema na query |
| `tableFixed` | nome de tabela fixo na query, em vez de `RetSqlName()` |
| `bestAnalitc` | cláusulas da query na mesma linha, atrapalhando a análise |

### Projeto inteiro — exige índice, não cabe em um arquivo

| Chave do legado | O que criticava |
| --------------- | --------------- |
| `functionDuplicate` | função com o mesmo nome em dois fontes do projeto |
| `fileDuplicate` | arquivo duplicado no projeto |

### Higiene de fonte

| Chave do legado | O que criticava |
| --------------- | --------------- |
| `conflictMerge` | marcadores de conflito de merge esquecidos no fonte |
| `crlf` | recomendação de uso da expressão `CRLF` |
| `folMes` | parâmetro descontinuado no Protheus 12 |

---

## Três achados desta leitura

### 1. Uma crítica do legado NÃO tinha chave de desligamento

`validaAdvpl.freeObjSelf` — *"não é permitido limpar o próprio objeto"* — tem mensagem em
`locales/pt-br.json` e **nenhuma entrada** em `params.ts`. Ou seja: crítica que o usuário não
conseguia desligar.

O Princípio IV proíbe isso — *"regra sem chave própria MUST ser rejeitada"* —, e o registro de regras
da extensão nova **rejeita no ato**. Não é perda: é o piso já sendo corrigido.

### 2. As mensagens do legado eram montadas por concatenação

As 33 mensagens não são 33 regras. Várias são **fragmentos** colados em tempo de execução:

```text
includes.oInclude  + "<nome>" + includes.emDuplicidade
"O Include"        + "totvs.ch" + "está em duplicidade!"
```

Isso funciona em português e inglês por acidente de ordem de palavras. **Quebra em russo**, onde a
ordem é outra, e é frágil em espanhol. A extensão nova usa mensagem inteira com argumento nomeado
(`{nome}`) — decisão que agora tem uma razão medida, não só estética.

### 3. Existe norma TOTVS que o catálogo SonarQube não cobre — e a taxonomia de origem não prevê isso

As regras de ProtheusDOC são exigidas pelas **diretrizes oficiais** da TOTVS
(`referencias/totvs/totvs-advpl-tlpp-guidelines.md`: *"All new code must include a
`/*/{Protheus.doc}` block with at minimum `@type`, `@author`, `@since`…"*), mas **não têm
identificador no catálogo SonarQube**.

A taxonomia atual só tem dois valores: `totvs` — que exige citar id e grupo do catálogo — e
`projeto`, que significa "regra nossa que o padrão não cobre". Uma regra de ProtheusDOC não é nem
uma nem outra: é norma da TOTVS sem id de catálogo.

**Decisão em aberto.** Ou se acrescenta uma terceira origem (`totvs-guideline`), ou essas regras
entram como `projeto` com a justificativa citando a diretriz. A segunda opção funciona mas embaralha
o significado de `projeto`. Precisa de decisão do dono antes da spec que implementar ProtheusDOC.

---

## Como este documento é usado

- Toda spec que implementar regra do piso **risca a linha correspondente aqui**, apontando o
  identificador novo.
- Item que for deliberadamente abandonado **fica na lista, marcado**, com a razão e a data. O
  Princípio III exige decisão registrada; sumir da lista é a omissão que ele proíbe.
- A verificação `check:docs` cobre `docs/regras/` contra o registro de regras. **Este arquivo não é
  coberto por ela** — é rastreamento de backlog, não documentação de regra existente.
