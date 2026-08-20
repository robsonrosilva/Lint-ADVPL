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
// ⚠️ A LISTA É ORDENADA, e a ordem é requisito — não estilo.
//
// `activation.test.js` mede a PRIMEIRA ativação da extensão na sessão, que é a
// única medição possível do orçamento do Princípio I. Qualquer arquivo que abra
// um fonte ADVPL antes dele dispara `onLanguage`, a extensão ativa por fora, e
// a medição vira uma corrida perdida.
//
// Um glob não serve: `glob` NÃO devolve os arquivos em ordem alfabética.
// Medido em 2026-08-20, nesta máquina — o padrão `**/*.test.js` devolveu
// `code-actions.test.js` ANTES de `activation.test.js`, e os dois testes de
// ativação reprovaram na hora. Enquanto havia um arquivo só, a fragilidade não
// tinha como aparecer.
//
// Arquivo novo que fique de fora desta lista não roda, e ninguém avisa — por
// isso `packages/tooling/test/checks/verify-gate.test.ts` confere que toda
// suíte de integração versionada está declarada aqui.
export default defineConfig([
  {
    label: 'integração',
    files: [
      'packages/extension/out/test/integration/activation.test.js',
      'packages/extension/out/test/integration/code-actions.test.js',
      'packages/extension/out/test/integration/pj0001.test.js',
    ],
    extensionDevelopmentPath: 'packages/extension',
    workspaceFolder: 'packages/extension/test/fixtures/workspace',
    mocha: { ui: 'tdd', timeout: 60000 },
  },
])
