import html2canvas from "html2canvas";
import { calcularPrecisaoImagem } from "../services/comparacaoImagem";

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

type DesafioRecebido = {
  challengeId: string;
  dificuldade: "facil" | "medio" | "dificil";
  width: number;
  height: number;
  backgroundColor: string;
  blocks: Array<{
    id: number;
    parentId?: number;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    borderRadius?: number;
    shape?: "rectangle" | "circle";
  }>;
  captureWidth?: number;
  captureHeight?: number;
  tempoAtualMs?: number;
  encerrado?: boolean;
};

type BlocoRecebido = DesafioRecebido["blocks"][number];

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
  serverMessage?: string;
};

type StatusConexaoServidorRecebido = {
  ok: boolean;
  mensagem: string;
};

type EstadoAutenticacaoRecebido = {
  status: "checking" | "authenticated" | "unauthenticated" | "error";
  message?: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
};

type MensagemDaExtensao =
  | { type: "dadosDesafio"; payload: DesafioRecebido }
  | { type: "dadosWorkspace"; payload: ResumoWorkspaceRecebido }
  | { type: "resultadoAvaliacao"; payload: ResultadoAvaliacaoRecebido }
  | { type: "statusServidor"; payload: StatusConexaoServidorRecebido }
  | { type: "estadoAutenticacao"; payload: EstadoAutenticacaoRecebido };

const vscode = acquireVsCodeApi();

const canvasAlvo = document.getElementById("canvasAlvo") as HTMLCanvasElement;
const canvasAnotacoes = document.getElementById(
  "canvasAnotacoes",
) as HTMLCanvasElement;
const metaDesafio = document.getElementById("metaDesafio") as HTMLDivElement;
const detalheComponente = document.getElementById(
  "detalheComponente",
) as HTMLDivElement;
const listaWorkspace = document.getElementById(
  "listaWorkspace",
) as HTMLDivElement;
const canvasPreviewAluno = document.getElementById(
  "canvasPreviewAluno",
) as HTMLCanvasElement;
const quadroAvaliacao = document.getElementById(
  "quadroAvaliacao",
) as HTMLDivElement;
const caixaResultado = document.getElementById(
  "caixaResultado",
) as HTMLDivElement;
const statusAutenticacao = document.getElementById(
  "statusAutenticacao",
) as HTMLDivElement;
const avatarUsuario = document.getElementById(
  "avatarUsuario",
) as HTMLImageElement;
const avatarFallback = document.getElementById(
  "avatarFallback",
) as HTMLDivElement;

const botaoNovoDesafio = document.getElementById("botaoNovoDesafio");
const botaoEncerrarDesafio = document.getElementById(
  "botaoEncerrarDesafio",
) as HTMLButtonElement;
const botaoTestarConexao = document.getElementById("botaoTestarConexao");
const botaoAtualizarPreview = document.getElementById("botaoAtualizarPreview");
const botaoVerificar = document.getElementById(
  "botaoVerificar",
) as HTMLButtonElement;
const botaoSair = document.getElementById("botaoSair");
const seletorDificuldade = document.getElementById(
  "seletorDificuldade",
) as HTMLSelectElement;
let ultimoGabaritoEnviado = "";
let desafioAtual: DesafioRecebido | undefined;
let tempoBaseMs = 0;
let instanteTempoRecebido = Date.now();
let confirmarAtualizacaoWorkspace: (() => void) | undefined;
let componenteSelecionadoId: number | undefined;
let capturaWorkspaceAtual: Promise<HTMLCanvasElement> | undefined;
let versaoWorkspace = 0;

botaoNovoDesafio?.addEventListener("click", () => {
  vscode.postMessage({
    type: "novoDesafio",
    dificuldade: seletorDificuldade.value,
  });
});

botaoEncerrarDesafio?.addEventListener("click", () => {
  botaoEncerrarDesafio.disabled = true;
  vscode.postMessage({ type: "encerrarDesafio" });
});

botaoTestarConexao?.addEventListener("click", () => {
  caixaResultado.textContent = "Testando conexão com o servidor...";
  vscode.postMessage({ type: "testarConexao" });
});

botaoAtualizarPreview?.addEventListener("click", () => {
  vscode.postMessage({ type: "atualizarPreview" });
});

botaoVerificar?.addEventListener("click", () => {
  void solicitarVerificacao();
});

botaoSair?.addEventListener("click", () => {
  vscode.postMessage({ type: "logout" });
});

canvasAnotacoes.addEventListener("click", selecionarComponenteNoCanvas);

