---
name: armadilhas-do-ambiente
description: Erros de ferramenta que já custaram tempo neste repositório — cada um foi encontrado na prática, não previsto
metadata:
  type: feedback
---

Cada item abaixo **aconteceu** durante a implementação da spec 001, em 2026-08-19. Nenhum foi
previsto; todos custaram uma rodada de diagnóstico. Ler antes de rodar as ferramentas.

## Testes

**`node --test <diretório>` não funciona.** O runner tenta carregar o diretório como módulo e falha
com `Cannot find module`. Use **glob entre aspas**:

```bash
node --test "packages/server/out/test/**/*.test.js"
```

**`npx vscode-test` roda contra o bundle que estiver em `dist/`.** Ele não reconstrói. O teste chegou
a reprovar apontando `Information` onde o código já dizia `Hint` — o bundle era de duas edições
atrás. Por isso `npm run test:integration` agora faz `npm run build &&` antes. **Use o script, não o
`npx` direto.**

**Nunca canalize a saída do teste.** `npm test | tail` devolve o código de saída do `tail`. Já
aconteceu aqui: `tsc` falhou e a linha seguinte imprimiu `exit: 0`.

**A medição de latência do laço de eventos é sensível à carga da máquina.** O `node:test` roda os
arquivos em processos paralelos e a instrumentação de cobertura pesa; sob isso, um teste de relógio
mede a máquina, não o desenho. A asserção principal desse teste é **determinística** — contar quantas
vezes a análise cedeu o controle —, e a de relógio ficou com teto folgado.

## Compilação

**`tsc --noEmit` conflita com `composite: true`.** Use `tsc --build`.

**`tsc --build` na raiz falha se algum workspace não tiver fonte** (`TS18003`). Enquanto
`packages/extension` estava vazio, era preciso compilar os workspaces explicitamente.

**Ordem importa:** `npm run typecheck` gera `out/` (que o manifesto usa) e `npm run build` gera
`dist/` (que o cliente carrega). O `F5` usa `npm: build` como `preLaunchTask` justamente por isso.

## Lint

**O ESLint varre `.vscode-test/`** — a instalação do VS Code que o teste de integração baixa — se
ela não estiver na lista de ignorados. São 14 MB de erro sobre código que não é nosso.

**Regra de lint mal escrita vira ruído.** A primeira versão da proibição de I/O síncrono usava
`Identifier[name=/Sync$/]` e reprovava `textDocumentSync`, nome de capacidade do LSP. Os seletores
agora casam **chamada e importação**, não identificador qualquer.

## A fronteira do motor NÃO é garantida pelo compilador

Omitir `vscode` e `@types/vscode` do `package.json` de `packages/server` **não impede** o import: com
workspaces do npm, `@types/vscode` é içado para o `node_modules` da raiz e a resolução de módulo do
TypeScript o encontra assim mesmo. `"types": ["node"]` governa só a inclusão **global** de `@types`.

Quem fecha a porta é `no-restricted-imports` no lint, restrito a `packages/server/**`.

## Encoding

**Configuração de workspace vence o `configurationDefaults` da extensão.** O
`.vscode/settings.json` deste repositório tem `files.encoding: utf8`, e sem a sobreposição por
linguagem (`"[advpl]": { "files.encoding": "windows1252" }`) a própria instância de desenvolvimento
leria as fixtures errado. **Não remover essas duas linhas.**

**Não engula falha ao ler pacote de tradução.** A primeira versão devolvia `{}` quando não achava o
arquivo; o servidor empacotado procurava no caminho errado e o painel de problemas exibiu
literalmente `rule.CA3001.message` ao usuário. Agora lança, com os caminhos procurados na mensagem.

## Git

**`core.autocrlf` está em `true` nesta máquina.** O `.gitattributes` marca
`packages/*/test/fixtures/** -text` — sem isso, as fixtures de fim de linha e de CP1252 nascem
normalizadas e os testes passam sobre conteúdo que ninguém escreveu.

**`git add -A` engole `analise-advpl/` como gitlink.** É repositório aninhado. Use
`git add -A -- . ':!analise-advpl'`.

## Shell

Heredoc do bash come barra invertida em expressão regular. Para script com `\\`, escreva o arquivo
com a ferramenta de escrita em vez de heredoc.
