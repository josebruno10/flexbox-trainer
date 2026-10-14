import html2canvas from "html2canvas";
import {
  blocoNoPonto,
  desenharGabarito,
  destacarBloco,
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
  podeCadastrar?: boolean;
};

type MensagemDaExtensao =
  | { type: "dadosDesafio"; payload: DesafioRecebido }
  | { type: "dadosWorkspace"; payload: ResumoWorkspaceRecebido }
  | { type: "resultadoAvaliacao"; payload: ResultadoAvaliacaoRecebido }
  | { type: "statusServidor"; payload: StatusConexaoServidorRecebido }
  | { type: "estadoAutenticacao"; payload: EstadoAutenticacaoRecebido }
  | { type: "extensoesIa"; payload: Array<{ id: string; nome: string }> }
  | { type: "historicoNotas"; payload: number[] }
  | { type: "progressoVerificacao"; payload: VerificacaoRecebida }
  | { type: "verificacaoConcluida"; payload: VerificacaoRecebida };

// Uma verificação vai do clique em Verificar até a extensão avisar que ela
// terminou. Nesse meio tempo a extensão reenvia o estado (com o resultado
// antigo) ao reler os arquivos; ele fica guardado e só o último é exibido.
const LIMITE_VERIFICACAO_MS = 120_000;
let verificacaoPendente: { id: number; challengeId: string } | undefined;
let contadorVerificacoes = 0;
let resultadoDuranteVerificacao: ResultadoAvaliacaoRecebido | undefined;
let historicoDuranteVerificacao: number[] | undefined;
let limiteVerificacao: number | undefined;

const vscode = acquireVsCodeApi();

const canvasAlvo = document.getElementById("canvasAlvo") as HTMLCanvasElement;
const canvasAnotacoes = document.getElementById(
  "canvasAnotacoes",
) as HTMLCanvasElement;
const seloDesafio = document.getElementById("seloDesafio") as HTMLSpanElement;
const metaDesafio = document.getElementById("metaDesafio") as HTMLElement;
const valorTempo = document.getElementById("valorTempo") as HTMLElement;
const valorFormato = document.getElementById("valorFormato") as HTMLElement;
const valorFundo = document.getElementById("valorFundo") as HTMLElement;
const valorComponentes = document.getElementById(
  "valorComponentes",
) as HTMLElement;
const detalheComponente = document.getElementById(
  "detalheComponente",
) as HTMLDivElement;
const avisoArquivos = document.getElementById("avisoArquivos") as HTMLElement;
const textoArquivos = document.getElementById("textoArquivos") as HTMLElement;
const botaoVistaPagina = document.getElementById(
  "botaoVistaPagina",
) as HTMLButtonElement;
const canvasPreviewAluno = document.getElementById(
  "canvasPreviewAluno",
) as HTMLCanvasElement;
const quadroAvaliacao = document.getElementById(
  "quadroAvaliacao",
) as HTMLDivElement;
const quadroDesafio = document.getElementById("quadroDesafio") as HTMLDivElement;
const quadroVazio = document.getElementById("quadroVazio") as HTMLElement;
const vistas = document.getElementById("vistas") as HTMLDivElement;
const botoesVista = Array.from(
  vistas.querySelectorAll<HTMLButtonElement>("[data-vista]"),
);
const historicoNotas = document.getElementById("historicoNotas") as HTMLElement;
const valorTentativas = document.getElementById("valorTentativas") as HTMLElement;
const valorMelhor = document.getElementById("valorMelhor") as HTMLElement;
// No histórico cabem as três últimas tentativas na largura da barra.
const TENTATIVAS_NO_HISTORICO = 3;
const caixaResultado = document.getElementById(
  "caixaResultado",
) as HTMLDivElement;
const notaResultado = document.getElementById("notaResultado") as HTMLDivElement;
const valorNota = document.getElementById("valorNota") as HTMLElement;
const barraNota = document.getElementById("barraNota") as HTMLSpanElement;
const simboloVerificar = document.getElementById(
  "simboloVerificar",
) as HTMLSpanElement;
const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");
// A nota sobe do valor anterior até o novo, junto com a barra.
const DURACAO_CONTAGEM_MS = 700;
let notaExibida = 0;
let animacaoNota: number | undefined;
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
const botaoAtualizarPreview = document.getElementById("botaoAtualizarPreview");
const botaoVerificar = document.getElementById(
  "botaoVerificar",
) as HTMLButtonElement;
const botaoSair = document.getElementById("botaoSair");
const cadastroTorneio = document.getElementById(
  "cadastroTorneio",
) as HTMLDivElement;
const botaoCadastrar = document.getElementById(
  "botaoCadastrar",
) as HTMLButtonElement;
const botaoAbrirAba = document.getElementById(
  "botaoAbrirAba",
) as HTMLButtonElement;
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

