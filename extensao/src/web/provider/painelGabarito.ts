import * as vscode from "vscode";
import { Desafio, ResultadoNaAba } from "../types";
import { obterHtmlPainelGabarito } from "../telas/painelGabarito";

type MensagemDoPainel =
  | { type: "pronto" }
  | { type: "copiar"; texto: unknown }
  | { type: "verificar" };

/** A verificação em andamento, com a etapa que a barra lateral mostra. */
export type VerificacaoNaAba = { andamento: boolean; etapa?: string };

// Aba do editor com o gabarito e as medidas de todos os componentes, uma
// alternativa a clicar em cada componente na barra lateral estreita.
export class PainelGabarito implements vscode.Disposable {
  public static readonly viewType = "flexbox-trainer.gabarito";

  private painel?: vscode.WebviewPanel;

  private desafio?: Desafio;

  // HTML da página do aluno, para comparar com o gabarito.
  private htmlAluno?: string;

  private resultado?: ResultadoNaAba;

  private verificacao: VerificacaoNaAba = { andamento: false };

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly copiar: (texto: string) => Thenable<void> = (texto) =>
      vscode.env.clipboard.writeText(texto),
    // A medição é feita na barra lateral: o comando a abre e pede a
    // verificação a ela, como o atalho.
    private readonly verificar: () => Thenable<unknown> = () =>
      vscode.commands.executeCommand("flexbox-trainer.verificar"),
  ) {}

  public mostrar(desafio: Desafio | undefined, htmlAluno?: string): void {
    this.desafio = desafio;
    this.htmlAluno = htmlAluno;

    if (this.painel) {
      this.painel.reveal(this.painel.viewColumn ?? vscode.ViewColumn.Beside);
      this.enviarDesafio();
      this.enviarPagina();
      this.enviarResultado();
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
        this.enviarResultado();
        return;
      }

      if (mensagem.type === "verificar") {
        void this.verificar();
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
  /** Redesenha a aba com as cores escolhidas; ela pede o desafio de novo. */
  public aplicarCores(): void {
    if (this.painel) {
      this.painel.webview.html = obterHtmlPainelGabarito(
        this.painel.webview,
        this.extensionUri,
      );
    }
  }

  public atualizarPagina(htmlAluno: string | undefined): void {
    if (htmlAluno === this.htmlAluno) {
      return;
    }

    this.htmlAluno = htmlAluno;
    this.enviarPagina();
  }

  /** A nota do desafio mudou (ou o desafio). */
  public atualizarResultado(resultado: ResultadoNaAba | undefined): void {
    this.resultado = resultado;
    this.enviarResultado();
  }

  /** As etapas da verificação, como na barra lateral. */
  public avisarVerificacao(verificacao: VerificacaoNaAba): void {
    this.verificacao = verificacao;
    this.enviarResultado();
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

  private enviarResultado(): void {
    void this.painel?.webview.postMessage({
      type: "resultado",
      payload: { resultado: this.resultado ?? null, verificacao: this.verificacao },
    });
  }

  private enviarDesafio(): void {
    const desafio = this.desafio;
    void this.painel?.webview.postMessage({
      type: "desafio",
      payload: desafio
        ? {
            challengeId: desafio.challengeId,
            codigo: desafio.codigo,
            nivel: desafio.nivel,
            width: desafio.width,
            height: desafio.height,
            backgroundColor: desafio.backgroundColor,
            blocks: desafio.blocks,
          }
        : null,
    });
  }
}
