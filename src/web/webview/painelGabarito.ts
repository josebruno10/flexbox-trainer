import type { Bloco, Desafio } from "../types";
import {
  blocoNoPonto,
  desenharGabarito,
  destacarBloco,
  formatarMedida,
  normalizarHex,
} from "./desenhoGabarito";
import { montarPaginaAluno } from "./paginaAluno";

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

type GabaritoRecebido = Pick<
  Desafio,
  "challengeId" | "width" | "height" | "backgroundColor" | "blocks"
>;

type Modo = "gabarito" | "sobreposto" | "lado";

type MensagemDaExtensao =
  | { type: "desafio"; payload: GabaritoRecebido | null }
  | { type: "paginaAluno"; payload: string | null };

// Espaço reservado para a lista ao lado da imagem; abaixo da largura de uma
// coluna, a lista vai para baixo (mesmo limite do CSS).
const LARGURA_LISTA = 300;
const LARGURA_UMA_COLUNA = 680;
const ESPACO = 16;

const AJUDA: Record<Modo, string> = {
  gabarito:
    "Clique em um componente na imagem ou na lista para destacá-lo. Clique em um valor para copiá-lo.",
  sobreposto:
    "Arraste o controle para ver mais a sua página ou mais o gabarito. A sua página atualiza quando você salva index.html ou style.css.",
  lado: "A sua página atualiza quando você salva index.html ou style.css.",
};

const vscode = acquireVsCodeApi();
const canvas = elemento<HTMLCanvasElement>("canvasGabarito");
const canvasDestaque = elemento<HTMLCanvasElement>("canvasDestaque");
const superficie = elemento<HTMLDivElement>("superficieAluno");
const semPagina = elemento<HTMLDivElement>("semPagina");
const palco = elemento<HTMLDivElement>("palco");
const telas = [
  elemento<HTMLDivElement>("telaGabarito"),
  elemento<HTMLDivElement>("telaAluno"),
];
const controleOpacidade = elemento<HTMLDivElement>("controleOpacidade");
const opacidade = elemento<HTMLInputElement>("opacidade");
const valorOpacidade = elemento<HTMLElement>("valorOpacidade");
const ajuda = elemento<HTMLDivElement>("ajuda");
const resumo = elemento<HTMLDivElement>("resumo");
const lista = elemento<HTMLUListElement>("listaComponentes");
const vazio = elemento<HTMLDivElement>("vazio");
const conteudo = elemento<HTMLDivElement>("conteudo");

let gabarito: GabaritoRecebido | undefined;
let htmlAluno: string | undefined;
let modo: Modo = "gabarito";
let selecionadoId: number | undefined;
let sobMouseId: number | undefined;

window.addEventListener("message", (evento: MessageEvent<MensagemDaExtensao>) => {
  const mensagem = evento.data;

  if (mensagem?.type === "desafio") {
    const novo = mensagem.payload ?? undefined;
    if (novo?.challengeId !== gabarito?.challengeId) {
      selecionadoId = undefined;
      sobMouseId = undefined;
    }
    gabarito = novo;
    renderizar();
  }

  if (mensagem?.type === "paginaAluno") {
    htmlAluno = mensagem.payload ?? undefined;
    renderizarPagina();
  }
});

document.querySelectorAll<HTMLButtonElement>(".modo").forEach((botao) => {
  botao.addEventListener("click", () => definirModo(botao.dataset.modo as Modo));
});

opacidade.addEventListener("input", aplicarOpacidade);

canvas.addEventListener("click", (evento) => {
  selecionar(blocoSobPonteiro(evento)?.id, true);
});

canvas.addEventListener("mousemove", (evento) => {
  const id = blocoSobPonteiro(evento)?.id;
  canvas.style.cursor = id === undefined ? "default" : "pointer";
  if (id !== sobMouseId) {
    sobMouseId = id;
    desenharDestaques();
  }
});

