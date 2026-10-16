import * as vscode from "vscode";
import { obterHtmlAtalhos } from "../telas/atalhos";

// A aba Atalhos, ao lado do editor: abre uma vez e volta para frente nos
// pedidos seguintes.
export class PainelAtalhos implements vscode.Disposable {
  public static readonly viewType = "flexbox-trainer.atalhos";

  private painel?: vscode.WebviewPanel;

  public constructor(private readonly extensionUri: vscode.Uri) {}

  public mostrar(): void {
    if (this.painel) {
      this.painel.reveal(this.painel.viewColumn ?? vscode.ViewColumn.Beside);
      return;
    }

    const painel = vscode.window.createWebviewPanel(
      PainelAtalhos.viewType,
      "Atalhos",
      vscode.ViewColumn.Beside,
      {
        enableScripts: false,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
      },
    );
    painel.iconPath = vscode.Uri.joinPath(this.extensionUri, "resources", "icone.png");
    painel.webview.html = obterHtmlAtalhos(painel.webview, this.extensionUri);
    painel.onDidDispose(() => {
      this.painel = undefined;
    });
    this.painel = painel;
  }

  /** Redesenha a aba com as cores escolhidas. */
  public aplicarCores(): void {
    if (this.painel) {
      this.painel.webview.html = obterHtmlAtalhos(this.painel.webview, this.extensionUri);
    }
  }

  public dispose(): void {
    this.painel?.dispose();
  }
}
