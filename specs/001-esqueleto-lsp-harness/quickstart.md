# Quickstart — como validar a spec 001

Guia de execução e validação. Não traz implementação; ela vive em `tasks.md` e nos arquivos de
código. Todos os comandos rodam a partir da raiz do repositório.

## Pré-requisitos

| Item | Versão mínima | Medido nesta máquina |
| ---- | ------------- | -------------------- |
| Node.js | 24 | `v24.18.0` |
| npm | 10 | `11.16.0` |
| VS Code | 1.85 | `1.134.0` |
| git | qualquer | `core.autocrlf=true` — daí o `.gitattributes` |

O **corpus é opcional** para tudo, exceto a medição. Sem ele, a suíte de testes passa inteira
(FR-024).

## Instalação

```bash
npm install          # instala os três workspaces
npm run build        # tsc (portão de tipagem) + esbuild (pacotes)
```

## Portão local completo

Não há CI neste repositório; este é o portão (constituição, Fluxo de Desenvolvimento).

```bash
npm run verify
```

Reúne, em ordem:

| Etapa | O que prova | Requisito |
| ----- | ----------- | --------- |
| `typecheck` | compila sem erro; e que o motor não importa `vscode` | Portão 1, Princípio I |
| `lint` | sem `*Sync`, sem `console.*` em `packages/server/src` | FR-007 |
| `test:unit` | motor, ferramentas e protocolo, **com cobertura ≥ 98%** em linhas, funções e ramos | Portão 2, FR-030 |
| `check:nls` | as chaves batem nos quatro idiomas; o manifesto bate com o registro | FR-015, SC-005 |
| `check:corpus` | nenhum fonte do corpus versionado; fixtures com autoria declarada | FR-027, SC-008 |
| `check:docs` | toda regra tem documentação e está no README, e vice-versa | Portão 6 |
| `test:integration` | ativação, painel de problemas, configuração e encoding, dentro de um VS Code real | Portão 2 |

O portão inteiro leva **~23 s** nesta máquina. A integração vem por último de propósito: o que é
barato reprova primeiro, e assim o laço de trabalho não paga 11 s para descobrir um erro de tipo.

⚠️ Até 2026-08-19 o `verify` **não** rodava a integração — encadeava só `test:unit`, contra o que a
`T023` pedia. Dez testes ficavam fora do portão de merge enquanto este guia o chamava de completo, e
ninguém percebeu porque ele estava sempre verde. Hoje `packages/tooling/test/checks/verify-gate.test.ts`
trava isso por máquina.

⚠️ **Não canalizar a saída.** `npm test | tail` devolve o código de saída do `tail`, não do teste —
um "exit code 0" já mascarou suíte que nem chegou a rodar. Rodar direto e ler o resultado.

### Conferir que o portão de cobertura realmente fecha

Um limiar que nunca reprovou ninguém não é portão. Para provar que ele fecha:

```bash
npm run test:unit -- --test-coverage-branches=100   # esperado: FALHA
npm run test:unit                                    # esperado: passa, cobertura >= 98%
```

Se a primeira passar, o limiar não está sendo aplicado e o Portão 2 é decorativo.

⚠️ **Use o limiar de RAMOS, não o de linhas.** `--test-coverage-lines=100` **passaria**: a cobertura
de linhas do motor é 100%, e um limiar que a suíte já atinge não prova nada.

> Nota histórica: até 2026-08-19 esta conferência não funcionava. `npm run test:unit -- <flag>`
> anexava o argumento ao **fim** do comando, depois dos globs de arquivo, e o Node o ignorava em
> silêncio — o comando saía com sucesso e dava a impressão de que o portão estava quebrado, quando o
> quebrado era a instrução. Hoje a suíte roda por
> [`packages/tooling/scripts/test-unit.mjs`](../../packages/tooling/scripts/test-unit.mjs), que
> coloca os argumentos extras na posição certa.

Toda exclusão da medição vive em `coverage-exclusions.json`, **com a razão de cada item** (FR-032).
Baixar o limiar em vez de declarar a exclusão é violação do Princípio VI, não atalho — a exclusão
declarada deixa rastro auditável do que não está coberto e por quê; o limiar menor apaga a informação.

## Validar a User Story 1 — o diagnóstico aparece, o editor não trava

```bash
npm run test:unit          # motor: detecção, posição, cancelamento, CP1252
npm run test:integration   # dentro de uma instância real do VS Code
```

Depois, à mão, que é onde o Princípio I realmente se verifica:

