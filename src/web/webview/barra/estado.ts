import type { DesafioRecebido } from "./tipos";

// O desafio que a barra lateral mostra, lido por quase todas as partes dela.
export const estado: { desafio?: DesafioRecebido } = {};

// As dimensões vêm do gabarito. Estes valores, iguais aos do gerador, só
// valem enquanto nenhum desafio foi gerado.
export const LARGURA_PADRAO = 800;
export const ALTURA_PADRAO = 800;

export function dimensoesDoDesafio(): { largura: number; altura: number } {
  return {
    largura: estado.desafio?.width ?? LARGURA_PADRAO,
    altura: estado.desafio?.height ?? ALTURA_PADRAO,
  };
}