canvas.addEventListener("mouseleave", () => {
  sobMouseId = undefined;
  desenharDestaques();
});

window.addEventListener("resize", ajustarTamanho);

function renderizar(): void {
  conteudo.hidden = !gabarito;
  vazio.hidden = Boolean(gabarito);

  if (!gabarito) {
    lista.replaceChildren();
    return;
  }

  for (const camada of [canvas, canvasDestaque]) {
    camada.width = gabarito.width;
    camada.height = gabarito.height;
  }
  const contexto = canvas.getContext("2d");
  if (contexto) {
    desenharGabarito(contexto, gabarito);
  }
  renderizarResumo(gabarito);
  renderizarLista(gabarito);
  renderizarPagina();
  definirModo(modo);
}

function renderizarPagina(): void {
  if (!gabarito) {
    return;
  }

  semPagina.hidden = Boolean(htmlAluno);
  if (htmlAluno) {
    montarPaginaAluno(superficie, htmlAluno, gabarito.width, gabarito.height);
  } else {
    superficie.shadowRoot?.replaceChildren();
  }
}

function definirModo(novo: Modo): void {
  modo = novo;
  palco.dataset.modo = novo;
  document.querySelectorAll<HTMLButtonElement>(".modo").forEach((botao) => {
    botao.setAttribute("aria-pressed", String(botao.dataset.modo === novo));
  });
  controleOpacidade.hidden = novo !== "sobreposto";
  ajuda.textContent = AJUDA[novo];
  aplicarOpacidade();
  ajustarTamanho();
}

function aplicarOpacidade(): void {
  valorOpacidade.textContent = `${opacidade.value}%`;
  palco.style.setProperty(
    "--opacidade-gabarito",
    String(Number(opacidade.value) / 100),
  );
}

// As imagens ocupam o espaço livre da aba, sem passar do tamanho real.
function ajustarTamanho(): void {
  if (!gabarito) {
    return;
  }

  const umaColuna = window.innerWidth <= LARGURA_UMA_COLUNA;
  const quadros = modo === "lado" ? 2 : 1;
  const larguraLivre =
    window.innerWidth - ESPACO * 2 - (umaColuna ? 0 : LARGURA_LISTA + ESPACO);
  const larguraPorQuadro = (larguraLivre - (quadros - 1) * ESPACO) / quadros;
  const topo = palco.getBoundingClientRect().top + window.scrollY;
  // Legenda dos quadros lado a lado e a linha de ajuda embaixo.
  const reserva = (modo === "lado" ? 24 : 0) + 56;
  const alturaLivre = umaColuna ? Infinity : window.innerHeight - topo - reserva;
  const escala = Math.max(
    0.05,
    Math.min(1, larguraPorQuadro / gabarito.width, alturaLivre / gabarito.height),
  );

  for (const tela of telas) {
    tela.style.width = `${Math.round(gabarito.width * escala)}px`;
    tela.style.height = `${Math.round(gabarito.height * escala)}px`;
  }
  superficie.style.transform = `scale(${escala})`;
  desenharDestaques();
}

function renderizarResumo(atual: GabaritoRecebido): void {
  const titulo = document.createElement("strong");
  titulo.textContent = `Gabarito ${atual.width} × ${atual.height} px`;
  const fundo = document.createElement("span");
  fundo.className = "fundo";
  const corFundo = normalizarHex(atual.backgroundColor);
  fundo.append(
    "fundo ",
    criarAmostra(atual.backgroundColor),
    " ",
    criarValor(corFundo, corFundo, "Copiar a cor do fundo"),
  );
  const contagem = document.createElement("span");
  contagem.className = "contagem";
  contagem.textContent = `${atual.blocks.length} componentes`;
  resumo.replaceChildren(titulo, fundo, contagem);
}

