import * as vscode from "vscode";
import { AuthService } from "./auth/authService";
import { ProvedorBarraLateralFlexBox } from "./provider/provedor-barra-lateral";
import { gerarSolucaoAbsoluta, gerarSolucaoFlexbox } from "./services/solucao";
import { criarDinamicaTreinoInterativa } from "./services/dinamicaTreino";
import { initializeLogger } from "./services/logger";
import {
  ehDocumentoDeTreino,
  escreverArquivosDeTreino,
} from "./services/workspace";

export async function activate(context: vscode.ExtensionContext) {
  initializeLogger(context);

  const authService = new AuthService(context);
  const provedor = new ProvedorBarraLateralFlexBox(
    context.extensionUri,
    authService,
    context.globalState,
  );

  context.subscriptions.push(authService);

  context.subscriptions.push(
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
    vscode.commands.registerCommand(
      "flexbox-trainer.criarDinamicaTreino",
      async () => {
        await criarDinamicaTreinoInterativa(authService);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "flexbox-trainer.gerarSolucaoTeste",
      async () => {
        const desafio = provedor.obterDesafioAtual();

        if (!desafio) {
          void vscode.window.showInformationMessage(
            "Gere um desafio na barra lateral antes de gerar a solução.",
          );
          return;
        }

        const montagem = await vscode.window.showQuickPick(
          [
            {
              label: "Flexbox",
              description: "display: flex, gap, padding e alinhamento; sem position",
              gerar: gerarSolucaoFlexbox,
            },
            {
              label: "Posição absoluta",
              description: "cada bloco com left e top dentro do pai",
              gerar: gerarSolucaoAbsoluta,
            },
          ],
          {
            title: "Gerar solução exata do desafio (teste)",
            placeHolder: "Como montar o HTML/CSS?",
          },
        );

        if (!montagem) {
          return;
        }

        const confirmacao = await vscode.window.showWarningMessage(
          "Substituir index.html e style.css pela solução exata do desafio atual?",
          {
            modal: true,
            detail: `Montagem: ${montagem.label}. Serve só para testar se a correção chega a 100%.`,
          },
          "Substituir",
        );

        if (confirmacao !== "Substituir") {
          return;
        }

        try {
          const { html, css } = montagem.gerar(desafio);
          await escreverArquivosDeTreino(html, css);
          await provedor.atualizarPreviewWorkspace();
          void vscode.window.showInformationMessage(
            "Solução exata gravada em index.html e style.css. Clique em Verificar.",
          );
        } catch (error) {
          const mensagem =
            error instanceof Error ? error.message : "Erro desconhecido";
          void vscode.window.showErrorMessage(
            `Não foi possível gravar a solução: ${mensagem}`,
          );
        }
      },
    ),
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

      await provedor.atualizarPreviewWorkspace();
      await vscode.commands.executeCommand(
        "workbench.view.extension.flexboxTrainer",
      );
      vscode.window.showInformationMessage(
        "Gere desafios aleatórios na barra lateral até escolher o que deseja treinar.",
      );
    }),
  );

  // A barra lateral e os comandos precisam estar disponíveis mesmo quando o
  // armazenamento seguro ou a API de autenticação estiverem lentos/offline.
  // A inicialização da sessão atualiza a webview assim que for concluída.
  void authService.inicializar();
}

export function deactivate() {}
