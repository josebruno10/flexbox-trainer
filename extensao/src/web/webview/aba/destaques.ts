import type { Bloco } from "../../types";
import { blocoNoPonto, destacarBloco } from "../desenhoGabarito";
import { canvas, canvasDestaque, lista } from "./elementos";
import { estado } from "./estado";

// O componente escolhido e o que está sob o mouse, destacados na imagem e na
// lista. Como na extensão do torneio, o destaque some sozinho: preso na
// imagem, ele atrapalha comparar o gabarito com a página.
const DURACAO_SELECAO_MS = 2500;

// Clicar de novo no mesmo componente, ou fora deles, tira o destaque.
export function selecionar(id: number | undefined, rolarLista: boolean): void {
  definirSelecao(id === estado.selecionadoId ? undefined : id, rolarLista);
}

export function definirSelecao(id: number | undefined, rolarLista: boolean): void {
  estado.selecionadoId = id;
  window.clearTimeout(estado.limpezaSelecao);
  if (id !== undefined) {
    estado.limpezaSelecao = window.setTimeout(
      () => definirSelecao(undefined, false),
      DURACAO_SELECAO_MS,
    );
  }
  lista.querySelectorAll<HTMLLIElement>(".componente").forEach((item) => {
    const ativo = Number(item.dataset.id) === estado.selecionadoId;
    item.classList.toggle("selecionado", ativo);
    if (ativo && rolarLista) {
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
  desenharDestaques();
}

/** Um desafio novo começa sem destaque. */
export function esquecerSelecao(): void {
  window.clearTimeout(estado.limpezaSelecao);
  estado.selecionadoId = undefined;
  estado.sobMouseId = undefined;
}

export function passarMouse(id: number | undefined): void {
  if (id !== estado.sobMouseId) {
    estado.sobMouseId = id;
    desenharDestaques();
  }
}

// Camada própria: o destaque fica nítido mesmo com o gabarito transparente.
export function desenharDestaques(): void {
  const contexto = canvasDestaque.getContext("2d");
  const gabarito = estado.gabarito;
  if (!gabarito || !contexto) {
    return;
  }

  contexto.clearRect(0, 0, canvasDestaque.width, canvasDestaque.height);
  // A espessura acompanha a redução da imagem na aba.
  const escala =
    canvasDestaque.width /
    Math.max(1, canvasDestaque.getBoundingClientRect().width);
  const espessura = Math.max(2, 2 * escala);
  const destaques = new Set([estado.sobMouseId, estado.selecionadoId]);
  for (const bloco of gabarito.blocks) {
    if (destaques.has(bloco.id)) {
      destacarBloco(contexto, bloco, espessura);
    }
  }
}

export function blocoSobPonteiro(evento: MouseEvent): Bloco | undefined {
  if (!estado.gabarito) {
    return undefined;
  }

  const limites = canvas.getBoundingClientRect();
  const x = (evento.clientX - limites.left) * (canvas.width / limites.width);
  const y = (evento.clientY - limites.top) * (canvas.height / limites.height);
  return blocoNoPonto(estado.gabarito.blocks, x, y);
}
