import type { Nivel } from "./types";

// Os níveis de dificuldade, usados pela extensão e pelas telas.
export const NIVEIS: readonly Nivel[] = ["facil", "medio", "dificil"];

export const NOME_DO_NIVEL: Record<Nivel, string> = {
  facil: "fácil",
  medio: "médio",
  dificil: "difícil",
};

/**
 * O nível vem do próprio código, pelo resto da divisão por 3: quem recebe um
 * código treina o mesmo desafio, no mesmo nível.
 */
export function nivelDoCodigo(codigo: string): Nivel {
  return NIVEIS[Number(codigo) % 3];
}

export function ehNivel(valor: unknown): valor is Nivel {
  return NIVEIS.includes(valor as Nivel);
}
