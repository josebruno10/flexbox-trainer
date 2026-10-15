// O script da aba do gabarito. As partes dela ficam em ./aba; aqui chegam as
// mensagens da extensão e ficam os ouvintes da página.
import { desenharGabarito } from "./desenhoGabarito";
import { montarPaginaAluno } from "./paginaAluno";
import { vscode } from "./api";
import { renderizarLista, renderizarResumo } from "./aba/componentes";
import {
  blocoSobPonteiro,
  definirSelecao,
  esquecerSelecao,
  passarMouse,
  selecionar,
} from "./aba/destaques";
import {
  botaoLista,
  botoesModo,
  canvas,
  canvasDestaque,
  conteudo,
  lista,
  opacidade,
  semPagina,
  superficie,
  vazio,
} from "./aba/elementos";
import { estado } from "./aba/estado";
import {
  ajustarTamanho,
  aplicarOpacidade,
  definirModo,
  mostrarLista,
  rotularBotaoLista,
} from "./aba/modos";
import type { MensagemDaExtensao, Modo } from "./aba/tipos";

window.addEventListener("message", (evento: MessageEvent<MensagemDaExtensao>) => {
  const mensagem = evento.data;

  if (mensagem?.type === "desafio") {
    const novo = mensagem.payload ?? undefined;
    if (novo?.challengeId !== estado.gabarito?.challengeId) {
      esquecerSelecao();
    }
    estado.gabarito = novo;
    renderizar();
  }

  if (mensagem?.type === "paginaAluno") {
    estado.htmlAluno = mensagem.payload ?? undefined;
    renderizarPagina();
  }
});

for (const botao of botoesModo) {
  botao.addEventListener("click", () => definirModo(botao.dataset.modo as Modo));
}

opacidade.addEventListener("input", aplicarOpacidade);

botaoLista.addEventListener("click", () => mostrarLista(!estado.listaVisivel));

canvas.addEventListener("click", (evento) => {
  selecionar(blocoSobPonteiro(evento)?.id, true);
});

canvas.addEventListener("mousemove", (evento) => {
  const id = blocoSobPonteiro(evento)?.id;
  canvas.style.cursor = id === undefined ? "default" : "pointer";
  passarMouse(id);
});

canvas.addEventListener("mouseleave", () => passarMouse(undefined));

document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape") {
    definirSelecao(undefined, false);
  }
});

window.addEventListener("resize", ajustarTamanho);

function renderizar(): void {
  const gabarito = estado.gabarito;
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
  rotularBotaoLista();
  renderizarPagina();
  definirModo(estado.modo);
}

function renderizarPagina(): void {
  const gabarito = estado.gabarito;
  if (!gabarito) {
    return;
  }

  semPagina.hidden = Boolean(estado.htmlAluno);
  if (estado.htmlAluno) {
    montarPaginaAluno(superficie, estado.htmlAluno, gabarito.width, gabarito.height);
  } else {
    superficie.shadowRoot?.replaceChildren();
  }
}

vscode.postMessage({ type: "pronto" });
