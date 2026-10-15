// Os elementos da aba do gabarito, pelo id que eles têm no HTML da aba.

function elemento<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export const canvas = elemento<HTMLCanvasElement>("canvasGabarito");
export const canvasDestaque = elemento<HTMLCanvasElement>("canvasDestaque");
export const superficie = elemento<HTMLDivElement>("superficieAluno");
export const semPagina = elemento<HTMLDivElement>("semPagina");
export const palco = elemento<HTMLDivElement>("palco");
export const telas = [
  elemento<HTMLDivElement>("telaGabarito"),
  elemento<HTMLDivElement>("telaAluno"),
];
export const controleOpacidade = elemento<HTMLDivElement>("controleOpacidade");
export const opacidade = elemento<HTMLInputElement>("opacidade");
export const valorOpacidade = elemento<HTMLElement>("valorOpacidade");
export const ajuda = elemento<HTMLDivElement>("ajuda");
export const botaoLista = elemento<HTMLButtonElement>("botaoLista");
export const textoBotaoLista = elemento<HTMLElement>("textoBotaoLista");
export const resumo = elemento<HTMLDivElement>("resumo");
export const lista = elemento<HTMLUListElement>("listaComponentes");
export const vazio = elemento<HTMLDivElement>("vazio");
export const conteudo = elemento<HTMLDivElement>("conteudo");
export const botoesModo = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".modo[data-modo]"),
);
