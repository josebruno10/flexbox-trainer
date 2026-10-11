import html2canvas from "html2canvas";
import {
  blocoNoPonto,
  desenharGabarito,
  formatarMedida,
  normalizarHex,
} from "./desenhoGabarito";
import { medirFormas } from "./formas";
import { montarPaginaAluno } from "./paginaAluno";

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

type DesafioRecebido = {
  challengeId: string;
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
  tempoAtualMs?: number;
  encerrado?: boolean;
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
  // A página não mudou desde a última correção e não foi reenviada.
  repetida?: boolean;
};

type VerificacaoRecebida = { id?: number; mensagem?: string };

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
  aviso?: string;
};

type MensagemDaExtensao =
  | { type: "dadosDesafio"; payload: DesafioRecebido }
  | { type: "dadosWorkspace"; payload: ResumoWorkspaceRecebido }
  | { type: "resultadoAvaliacao"; payload: ResultadoAvaliacaoRecebido }
  | { type: "statusServidor"; payload: StatusConexaoServidorRecebido }
  | { type: "estadoAutenticacao"; payload: EstadoAutenticacaoRecebido }
  | { type: "extensoesIa"; payload: Array<{ id: string; nome: string }> }
  | { type: "progressoVerificacao"; payload: VerificacaoRecebida }
  | { type: "verificacaoConcluida"; payload: VerificacaoRecebida };

// Uma verificação vai do clique em Verificar até a extensão avisar que ela
// terminou. Nesse meio tempo a extensão reenvia o estado (com o resultado
// antigo) ao reler os arquivos; ele fica guardado e só o último é exibido.
const LIMITE_VERIFICACAO_MS = 120_000;
let verificacaoPendente: { id: number; challengeId: string } | undefined;
let contadorVerificacoes = 0;
let resultadoDuranteVerificacao: ResultadoAvaliacaoRecebido | undefined;
let limiteVerificacao: number | undefined;

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

const botaoNovoDesafio = document.getElementById(
  "botaoNovoDesafio",
) as HTMLButtonElement;
const botaoEncerrarDesafio = document.getElementById(
  "botaoEncerrarDesafio",
) as HTMLButtonElement;
const botaoTestarConexao = document.getElementById("botaoTestarConexao");
const botaoAtualizarPreview = document.getElementById("botaoAtualizarPreview");
const botaoVerificar = document.getElementById(
  "botaoVerificar",
) as HTMLButtonElement;
const botaoSair = document.getElementById("botaoSair");
const botaoAbrirAba = document.getElementById("botaoAbrirAba");
const botaoCriarArquivos = document.getElementById(
  "botaoCriarArquivos",
) as HTMLButtonElement;
const avisoIa = document.getElementById("avisoIa") as HTMLDivElement;
const textoAvisoIa = document.getElementById("textoAvisoIa") as HTMLSpanElement;
const botaoVerExtensoesIa = document.getElementById("botaoVerExtensoesIa");
let ultimoGabaritoEnviado = "";
let desafioAtual: DesafioRecebido | undefined;
let tempoBaseMs = 0;
let instanteTempoRecebido = Date.now();
let confirmarAtualizacaoWorkspace: (() => void) | undefined;
let componenteSelecionadoId: number | undefined;
let versaoWorkspace = 0;

// As dimensões vêm do gabarito. Estes valores, iguais aos do gerador, só
// valem enquanto nenhum desafio foi gerado.
const LARGURA_PADRAO = 800;
const ALTURA_PADRAO = 800;

function dimensoesDoDesafio(): { largura: number; altura: number } {
  return {
    largura: desafioAtual?.width ?? LARGURA_PADRAO,
    altura: desafioAtual?.height ?? ALTURA_PADRAO,
  };
}

function aplicarProporcaoDoDesafio(largura: number, altura: number): void {
  if (largura <= 0 || altura <= 0) {
    return;
  }

  document.documentElement.style.setProperty(
    "--proporcao-desafio",
    `${largura} / ${altura}`,
  );
}