// O contorno mostra qual componente o detalhe descreve e some sozinho, como
// na aba do gabarito; o detalhe continua até outro clique.
const DURACAO_DESTAQUE_MS = 2500;
let destacadoId: number | undefined;
let sobMouseId: number | undefined;
let limpezaDestaque: number | undefined;

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

botaoCadastrar.addEventListener("click", () => {
  vscode.postMessage({ type: "cadastrarNoTorneio" });
});

canvasAnotacoes.addEventListener("click", selecionarComponenteNoCanvas);

for (const botao of botoesVista) {
  botao.addEventListener("click", () =>
    definirVista(botao.dataset.vista === "pagina" ? "pagina" : "gabarito"),
  );
}

function definirVista(vista: "gabarito" | "pagina"): void {
  quadroDesafio.dataset.vista = vista;
  for (const botao of botoesVista) {
    botao.setAttribute("aria-pressed", String(botao.dataset.vista === vista));
  }
  if (vista === "pagina") {
    sobMouseId = undefined;
    canvasAnotacoes.removeAttribute("data-sobre-componente");
    desenharDestaques();
  }
}

canvasAnotacoes.addEventListener("mousemove", (evento) => {
  const id = componenteSobPonteiro(evento)?.id;
  canvasAnotacoes.toggleAttribute("data-sobre-componente", id !== undefined);
  if (id !== sobMouseId) {
    sobMouseId = id;
    desenharDestaques();
  }
});

canvasAnotacoes.addEventListener("mouseleave", () => {
  sobMouseId = undefined;
  canvasAnotacoes.removeAttribute("data-sobre-componente");
  desenharDestaques();
});

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
  mostrarItensDoDesafio(true);

  if (mudouDesafio) {
    // Um desafio novo começa mostrando o gabarito.
    definirVista("gabarito");
    componenteSelecionadoId = undefined;
    destacadoId = undefined;
    sobMouseId = undefined;
    window.clearTimeout(limpezaDestaque);
    mostrarMensagem("Nenhuma verificação.");
    // Uma verificação do desafio anterior não vale para este.
    window.clearTimeout(limiteVerificacao);
    verificacaoPendente = undefined;
    resultadoDuranteVerificacao = undefined;
    historicoDuranteVerificacao = undefined;
  }

  // O cronômetro fica congelado ao encerrar, mas o aluno ainda pode
  // calcular o resultado final da tentativa. O estado é reenviado durante a
  // verificação, que mantém o botão desligado até terminar.
  botaoVerificar.disabled = Boolean(verificacaoPendente);
  botaoEncerrarDesafio.disabled = Boolean(desafio.encerrado);
  desenharDestaques();
  renderizarDetalheComponente();
  // Sem "px": na grade de dados ele quebraria a linha; o detalhe logo acima
  // já mostra a unidade.
  valorFormato.textContent =
    `${formatarMedida(desafio.width)} × ${formatarMedida(desafio.height)}`;
  valorFundo.replaceChildren(
    criarAmostra(desafio.backgroundColor),
    normalizarHex(desafio.backgroundColor),
  );
  valorComponentes.textContent = String(desafio.blocks.length);

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
  valorTempo.textContent = formatarTempo(tempoDecorrido);
  const estado = desafioAtual.encerrado ? "encerrado" : "andamento";
  if (seloDesafio.dataset.estado !== estado) {
    seloDesafio.dataset.estado = estado;
    seloDesafio.textContent = desafioAtual.encerrado
      ? "Encerrado"
      : "Em andamento";
  }
}

