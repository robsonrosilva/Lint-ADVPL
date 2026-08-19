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

**Teste de relógio dentro da suíte paralela mede a MÁQUINA, não o desenho** — e nenhuma calibragem
conserta isso. Duas formulações do mesmo teste caíram, cada uma por um motivo diferente:

- `maxGap < 250` (teto absoluto) passou por meses e reprovou no dia em que a suíte cresceu de 139
  para 352 testes em processos paralelos, acusando 448 ms de contenção como se fosse bloqueio.
- `ticks >= 10` (contar cessões) **parecia** determinística e não era: o motor cede a cada ~10 ms de
  trabalho, então máquina mais RÁPIDA cede MENOS vezes. Em máquina ociosa deu 5 cessões e reprovou
  por ser rápida demais.

**O que funciona é uma RAZÃO auto-referente**: `maxGap < total * 0.6` — nenhum bloco contínuo domina
a análise. Máquina lenta sobe os dois lados e a razão se mantém.

Medido em máquina ociosa, para referência: análise de 25.000 linhas com 60 regras leva 88,8 ms, cede
5 vezes, e o maior bloqueio é **29,8 ms** — dentro dos 50 ms do Princípio I. Esse número absoluto só
é aferível FORA da suíte; dentro dela, não tente.

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

## VS Code

**O painel de Problemas NÃO lista diagnóstico de severidade `Hint`.** Ele mostra `Error`, `Warning` e
`Information`. Um `Hint` aparece só como sublinhado pontilhado discreto no editor e pelo balão ao
passar o mouse. Custou uma sessão inteira de diagnóstico: `CA3001` foi rebaixada a `Hint` por volume
medido e a extensão passou a parecer quebrada — abrir um fonte real com seis violações não mostrava
nada. **Ao escolher severidade, conferir como o editor EXIBE aquela severidade**, não só quanto a
regra dispara.

**A instância de desenvolvimento (F5) roda com `--disable-extensions`.** Todas as outras extensões
ficam desligadas nela. Isso é ótimo para isolar o comportamento — e é o teste decisivo para saber em
que janela se está: se um diagnóstico de outra extensão aparece no painel, **não** é a janela de
desenvolvimento, e portanto a extensão nova não está rodando ali. Ela não está instalada no VS Code
normal; só existe sob F5 ou empacotada em `.vsix`.

## Git — o `.gitignore` é por branch, e isso morde

**Commitar numa branch antiga sem rodar o portão deixa passar o que o portão pegaria.** Aconteceu em
2026-08-19: dois arquivos de fixture GERADOS entraram no repositório num commit feito na branch da
spec 002, porque ali o `.gitignore` ainda era o antigo — o padrão corrigido
(`packages/*/test/fixtures/**/generated/`) só existia na branch da 001. O `git add -A` os pegou, e
como não rodei `npm run verify` naquele commit, ninguém avisou.

Quem encontrou foi o `check:corpus`, na primeira vez que o portão rodou naquela branch — depois de a
master ser mergeada para dentro dela.

**Regra prática: rodar `npm run verify` antes de commitar, em QUALQUER branch.** O hábito de confiar
no portão só na branch principal é o que deixa a brecha; o `.gitignore` viaja com a branch, e uma
branch antiga tem regras antigas.
