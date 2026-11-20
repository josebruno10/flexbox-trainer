// A linha da comparação, como na extensão oficial do torneio: ela divide a
// mesma imagem em duas, com o gabarito à esquerda e a página do aluno à
// direita. Arrasta-se com o mouse (de qualquer ponto da imagem) ou com as
// setas do teclado. A posição vai para a variável --corte do palco, que o CSS
// usa para recortar a imagem de cima e posicionar a linha.

const PASSO = 2;
const PASSO_GRANDE = 10;

export type OpcoesDaLinha = {
  /** Recebe o --corte e os cliques. */
  palco: HTMLElement;
  /** O controle da linha (role="slider"). */
  linha: HTMLElement;
  /** A imagem sobre a qual a posição do ponteiro é medida. */
  area: () => HTMLElement;
  /** Só arrasta com o modo de comparar aberto. */
  ativa: () => boolean;
};

export function ligarLinhaComparacao({
  palco,
  linha,
  area,
  ativa,
}: OpcoesDaLinha): void {
  let posicao = 50;

  const aplicar = (valor: number) => {
    posicao = Math.max(0, Math.min(100, valor));
    const arredondada = Math.round(posicao);
    palco.style.setProperty("--corte", `${posicao}%`);
    linha.setAttribute("aria-valuenow", String(arredondada));
    linha.setAttribute(
      "aria-valuetext",
      `${arredondada}% gabarito, ${100 - arredondada}% sua página`,
    );
  };

  const pelaPosicaoDoPonteiro = (evento: PointerEvent) => {
    const retangulo = area().getBoundingClientRect();
    if (retangulo.width > 0) {
      aplicar(((evento.clientX - retangulo.left) / retangulo.width) * 100);
    }
  };

  palco.addEventListener("pointerdown", (evento) => {
    if (!ativa() || evento.button !== 0) {
      return;
    }
    evento.preventDefault();
    try {
      palco.setPointerCapture(evento.pointerId);
    } catch {
      // Sem a captura, a linha só acompanha o ponteiro dentro do palco.
    }
    pelaPosicaoDoPonteiro(evento);
    linha.focus({ preventScroll: true });

    const soltar = () => {
      palco.removeEventListener("pointermove", pelaPosicaoDoPonteiro);
      palco.removeEventListener("pointerup", soltar);
      palco.removeEventListener("pointercancel", soltar);
    };
    palco.addEventListener("pointermove", pelaPosicaoDoPonteiro);
    palco.addEventListener("pointerup", soltar);
    palco.addEventListener("pointercancel", soltar);
  });

  linha.addEventListener("keydown", (evento) => {
    const passo = evento.shiftKey ? PASSO_GRANDE : PASSO;
    const destinos: Record<string, number> = {
      ArrowLeft: posicao - passo,
      ArrowRight: posicao + passo,
      Home: 0,
      End: 100,
    };
    const destino = destinos[evento.key];
    if (destino === undefined) {
      return;
    }
    evento.preventDefault();
    aplicar(destino);
  });

  aplicar(posicao);
}
