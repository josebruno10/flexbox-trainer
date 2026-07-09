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
import { criarDesafioBase } from "../services/desafio";
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

  private desafioAtual: Desafio = criarDesafioBase();

  private resumoWorkspaceAtual: ResumoWorkspace = criarResumoWorkspaceVazio();

  private avaliacaoAtual?: ResultadoAvaliacao;

  private inicioTentativaMs = Date.now();

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
        void this.iniciarNovoDesafio(false);
        void this.atualizarPreviewWorkspace();
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

        if (!this.authService.isAutenticado()) {
          return;
        }

        if (mensagem.type === "novoDesafio") {
          void this.iniciarNovoDesafio();
          void this.atualizarPreviewWorkspace();
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
          void this.verificarTentativaAtual();
        }
      },
      undefined,
    );

    if (this.authService.isAutenticado()) {
      this.preparandoPasta = this.prepararPastaDoAluno();
      void this.atualizarPreviewWorkspace();
    }
  }

  public async iniciarNovoDesafio(confirmar = true): Promise<void> {
    if (!this.authService.isAutenticado()) {
      return;
    }

    if (confirmar) {
      const confirmacao = await vscode.window.showInformationMessage(
        "Deseja iniciar um novo desafio? O progresso atual será perdido.",
        { modal: true },
        "Sim",
      );

      if (confirmacao !== "Sim") {
        return;
      }
    }

    const configuracao = lerConfiguracaoServidor();

    console.log("[FlexBox Trainer] Iniciando novo desafio...");
    this.desafioAtual = {
      ...criarDesafioBase(),
      captureWidth: configuracao.captureWidth,
      captureHeight: configuracao.captureHeight,
    };
    this.avaliacaoAtual = undefined;
    this.codigoPastaAluno = undefined;
    this.inicioTentativaMs = Date.now();
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

  private async verificarTentativaAtual(): Promise<void> {
    if (!this.authService.isAutenticado()) {
      return;
    }

    try {
      if (
        !this.resumoWorkspaceAtual.temArquivoHtml ||
        !this.resumoWorkspaceAtual.temArquivoCss
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

      await this.preparandoPasta;

      if (!this.codigoPastaAluno) {
        this.avaliacaoAtual = {
          precision: 0,
          score: 0,
          source: "folder-error",
          error:
            "A pasta do aluno ainda não foi criada. Verifique a configuração do servidor.",
        };
        this.enviarEstado();
        return;
      }

      this.avaliacaoAtual = await avaliarTentativa({
        html: this.resumoWorkspaceAtual.textoHtml,
        css: this.resumoWorkspaceAtual.textoCss,
        elapsedMs: Date.now() - this.inicioTentativaMs,
        challengeId: this.desafioAtual.challengeId,
        seed: this.desafioAtual.seed,
        codigoPasta: this.codigoPastaAluno,
      });

      this.enviarEstado();
    } catch (error) {
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

    this.visualizacaoWebview.webview.postMessage({
      type: "dadosDesafio",
      payload: {
        ...this.desafioAtual,
        tempoAtualMs: Date.now() - this.inicioTentativaMs,
      },
    });

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