function desenharDesafio(desafio: DesafioRecebido): void {
  const mudouDesafio = desafioAtual?.challengeId !== desafio.challengeId;
  desafioAtual = desafio;
  tempoBaseMs = desafio.tempoAtualMs ?? 0;
  instanteTempoRecebido = Date.now();
  canvasAlvo.width = desafio.width;
  canvasAlvo.height = desafio.height;
  canvasAnotacoes.width = desafio.width;
  canvasAnotacoes.height = desafio.height;

  const contexto = canvasAlvo.getContext("2d");

  if (!contexto) {
    return;
  }

  contexto.clearRect(0, 0, canvasAlvo.width, canvasAlvo.height);
  contexto.fillStyle = desafio.backgroundColor;
  contexto.fillRect(0, 0, canvasAlvo.width, canvasAlvo.height);

  desafio.blocks.forEach((bloco) => {
    contexto.fillStyle = bloco.color;
    if (bloco.shape === "circle") {
      desenharCirculo(
        contexto,
        bloco.x,
        bloco.y,
        bloco.width,
        bloco.height,
      );
    } else {
      desenharRetanguloArredondado(
        contexto,
        bloco.x,
        bloco.y,
        bloco.width,
        bloco.height,
        bloco.borderRadius ?? 0,
      );
    }
  });

  seletorDificuldade.value = desafio.dificuldade;
  // O cronômetro fica congelado ao encerrar, mas o aluno ainda pode
  // calcular o resultado final da tentativa.
  botaoVerificar.disabled = false;
  botaoEncerrarDesafio.disabled = Boolean(desafio.encerrado);

  if (mudouDesafio) {
    componenteSelecionadoId = undefined;
    caixaResultado.textContent = "Nenhuma verificação ainda.";
  }
  canvasAnotacoes
    .getContext("2d")
    ?.clearRect(0, 0, canvasAnotacoes.width, canvasAnotacoes.height);
  renderizarDetalheComponente();

  if (ultimoGabaritoEnviado !== desafio.challengeId) {
    ultimoGabaritoEnviado = desafio.challengeId;
    vscode.postMessage({
      type: "gabaritoGerado",
      challengeId: desafio.challengeId,
      imagemDataUrl: canvasAlvo.toDataURL("image/png"),
      width: canvasAlvo.width,
      height: canvasAlvo.height,
    });
  }

  renderizarMetaDesafio();
}

function renderizarMetaDesafio(): void {
  if (!desafioAtual) {
    return;
  }

  const tempoDecorrido =
    tempoBaseMs +
    (desafioAtual.encerrado ? 0 : Date.now() - instanteTempoRecebido);
  metaDesafio.textContent =
    "Nível: " +
    formatarDificuldade(desafioAtual.dificuldade) +
    " | Tempo: " +
    formatarTempo(tempoDecorrido) +
    " | Status: " +
    (desafioAtual.encerrado ? "Encerrado" : "Em andamento") +
    " | Captura: " +
    (desafioAtual.captureWidth ?? 960) +
    "x" +
    (desafioAtual.captureHeight ?? 540);
}

function desenharEstadoInicial(): void {
  canvasAlvo.width = 960;
  canvasAlvo.height = 540;
  const contexto = canvasAlvo.getContext("2d");

  if (!contexto) {
    return;
  }

  contexto.fillStyle = "#9ca3af";
  contexto.fillRect(0, 0, canvasAlvo.width, canvasAlvo.height);
  contexto.fillStyle = "#334155";
  contexto.font = "600 28px sans-serif";
  contexto.textAlign = "center";
  contexto.textBaseline = "middle";
  contexto.fillText(
    "Escolha o nível e clique em Gerar desafio",
    canvasAlvo.width / 2,
    canvasAlvo.height / 2,
  );
  metaDesafio.textContent = "Nenhum desafio iniciado.";
  detalheComponente.textContent =
    "Gere um desafio para consultar medidas e cores.";
  canvasAnotacoes.width = 960;
  canvasAnotacoes.height = 540;
  canvasAnotacoes.getContext("2d")?.clearRect(0, 0, 960, 540);
  desenharMensagemPreview("O preview aparecerá aqui.");
  botaoVerificar.disabled = true;
  botaoEncerrarDesafio.disabled = true;
}

function selecionarComponenteNoCanvas(evento: MouseEvent): void {
  if (!desafioAtual) {
    return;
  }

  const limites = canvasAnotacoes.getBoundingClientRect();
  const x =
    (evento.clientX - limites.left) * (canvasAnotacoes.width / limites.width);
  const y =
    (evento.clientY - limites.top) * (canvasAnotacoes.height / limites.height);
  const bloco = [...desafioAtual.blocks]
    .reverse()
    .find((candidato) => pontoPertenceAoBloco(x, y, candidato));

  componenteSelecionadoId = bloco?.id;
  renderizarDetalheComponente();
}