botaoNovoDesafio?.addEventListener("click", () => {
  vscode.postMessage({ type: "novoDesafio" });
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

botaoVerExtensoesIa?.addEventListener("click", () => {
  vscode.postMessage({ type: "verExtensoesIa" });
});

botaoCriarArquivos?.addEventListener("click", () => {
  vscode.postMessage({ type: "criarArquivos" });
});

botaoAbrirAba?.addEventListener("click", () => {
  vscode.postMessage({ type: "abrirPainelGabarito" });
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
  aplicarProporcaoDoDesafio(desafio.width, desafio.height);

  const contexto = canvasAlvo.getContext("2d");

  if (!contexto) {
    return;
  }

  desenharGabarito(contexto, desafio);

  if (mudouDesafio) {
    componenteSelecionadoId = undefined;
    caixaResultado.textContent = "Nenhuma verificação ainda.";
    // Uma verificação do desafio anterior não vale para este.
    window.clearTimeout(limiteVerificacao);
    verificacaoPendente = undefined;
    resultadoDuranteVerificacao = undefined;
  }

  // O cronômetro fica congelado ao encerrar, mas o aluno ainda pode
  // calcular o resultado final da tentativa. O estado é reenviado durante a
  // verificação, que mantém o botão desligado até terminar.
  botaoVerificar.disabled = Boolean(verificacaoPendente);
  botaoEncerrarDesafio.disabled = Boolean(desafio.encerrado);
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
    "Tempo: " +
    formatarTempo(tempoDecorrido) +
    " | Status: " +
    (desafioAtual.encerrado ? "Encerrado" : "Em andamento") +
    " | Gabarito: " +
    desafioAtual.width +
    "x" +
    desafioAtual.height;
}

function desenharEstadoInicial(): void {
  canvasAlvo.width = LARGURA_PADRAO;
  canvasAlvo.height = ALTURA_PADRAO;
  aplicarProporcaoDoDesafio(LARGURA_PADRAO, ALTURA_PADRAO);
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
    "Clique em Gerar novo desafio",
    canvasAlvo.width / 2,
    canvasAlvo.height / 2,
  );
  metaDesafio.textContent = "Nenhum desafio iniciado.";
  detalheComponente.textContent =
    "Gere um desafio para consultar medidas e cores.";
  canvasAnotacoes.width = LARGURA_PADRAO;
  canvasAnotacoes.height = ALTURA_PADRAO;
  canvasAnotacoes
    .getContext("2d")
    ?.clearRect(0, 0, LARGURA_PADRAO, ALTURA_PADRAO);
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
  const bloco = blocoNoPonto(desafioAtual.blocks, x, y);

  componenteSelecionadoId = bloco?.id;
  renderizarDetalheComponente();
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
    (bloco.shape === "circle"
      ? `Círculo | Diâmetro: ${formatarMedida(bloco.width)} px`
      : `Tamanho: ${formatarMedida(bloco.width)} × ` +
        `${formatarMedida(bloco.height)} px`) +
    ` | Cor: ${normalizarHex(bloco.color)}`;
}

function renderizarWorkspace(
  resumoWorkspace: ResumoWorkspaceRecebido,
): void {
  const htmlInfo = resumoWorkspace.temArquivoHtml
    ? resumoWorkspace.caminhoHtml
    : "index.html não encontrado";
  const cssInfo = resumoWorkspace.temArquivoCss
    ? resumoWorkspace.caminhoCss
    : "style.css não encontrado";

  listaWorkspace.textContent = "HTML: " + htmlInfo + " | CSS: " + cssInfo;
  botaoCriarArquivos.hidden =
    resumoWorkspace.temArquivoHtml && resumoWorkspace.temArquivoCss;
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

async function solicitarVerificacao(): Promise<void> {
  if (!desafioAtual || botaoVerificar.disabled) {
    return;
  }

  const challengeId = desafioAtual.challengeId;
  const id = ++contadorVerificacoes;
  verificacaoPendente = { id, challengeId };
  resultadoDuranteVerificacao = undefined;
  window.clearTimeout(limiteVerificacao);
  limiteVerificacao = window.setTimeout(() => {
    if (verificacaoPendente?.id === id) {
      concluirVerificacao();
      caixaResultado.textContent =
        "A verificação demorou demais para responder. Tente de novo.";
    }
  }, LIMITE_VERIFICACAO_MS);
  botaoVerificar.disabled = true;
  caixaResultado.textContent = "Atualizando os arquivos antes de verificar...";

  try {
    await atualizarWorkspaceAntesDaVerificacao();
  } catch (error) {
    if (desafioAtual?.challengeId !== challengeId) {
      return;
    }

    const mensagem =
      error instanceof Error ? error.message : "Falha ao atualizar o preview.";
    caixaResultado.textContent =
      `Aviso do preview: ${mensagem} Enviando os arquivos mesmo assim...`;
  }

  if (desafioAtual?.challengeId !== challengeId) {
    return;
  }

  // A superfície de avaliação já tem o HTML/CSS recém-lidos; espera o layout
  // assentar antes de medir.
  await document.fonts?.ready;
  await aguardarDoisFrames();

  if (desafioAtual?.challengeId !== challengeId) {
    return;
  }

  caixaResultado.textContent = "Medindo as formas da sua página...";
  vscode.postMessage({
    type: "solicitarVerificacao",
    challengeId,
    verificacaoId: id,
    formas: medirFormasDoAluno(),
  });
}

function concluirVerificacao(): void {
  window.clearTimeout(limiteVerificacao);
  verificacaoPendente = undefined;
  const resultado = resultadoDuranteVerificacao;
  resultadoDuranteVerificacao = undefined;
  renderizarResultado(resultado);
}

function medirFormasDoAluno(): ReturnType<typeof medirFormas> {
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

function desenharMensagemPreview(mensagem: string): void {
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
  contexto.font = "600 24px sans-serif";
  contexto.textAlign = "center";
  contexto.textBaseline = "middle";
  contexto.fillText(mensagem, largura / 2, altura / 2, largura * 0.92);
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
    resultado.source === "desafio-invalidado" ||
    resultado.source === "sem-formas" ||
    resultado.source === "config-missing" ||
    resultado.source === "gabarito-error" ||
    resultado.source === "servidor-sem-nota"
  ) {
    caixaResultado.textContent =
      resultado.error || "Erro ao verificar a tentativa.";
    return;
  }

  if (resultado.source === "servidor") {
    caixaResultado.textContent =
      "Precisão oficial do servidor: " +
      resultado.precision.toFixed(2) +
      "%" +
      (resultado.repetida
        ? ". A sua página continua igual à da última verificação, então não " +
          "foi enviada de novo; altere o código e salve para verificar outra vez."
        : "");
    return;
  }

  if (
    resultado.source === "api-error" ||
    resultado.source === "authentication-error"
  ) {
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
    statusAutenticacao.innerHTML =
      `<strong>${escapeHtml(nome)}</strong>` +
      (estado.aviso
        ? `<span class="aviso-cadastro">${escapeHtml(estado.aviso)}</span>`
        : "Conectado e pronto para usar a extensão.");
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
      if (verificacaoPendente) {
        resultadoDuranteVerificacao = mensagem.payload;
      } else {
        renderizarResultado(mensagem.payload);
      }
    }

    if (
      mensagem.type === "progressoVerificacao" &&
      mensagem.payload.id === verificacaoPendente?.id &&
      mensagem.payload.mensagem
    ) {
      caixaResultado.textContent = mensagem.payload.mensagem;
    }

    if (
      mensagem.type === "verificacaoConcluida" &&
      mensagem.payload.id === verificacaoPendente?.id
    ) {
      concluirVerificacao();
    }

    if (mensagem.type === "statusServidor") {
      caixaResultado.textContent =
        (mensagem.payload.ok ? "Servidor conectado: " : "Erro no servidor: ") +
        mensagem.payload.mensagem;
    }

    if (mensagem.type === "estadoAutenticacao") {
      renderizarEstadoAutenticacao(mensagem.payload);
    }

    if (mensagem.type === "extensoesIa") {
      const nomes = mensagem.payload.map((extensao) => extensao.nome);
      avisoIa.hidden = nomes.length === 0;
      textoAvisoIa.textContent =
        `Extensões de IA habilitadas: ${nomes.join(", ")}. Como no torneio, ` +
        "você só começa e corrige desafios com elas desabilitadas. Depois " +
        'de desabilitar, clique em "Reiniciar Extensões" se o VS Code pedir.';
      // A extensão também recusa; o botão desligado só deixa isso claro.
      botaoNovoDesafio.disabled = nomes.length > 0;
      botaoNovoDesafio.title =
        nomes.length > 0 ? "Desabilite as extensões de IA para começar." : "";
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
