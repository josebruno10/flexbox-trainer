import * as vscode from "vscode";

/**
 * A barra lateral aberta no VS Code: guarda a visualização, sabe quando o
 * script dela carregou e segura o pedido de Verificar até ela poder medir.
 */
export class VistaDaBarra {
  public visualizacao?: vscode.WebviewView;

  // A verificação mede a página dentro da barra lateral: o atalho só a pede
  // quando o script da barra já carregou.
  private pronta = false;
  private verificarQuandoPronta = false;

  public conectar(visualizacao: vscode.WebviewView): void {
    this.visualizacao = visualizacao;
    visualizacao.webview.options = { enableScripts: true };
    visualizacao.onDidDispose(() => {
      this.pronta = false;
      this.visualizacao = undefined;
    });
    visualizacao.onDidChangeVisibility(() => this.enviarVerificacaoPendente());
  }

  public get webview(): vscode.Webview | undefined {
    return this.visualizacao?.webview;
  }

  public postar(mensagem: unknown): void {
    void this.visualizacao?.webview.postMessage(mensagem);
  }

  /** HTML novo recarrega o script da barra; ele avisa de novo quando carregar. */
  public renderizar(html: (webview: vscode.Webview) => string): void {
    if (!this.visualizacao) {
      return;
    }
    const webview = this.visualizacao.webview;
    const novo = html(webview);
    // Com o mesmo HTML, o VS Code não recarrega a barra: o script continua
    // carregado e não avisa de novo. Marcar a barra como não pronta aqui
    // prendia para sempre o Verificar do atalho e da aba do gabarito (a
    // sessão revalidada ao abrir redesenha a barra com o mesmo HTML).
    if (webview.html === novo) {
      return;
    }
    this.pronta = false;
    webview.html = novo;
  }

  /** O script da barra carregou: daqui em diante ela já pode medir. */
  public marcarPronta(): void {
    this.pronta = true;
  }

  /** O atalho pediu Verificar: vai assim que a barra carregar e aparecer. */
  public guardarVerificacao(): void {
    this.verificarQuandoPronta = true;
  }

  public esquecerVerificacao(): void {
    this.verificarQuandoPronta = false;
  }

  // Escondida, a barra não mede a página: o pedido espera ela aparecer.
  public enviarVerificacaoPendente(): void {
    if (!this.verificarQuandoPronta || !this.pronta || !this.visualizacao?.visible) {
      return;
    }
    this.verificarQuandoPronta = false;
    void this.visualizacao.webview.postMessage({ type: "verificar" });
  }
}