function pontoPertenceAoBloco(
  x: number,
  y: number,
  bloco: BlocoRecebido,
): boolean {
  if (bloco.shape === "circle") {
    const raioX = bloco.width / 2;
    const raioY = bloco.height / 2;
    const centroX = bloco.x + raioX;
    const centroY = bloco.y + raioY;

    if (raioX <= 0 || raioY <= 0) {
      return false;
    }

    return (
      ((x - centroX) * (x - centroX)) / (raioX * raioX) +
        ((y - centroY) * (y - centroY)) / (raioY * raioY) <=
      1
    );
  }

  return (
    x >= bloco.x &&
    x <= bloco.x + bloco.width &&
    y >= bloco.y &&
    y <= bloco.y + bloco.height
  );
}

function renderizarDetalheComponente(): void {
  if (!desafioAtual) {
    detalheComponente.textContent =
      "Gere um desafio para consultar medidas e cores.";
    return;
  }

  const bloco = desafioAtual.blocks.find(
    (candidato) => candidato.id === componenteSelecionadoId,
  );

  if (!bloco) {
    detalheComponente.textContent =
      `Tamanho da tela: ${formatarMedida(desafioAtual.width)} × ` +
      `${formatarMedida(desafioAtual.height)} px` +
      ` | Cor: ${normalizarHex(desafioAtual.backgroundColor)}` +
      " | Clique em um componente para consultar os valores exatos.";
    return;
  }

  detalheComponente.textContent =
    `Tamanho: ${formatarMedida(bloco.width)} × ` +
    `${formatarMedida(bloco.height)} px` +
    ` | Cor: ${normalizarHex(bloco.color)}`;
}

function formatarMedida(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1);
}

function normalizarHex(cor: string): string {
  return cor.toUpperCase();
}

function desenharCirculo(
  contexto: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  contexto.beginPath();
  contexto.ellipse(
    x + width / 2,
    y + height / 2,
    width / 2,
    height / 2,
    0,
    0,
    Math.PI * 2,
  );
  contexto.fill();
}

function formatarDificuldade(
  dificuldade: DesafioRecebido["dificuldade"],
): string {
  if (dificuldade === "facil") {
    return "Fácil";
  }

  if (dificuldade === "medio") {
    return "Médio";
  }

  return "Difícil";
}

function desenharRetanguloArredondado(
  contexto: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  raioSolicitado: number,
): void {
  const raio = Math.max(0, Math.min(raioSolicitado, width / 2, height / 2));

  if (raio === 0) {
    contexto.fillRect(x, y, width, height);
    return;
  }

  contexto.beginPath();
  contexto.moveTo(x + raio, y);
  contexto.lineTo(x + width - raio, y);
  contexto.quadraticCurveTo(x + width, y, x + width, y + raio);
  contexto.lineTo(x + width, y + height - raio);
  contexto.quadraticCurveTo(
    x + width,
    y + height,
    x + width - raio,
    y + height,
  );
  contexto.lineTo(x + raio, y + height);
  contexto.quadraticCurveTo(x, y + height, x, y + height - raio);
  contexto.lineTo(x, y + raio);
  contexto.quadraticCurveTo(x, y, x + raio, y);
  contexto.closePath();
  contexto.fill();
}

function renderizarWorkspace(
  resumoWorkspace: ResumoWorkspaceRecebido,
): void {
  const htmlInfo = resumoWorkspace.temArquivoHtml
    ? resumoWorkspace.caminhoHtml
    : "index.html nao encontrado";
  const cssInfo = resumoWorkspace.temArquivoCss
    ? resumoWorkspace.caminhoCss
    : "style.css nao encontrado";

  listaWorkspace.textContent = "HTML: " + htmlInfo + " | CSS: " + cssInfo;
  try {
    prepararSuperficieAvaliacao(resumoWorkspace.htmlPreview);
    const versaoDaCaptura = ++versaoWorkspace;
    const captura = capturarCanvasAluno();
    capturaWorkspaceAtual = captura;
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
    capturaWorkspaceAtual = undefined;
    const mensagem =
      error instanceof Error ? error.message : "Falha ao preparar o preview.";
    desenharMensagemPreview(mensagem);
  } finally {
    confirmarAtualizacaoWorkspace?.();
    confirmarAtualizacaoWorkspace = undefined;
  }
}

