import {
  blocoNoPonto,
  destacarBloco,
  formatarMedida,
  normalizarHex,
} from "../desenhoGabarito";
import { canvasAnotacoes, detalheComponente } from "./elementos";
import { estado } from "./estado";
import type { BlocoRecebido } from "./tipos";

// O componente escolhido no gabarito: o contorno e o detalhe com medidas e cor.
// O contorno mostra qual componente o detalhe descreve e some sozinho, como
// na aba do gabarito; o detalhe continua até outro clique.
const DURACAO_DESTAQUE_MS = 2500;
let componenteSelecionadoId: number | undefined;
let destacadoId: number | undefined;
let sobMouseId: number | undefined;
let limpezaDestaque: number | undefined;

export function ligarComponentes(): void {
  canvasAnotacoes.addEventListener("click", selecionarComponenteNoCanvas);

  canvasAnotacoes.addEventListener("mousemove", (evento) => {
    const id = componenteSobPonteiro(evento)?.id;
    canvasAnotacoes.toggleAttribute("data-sobre-componente", id !== undefined);
    if (id !== sobMouseId) {
      sobMouseId = id;
      desenharDestaques();
    }
  });

  canvasAnotacoes.addEventListener("mouseleave", tirarPonteiro);
}

/** O ponteiro saiu do gabarito, ou a vista mudou para a página. */
export function tirarPonteiro(): void {
  sobMouseId = undefined;
  canvasAnotacoes.removeAttribute("data-sobre-componente");
  desenharDestaques();
}

/** Um desafio novo começa sem componente escolhido. */
export function esquecerComponentes(): void {
  componenteSelecionadoId = undefined;
  destacadoId = undefined;
  sobMouseId = undefined;
  window.clearTimeout(limpezaDestaque);
}

function selecionarComponenteNoCanvas(evento: MouseEvent): void {
  if (!estado.desafio) {
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

function componenteSobPonteiro(evento: MouseEvent): BlocoRecebido | undefined {
  if (!estado.desafio) {
    return undefined;
  }

  const limites = canvasAnotacoes.getBoundingClientRect();
  const x =
    (evento.clientX - limites.left) * (canvasAnotacoes.width / limites.width);
  const y =
    (evento.clientY - limites.top) * (canvasAnotacoes.height / limites.height);
  return blocoNoPonto(estado.desafio.blocks, x, y);
}

export function desenharDestaques(): void {
  const contexto = canvasAnotacoes.getContext("2d");
  if (!contexto) {
    return;
  }

  contexto.clearRect(0, 0, canvasAnotacoes.width, canvasAnotacoes.height);
  if (!estado.desafio) {
    return;
  }

  // A espessura acompanha a redução do gabarito na barra lateral.
  const escala =
    canvasAnotacoes.width /
    Math.max(1, canvasAnotacoes.getBoundingClientRect().width);
  const espessura = Math.max(2, 2 * escala);
  const destaques = new Set([sobMouseId, destacadoId]);
  for (const bloco of estado.desafio.blocks) {
    if (destaques.has(bloco.id)) {
      destacarBloco(contexto, bloco, espessura);
    }
  }
}

export function renderizarDetalheComponente(): void {
  if (!estado.desafio) {
    return;
  }

  const bloco = estado.desafio.blocks.find(
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

export function criarAmostra(cor: string): HTMLSpanElement {
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
