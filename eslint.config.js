// Configuração de lint. Além do básico, ela existe para transformar duas regras
// do Princípio I em erro de build em vez de item de revisão — as duas foram
// defeitos MEDIDOS no legado, com arquivo e linha registrados na constituição.

const tseslint = require('typescript-eslint')

module.exports = tseslint.config(
  {
    ignores: ['**/out/**', '**/node_modules/**', '**/*.d.ts', 'analise-advpl/**'],
  },
  ...tseslint.configs.recommended,
  {
    // O MOTOR é o caminho quente. Aqui as duas proibições do Princípio I valem
    // sem exceção: qualquer I/O síncrono e qualquer log direto reprovam.
    files: ['packages/server/**/*.ts'],
    rules: {
      // A fronteira do Princípio I: "a camada VS Code é fina e não analisa
      // nada". O motor não pode conhecer a API do editor.
      //
      // MEDIDO em 2026-08-19: deixar `vscode` fora do package.json do server
      // NÃO basta. Com workspaces do npm, @types/vscode é içado para o
      // node_modules da raiz, e a resolução de módulo do TypeScript o encontra
      // de qualquer forma — `types: ["node"]` só governa a inclusão global de
      // @types, não a resolução de `import 'vscode'`. O lint é o que realmente
      // fecha esta porta.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'vscode',
              message:
                'O motor NEVER importa a API do editor (Princípio I). Se o ' +
                'servidor precisa de algo do VS Code, isso chega pelo LSP.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/server/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // `readFileSync`, `writeFileSync`, `statSync`, `existsSync`...
          // Legado: validaProjeto.ts:124 e :189 chamavam readFileSync e
          // statSync uma vez por fonte do projeto.
          selector: 'Identifier[name=/Sync$/]',
          message:
            'I/O síncrono é proibido no caminho de análise (Princípio I). ' +
            'Use a variante assíncrona.',
        },
        {
          // Legado: 66 chamadas de console.log no motor, sem nível e sem chave
          // de desligamento — mais um console.log POR LINHA de cada arquivo em
          // validaAdvpl.ts:121-124.
          selector: "MemberExpression[object.name='console']",
          message:
            'Log direto é proibido no caminho quente (Princípio I). ' +
            'Use o canal de log com nível, que nasce desligado.',
        },
      ],
    },
  },
  {
    // Testes podem usar o que precisarem para montar cenário; eles não rodam
    // no caminho de análise do usuário.
    files: ['packages/*/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
