import * as vscode from "vscode";
import {
  Desafio,
  MensagemRecebidaBarraLateral,
  ResumoWorkspace,
  ResultadoAvaliacao,
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

  private capturaPendente?: {
    resolve: (imagemBase64: string) => void;
    reject: (erro: Error) => void;
    timeoutId: ReturnType<typeof setTimeout>;
  };

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
          this.iniciarNovoDesafio();
          void this.atualizarPreviewWorkspace();
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

        if (mensagem.type === "imagemCapturada") {
          this.processarImagemCapturada(mensagem.imagemBase64);
          return;
        }

        if (mensagem.type === "erroCaptura") {
          this.processarErroCaptura(mensagem.error);
        }
      },
      undefined,
    );

    this.preparandoPasta = this.prepararPastaDoAluno();
    void this.atualizarPreviewWorkspace();
  }

  public iniciarNovoDesafio(): void {
    const configuracao = lerConfiguracaoServidor();

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

      const imagemBase64 = await this.capturarImagemDoPreview();

      this.avaliacaoAtual = await avaliarTentativa({
        html: this.resumoWorkspaceAtual.textoHtml,
        css: this.resumoWorkspaceAtual.textoCss,
        elapsedMs: Date.now() - this.inicioTentativaMs,
        challengeId: this.desafioAtual.challengeId,
        seed: this.desafioAtual.seed,
        imagemBase64,
        codigoPasta: this.codigoPastaAluno,
      });

      this.enviarEstado();
    } catch (error) {
      if (this.avaliacaoAtual?.source === "capture-error") {
        this.enviarEstado();
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
    const configuracao = lerConfiguracaoServidor();

    if (!temConfiguracaoServidorMinima(configuracao)) {
      this.codigoPastaAluno = undefined;
      return;
    }

    try {
      this.codigoPastaAluno = await criarPastaDoAluno(configuracao);
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

  private capturarImagemDoPreview(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.visualizacaoWebview) {
        reject(new Error("A barra lateral ainda não foi inicializada."));
        return;
      }

      if (this.capturaPendente) {
        clearTimeout(this.capturaPendente.timeoutId);
        this.capturaPendente.reject(
          new Error("Uma captura anterior foi interrompida."),
        );
      }

      const timeoutId = setTimeout(() => {
        if (this.capturaPendente) {
          this.capturaPendente = undefined;
          reject(new Error("Tempo esgotado ao capturar o preview."));
        }
      }, 15000);

      this.capturaPendente = { resolve, reject, timeoutId };

      void this.visualizacaoWebview.webview.postMessage({
        type: "capturarPreview",
        largura: this.desafioAtual.captureWidth ?? 960,
        altura: this.desafioAtual.captureHeight ?? 540,
      });
    });
  }

  private processarImagemCapturada(imagemBase64: string): void {
    if (!this.capturaPendente) {
      return;
    }

    clearTimeout(this.capturaPendente.timeoutId);
    this.capturaPendente.resolve(imagemBase64);
    this.capturaPendente = undefined;
  }

  private processarErroCaptura(mensagem: string): void {
    if (!this.capturaPendente) {
      return;
    }

    clearTimeout(this.capturaPendente.timeoutId);
    this.capturaPendente.reject(new Error(mensagem));
    this.capturaPendente = undefined;
    this.avaliacaoAtual = {
      precision: 0,
      score: 0,
      source: "capture-error",
      error: mensagem,
    };
    this.enviarEstado();
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
