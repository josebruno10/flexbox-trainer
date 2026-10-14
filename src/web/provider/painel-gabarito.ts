import * as vscode from "vscode";
import { Desafio } from "../types";
import { obterHtmlPainelGabarito } from "../webview/html";

type MensagemDoPainel =
  | { type: "pronto" }
  | { type: "copiar"; texto: unknown };

// Aba do editor com o gabarito e as medidas de todos os componentes, uma
// alternativa a clicar em cada componente na barra lateral estreita.
export class PainelGabarito implements vscode.Disposable {
  public static readonly viewType = "flexbox-trainer.gabarito";

  private painel?: vscode.WebviewPanel;

  private desafio?: Desafio;

  // HTML da página do aluno, para comparar com o gabarito.
  private htmlAluno?: string;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly copiar: (texto: string) => Thenable<void> = (texto) =>
      vscode.env.clipboard.writeText(texto),
  ) {}

  public mostrar(desafio: Desafio | undefined, htmlAluno?: string): void {
    this.desafio = desafio;
    this.htmlAluno = htmlAluno;

    if (this.painel) {
      this.painel.reveal(this.painel.viewColumn ?? vscode.ViewColumn.Beside);
      this.enviarDesafio();
      this.enviarPagina();
      return;
    }

    const painel = vscode.window.createWebviewPanel(
      PainelGabarito.viewType,
      "Gabarito",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, "dist"),
          vscode.Uri.joinPath(this.extensionUri, "media"),
        ],
      },
    );
    painel.iconPath = vscode.Uri.joinPath(
      this.extensionUri,
      "resources",
      // Na aba o ícone aparece com as cores dele; o SVG da barra de
      // atividades é só um molde.
      "icone.png",
    );
    painel.webview.html = obterHtmlPainelGabarito(
      painel.webview,
      this.extensionUri,
    );
    painel.webview.onDidReceiveMessage((mensagem: MensagemDoPainel) => {
      if (mensagem.type === "pronto") {
        this.enviarDesafio();
        this.enviarPagina();
        return;
      }

      // Só valores curtos vindos da própria aba: medidas e cores.
      if (
        mensagem.type === "copiar" &&
        typeof mensagem.texto === "string" &&
        mensagem.texto.length <= 40
      ) {
        void this.copiar(mensagem.texto);
        vscode.window.setStatusBarMessage(`Copiado: ${mensagem.texto}`, 2500);
      }
    });
    painel.onDidDispose(() => {
      this.painel = undefined;
    });
    this.painel = painel;
  }

  /** Acompanha o desafio da barra lateral; não abre a aba se ela estiver fechada. */
  public atualizar(desafio: Desafio | undefined): void {
    this.desafio = desafio;
    this.enviarDesafio();
  }

  /** A página do aluno mudou (arquivos salvos ou relidos). */
  public atualizarPagina(htmlAluno: string | undefined): void {
    if (htmlAluno === this.htmlAluno) {
      return;
    }

    this.htmlAluno = htmlAluno;
    this.enviarPagina();
  }

  public dispose(): void {
    this.painel?.dispose();
  }

  private enviarPagina(): void {
    void this.painel?.webview.postMessage({
      type: "paginaAluno",
      payload: this.htmlAluno ?? null,
    });
  }

  private enviarDesafio(): void {
    const desafio = this.desafio;
    void this.painel?.webview.postMessage({
      type: "desafio",
      payload: desafio
        ? {
            challengeId: desafio.challengeId,
            width: desafio.width,
            height: desafio.height,
            backgroundColor: desafio.backgroundColor,
            blocks: desafio.blocks,
          }
        : null,
    });
  }
}
