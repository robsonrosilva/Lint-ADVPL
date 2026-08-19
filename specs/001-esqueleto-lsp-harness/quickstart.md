# Quickstart — como validar a spec 001

Guia de execução e validação. Não traz implementação; ela vive em `tasks.md` e nos arquivos de
código. Todos os comandos rodam a partir da raiz do repositório.

## Pré-requisitos

| Item | Versão mínima | Medido nesta máquina |
| ---- | ------------- | -------------------- |
| Node.js | 24 | `v24.18.0` |
| npm | 10 | `11.16.0` |
| VS Code | 1.85 | `1.133.0` |
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
| `test` | a suíte inteira **e cobertura ≥ 98%** em linhas, funções e ramos | Portão 2, FR-030 |
| `check:nls` | as chaves batem nos quatro idiomas | FR-015, SC-005 |
| `check:corpus` | nenhum fonte do corpus versionado; fixtures com autoria declarada | FR-027, SC-008 |
| `check:docs` | toda regra tem documentação e vice-versa | Portão 6 |

⚠️ **Não canalizar a saída.** `npm test | tail` devolve o código de saída do `tail`, não do teste —
um "exit code 0" já mascarou suíte que nem chegou a rodar. Rodar direto e ler o resultado.

### Conferir que o portão de cobertura realmente fecha

Um limiar que nunca reprovou ninguém não é portão. Para provar que ele fecha:

```bash
npm test -- --test-coverage-lines=100      # esperado: FALHA, e o processo sai com erro
npm test                                    # esperado: passa, com cobertura >= 98%
```

Se a primeira linha passar, o limiar não está sendo aplicado e o Portão 2 é decorativo.

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
3. Trocar o idioma do editor (`Configure Display Language`) entre `pt-br`, `es`, `en` e `ru`.
   **Esperado**: a mensagem muda; identificador e posição não.
4. Escolher um idioma sem tradução nossa. **Esperado**: cai no inglês — **nunca** aparece o
   identificador cru da chave.
5. Apagar uma chave de `package.nls.es.json` e rodar `npm run verify`. **Esperado**: **falha**,
   nomeando a chave e o arquivo. Se passar, a verificação do FR-015 não está fazendo efeito.

## Verificar o que mais engana

| Armadilha | Como conferir |
| --------- | ------------- |
| Fixture normalizada pelo git | `git check-attr text packages/server/test/fixtures/<arquivo>` deve dizer `text: unset` |
| Codificação errada no editor | fixture com travessão e aspas tipográficas: a coluna do diagnóstico tem de bater |
| Cancelamento que não cancela | teste dedicado mede **quando** o trabalho parou, não só que o resultado foi descartado |
| Suíte que não roda | ler a saída do `npm test` direto, sem cano |
| Verde por contagem | a asserção compara o diagnóstico inteiro; contagem agregada é proibida (FR-029) |
