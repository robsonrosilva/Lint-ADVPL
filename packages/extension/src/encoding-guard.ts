import * as vscode from 'vscode'
import * as l10n from '@vscode/l10n'

import { SUPPORTED_LANGUAGES } from './languages'
import { REQUIRED_ENCODING, shouldWarnAboutEncoding } from './encoding-policy'

/**
 * Confere a codificação efetiva dos fontes ADVPL/TLPP e avisa uma vez por
 * sessão se ela estiver errada.
 *
 * A decisão de QUANDO avisar mora em `encoding-policy.ts`, testada sem editor.
 * Aqui fica só o que precisa da API do VS Code.
 */
export function registerEncodingGuard(context: vscode.ExtensionContext): void {
  let warned = false

  const check = (document: vscode.TextDocument): void => {
    if (!SUPPORTED_LANGUAGES.includes(document.languageId)) return

    const encoding = vscode.workspace
      .getConfiguration('files', document.uri)
      .get<string>('encoding')

    if (!shouldWarnAboutEncoding({ warned }, encoding)) return
    warned = true

    const fix = l10n.t('Corrigir para Windows-1252')
    void vscode.window
      .showWarningMessage(l10n.t('encoding.wrongEncoding'), fix)
      .then((choice) => {
        if (choice !== fix) return
        return vscode.workspace
          .getConfiguration('files', document.uri)
          .update('encoding', REQUIRED_ENCODING, vscode.ConfigurationTarget.Workspace)
      })
  }

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(check))
  // Documentos já abertos quando a extensão ativou também contam.
  for (const document of vscode.workspace.textDocuments) check(document)
}
