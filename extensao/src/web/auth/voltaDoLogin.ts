import * as vscode from "vscode";
import { COMANDO_ABRIR_BARRA } from "../provider/barraDeStatus";
import type { AuthService, ResultadoDoLogin } from "./authService";

// O fim do login no navegador, pelas duas voltas: o servidor local (VS Code
// desktop) e o endereço vscode:// (VS Code pelo navegador).

/** Recebe as duas voltas do login. */
export function registrarVoltaDoLogin(
  context: vscode.ExtensionContext,
  authService: AuthService,
): void {
  context.subscriptions.push(
    authService.onDidVoltarDoNavegador((resultado) => void voltarDoLogin(resultado)),
    vscode.window.registerUriHandler({
      handleUri: async (uri: vscode.Uri) => {
        const caminhoCallback = uri.path.replace(/\/+$/, "");
        if (
          uri.authority !== context.extension.id ||
          caminhoCallback !== "/auth/callback"
        ) {
          return;
        }

        try {
          await authService.processarCallback(uri);
          await voltarDoLogin({ ok: true });
        } catch (error) {
          await voltarDoLogin({
            ok: false,
            mensagem: error instanceof Error ? error.message : "Falha na autenticação.",
          });
        }
      },
    }),
  );
}

/**
 * Traz o VS Code para a frente, que ao fim do login é o navegador que está
 * lá, e mostra a barra lateral com quem entrou, ou o erro.
 */
export async function voltarDoLogin(resultado: ResultadoDoLogin): Promise<void> {
  // No VS Code pelo navegador, o comando não existe.
  await Promise.resolve(
    vscode.commands.executeCommand("workbench.action.focusWindow"),
  ).catch(() => undefined);

  if (!resultado.ok) {
    void vscode.window.showErrorMessage(`Erro no login: ${resultado.mensagem}`);
    return;
  }
  await vscode.commands.executeCommand(COMANDO_ABRIR_BARRA);
}
