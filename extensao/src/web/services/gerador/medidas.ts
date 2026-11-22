// Os tamanhos mínimos do gerador acompanham a imagem, como no script do Vitor
// desde o commit d92b217: são frações da média dos dois lados. No 800x800,
// dão os 70, 15, 20 e 30 px de antes; numa imagem maior, tudo cresce junto,
// e ela sai como uma menor ampliada, sem mais componentes. As contas seguem
// a ordem do script, para dar os mesmos números.
//
// Continuam em px, como no script: o espaço entre os itens de uma sequência
// e os limites de "cabe um elemento" e "cabe uma sequência".
export type Medidas = {
  // Nenhuma parte de um corte fica menor que isto (tamanhoMin).
  tamanhoMinimo: number;
  // Cada elemento fica a esta distância das bordas da região (margemMin).
  margem: number;
  diametroMinimo: number;
  // O espaço mínimo entre os círculos de uma fileira (minGap).
  espacoCirculos: number;
};

export function medidasDaImagem(largura: number, altura: number): Medidas {
  const media = (largura + altura) / 2;
  return {
    tamanhoMinimo: media * (7 / 80),
    margem: media * (15 / 800),
    diametroMinimo: media * (2 / 80),
    espacoCirculos: media * (3 / 80),
  };
}
