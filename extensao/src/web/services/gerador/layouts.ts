import { Retangulo } from "./padroes";
import { Aleatorio, inteiroAleatorio } from "./sorteio";

// As faixas principais do layout, que depois são cortadas (veja regioes.ts).
// 0 corta a faixa em partes lado a lado, 1 em faixas empilhadas.
export type FaixaPrincipal = { area: Retangulo; direcao: 0 | 1 };

// Os 8 layouts primários do script original, em frações da largura (L) e da
// altura (A) da imagem, a proporcaoImagem dele. As contas seguem a ordem do
// script (L * 2 / 3, e não 2 / 3 * L), para dar os mesmos números.
export function escolherLayoutPrimario(
  aleatorio: Aleatorio,
  direcao: 0 | 1,
  L: number,
  A: number,
): FaixaPrincipal[] {
  const faixa = (
    x: number,
    y: number,
    width: number,
    height: number,
    direcaoDaFaixa: 0 | 1 = direcao,
  ): FaixaPrincipal => ({ area: { x, y, width, height }, direcao: direcaoDaFaixa });

  switch (inteiroAleatorio(aleatorio, 0, 7)) {
    case 0:
      // Cabeçalho, conteúdo e rodapé.
      return [
        faixa(0, 0, L, A / 4, 0),
        faixa(0, A / 4, L, A / 2),
        faixa(0, (A * 3) / 4, L, A / 4, 0),
      ];
    case 1:
      // Três colunas.
      return [
        faixa(0, 0, L / 4, A, 1),
        faixa(L / 4, 0, L / 2, A),
        faixa((L * 3) / 4, 0, L / 4, A, 1),
      ];
    case 2:
      // Duas colunas sobre um rodapé.
      return [
        faixa(0, 0, (L * 3) / 8, (A * 3) / 4),
        faixa((L * 3) / 8, 0, (L * 5) / 8, (A * 3) / 4),
        faixa(0, (A * 3) / 4, L, A / 4),
      ];
    case 3:
      // Cabeçalho, uma coluna estreita e outra larga, e rodapé.
      return [
        faixa(0, 0, L, A / 4),
        faixa(0, A / 4, L / 4, A / 2),
        faixa(L / 4, A / 4, (L * 3) / 4, A / 2),
        faixa(0, (A * 3) / 4, L, A / 4),
      ];
    case 4:
      // Uma faixa em cima e três colunas iguais embaixo.
      return [
        faixa(0, 0, L, (A * 4) / 10),
        faixa(0, (A * 4) / 10, L / 3, (A * 6) / 10),
        faixa(L / 3, (A * 4) / 10, L / 3, (A * 6) / 10),
        faixa((L * 2) / 3, (A * 4) / 10, L / 3, (A * 6) / 10),
      ];
    case 5:
      // Quatro quadrantes.
      return [
        faixa(0, 0, L / 2, A / 2),
        faixa(L / 2, 0, L / 2, A / 2),
        faixa(0, A / 2, L / 2, A / 2),
        faixa(L / 2, A / 2, L / 2, A / 2),
      ];
    case 6:
      // Uma coluna larga e, ao lado, duas partes empilhadas.
      return [
        faixa(0, 0, (L * 6) / 10, A),
        faixa((L * 6) / 10, 0, (L * 4) / 10, A / 2),
        faixa((L * 6) / 10, A / 2, (L * 4) / 10, A / 2),
      ];
    default:
      // Barra no topo, menu à esquerda e duas partes empilhadas à direita.
      return [
        faixa(0, 0, L, A / 8),
        faixa(0, A / 8, L / 5, (A * 7) / 8),
        faixa(L / 5, A / 8, (L * 4) / 5, (A * 7) / 16),
        faixa(L / 5, (A * 9) / 16, (L * 4) / 5, (A * 7) / 16),
      ];
  }
}
