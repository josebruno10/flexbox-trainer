import * as vscode from "vscode";
import { AuthService } from "../auth/authService";
import { LoginProvider } from "../auth/loginProvider";
import {
  Desafio,
  EstadoAutenticacao,
  MensagemRecebidaBarraLateral,
  ResumoWorkspace,
  ResultadoAvaliacao,
  StatusConexaoServidor,
} from "../types";
import { criarDesafioGerado } from "../services/desafio";
import {
  criarResumoWorkspaceVazio,
  lerResumoWorkspace,
} from "../services/workspace";
import { avaliarTentativa } from "../services/avaliacao";
import {
  criarPastaDoAluno,
  lerConfiguracaoServidor,
  temConfiguracaoServidorMinima,
  verificarConexaoServidor,
} from "../services/servidor";
import { obterHtmlAutenticacao, obterHtmlWebview } from "../webview/html";

export class ProvedorBarraLateralFlexBox implements vscode.WebviewViewProvider {
  public static readonly viewType = "flexbox-trainer.sidebar";

  private readonly extensionUri: vscode.Uri;

  private readonly authService: AuthService;

  private readonly loginProvider: LoginProvider;

  private visualizacaoWebview?: vscode.WebviewView;

  private desafioAtual?: Desafio;

  private gabaritoAtual?: {
    challengeId: string;
    imagemDataUrl: string;
    width: number;
    height: number;
  };

  private resumoWorkspaceAtual: ResumoWorkspace = criarResumoWorkspaceVazio();

  private avaliacaoAtual?: ResultadoAvaliacao;

  private inicioTentativaMs = Date.now();

  private fimTentativaMs?: number;

  private codigoPastaAluno?: string;

  private preparandoPasta: Promise<void> = Promise.resolve();

  private estadoAutenticacao: EstadoAutenticacao;

  public constructor(extensionUri: vscode.Uri, authService: AuthService) {
    this.extensionUri = extensionUri;
    this.authService = authService;
    this.loginProvider = new LoginProvider(authService);
    this.estadoAutenticacao = authService.getEstadoAtual();

    this.authService.onDidChangeEstado((estado) => {
      this.estadoAutenticacao = estado;
      this.renderizarWebviewAtual();

      if (estado.status === "authenticated") {
        void this.atualizarPreviewWorkspace();
      } else if (estado.status === "unauthenticated") {
        this.desafioAtual = undefined;
        this.fimTentativaMs = undefined;
        this.gabaritoAtual = undefined;
        this.avaliacaoAtual = undefined;
      }

      this.enviarEstado();
    });
  }

