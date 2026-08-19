import { defineConfig } from '@vscode/test-cli'

// Testes de integração: rodam dentro de uma instância real do VS Code.
//
// É o único jeito de exercitar o que só existe lá dentro — ativação restrita
// por linguagem, diagnóstico chegando ao painel de problemas, configuração
// fazendo efeito sem reiniciar. Tudo que NÃO precisa do editor é testado por
// `node:test`, que roda em milissegundos.
export default defineConfig({
  files: 'packages/extension/out/test/integration/**/*.test.js',
  extensionDevelopmentPath: 'packages/extension',
  workspaceFolder: 'packages/extension/test/fixtures/workspace',
  mocha: {
    ui: 'tdd',
    timeout: 60000,
  },
})
