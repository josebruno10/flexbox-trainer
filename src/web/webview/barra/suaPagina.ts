import html2canvas from "html2canvas";
import { medirFormas } from "../formas";
import { montarPaginaAluno } from "../paginaAluno";
import { vscode } from "./api";
import {
  avisoArquivos,
  botaoVistaPagina,
  canvasPreviewAluno,
  quadroAvaliacao,
  textoArquivos,
} from "./elementos";
import { dimensoesDoDesafio } from "./estado";
import type { ResumoWorkspaceRecebido } from "./tipos";

// A página do aluno: montada fora da vista para ser medida na verificação e
// fotografada para a vista Sua página.
let confirmarAtualizacaoWorkspace: (() => void) | undefined;
let versaoWorkspace = 0;

export function renderizarWorkspace(
  resumoWorkspace: ResumoWorkspaceRecebido,
): void {
  // Os arquivos só aparecem quando falta algum; os caminhos ficam na dica
  // do botão Sua página.
  const faltando = [
    resumoWorkspace.temArquivoHtml ? "" : "index.html",
    resumoWorkspace.temArquivoCss ? "" : "style.css",
  ].filter(Boolean);
  avisoArquivos.hidden = faltando.length === 0;
  textoArquivos.textContent =
    faltando.length === 2
      ? "Faltam index.html e style.css na pasta aberta."
      : `Falta ${faltando[0]} na pasta aberta.`;
  botaoVistaPagina.title = [
    resumoWorkspace.temArquivoHtml ? resumoWorkspace.caminhoHtml : "",
    resumoWorkspace.temArquivoCss ? resumoWorkspace.caminhoCss : "",
  ]
    .filter(Boolean)
    .join("\n");
  try {
    const { largura, altura } = dimensoesDoDesafio();
    montarPaginaAluno(
      quadroAvaliacao,
      resumoWorkspace.htmlPreview,
      largura,
      altura,
    );
    const versaoDaCaptura = ++versaoWorkspace;
    const captura = capturarCanvasAluno();
    void captura
      .then((canvasAluno) => {
        if (versaoDaCaptura === versaoWorkspace) {
          desenharPreviewAluno(canvasAluno);
        }
      })
      .catch((error: unknown) => {
        if (versaoDaCaptura === versaoWorkspace) {
          const mensagem =
            error instanceof Error ? error.message : "Falha ao gerar preview.";
          desenharMensagemPreview(mensagem);
        }
      });
  } catch (error) {
    const mensagem =
      error instanceof Error ? error.message : "Falha ao preparar o preview.";
    desenharMensagemPreview(mensagem);
  } finally {
    confirmarAtualizacaoWorkspace?.();
    confirmarAtualizacaoWorkspace = undefined;
  }
}

export function medirFormasDoAluno(): ReturnType<typeof medirFormas> {
  const corpo = quadroAvaliacao.shadowRoot?.querySelector("body");

  if (!corpo) {
    return [];
  }

  const { largura, altura } = dimensoesDoDesafio();
  return medirFormas(
    corpo,
    quadroAvaliacao.getBoundingClientRect(),
    largura,
    altura,
  );
}

export async function atualizarWorkspaceAntesDaVerificacao(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let concluiu = false;
    const timeoutId = window.setTimeout(() => {
      if (concluiu) {
        return;
      }

      concluiu = true;
      confirmarAtualizacaoWorkspace = undefined;
      reject(
        new Error(
          "o VS Code não respondeu em 5 s.",
        ),
      );
    }, 5000);

    confirmarAtualizacaoWorkspace = () => {
      if (concluiu) {
        return;
      }

      concluiu = true;
      window.clearTimeout(timeoutId);
      resolve();
    };

    vscode.postMessage({ type: "atualizarPreview" });
  });
}

async function capturarCanvasAluno(): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  await aguardarDoisFrames();

  const { largura, altura } = dimensoesDoDesafio();

  return html2canvas(quadroAvaliacao, {
    width: largura,
    height: altura,
    windowWidth: largura,
    windowHeight: altura,
    scale: 1,
    useCORS: true,
    imageTimeout: 5000,
    backgroundColor: "#ffffff",
    logging: false,
  });
}

function desenharPreviewAluno(canvasAluno: HTMLCanvasElement): void {
  canvasPreviewAluno.width = canvasAluno.width;
  canvasPreviewAluno.height = canvasAluno.height;
  const contexto = canvasPreviewAluno.getContext("2d");

  if (!contexto) {
    return;
  }

  contexto.clearRect(
    0,
    0,
    canvasPreviewAluno.width,
    canvasPreviewAluno.height,
  );
  contexto.drawImage(canvasAluno, 0, 0);
}

export function desenharMensagemPreview(mensagem: string): void {
  const { largura, altura } = dimensoesDoDesafio();
  canvasPreviewAluno.width = largura;
  canvasPreviewAluno.height = altura;
  const contexto = canvasPreviewAluno.getContext("2d");

  if (!contexto) {
    return;
  }

  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, largura, altura);
  contexto.fillStyle = "#52606d";
  contexto.font = "500 34px sans-serif";
  contexto.textAlign = "center";
  contexto.textBaseline = "middle";
  contexto.fillText(mensagem, largura / 2, altura / 2, largura * 0.92);
}

export function aguardarDoisFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
