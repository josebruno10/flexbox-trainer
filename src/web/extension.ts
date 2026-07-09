import * as vscode from "vscode";
import { AuthService } from "./auth/authService";
import { ProvedorBarraLateralFlexBox } from "./provider/provedor-barra-lateral";
import { initializeLogger } from "./services/logger";
import { ehDocumentoDeTreino } from "./services/workspace";

export async function activate(context: vscode.ExtensionContext) {
  initializeLogger(context);

  const authService = new AuthService(context);
  await authService.inicializar();

  const provedor = new ProvedorBarraLateralFlexBox(
    context.extensionUri,
    authService,
  );

  context.subscriptions.push(authService);

  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri: async (uri: vscode.Uri) => {
        // Correção: Usa includes para evitar bugs com barras no final (trailing slashes)
        if (!uri.path.includes("/auth/callback")) {
          return;
        }

        try {
          await authService.processarCallback(uri);
          await vscode.commands.executeCommand(
            "workbench.view.extension.flexboxTrainer",
          );
          vscode.window.showInformationMessage(
            "Autenticação concluída com sucesso. Bem-vindo!",
          );
        } catch (error) {
          const mensagem =
            error instanceof Error ? error.message : "Falha na autenticação.";
          void vscode.window.showErrorMessage("Erro no Login: " + mensagem);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ProvedorBarraLateralFlexBox.viewType,
      provedor,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    ),
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (ehDocumentoDeTreino(document) && authService.isAutenticado()) {
        void provedor.atualizarPreviewWorkspace();
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("flexbox-trainer.login", async () => {
      await authService.abrirFluxoAutenticacao("login");
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "flexbox-trainer.criarConta",
      async () => {
        await authService.abrirFluxoAutenticacao("register");
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("flexbox-trainer.logout", async () => {
      await authService.logout();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("flexbox-trainer.iniciar", async () => {
      if (!authService.isAutenticado()) {
        await authService.abrirFluxoAutenticacao("login");
        await vscode.commands.executeCommand(
          "workbench.view.extension.flexboxTrainer",
        );
        vscode.window.showInformationMessage(
          "Você precisa criar uma conta ou fazer login para usar esta extensão.",
        );
        return;
      }

      await provedor.iniciarNovoDesafio();
      await provedor.atualizarPreviewWorkspace();
      await vscode.commands.executeCommand(
        "workbench.view.extension.flexboxTrainer",
      );
      vscode.window.showInformationMessage(
        "FlexBox Trainer aberto na barra lateral.",
      );
    }),
  );
}

export function deactivate() {}
