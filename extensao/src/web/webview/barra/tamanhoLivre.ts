import { TAMANHO_LIVRE_MAXIMO, TAMANHO_LIVRE_MINIMO } from "../../formatos";
import type { Formato, Tamanho } from "../../types";
import { vscode } from "../api";
import { alturaLivre, larguraLivre, linhaTamanhoLivre } from "./elementos";

// A largura e a altura do formato livre. Os campos só aparecem com o Livre
// escolhido e valem para os desafios novos: o tamanho de um desafio não muda
// depois de gerado.

/** Mostra os campos só no formato livre. */
export function mostrarTamanhoLivre(formato: Formato): void {
  linhaTamanhoLivre.hidden = formato !== "livre";
}

/** O tamanho guardado pela extensão; o campo em que o aluno digita fica. */
export function marcarTamanhoLivre(tamanho: Tamanho): void {
  for (const [campo, valor] of [
    [larguraLivre, tamanho.largura],
    [alturaLivre, tamanho.altura],
  ] as const) {
    if (document.activeElement !== campo) {
      campo.value = String(valor);
    }
  }
}

export function ligarTamanhoLivre(): void {
  // Ao sair do campo ou apertar Enter: um valor fora dos limites vai para o
  // limite mais próximo.
  const enviar = () => {
    const lado = (campo: HTMLInputElement, maximo: number) => {
      const valor = Math.round(Number(campo.value));
      const limitado = Number.isFinite(valor)
        ? Math.min(maximo, Math.max(TAMANHO_LIVRE_MINIMO, valor))
        : TAMANHO_LIVRE_MINIMO;
      campo.value = String(limitado);
      return limitado;
    };
    vscode.postMessage({
      type: "definirTamanhoLivre",
      largura: lado(larguraLivre, TAMANHO_LIVRE_MAXIMO.largura),
      altura: lado(alturaLivre, TAMANHO_LIVRE_MAXIMO.altura),
    });
  };
  for (const campo of [larguraLivre, alturaLivre]) {
    campo.addEventListener("change", enviar);
  }
}
