import { defineConfig } from '@vscode/test-cli'

// Testes de integração: rodam dentro de uma instância real do VS Code.
//
// É o único jeito de exercitar o que só existe lá dentro — ativação restrita
// por linguagem, diagnóstico chegando ao painel de problemas, configuração
// fazendo efeito sem reiniciar. Tudo que NÃO precisa do editor é testado por
// `node:test`, que roda em milissegundos.
//
// O idioma NÃO é testado aqui, e a razão é do ambiente: o VS Code só honra
// `--locale` com o pacote de idioma instalado, o que traria dependência de rede
// para dentro de um portão local. Quem prova a tradução é
// `packages/server/test/protocol/locale.test.ts`, que fala LSP direto com o
// servidor — mais rápido, determinístico, e cobrindo os quatro idiomas em vez
// de um.
export default defineConfig([
  {
    label: 'integração',
    files: 'packages/extension/out/test/integration/**/*.test.js',
    extensionDevelopmentPath: 'packages/extension',
    workspaceFolder: 'packages/extension/test/fixtures/workspace',
    mocha: { ui: 'tdd', timeout: 60000 },
  },
])