1. `F5` no VS Code abre a instância de desenvolvimento.
2. Abrir uma fixture com `#INCLUDE "TOTVS.CH"` na linha 3, coluna 1.
3. **Esperado**: diagnóstico `CA3001`, severidade Information, sublinhando exatamente o token
   `#INCLUDE` — colunas 1 a 9, não a linha inteira.
4. Corrigir para `#include "totvs.ch"`. **Esperado**: o diagnóstico some **sem salvar**.
5. Abrir o fonte grande gerado (`npm run fixture:large`, 24.636 linhas) e digitar continuamente por
   10 segundos. **Esperado**: nenhuma tecla demora a aparecer; a análise final reflete o texto final.
6. Abrir um `.txt`. **Esperado**: a extensão não ativa — conferir em "Running Extensions".

## Validar a User Story 2 — a linha de base

Apontar o corpus (as duas formas; a variável de ambiente vence):

```bash
export ADVPL_LINT_CORPUS='D:\Workspace\FONTES'
# ou: corpus.local.json na raiz — { "root": "D:\\Workspace\\FONTES" }
```

Nenhum dos dois é versionado. Depois:

```bash
npm run baseline           # inventário (com cache) → amostra → medição → relatório
```

**Esperado**: `specs/001-esqueleto-lsp-harness/baseline/AAAA-MM-DD.{json,md}` com percentis, custo
incremental de `CA3001` e o agregado de falso positivo. Formato em
[contracts/relatorio-baseline.md](contracts/relatorio-baseline.md).

Conferir o caminho sem corpus, que é o cenário 4 da US2:

```bash
unset ADVPL_LINT_CORPUS
npm test        # esperado: passa inteira
npm run baseline # esperado: avisa que o corpus não está disponível e encerra com sucesso
```

### Revisão de falso positivo

`npm run baseline` grava o material de revisão em diretório local **não versionado**. Revisar é
trabalho humano: olhar os disparos amostrados e marcar quais eram falsos. Só o agregado — quantos,
quantos revisados, quantos falsos, a taxa — entra no relatório versionado. **Nenhum trecho de fonte
padrão do Protheus entra no repositório.**

## Validar a User Story 3 — controle e idioma

1. Com um diagnóstico visível, pôr `"advplLint.rules.CA3001.enabled": false` nas configurações.
   **Esperado**: some, sem reiniciar.
2. Religar e pôr `"advplLint.rules.CA3001.severity": "warning"`. **Esperado**: vira aviso, mantendo
   `CA3001` e a mesma posição.
3. Apagar uma chave de `package.nls.es.json` e rodar `npm run check:nls`. **Esperado**: **falha**,
   nomeando a chave e o arquivo. Se passar, a verificação do FR-015 não está fazendo efeito.
   Conferido em 2026-08-19: falha com
   `a chave "configuration.title" falta em "package.nls.es.json"`.

### Idioma: por que a validação NÃO é manual no editor

O passo óbvio seria trocar o idioma pelo `Configure Display Language` e olhar a mensagem. **Ele não
serve**, e a razão é do ambiente: o VS Code só honra outro idioma com o **pacote de idioma
instalado**. Sem ele, `vscode.env.language` continua `en` e a validação passa a provar o contrário do
que diz — medido aqui em 2026-08-19, ao tentar automatizar exatamente isso.

Quem prova a tradução é `packages/server/test/protocol/locale.test.ts`, que sobe o servidor e fala
**LSP direto** com ele, fazendo o aperto de mão em cada idioma:

```bash
node --test "packages/server/out/test/protocol/*.test.js"
```

Cobre os **quatro** idiomas em vez de um, confere que o russo sai em cirílico — o que denunciaria
encoding errado —, que um idioma sem tradução nossa recai no inglês, que a chave crua **nunca**
aparece, e que identificador e intervalo não mudam com o idioma.

Se você tiver o pacote de idioma instalado e quiser conferir no editor mesmo assim, o resultado
esperado é: a mensagem muda; identificador e posição, não.

## Verificar o que mais engana

| Armadilha | Como conferir |
| --------- | ------------- |
| Fixture normalizada pelo git | `git check-attr text packages/server/test/fixtures/<arquivo>` deve dizer `text: unset` |
| Codificação errada no editor | fixture com travessão e aspas tipográficas: a coluna do diagnóstico tem de bater |
| Cancelamento que não cancela | teste dedicado mede **quando** o trabalho parou, não só que o resultado foi descartado |
| Suíte que não roda | ler a saída do `npm test` direto, sem cano |
| Verde por contagem | a asserção compara o diagnóstico inteiro; contagem agregada é proibida (FR-029) |
