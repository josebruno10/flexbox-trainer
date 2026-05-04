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
import { obterHtmlWebview } from "../webview/html";

// provider responsável por gerenciar estado e comunicação da sidebar.
export class ProvedorBarraLateralFlexBox implements vscode.WebviewViewProvider {
  public static readonly viewType = "flexbox-trainer.sidebar";

  private visualizacaoWebview?: vscode.WebviewView;

  private desafioAtual: Desafio = criarDesafioBase();

  private resumoWorkspaceAtual: ResumoWorkspace = criarResumoWorkspaceVazio();

  private avaliacaoAtual?: ResultadoAvaliacao;

  private inicioTentativaMs = Date.now();

  public resolveWebviewView(
    visualizacaoWebview: vscode.WebviewView,
  ): void | Thenable<void> {
    this.visualizacaoWebview = visualizacaoWebview;
    visualizacaoWebview.webview.options = { enableScripts: true };
    visualizacaoWebview.webview.html = obterHtmlWebview(
      visualizacaoWebview.webview,
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
          void this.avaliarWorkspaceAtual();
        }
      },
      undefined,
    );

    void this.atualizarPreviewWorkspace();
  }

  public iniciarNovoDesafio(): void {
    this.desafioAtual = criarDesafioBase();
    this.avaliacaoAtual = undefined;
    this.inicioTentativaMs = Date.now();
    this.enviarEstado();
  }

  public async atualizarPreviewWorkspace(): Promise<void> {
    this.resumoWorkspaceAtual = await lerResumoWorkspace();
    this.enviarEstado();
  }

  private async avaliarWorkspaceAtual(): Promise<void> {
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

    this.avaliacaoAtual = await avaliarTentativa({
      html: this.resumoWorkspaceAtual.textoHtml,
      css: this.resumoWorkspaceAtual.textoCss,
      elapsedMs: Date.now() - this.inicioTentativaMs,
      challengeId: this.desafioAtual.challengeId,
      seed: this.desafioAtual.seed,
    });

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