async function solicitarVerificacao(): Promise<void> {
  if (!desafioAtual || botaoVerificar.disabled) {
    return;
  }

  const challengeId = desafioAtual.challengeId;
  botaoVerificar.disabled = true;
  caixaResultado.textContent =
    "Atualizando o preview e calculando a precisão...";

  try {
    await atualizarWorkspaceAntesDaVerificacao();
    const precisaoLocal = await calcularPrecisaoVisualLocal();

    if (desafioAtual?.challengeId !== challengeId) {
      return;
    }

    caixaResultado.textContent =
      `Precisão visual local: ${precisaoLocal.toFixed(2)}%` +
      " | Enviando o HTML e o CSS ao servidor...";
    vscode.postMessage({
      type: "solicitarVerificacao",
      challengeId,
      precisaoLocal,
    });
  } catch (error) {
    if (desafioAtual?.challengeId !== challengeId) {
      return;
    }

    const mensagem =
      error instanceof Error ? error.message : "Falha desconhecida na captura.";
    vscode.postMessage({
      type: "solicitarVerificacao",
      challengeId,
      erroCorrecaoLocal: mensagem,
    });
  }
}

async function atualizarWorkspaceAntesDaVerificacao(): Promise<void> {
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
          "O VS Code não atualizou o preview em 5 segundos. Tente novamente.",
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

async function calcularPrecisaoVisualLocal(): Promise<number> {
  const canvasAluno = await (
    capturaWorkspaceAtual ?? capturarCanvasAluno()
  );
  desenharPreviewAluno(canvasAluno);
  const contextoAlvo = canvasAlvo.getContext("2d", { willReadFrequently: true });
  const contextoAluno = canvasAluno.getContext("2d", { willReadFrequently: true });

  if (!contextoAlvo || !contextoAluno) {
    throw new Error("O navegador não disponibilizou o contexto de comparação.");
  }

  const alvo = contextoAlvo.getImageData(0, 0, 960, 540).data;
  const atual = contextoAluno.getImageData(0, 0, 960, 540).data;
  return calcularPrecisaoImagem(alvo, atual).precisao;
}

async function capturarCanvasAluno(): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  await aguardarDoisFrames();

  return html2canvas(quadroAvaliacao, {
    width: 960,
    height: 540,
    windowWidth: 960,
    windowHeight: 540,
    scale: 1,
    useCORS: true,
    imageTimeout: 5000,
    backgroundColor: "#ffffff",
    logging: false,
  });
}

function desenharPreviewAluno(canvasAluno: HTMLCanvasElement): void {
  canvasPreviewAluno.width = 960;
  canvasPreviewAluno.height = 540;
  const contexto = canvasPreviewAluno.getContext("2d");

  if (!contexto) {
    return;
  }

  contexto.clearRect(0, 0, 960, 540);
  contexto.drawImage(canvasAluno, 0, 0, 960, 540);
}

function desenharMensagemPreview(mensagem: string): void {
  canvasPreviewAluno.width = 960;
  canvasPreviewAluno.height = 540;
  const contexto = canvasPreviewAluno.getContext("2d");

  if (!contexto) {
    return;
  }

  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, 960, 540);
  contexto.fillStyle = "#52606d";
  contexto.font = "600 24px sans-serif";
  contexto.textAlign = "center";
  contexto.textBaseline = "middle";
  contexto.fillText(mensagem, 480, 270, 880);
}

function prepararSuperficieAvaliacao(htmlPreview: string): void {
  const documento = new DOMParser().parseFromString(htmlPreview, "text/html");
  documento.querySelectorAll("script, iframe, object, embed").forEach((elemento) =>
    elemento.remove(),
  );
  documento.querySelectorAll("*").forEach((elemento) => {
    Array.from(elemento.attributes).forEach((atributo) => {
      if (atributo.name.toLowerCase().startsWith("on")) {
        elemento.removeAttribute(atributo.name);
      }
    });
  });
  documento
    .querySelectorAll('meta[http-equiv="Content-Security-Policy" i]')
    .forEach((elemento) => elemento.remove());

  const raiz = quadroAvaliacao.shadowRoot ?? quadroAvaliacao.attachShadow({
    mode: "open",
  });
  raiz.replaceChildren();

  const estilo = document.createElement("style");
  estilo.textContent = `
    :host {
      display: block;
      width: 960px;
      height: 540px;
      overflow: hidden;
      background: #fff;
    }
    html, body {
      display: block;
      width: 100%;
      height: 100%;
      margin: 0;
    }
  `;

  documento.querySelectorAll("style").forEach((estiloOriginal) => {
    estilo.textContent += `\n${estiloOriginal.textContent || ""}`;
  });

  const htmlAluno = document.createElement("html");
  copiarAtributosPermitidos(documento.documentElement, htmlAluno);
  const bodyAluno = document.createElement("body");
  copiarAtributosPermitidos(documento.body, bodyAluno);

  Array.from(documento.body.childNodes).forEach((filho) => {
    if (!(filho instanceof HTMLStyleElement)) {
      bodyAluno.append(filho.cloneNode(true));
    }
  });
  htmlAluno.append(bodyAluno);
  raiz.append(estilo, htmlAluno);
}

