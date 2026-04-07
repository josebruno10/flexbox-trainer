import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const comandoIniciar = vscode.commands.registerCommand(
    "flexbox-trainer.iniciar",
    () => {
      vscode.window.showInformationMessage(
        "FlexBox Trainer iniciado com sucesso.",
      );
    },
  );

  context.subscriptions.push(comandoIniciar);
}

export function deactivate() {}