  public resolveWebviewView(
    visualizacaoWebview: vscode.WebviewView,
  ): void | Thenable<void> {
    this.visualizacaoWebview = visualizacaoWebview;
    visualizacaoWebview.webview.options = { enableScripts: true };
    this.renderizarWebviewAtual();

    visualizacaoWebview.webview.onDidReceiveMessage(
      (mensagem: MensagemRecebidaBarraLateral) => {
        if (mensagem.type === "pronto") {
          this.enviarEstado();

          if (this.authService.isAutenticado()) {
            void this.atualizarPreviewWorkspace();
          }

          return;
        }

        if (mensagem.type === "abrirLogin") {
          void this.loginProvider.abrirLogin();
          return;
        }

        if (mensagem.type === "abrirCadastro") {
          void this.loginProvider.abrirCadastro();
          return;
        }

        if (mensagem.type === "loginGitHub") {
          void this.authService.loginComProvedorVSCode("github");
          return;
        }

        if (mensagem.type === "loginMicrosoft") {
          void this.authService.loginComProvedorVSCode("microsoft");
          return;
        }

        if (mensagem.type === "loginGoogle") {
          void this.authService.abrirLoginGoogle();
          return;
        }

        if (mensagem.type === "revalidarSessao") {
          void this.loginProvider.revalidarSessao();
          return;
        }

        if (mensagem.type === "logout") {
          void this.loginProvider.sair();
          return;
        }

        if (mensagem.type === "gabaritoGerado") {
          if (
            mensagem.challengeId === this.desafioAtual?.challengeId &&
            mensagem.width === this.desafioAtual.width &&
            mensagem.height === this.desafioAtual.height &&
            mensagem.imagemDataUrl.startsWith("data:image/png;base64,")
          ) {
            this.gabaritoAtual = {
              challengeId: mensagem.challengeId,
              imagemDataUrl: mensagem.imagemDataUrl,
              width: mensagem.width,
              height: mensagem.height,
            };
            console.log(
              `[FlexBox Trainer] Gabarito PNG gerado: ${mensagem.challengeId} (${mensagem.width}x${mensagem.height})`,
            );
          }
          return;
        }

        if (!this.authService.isAutenticado()) {
          return;
        }

        if (mensagem.type === "novoDesafio") {
          void this.iniciarNovoDesafio();
          void this.atualizarPreviewWorkspace();
          return;
        }

        if (mensagem.type === "encerrarDesafio") {
          this.encerrarDesafioAtual();
          return;
        }

        if (mensagem.type === "testarConexao") {
          void this.testarConexaoServidor();
          return;
        }

        if (mensagem.type === "atualizarPreview") {
          void this.atualizarPreviewWorkspace();
          return;
        }

        if (mensagem.type === "solicitarVerificacao") {
          if (mensagem.challengeId !== this.desafioAtual?.challengeId) {
            return;
          }

          void this.verificarTentativaAtual(mensagem.challengeId);
        }
      },
      undefined,
    );

    if (this.authService.isAutenticado()) {
      this.preparandoPasta = this.prepararPastaDoAluno();
      void this.atualizarPreviewWorkspace();
    }
  }

  public async iniciarNovoDesafio(): Promise<void> {
    if (!this.authService.isAutenticado()) {
      return;
    }

    const configuracao = lerConfiguracaoServidor();

    console.log("[FlexBox Trainer] Iniciando novo desafio...");
    this.desafioAtual = {
      ...criarDesafioGerado(),
      captureWidth: configuracao.captureWidth,
      captureHeight: configuracao.captureHeight,
    };
    this.gabaritoAtual = undefined;
    this.avaliacaoAtual = undefined;
    this.codigoPastaAluno = undefined;
    this.inicioTentativaMs = Date.now();
    this.fimTentativaMs = undefined;
    this.preparandoPasta = this.prepararPastaDoAluno();
    this.enviarEstado();
    void this.testarConexaoServidor();
  }

  public async atualizarPreviewWorkspace(): Promise<void> {
    if (!this.authService.isAutenticado()) {
      return;
    }

    this.resumoWorkspaceAtual = await lerResumoWorkspace();
    this.enviarEstado();
  }

  private encerrarDesafioAtual(): void {
    if (!this.desafioAtual || this.fimTentativaMs !== undefined) {
      return;
    }

    this.fimTentativaMs = Date.now();
    this.enviarEstado();
  }

  private async verificarTentativaAtual(challengeId: string): Promise<void> {
    if (!this.authService.isAutenticado()) {
      return;
    }

    if (!this.desafioAtual || this.desafioAtual.challengeId !== challengeId) {
      return;
    }

    const preparandoPasta = this.preparandoPasta;
    const inicioTentativaMs = this.inicioTentativaMs;
    const fimTentativaMs = this.fimTentativaMs;
    const instanteVerificacaoMs = Date.now();
    const desafioAindaEhAtual = (): boolean =>
      this.desafioAtual?.challengeId === challengeId;

    try {
      // A verificação sempre relê os arquivos; assim, um atraso ou falha na
      // atualização visual da webview não envia uma versão antiga ao servidor.
      const resumoLido = await lerResumoWorkspace();
      const resumoWorkspace =
        resumoLido.temArquivoHtml && resumoLido.temArquivoCss
          ? resumoLido
          : this.resumoWorkspaceAtual;

      if (!desafioAindaEhAtual()) {
        return;
      }

      this.resumoWorkspaceAtual = resumoWorkspace;

      if (
        !resumoWorkspace.temArquivoHtml ||
        !resumoWorkspace.temArquivoCss
      ) {
        this.avaliacaoAtual = {
          precision: 0,
          score: 0,
          source: "missing-files",
          error: "Abra ou crie index.html e style.css na pasta do projeto.",
        };
        this.enviarEstado();
        return;
      }

      await preparandoPasta;

      if (!desafioAindaEhAtual()) {
        return;
      }

      const codigoPasta = this.codigoPastaAluno;

      const resultadoServidor = await avaliarTentativa({
        html: resumoWorkspace.textoHtml,
        css: resumoWorkspace.textoCss,
        elapsedMs:
          (fimTentativaMs ?? instanteVerificacaoMs) - inicioTentativaMs,
        challengeId,
        codigoPasta,
      });

      if (!desafioAindaEhAtual()) {
        return;
      }

      this.avaliacaoAtual = resultadoServidor;

      this.enviarEstado();
    } catch (error) {
      if (!desafioAindaEhAtual()) {
        return;
      }

      const mensagem =
        error instanceof Error ? error.message : "Erro desconhecido";
      this.avaliacaoAtual = {
        precision: 0,
        score: 0,
        source: "api-error",
        error: mensagem,
      };
      this.enviarEstado();
    }
  }