function desenharEstadoInicial(): void {
  canvasAlvo.width = LARGURA_PADRAO;
  canvasAlvo.height = ALTURA_PADRAO;
  aplicarProporcaoDoDesafio(LARGURA_PADRAO, ALTURA_PADRAO);
  const contexto = canvasAlvo.getContext("2d");

  if (!contexto) {
    return;
  }

  desenharGrade(contexto, LARGURA_PADRAO, ALTURA_PADRAO);
  seloDesafio.dataset.estado = "vazio";
  seloDesafio.textContent = "Sem desafio";
  mostrarItensDoDesafio(false);
  canvasAnotacoes.width = LARGURA_PADRAO;
  canvasAnotacoes.height = ALTURA_PADRAO;
  canvasAnotacoes
    .getContext("2d")
    ?.clearRect(0, 0, LARGURA_PADRAO, ALTURA_PADRAO);
  desenharMensagemPreview("");
  botaoVerificar.disabled = true;
  botaoEncerrarDesafio.disabled = true;
}

// Detalhe, dados e as ações sobre o desafio só existem depois de gerar um.
// Até lá, gerar o desafio é a ação principal; depois, é verificar.
function mostrarItensDoDesafio(visiveis: boolean): void {
  for (const item of [
    vistas,
    detalheComponente,
    metaDesafio,
    botaoAbrirAba,
    botaoEncerrarDesafio,
  ]) {
    item.hidden = !visiveis;
  }
  quadroVazio.hidden = visiveis;
  botaoNovoDesafio.classList.toggle("principal", !visiveis);
  botaoNovoDesafio.classList.toggle("secundario", visiveis);
}

function selecionarComponenteNoCanvas(evento: MouseEvent): void {
  if (!desafioAtual) {
    return;
  }

  const bloco = componenteSobPonteiro(evento);
  componenteSelecionadoId = bloco?.id;
  destacadoId = bloco?.id;
  window.clearTimeout(limpezaDestaque);
  if (bloco) {
    limpezaDestaque = window.setTimeout(() => {
      destacadoId = undefined;
      desenharDestaques();
    }, DURACAO_DESTAQUE_MS);
  }
  renderizarDetalheComponente();
  desenharDestaques();
}

function componenteSobPonteiro(
  evento: MouseEvent,
): DesafioRecebido["blocks"][number] | undefined {
  if (!desafioAtual) {
    return undefined;
  }

  const limites = canvasAnotacoes.getBoundingClientRect();
  const x =
    (evento.clientX - limites.left) * (canvasAnotacoes.width / limites.width);
  const y =
    (evento.clientY - limites.top) * (canvasAnotacoes.height / limites.height);
  return blocoNoPonto(desafioAtual.blocks, x, y);
}

function desenharDestaques(): void {
  const contexto = canvasAnotacoes.getContext("2d");
  if (!contexto) {
    return;
  }

  contexto.clearRect(0, 0, canvasAnotacoes.width, canvasAnotacoes.height);
  if (!desafioAtual) {
    return;
  }

  // A espessura acompanha a redução do gabarito na barra lateral.
  const escala =
    canvasAnotacoes.width /
    Math.max(1, canvasAnotacoes.getBoundingClientRect().width);
  const espessura = Math.max(2, 2 * escala);
  const destaques = new Set([sobMouseId, destacadoId]);
  for (const bloco of desafioAtual.blocks) {
    if (destaques.has(bloco.id)) {
      destacarBloco(contexto, bloco, espessura);
    }
  }
}

function renderizarDetalheComponente(): void {
  if (!desafioAtual) {
    return;
  }

  const bloco = desafioAtual.blocks.find(
    (candidato) => candidato.id === componenteSelecionadoId,
  );

  if (!bloco) {
    detalheComponente.textContent =
      "Clique num componente para ver medidas e cor.";
    return;
  }

  const circulo = bloco.shape === "circle";
  const nome = document.createElement("strong");
  nome.textContent = `#${bloco.id} ${circulo ? "Círculo" : "Retângulo"}`;
  const amostra = criarAmostra(bloco.color);
  amostra.classList.toggle("circulo", circulo);
  // Círculos também em largura e altura: o aluno os faz com border-radius.
  detalheComponente.replaceChildren(
    amostra,
    nome,
    criarMedida(
      `${formatarMedida(bloco.width)} × ${formatarMedida(bloco.height)} px`,
    ),
    criarMedida(normalizarHex(bloco.color)),
  );
}