function copiarAtributosPermitidos(
  origem: Element,
  destino: Element,
): void {
  Array.from(origem.attributes).forEach((atributo) => {
    if (!atributo.name.toLowerCase().startsWith("on")) {
      destino.setAttribute(atributo.name, atributo.value);
    }
  });
}

function aguardarDoisFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function renderizarResultado(
  resultado: ResultadoAvaliacaoRecebido | undefined,
): void {
  botaoVerificar.disabled = !desafioAtual;

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

  if (resultado.source === "local-visual") {
    caixaResultado.textContent =
      "Precisão visual local (experimental): " +
      resultado.precision.toFixed(2) +
      "%" +
      (resultado.serverMessage ? " | Servidor: " + resultado.serverMessage : "");
    return;
  }

  if (resultado.source === "servidor") {
    caixaResultado.textContent =
      "Precisão oficial do servidor: " + resultado.precision.toFixed(2) + "%";
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

function renderizarEstadoAutenticacao(
  estado: EstadoAutenticacaoRecebido,
): void {
  if (!statusAutenticacao) {
    return;
  }

  if (estado.status === "checking") {
    statusAutenticacao.textContent = estado.message || "Validando sessão...";
    return;
  }

  if (estado.status === "authenticated") {
    const nome = estado.displayName || estado.email || "Usuário";
    statusAutenticacao.innerHTML = `<strong>${escapeHtml(nome)}</strong>Conectado e pronto para usar a extensão.`;
    renderizarAvatar(nome, estado.avatarUrl);
    return;
  }

  if (estado.status === "error") {
    statusAutenticacao.textContent =
      estado.message || "Não foi possível validar sua sessão agora.";
    return;
  }

  statusAutenticacao.textContent =
    estado.message ||
    "Você precisa criar uma conta ou fazer login para usar esta extensão.";
}

function renderizarAvatar(nome: string, avatarUrl?: string): void {
  avatarFallback.textContent = nome.trim().charAt(0).toUpperCase() || "U";
  avatarFallback.hidden = false;
  avatarUsuario.hidden = true;
  avatarUsuario.removeAttribute("src");

  if (!avatarUrl || !ehUrlAvatarPermitida(avatarUrl)) {
    return;
  }

  avatarUsuario.onload = () => {
    avatarUsuario.hidden = false;
    avatarFallback.hidden = true;
  };
  avatarUsuario.onerror = () => {
    avatarUsuario.hidden = true;
    avatarFallback.hidden = false;
  };
  avatarUsuario.src = avatarUrl;
}

function ehUrlAvatarPermitida(url: string): boolean {
  return /^https?:\/\//i.test(url) || /^data:image\//i.test(url);
}

function formatarTempo(tempoMs: number): string {
  const totalSegundos = Math.max(0, Math.floor(tempoMs / 1000));
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  const partes = [minutos, segundos].map((parte) =>
    parte.toString().padStart(2, "0"),
  );

  if (horas > 0) {
    partes.unshift(horas.toString().padStart(2, "0"));
  }
  return partes.join(":");
}

window.addEventListener(
  "message",
  (event: MessageEvent<MensagemDaExtensao>) => {
    const mensagem = event.data;

    if (mensagem.type === "dadosDesafio") {
      desenharDesafio(mensagem.payload);
    }

    if (mensagem.type === "dadosWorkspace") {
      void renderizarWorkspace(mensagem.payload);
    }

    if (mensagem.type === "resultadoAvaliacao") {
      renderizarResultado(mensagem.payload);
    }

    if (mensagem.type === "statusServidor") {
      caixaResultado.textContent =
        (mensagem.payload.ok ? "Servidor conectado: " : "Erro no servidor: ") +
        mensagem.payload.mensagem;
    }

    if (mensagem.type === "estadoAutenticacao") {
      renderizarEstadoAutenticacao(mensagem.payload);
    }
  },
);

desenharEstadoInicial();
window.setInterval(renderizarMetaDesafio, 250);
vscode.postMessage({ type: "pronto" });

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
