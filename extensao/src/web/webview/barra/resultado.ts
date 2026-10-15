import {
  barraNota,
  botaoVerificar,
  caixaResultado,
  notaResultado,
  simboloVerificar,
  valorNota,
} from "./elementos";
import { estado } from "./estado";
import { formatarPorcentagem } from "./formatos";
import type { ResultadoAvaliacaoRecebido } from "./tipos";

const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");
// A nota sobe do valor anterior até o novo, junto com a barra.
const DURACAO_CONTAGEM_MS = 700;
let notaExibida = 0;
let animacaoNota: number | undefined;

export function renderizarResultado(
  resultado: ResultadoAvaliacaoRecebido | undefined,
): void {
  botaoVerificar.disabled = !estado.desafio;

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

export function mostrarMensagem(texto: string): void {
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
