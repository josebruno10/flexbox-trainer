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
import type { GabaritoRecebido, Modo } from "./tipos";

// Os modos da aba (Gabarito, Sobrepor, Comparar e Lado a lado), a lista que aparece ou
// some e o tamanho das imagens e da lista no espaço livre.

// Ao lado da imagem, a lista fica com pelo menos um quarto da largura, entre
// 300 px (as medidas quebram em duas linhas) e 380 px (cada componente cabe
// numa linha só). Numa aba estreita, ela vai para baixo da imagem (mesmo
// limite do CSS).
const LISTA_MINIMA = 300;
const LISTA_UMA_LINHA = 380;
const ABA_ESTREITA = "(max-width: 680px)";
const ESPACO = 16;
// Numa aba baixa, a imagem e a lista param de diminuir aqui, e a aba rola.
const ALTURA_MINIMA = 240;
// Lado a lado, a lista só começa escondida se, com ela, as imagens ficassem
// com menos de 90% do tamanho que teriam sem ela.
const ESCALA_ACEITA = 0.9;

// Só os modos Gabarito e Comparar têm uma linha de ajuda; nos outros, ela some.
const AJUDA: Partial<Record<Modo, string>> = {
  gabarito: "Clique num componente para destacá-lo e num valor para copiá-lo.",
  comparar: "Arraste a linha, ou use as setas do teclado: à esquerda o gabarito, à direita a sua página.",
};

export function definirModo(novo: Modo): void {
  const mudou = novo !== estado.modo;
  estado.modo = novo;
  palco.dataset.modo = novo;
  for (const botao of botoesModo) {
    botao.setAttribute("aria-pressed", String(botao.dataset.modo === novo));
  }
  controleOpacidade.hidden = novo !== "sobreposto";
  ajuda.textContent = AJUDA[novo] ?? "";
  ajuda.hidden = !AJUDA[novo];
  aplicarOpacidade();
  if (mudou) {
    // Lado a lado, a lista começa escondida quando diminuiria bem as imagens.
    // Numa aba larga, elas já param na altura da aba, e a lista cabe ao lado.
    mostrarLista(novo !== "lado" || listaCabeAoLado());
  } else {
    ajustarTamanho();
  }
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

// As imagens ocupam o espaço livre da aba, sem passar do tamanho real, e a
// lista ao lado delas vai até o pé da aba.
export function ajustarTamanho(): void {
  const gabarito = estado.gabarito;
  if (!gabarito) {
    return;
  }

  // A lista primeiro: o topo dela não depende da imagem, e uma lista alta
  // demais por um instante punha a barra de rolagem na conta da largura.
  const aoLado = !window.matchMedia(ABA_ESTREITA).matches && estado.listaVisivel;
  lista.style.maxHeight = aoLado
    ? `${Math.max(ALTURA_MINIMA, alturaAteOPe(lista))}px`
    : "";

  aplicarEscala(gabarito, escalaDasImagens(gabarito, estado.listaVisivel));
  // A ajuda quebra na largura da imagem: com a imagem de outro tamanho, ela
  // pode ganhar ou perder uma linha, e a conta se refaz com a altura nova.
  aplicarEscala(gabarito, escalaDasImagens(gabarito, estado.listaVisivel));
  desenharDestaques();
}

// Cabem na largura livre (ao lado da lista, se ela aparece) e, numa aba
// larga, também na altura que sobra embaixo do topo.
function escalaDasImagens(gabarito: GabaritoRecebido, comLista: boolean): number {
  const estreita = window.matchMedia(ABA_ESTREITA).matches;
  const quadros = estado.modo === "lado" ? 2 : 1;
  // Sem a barra de rolagem, que ocupa espaço na aba.
  const larguraConteudo = document.documentElement.clientWidth - ESPACO * 2;
  const larguraLista = Math.min(
    LISTA_UMA_LINHA,
    Math.max(LISTA_MINIMA, larguraConteudo / 4),
  );
  const larguraLivre =
    larguraConteudo - (comLista && !estreita ? larguraLista + ESPACO : 0);
  const larguraPorQuadro = (larguraLivre - (quadros - 1) * ESPACO) / quadros;
  const alturaLivre = estreita
    ? Infinity
    : Math.max(ALTURA_MINIMA, alturaAteOPe(telas[0]) - alturaDaAjuda());
  return Math.max(
    0.05,
    Math.min(1, larguraPorQuadro / gabarito.width, alturaLivre / gabarito.height),
  );
}

function listaCabeAoLado(): boolean {
  const gabarito = estado.gabarito;
  return (
    gabarito !== undefined &&
    escalaDasImagens(gabarito, true) >=
      escalaDasImagens(gabarito, false) * ESCALA_ACEITA
  );
}

function aplicarEscala(gabarito: GabaritoRecebido, escala: number): void {
  for (const tela of telas) {
    tela.style.width = `${Math.round(gabarito.width * escala)}px`;
    tela.style.height = `${Math.round(gabarito.height * escala)}px`;
  }
  superficie.style.transform = `scale(${escala})`;
}

// Do topo do elemento até o pé da aba, menos a margem de baixo.
function alturaAteOPe(elemento: HTMLElement): number {
  const topo = elemento.getBoundingClientRect().top + window.scrollY;
  return document.documentElement.clientHeight - topo - ESPACO;
}

// A linha de ajuda embaixo das imagens, com o espaço até ela.
function alturaDaAjuda(): number {
  return ajuda.hidden
    ? 0
    : ajuda.getBoundingClientRect().bottom - telas[0].getBoundingClientRect().bottom;
}