function criarAmostra(cor: string): HTMLSpanElement {
  const amostra = document.createElement("span");
  amostra.className = "amostra";
  amostra.style.background = cor;
  return amostra;
}

function criarMedida(texto: string): HTMLSpanElement {
  const medida = document.createElement("span");
  medida.className = "medida";
  medida.textContent = texto;
  return medida;
}

function renderizarWorkspace(
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
      mostrarMensagem(
        "A verificação não respondeu. Tente de novo.",
      );
    }
  }, LIMITE_VERIFICACAO_MS);
  botaoVerificar.disabled = true;
  mostrarMensagem("Lendo os arquivos…");

  try {
    await atualizarWorkspaceAntesDaVerificacao();
  } catch (error) {
    if (desafioAtual?.challengeId !== challengeId) {
      return;
    }

    const mensagem =
      error instanceof Error ? error.message : "Falha ao atualizar o preview.";
    mostrarMensagem(
      `Preview: ${mensagem} Enviando assim mesmo…`,
    );
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

  mostrarMensagem("Medindo a página…");
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
  if (historicoDuranteVerificacao) {
    renderizarHistorico(historicoDuranteVerificacao);
    historicoDuranteVerificacao = undefined;
  }
}

// As últimas precisões do desafio e a melhor: a evolução, sem dizer o que
// está errado.
function renderizarHistorico(notas: number[]): void {
  historicoNotas.hidden = notas.length < 2;
  if (notas.length < 2) {
    return;
  }

  const ultimas = notas.slice(-TENTATIVAS_NO_HISTORICO);
  const partes: Array<Node | string> = notas.length > ultimas.length ? ["… "] : [];
  ultimas.forEach((nota, indice) => {
    const atual = indice === ultimas.length - 1;
    const valor = document.createElement("span");
    valor.className = atual ? "atual" : "anterior";
    valor.textContent = formatarPorcentagem(nota) + (atual ? "%" : "");
    partes.push(...(indice > 0 ? [" → ", valor] : [valor]));
  });
  valorTentativas.replaceChildren(...partes);
  valorMelhor.textContent = `${formatarPorcentagem(Math.max(...notas))}%`;
}

function formatarPorcentagem(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
  contexto.font = "500 34px sans-serif";
  contexto.textAlign = "center";
  contexto.textBaseline = "middle";
  contexto.fillText(mensagem, largura / 2, altura / 2, largura * 0.92);
}

// Grade de 100 px no quadro vazio, antes do primeiro desafio.
function desenharGrade(
  contexto: CanvasRenderingContext2D,
  largura: number,
  altura: number,
): void {
  contexto.fillStyle = "#faf7f5";
  contexto.fillRect(0, 0, largura, altura);
  contexto.strokeStyle = "rgba(21, 18, 24, 0.08)";
  contexto.lineWidth = 2;
  contexto.beginPath();
  for (let x = 100; x < largura; x += 100) {
    contexto.moveTo(x, 0);
    contexto.lineTo(x, altura);
  }
  for (let y = 100; y < altura; y += 100) {
    contexto.moveTo(0, y);
    contexto.lineTo(largura, y);
  }
  contexto.stroke();
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
    mostrarMensagem("Nenhuma verificação.");
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
    mostrarMensagem(resultado.error || "Não foi possível verificar.");
    return;
  }

  if (resultado.source === "servidor") {
    mostrarPrecisao(resultado.precision, Boolean(resultado.repetida));
    return;
  }

  if (
    resultado.source === "api-error" ||
    resultado.source === "authentication-error"
  ) {
    mostrarMensagem("Erro: " + (resultado.error || "desconhecido."));
    return;
  }

  mostrarMensagem(
    "Nota: " +
      resultado.score.toFixed(2) +
      " | Precisão: " +
      resultado.precision.toFixed(2) +
      "% | Fonte: " +
      resultado.source,
  );
}

function mostrarMensagem(texto: string): void {
  notaResultado.hidden = true;
  caixaResultado.textContent = texto;
}

