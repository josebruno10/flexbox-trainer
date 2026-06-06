declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

type DesafioRecebido = {
  challengeId: string;
  seed: number;
  titulo: string;
  width: number;
  height: number;
  blocks: Array<{
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }>;
  captureWidth?: number;
  captureHeight?: number;
  tempoAtualMs?: number;
};

type ResumoWorkspaceRecebido = {
  caminhoHtml: string;
  caminhoCss: string;
  textoHtml: string;
  textoCss: string;
  htmlPreview: string;
  temArquivoHtml: boolean;
  temArquivoCss: boolean;
};

type ResultadoAvaliacaoRecebido = {
  precision: number;
  score: number;
  source: string;
  error?: string;
};

type MensagemDaExtensao =
  | { type: "dadosDesafio"; payload: DesafioRecebido }
  | { type: "dadosWorkspace"; payload: ResumoWorkspaceRecebido }
  | { type: "resultadoAvaliacao"; payload: ResultadoAvaliacaoRecebido };

const vscode = acquireVsCodeApi();

const canvasAlvo = document.getElementById("canvasAlvo") as HTMLCanvasElement;
const metaDesafio = document.getElementById("metaDesafio") as HTMLDivElement;
const listaWorkspace = document.getElementById(
  "listaWorkspace",
) as HTMLDivElement;
const quadroPreview = document.getElementById(
  "quadroPreview",
) as HTMLIFrameElement;
const caixaResultado = document.getElementById(
  "caixaResultado",
) as HTMLDivElement;

const botaoNovoDesafio = document.getElementById("botaoNovoDesafio");
const botaoAtualizarPreview = document.getElementById("botaoAtualizarPreview");
const botaoVerificar = document.getElementById("botaoVerificar");

botaoNovoDesafio?.addEventListener("click", () => {
  vscode.postMessage({ type: "novoDesafio" });
});

botaoAtualizarPreview?.addEventListener("click", () => {
  vscode.postMessage({ type: "atualizarPreview" });
});

botaoVerificar?.addEventListener("click", () => {
  vscode.postMessage({ type: "solicitarVerificacao" });
});

function desenharDesafio(desafio: DesafioRecebido): void {
  canvasAlvo.width = desafio.width;
  canvasAlvo.height = desafio.height;

  const contexto = canvasAlvo.getContext("2d");

  if (!contexto) {
    return;
  }

  contexto.clearRect(0, 0, canvasAlvo.width, canvasAlvo.height);
  contexto.fillStyle = "#f2f2f2";
  contexto.fillRect(0, 0, canvasAlvo.width, canvasAlvo.height);

  desafio.blocks.forEach((bloco) => {
    contexto.fillStyle = bloco.color;
    contexto.fillRect(bloco.x, bloco.y, bloco.width, bloco.height);
  });

  metaDesafio.textContent =
    "Titulo: " +
    desafio.titulo +
    " | Seed: " +
    desafio.seed +
    " | Tempo: " +
    Math.floor((desafio.tempoAtualMs || 0) / 1000) +
    "s" +
    " | Captura: " +
    (desafio.captureWidth ?? 960) +
    "x" +
    (desafio.captureHeight ?? 540);
}

function renderizarWorkspace(resumoWorkspace: ResumoWorkspaceRecebido): void {
  const htmlInfo = resumoWorkspace.temArquivoHtml
    ? resumoWorkspace.caminhoHtml
    : "index.html nao encontrado";
  const cssInfo = resumoWorkspace.temArquivoCss
    ? resumoWorkspace.caminhoCss
    : "style.css nao encontrado";

  listaWorkspace.textContent = "HTML: " + htmlInfo + " | CSS: " + cssInfo;
  quadroPreview.srcdoc = resumoWorkspace.htmlPreview;
}

function renderizarResultado(
  resultado: ResultadoAvaliacaoRecebido | undefined,
): void {
  if (!resultado) {
    caixaResultado.textContent = "Nenhuma verificacao ainda.";
    return;
  }

  if (
    resultado.source === "missing-files" ||
    resultado.source === "config-missing" ||
    resultado.source === "capture-error" ||
    resultado.source === "folder-error" ||
    resultado.source === "servidor-sem-nota"
  ) {
    caixaResultado.textContent =
      resultado.error || "Erro ao verificar a tentativa.";
    return;
  }

  if (resultado.source === "api-error") {
    caixaResultado.textContent =
      "Erro na API: " + (resultado.error || "erro desconhecido");
    return;
  }

  caixaResultado.textContent =
    "Nota: " +
    resultado.score.toFixed(2) +
    " | Precisao: " +
    resultado.precision.toFixed(2) +
    "% | Fonte: " +
    resultado.source;
}

window.addEventListener(
  "message",
  (event: MessageEvent<MensagemDaExtensao>) => {
    const mensagem = event.data;

    if (mensagem.type === "dadosDesafio") {
      desenharDesafio(mensagem.payload);
    }

    if (mensagem.type === "dadosWorkspace") {
      renderizarWorkspace(mensagem.payload);
    }

    if (mensagem.type === "resultadoAvaliacao") {
      renderizarResultado(mensagem.payload);
    }
  },
);

vscode.postMessage({ type: "pronto" });
