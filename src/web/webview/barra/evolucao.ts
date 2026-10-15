import {
  evolucao,
  fimEvolucao,
  graficoEvolucao,
  inicioEvolucao,
  resumoEvolucao,
} from "./elementos";
import { formatarPorcentagem } from "./formatos";
import type { NotaDoDiaRecebida } from "./tipos";

// O gráfico da melhor nota de cada dia, no nível escolhido.
// Os dias ficam guardados para redesenhar quando a largura muda.
let diasEvolucao: NotaDoDiaRecebida[] = [];

export function ligarEvolucao(): void {
  new ResizeObserver(() => desenharEvolucao()).observe(graficoEvolucao);
}

// A linha precisa de dois dias de treino; com um só, o gráfico fica escondido.
export function renderizarEvolucao(dias: NotaDoDiaRecebida[]): void {
  diasEvolucao = dias;
  evolucao.hidden = dias.length < 2;
  if (dias.length < 2) {
    return;
  }

  const primeiro = dias[0];
  const ultimo = dias[dias.length - 1];
  resumoEvolucao.textContent =
    `${formatarPorcentagem(primeiro.melhor)} → ` +
    `${formatarPorcentagem(ultimo.melhor)}%`;
  inicioEvolucao.textContent = formatarDia(primeiro.dia);
  fimEvolucao.textContent = formatarDia(ultimo.dia);
  graficoEvolucao.setAttribute(
    "aria-label",
    `Melhor nota por dia: ${formatarPorcentagem(primeiro.melhor)}% em ` +
      `${formatarDia(primeiro.dia)} e ${formatarPorcentagem(ultimo.melhor)}% ` +
      `em ${formatarDia(ultimo.dia)}`,
  );
  desenharEvolucao();
}

// Desenha na largura real do gráfico, para os pontos ficarem redondos; volta
// a desenhar quando a barra lateral muda de largura.
function desenharEvolucao(): void {
  const dias = diasEvolucao;
  const largura = graficoEvolucao.getBoundingClientRect().width;
  if (dias.length < 2 || largura === 0) {
    return;
  }

  const altura = 64;
  const margem = 4;
  const x = (indice: number) =>
    margem + (indice * (largura - margem * 2)) / (dias.length - 1);
  const y = (nota: number) =>
    margem +
    ((100 - Math.min(100, Math.max(0, nota))) * (altura - margem * 2)) / 100;
  const criar = (nome: string, atributos: Record<string, string | number>) => {
    const elemento = document.createElementNS(
      "http://www.w3.org/2000/svg",
      nome,
    );
    for (const [atributo, valor] of Object.entries(atributos)) {
      elemento.setAttribute(atributo, String(valor));
    }
    return elemento;
  };

  graficoEvolucao.setAttribute("viewBox", `0 0 ${largura} ${altura}`);
  // Guias em 0, 50 e 100%.
  const guias = [0, 50, 100].map((nota) =>
    criar("line", {
      class: "guia",
      x1: 0,
      x2: largura,
      y1: y(nota),
      y2: y(nota),
    }),
  );
  const linha = criar("polyline", {
    points: dias
      .map((dia, indice) => `${x(indice)},${y(dia.melhor)}`)
      .join(" "),
  });
  const pontos = dias.map((dia, indice) => {
    const ponto = criar("circle", {
      cx: x(indice),
      cy: y(dia.melhor),
      r: indice === dias.length - 1 ? 3 : 2,
    });
    const dica = criar("title", {});
    dica.textContent =
      `${formatarDia(dia.dia)}: ${formatarPorcentagem(dia.melhor)}%`;
    ponto.append(dica);
    return ponto;
  });
  graficoEvolucao.replaceChildren(...guias, linha, ...pontos);
}

// "2026-10-14" vira "14/10".
function formatarDia(dia: string): string {
  const [, mes, data] = dia.split("-");
  return `${data}/${mes}`;
}