function mostrarPrecisao(precisao: number, repetida: boolean): void {
  const valor = Math.round(Math.min(100, Math.max(0, precisao)) * 100) / 100;
  const inicio = notaResultado.hidden ? 0 : notaExibida;
  if (notaResultado.hidden) {
    // Depois de uma mensagem, a barra recomeça do zero, como o número.
    barraNota.style.width = "0";
    notaResultado.hidden = false;
    void barraNota.offsetWidth;
  }
  barraNota.style.width = `${valor}%`;
  contarNota(inicio, valor);
  simboloVerificar.classList.remove("pulo");
  void simboloVerificar.offsetWidth;
  simboloVerificar.classList.add("pulo");

  caixaResultado.textContent =
    "Precisão medida pelo servidor do torneio." +
    (repetida
      ? " A página não mudou desde a última verificação e não foi reenviada."
      : "");
}

function contarNota(de: number, ate: number): void {
  if (animacaoNota !== undefined) {
    cancelAnimationFrame(animacaoNota);
    animacaoNota = undefined;
  }

  if (reduzirMovimento.matches || de === ate) {
    escreverNota(ate);
    return;
  }

  const comeco = performance.now();
  const passo = (agora: number): void => {
    const progresso = Math.min(1, (agora - comeco) / DURACAO_CONTAGEM_MS);
    // Desacelera no fim, como a barra.
    const suave = 1 - Math.pow(1 - progresso, 3);
    escreverNota(progresso < 1 ? de + (ate - de) * suave : ate);
    animacaoNota = progresso < 1 ? requestAnimationFrame(passo) : undefined;
  };
  animacaoNota = requestAnimationFrame(passo);
}

function escreverNota(valor: number): void {
  notaExibida = valor;
  const porcento = document.createElement("small");
  porcento.textContent = "%";
  valorNota.replaceChildren(formatarPorcentagem(valor), porcento);
}

function renderizarEstadoAutenticacao(
  estado: EstadoAutenticacaoRecebido,
): void {
  if (!statusAutenticacao) {
    return;
  }

  cadastroTorneio.hidden = !(
    estado.status === "authenticated" && estado.podeCadastrar
  );

  if (estado.status === "checking") {
    statusAutenticacao.textContent = estado.message || "Validando a sessão…";
    return;
  }

  if (estado.status === "authenticated") {
    const nome = estado.displayName || estado.email || "Usuário";
    statusAutenticacao.innerHTML =
      `<strong>${escapeHtml(nome)}</strong>` +
      (estado.aviso
        ? `<span class="aviso-cadastro">${escapeHtml(estado.aviso)}</span>`
        : "");
    renderizarAvatar(nome, estado.avatarUrl);
    return;
  }

  if (estado.status === "error") {
    statusAutenticacao.textContent =
      estado.message || "Não foi possível validar a sessão.";
    return;
  }

  statusAutenticacao.textContent =
    estado.message ||
    "Entre para usar a extensão.";
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

    if (mensagem.type === "historicoNotas") {
      if (verificacaoPendente) {
        historicoDuranteVerificacao = mensagem.payload;
      } else {
        renderizarHistorico(mensagem.payload);
      }
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
      mostrarMensagem(mensagem.payload.mensagem);
    }

    if (
      mensagem.type === "verificacaoConcluida" &&
      mensagem.payload.id === verificacaoPendente?.id
    ) {
      concluirVerificacao();
    }

    if (mensagem.type === "statusServidor") {
      mostrarMensagem(mensagem.payload.mensagem);
    }

    if (mensagem.type === "estadoAutenticacao") {
      renderizarEstadoAutenticacao(mensagem.payload);
    }

    if (mensagem.type === "extensoesIa") {
      const nomes = mensagem.payload.map((extensao) => extensao.nome);
      avisoIa.hidden = nomes.length === 0;
      textoAvisoIa.textContent =
        `${nomes.join(", ")}. Desabilite e reinicie as extensões para treinar.`;
      // A extensão também recusa; o botão desligado só deixa isso claro.
      botaoNovoDesafio.disabled = nomes.length > 0;
      botaoNovoDesafio.title =
        nomes.length > 0 ? "Desabilite as extensões de IA." : "";
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
