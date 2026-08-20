# Quickstart — como validar a spec 002

Guia de execução e validação. A implementação vive em `tasks.md` e no código. Todos os comandos
rodam da raiz do repositório.

## Pré-requisitos

Os mesmos da spec 001 — Node 24, VS Code 1.85+, e o portão local:

```bash
npm install
npm run verify        # ~34 s: tipos, lint, testes com cobertura, três verificações, integração
```

⚠️ **Não canalizar a saída.** `npm test | tail` devolve o código de saída do `tail`.

⚠️ **Rodar `npm run verify` antes de commitar, em qualquer branch.** O `.gitignore` viaja com a
branch, e uma branch antiga tem regras antigas — foi assim que duas fixtures geradas entraram no
repositório em 2026-08-19.

## Validar a US1 — a lâmpada corrige o `#INCLUDE`

```bash
npm run test:unit
npm run test:integration
```

À mão, na instância de desenvolvimento (**F5**):

1. Abrir uma fixture com `#INCLUDE "TOTVS.CH"`.
2. Pôr o cursor na linha. **Esperado**: a lâmpada 💡 aparece.
3. Aplicar. **Esperado**: a linha vira `#include "TOTVS.CH"` — a diretiva em caixa baixa, **o nome do
   arquivo intacto, inclusive a caixa**.
4. Desfazer uma vez. **Esperado**: volta ao original.
5. Desligar a regra (`advplLint.rules.CA3001.enabled: false`) e pedir as ações de novo.
   **Esperado**: nenhuma ação nossa é oferecida — a lâmpada não ressuscita regra desligada.

### O que mais engana aqui

| Armadilha | Como conferir |
| --------- | ------------- |
| A correção mexer no nome do arquivo | comparar o texto byte a byte: só o token da diretiva pode mudar |
| Perder o CRLF ou o CP1252 | fixture com travessão e aspas tipográficas; abrir depois e conferir os bytes |
| Aplicar edição obsoleta | digitar entre pedir a ação e aplicá-la; o editor deve recusar |

## Validar a US2 — corrigir todas do arquivo, e ao salvar

1. Abrir um fonte com várias diretivas em caixa alta.
2. Executar "Corrigir tudo" (`source.fixAll`). **Esperado**: todas corrigidas.
3. **Desfazer UMA vez.** **Esperado**: todas voltam juntas. Se precisar de N desfazeres, as edições
   não foram agrupadas.
4. Ligar `"editor.codeActionsOnSave": { "source.fixAll": true }` e salvar. **Esperado**: mesmo
   resultado.
5. Repetir no fonte gerado de 24.636 linhas (`npm run fixture:large`). **Esperado**: o salvamento não
   fica perceptivelmente mais lento.
6. Salvar um arquivo **sem violação**. **Esperado**: nenhuma edição, e o arquivo não fica marcado
   como modificado.

## Validar a US3 — a regra de portabilidade

Preparar um diretório de includes controlado, com **caixa mista de propósito**:

```text
<dir>/ACADEF.CH      <- maiúsculo no disco
<dir>/totvs.ch       <- minúsculo no disco
```

E um fonte que referencie `#include "acadef.ch"` (caixa baixa) e `#include "totvs.ch"`.

| Passo | Esperado |
| ----- | -------- |
| Abrir o fonte | `PJ0001` marca **apenas** `acadef.ch`, e o intervalo cobre só o nome — sem aspas, sem a diretiva |
| Ler a mensagem | cita o nome real: `ACADEF.CH` |
| Referenciar um arquivo inexistente | **nenhum** `PJ0001` — ausência é outra regra |
| Pôr `ACADEF.CH` e `acadef.ch` em dois diretórios da cadeia | **nenhum** `PJ0001` — ambiguidade não se resolve por adivinhação |
| Aplicar a correção | a referência vira `ACADEF.CH`; a diretiva não muda |

### A validação que prova o desenho

**Rodar tudo isso no Windows.** É onde o sistema de arquivos é insensível a caixa e onde uma
implementação baseada em `exists` passaria despercebida — ela responderia "existe" para `acadef.ch`
e a regra nunca dispararia. Se `PJ0001` acusa no Windows, o índice está lendo o nome real.

## Validar a cadeia de fontes

| Cenário | Esperado |
| ------- | -------- |
| tds-vscode com `includes` preenchido | a cadeia para na fonte 1 |
| tds-vscode com `includes: [""]` | **recua** — presente não é utilizável |
| Nenhuma das três primeiras configurada | cai na varredura do workspace |
| Nenhuma fonte utilizável | `PJ0001` cala; **um** aviso por sessão, não um por arquivo |
| Perguntar qual fonte está em uso | a extensão diz a fonte e os diretórios |

### A validação de segurança (SC-016)

```bash
node --test "packages/extension/out/test/**/include-sources*.test.js"
```

O teste usa um `servers.json` de mentira com **valor sentinela** em `savedTokens` e `permissions`, e
afirma que a sentinela não aparece no retorno, **nem no log, nem no texto da exceção**. Se ele passar
verificando só o retorno, não está provando o que diz — os dois caminhos reais de vazamento são o log
e a mensagem de erro.

## Validar o Princípio I

| Critério | Como |
| -------- | ---- |
| O índice não roda na ativação | medir a ativação com um diretório grande configurado; os tetos de 50 ms e 1000 ms continuam valendo |
| A análise não espera pelo índice | abrir um fonte com a indexação em curso: os diagnósticos das outras regras aparecem |
| A indexação é cancelável | cancelar e conferir que a leitura de disco **para**, não que o resultado é descartado |
| Custo de `PJ0001` | `npm run baseline` — o custo incremental entra no relatório |
| Custo da indexação | campo próprio no relatório, separado do custo por documento |
| Sem regressão | comparar com `baseline/2026-08-19.json` (Portão 4) |

⚠️ **O relatório sobe para `schemaVersion: 2`.** Comparar campos que mudaram de significado produz
alarme falso, e alarme falso é como um portão deixa de ser levado a sério.
