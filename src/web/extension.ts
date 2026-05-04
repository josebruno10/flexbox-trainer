import * as vscode from "vscode";
import { ProvedorBarraLateralFlexBox } from "./provider/provedor-barra-lateral";
import { ehDocumentoDeTreino } from "./services/workspace";

// ponto de entrada da extensão.
export function activate(context: vscode.ExtensionContext) {
  // instancia o provider que controla a sidebar.
  const provedor = new ProvedorBarraLateralFlexBox();

  // registra a view lateral da extensão.
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

  // atualiza preview ao salvar html/css de treino.
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (ehDocumentoDeTreino(document)) {
        void provedor.atualizarPreviewWorkspace();
      }
    }),
  );

  // comando principal para abrir a lateral e iniciar um novo desafio.
  context.subscriptions.push(
    vscode.commands.registerCommand("flexbox-trainer.iniciar", async () => {
      provedor.iniciarNovoDesafio();
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

// ponto de desligamento da extensão.
export function deactivate() {}
