import * as vscode from "vscode";
import {
  Desafio,
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
import { obterHtmlWebview } from "../webview/html";

// provider responsável por gerenciar estado e comunicação da sidebar.
export class ProvedorBarraLateralFlexBox implements vscode.WebviewViewProvider {
  public static readonly viewType = "flexbox-trainer.sidebar";

  private readonly extensionUri: vscode.Uri;

  private visualizacaoWebview?: vscode.WebviewView;

  private desafioAtual: Desafio = criarDesafioBase();

  private resumoWorkspaceAtual: ResumoWorkspace = criarResumoWorkspaceVazio();

  private avaliacaoAtual?: ResultadoAvaliacao;

  private inicioTentativaMs = Date.now();

  private codigoPastaAluno?: string;

  private preparandoPasta: Promise<void> = Promise.resolve();

  public constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  public resolveWebviewView(
    visualizacaoWebview: vscode.WebviewView,
  ): void | Thenable<void> {
    this.visualizacaoWebview = visualizacaoWebview;
    visualizacaoWebview.webview.options = { enableScripts: true };
    visualizacaoWebview.webview.html = obterHtmlWebview(
      visualizacaoWebview.webview,
      this.extensionUri,
    );

    visualizacaoWebview.webview.onDidReceiveMessage(
      (mensagem: MensagemRecebidaBarraLateral) => {
        if (mensagem.type === "pronto") {
          void this.atualizarPreviewWorkspace();
          this.enviarEstado();
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
          return;
        }
      },
      undefined,
    );

    this.preparandoPasta = this.prepararPastaDoAluno();
    void this.atualizarPreviewWorkspace();
  }

  public async iniciarNovoDesafio(): Promise<void> {
    const confirmacao = await vscode.window.showInformationMessage(
      "Deseja iniciar um novo desafio? O progresso atual será perdido.",
      { modal: true },
      "Sim",
    );

    if (confirmacao !== "Sim") {
      return;
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
    this.resumoWorkspaceAtual = await lerResumoWorkspace();
    this.enviarEstado();
  }

  private async verificarTentativaAtual(): Promise<void> {
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
}
