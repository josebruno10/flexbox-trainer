import type { Nivel } from "./types";

// Os níveis de dificuldade, usados pela extensão e pelas telas.
export const NIVEIS: readonly Nivel[] = ["facil", "medio", "dificil"];

export const NOME_DO_NIVEL: Record<Nivel, string> = {
  facil: "fácil",
  medio: "médio",
  dificil: "difícil",
};

// O código do desafio: 4 letras de A a Z (veja services/codigoDesafio.ts).
export const LETRAS_DO_CODIGO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const TAMANHO_DO_CODIGO = 4;

/**
 * O nível vem do próprio código, pelo resto da divisão por 3: quem recebe um
 * código treina o mesmo desafio, no mesmo nível.
 */
export function nivelDoCodigo(codigo: string): Nivel {
  return NIVEIS[valorDoCodigo(codigo) % 3];
}

/**
 * O número do código, lendo as letras como algarismos de base 26 ("AAAA" é
 * 0, "AAAB" é 1).
 */
export function valorDoCodigo(codigo: string): number {
  let valor = 0;
  for (const letra of codigo) {
    valor = valor * LETRAS_DO_CODIGO.length + Math.max(0, LETRAS_DO_CODIGO.indexOf(letra));
  }
  return valor;
}

export function ehNivel(valor: unknown): valor is Nivel {
  return NIVEIS.includes(valor as Nivel);
}