function renderizarLista(atual: GabaritoRecebido): void {
  lista.replaceChildren(
    ...atual.blocks.map((bloco) => {
      const item = document.createElement("li");
      item.className = "componente";
      item.dataset.id = String(bloco.id);
      item.classList.toggle("selecionado", bloco.id === selecionadoId);

      const nome = document.createElement("strong");
      const circulo = bloco.shape === "circle";
      nome.textContent = `#${bloco.id} ${circulo ? "Círculo" : "Retângulo"}`;

      const largura = formatarMedida(bloco.width);
      const altura = formatarMedida(bloco.height);
      const cor = normalizarHex(bloco.color);
      const valores = document.createElement("div");
      valores.className = "valores";
      valores.append(
        ...(circulo
          ? [criarValor(`diâm. ${largura} px`, `${largura}px`, "Copiar o diâmetro")]
          : [
              criarValor(`larg. ${largura} px`, `${largura}px`, "Copiar a largura"),
              criarValor(`alt. ${altura} px`, `${altura}px`, "Copiar a altura"),
            ]),
        criarValor(cor, cor, "Copiar a cor"),
      );

      const info = document.createElement("div");
      info.className = "info";
      info.append(nome, valores);
      item.append(criarAmostra(bloco.color), info);
      item.addEventListener("click", () => selecionar(bloco.id, false));
      item.addEventListener("mouseenter", () => {
        sobMouseId = bloco.id;
        desenharDestaques();
      });
      item.addEventListener("mouseleave", () => {
        sobMouseId = undefined;
        desenharDestaques();
      });
      return item;
    }),
  );
}

function selecionar(id: number | undefined, rolarLista: boolean): void {
  selecionadoId = id === selecionadoId ? undefined : id;
  lista.querySelectorAll<HTMLLIElement>(".componente").forEach((item) => {
    const ativo = Number(item.dataset.id) === selecionadoId;
    item.classList.toggle("selecionado", ativo);
    if (ativo && rolarLista) {
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
  desenharDestaques();
}

// Camada própria: o destaque fica nítido mesmo com o gabarito transparente.
function desenharDestaques(): void {
  const contexto = canvasDestaque.getContext("2d");
  if (!gabarito || !contexto) {
    return;
  }

  contexto.clearRect(0, 0, canvasDestaque.width, canvasDestaque.height);
  // A espessura acompanha a redução da imagem na aba.
  const escala =
    canvasDestaque.width /
    Math.max(1, canvasDestaque.getBoundingClientRect().width);
  const espessura = Math.max(2, 2 * escala);
  const destaques = new Set([sobMouseId, selecionadoId]);
  for (const bloco of gabarito.blocks) {
    if (destaques.has(bloco.id)) {
      destacarBloco(contexto, bloco, espessura);
    }
  }
}

function blocoSobPonteiro(evento: MouseEvent): Bloco | undefined {
  if (!gabarito) {
    return undefined;
  }

  const limites = canvas.getBoundingClientRect();
  const x = (evento.clientX - limites.left) * (canvas.width / limites.width);
  const y = (evento.clientY - limites.top) * (canvas.height / limites.height);
  return blocoNoPonto(gabarito.blocks, x, y);
}

function criarAmostra(cor: string): HTMLSpanElement {
  const amostra = document.createElement("span");
  amostra.className = "amostra";
  amostra.style.background = cor;
  return amostra;
}

// Clicar em um valor copia só o valor, sem selecionar o componente.
function criarValor(
  rotulo: string,
  texto: string,
  dica: string,
): HTMLButtonElement {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "valor";
  botao.textContent = rotulo;
  botao.title = `${dica}: ${texto}`;
  botao.addEventListener("click", (evento) => {
    evento.stopPropagation();
    vscode.postMessage({ type: "copiar", texto });
    botao.classList.add("copiado");
    window.setTimeout(() => botao.classList.remove("copiado"), 900);
  });
  return botao;
}

function elemento<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

vscode.postMessage({ type: "pronto" });
