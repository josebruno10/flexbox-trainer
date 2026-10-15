import { desenharDestaques } from "./destaques";
import {
  ajuda,
  botaoLista,
  botoesModo,
  controleOpacidade,
  lista,
  opacidade,
  palco,
  superficie,
  telas,
  textoBotaoLista,
  valorOpacidade,
} from "./elementos";
import { estado } from "./estado";
import type { Modo } from "./tipos";

// Os modos da aba (Gabarito, Sobrepor e Lado a lado), a lista que aparece ou
// some e o tamanho das imagens no espaço livre.

// Espaço reservado para a lista ao lado da imagem; abaixo da largura de uma
// coluna, a lista vai para baixo (mesmo limite do CSS).
const LARGURA_LISTA = 300;
const LARGURA_UMA_COLUNA = 680;
const ESPACO = 16;

// Só o modo Gabarito tem uma linha de ajuda; nos outros, ela some.
const AJUDA: Partial<Record<Modo, string>> = {
  gabarito: "Clique num componente para destacá-lo e num valor para copiá-lo.",
};

export function definirModo(novo: Modo): void {
  const mudou = novo !== estado.modo;
  estado.modo = novo;
  if (mudou) {
    mostrarLista(novo !== "lado");
  }
  palco.dataset.modo = novo;
  for (const botao of botoesModo) {
    botao.setAttribute("aria-pressed", String(botao.dataset.modo === novo));
  }
  controleOpacidade.hidden = novo !== "sobreposto";
  ajuda.textContent = AJUDA[novo] ?? "";
  ajuda.hidden = !AJUDA[novo];
  aplicarOpacidade();
  ajustarTamanho();
}

export function mostrarLista(visivel: boolean): void {
  estado.listaVisivel = visivel;
  lista.hidden = !visivel;
  botaoLista.setAttribute("aria-expanded", String(visivel));
  rotularBotaoLista();
  ajustarTamanho();
}

// O texto diz o que o clique faz e, escondida, quantos componentes há.
export function rotularBotaoLista(): void {
  textoBotaoLista.textContent = estado.listaVisivel
    ? "Esconder componentes"
    : `Mostrar componentes (${estado.gabarito?.blocks.length ?? 0})`;
}

export function aplicarOpacidade(): void {
  valorOpacidade.textContent = `${opacidade.value}%`;
  palco.style.setProperty(
    "--opacidade-gabarito",
    String(Number(opacidade.value) / 100),
  );
}

// As imagens ocupam o espaço livre da aba, sem passar do tamanho real.
export function ajustarTamanho(): void {
  const gabarito = estado.gabarito;
  if (!gabarito) {
    return;
  }

  const umaColuna = window.innerWidth <= LARGURA_UMA_COLUNA;
  const quadros = estado.modo === "lado" ? 2 : 1;
  const larguraLivre =
    window.innerWidth -
    ESPACO * 2 -
    (umaColuna || !estado.listaVisivel ? 0 : LARGURA_LISTA + ESPACO);
  const larguraPorQuadro = (larguraLivre - (quadros - 1) * ESPACO) / quadros;
  const topo = palco.getBoundingClientRect().top + window.scrollY;
  // Legenda dos quadros lado a lado e a linha de ajuda embaixo.
  const reserva = (estado.modo === "lado" ? 24 : 0) + 56;
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
