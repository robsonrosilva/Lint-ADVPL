# Inventário do legado — o piso que não se pode perder

O Princípio III da constituição fala em **dois pisos, nenhum teto**: o legado (28 chaves de
desligamento, 33 mensagens) é o piso do que **já se entregava**; o catálogo oficial G1–G5 é o piso do
que o **padrão exige**. Perder item de qualquer um dos dois na reescrita exige **decisão registrada,
nunca omissão**.

Este documento é o instrumento dessa exigência. Sem ele, "está no backlog" é uma frase; com ele, é
uma lista conferível.

**Estado em 2026-08-20**: das 28 críticas do legado, **zero** estão implementadas.

O produto entrega duas regras, e **nenhuma das duas é deste piso**:

| Regra | Origem | Vem do legado? |
| ----- | ------ | -------------- |
| `CA3001` — diretiva de inclusão em caixa baixa | catálogo, G3 | **não** — o legado tinha cinco regras de include, e esta não era uma delas |
| `PJ0001` — caixa da referência × nome real no disco | `projeto` | **não** — descoberta na medição de 2026-08-19; é acréscimo ao piso, não recuperação dele |

O que a spec 002 mudou a favor do piso é outra coisa, e é grande: ela construiu o **índice de
includes do projeto** — sob demanda, cancelável, incremental por diretório. Ele é a peça que faltava
para `includeFalta`, `includeDesnecessario`, `functionDuplicate` e `fileDuplicate`, que são
justamente as quatro que o legado fazia mal por não ter índice.

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

✅ **A regra de portabilidade já foi entregue**: `PJ0001`, na spec 002 — referência de include cuja
caixa não bate com o nome real do arquivo no disco, que já falha no AppServer Linux em silêncio. Ela
**soma** a este bloco; não risca nenhuma das cinco linhas acima. Ver `docs/regras/PJ0001.md` e
`memoria/pj0001-medicao-e-decisao.md`.

**As cinco continuam abertas — e agora são baratas.** Todas as cinco precisavam de conhecimento que a
spec 002 passou a ter: `includeFalta` e `includeDesnecessario` exigem o índice, que existe;
`includeObsoleto` exige uma tabela que o legado já tem em `src/include.ts`; `faltaTOTVS` e
`includeDuplicidade` exigem só a análise do arquivo inteiro. É o bloco de melhor relação entre valor
e custo do inventário.

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

✅ **RESOLVIDO em 2026-08-20** — constituição **v2.5.0**. O dono decidiu pela terceira origem, e ela
se chama **`diretriz`**: norma escrita da TOTVS sem entrada no catálogo. Ela cita o **documento** e a
**data da consulta** no lugar do identificador — e é essa citação que a separa de uma regra `projeto`
disfarçada.

A alternativa (entrar como `projeto` citando a diretriz) foi descartada pela razão registrada acima:
embaralharia o significado de `projeto`, que quer dizer "regra nossa, que o padrão não cobre". Uma
regra de ProtheusDOC não é nossa — o padrão MANDA fazer, ele só não oferece um id.

`diretriz` herda de `projeto` tudo o mais: identificador na faixa reservada, severidade declarada com
razão escrita, chave própria de desligamento, e medição de falso positivo antes de ser ligada.

⚠️ `TODO(DIRETRIZ_REGISTRY)`: o registro de regras **ainda não implementa** esta origem. Ela vem com
a primeira regra que a use, junto das invariantes que só aquela spec tem como fixar — implementá-la
sem consumidor seria fixar invariante no escuro.

**A spec de ProtheusDOC está desbloqueada.**

---

## Como este documento é usado

- Toda spec que implementar regra do piso **risca a linha correspondente aqui**, apontando o
  identificador novo.
- Item que for deliberadamente abandonado **fica na lista, marcado**, com a razão e a data. O
  Princípio III exige decisão registrada; sumir da lista é a omissão que ele proíbe.
- A verificação `check:docs` cobre `docs/regras/` contra o registro de regras. **Este arquivo não é
  coberto por ela** — é rastreamento de backlog, não documentação de regra existente.