  private async prepararPastaDoAluno(): Promise<void> {
    if (!this.authService.isAutenticado()) {
      this.codigoPastaAluno = undefined;
      return;
    }

    const configuracao = lerConfiguracaoServidor();

    if (!temConfiguracaoServidorMinima(configuracao)) {
      this.codigoPastaAluno = undefined;
      return;
    }

    try {
      this.codigoPastaAluno = await criarPastaDoAluno(configuracao);
      console.log(
        `[FlexBox Trainer] Pasta criada com sucesso no servidor! Código: ${this.codigoPastaAluno}`,
      );
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Erro desconhecido";
      this.codigoPastaAluno = undefined;
      this.avaliacaoAtual = {
        precision: 0,
        score: 0,
        source: "folder-error",
        error: `Falha ao preparar a pasta do aluno: ${mensagem}`,
      };
      this.enviarEstado();
    }
  }

  private async testarConexaoServidor(): Promise<void> {
    const configuracao = lerConfiguracaoServidor();
    let status: StatusConexaoServidor;

    try {
      const mensagem = await verificarConexaoServidor(configuracao);
      status = { ok: true, mensagem };
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Erro desconhecido";
      status = { ok: false, mensagem };
    }

    void this.visualizacaoWebview?.webview.postMessage({
      type: "statusServidor",
      payload: status,
    });
  }

  private enviarEstado(): void {
    if (!this.visualizacaoWebview) {
      return;
    }

    this.visualizacaoWebview.webview.postMessage({
      type: "estadoAutenticacao",
      payload: this.estadoAutenticacao,
    });

    if (!this.authService.isAutenticado()) {
      return;
    }

    if (this.desafioAtual) {
      this.visualizacaoWebview.webview.postMessage({
        type: "dadosDesafio",
        payload: {
          ...this.desafioAtual,
          tempoAtualMs:
            (this.fimTentativaMs ?? Date.now()) - this.inicioTentativaMs,
          encerrado: this.fimTentativaMs !== undefined,
        },
      });
    }

    this.visualizacaoWebview.webview.postMessage({
      type: "dadosWorkspace",
      payload: this.resumoWorkspaceAtual,
    });

    if (this.avaliacaoAtual) {
      this.visualizacaoWebview.webview.postMessage({
        type: "resultadoAvaliacao",
        payload: this.avaliacaoAtual,
      });
    }
  }

  private renderizarWebviewAtual(): void {
    if (!this.visualizacaoWebview) {
      return;
    }

    if (this.authService.isAutenticado()) {
      this.visualizacaoWebview.webview.html = obterHtmlWebview(
        this.visualizacaoWebview.webview,
        this.extensionUri,
        this.authService.getSessaoAtual()?.displayName,
      );
      return;
    }

    this.visualizacaoWebview.webview.html = obterHtmlAutenticacao(
      this.visualizacaoWebview.webview,
      this.extensionUri,
    );
  }
}
