import type { Bloco, Desafio } from "../types";

// Desenho e consulta do gabarito, compartilhados pela barra lateral e pela
// aba do gabarito.

type GabaritoDesenhavel = Pick<
  Desafio,
  "width" | "height" | "backgroundColor" | "blocks"
>;

export function desenharGabarito(
  contexto: CanvasRenderingContext2D,
  desafio: GabaritoDesenhavel,
): void {
  contexto.clearRect(0, 0, desafio.width, desafio.height);
  contexto.fillStyle = desafio.backgroundColor;
  contexto.fillRect(0, 0, desafio.width, desafio.height);

  for (const bloco of desafio.blocks) {
    contexto.fillStyle = bloco.color;
    if (bloco.shape === "circle") {
      desenharCirculo(contexto, bloco.x, bloco.y, bloco.width, bloco.height);
    } else {
      desenharRetanguloArredondado(
        contexto,
        bloco.x,
        bloco.y,
        bloco.width,
        bloco.height,
        bloco.borderRadius ?? 0,
      );
    }
  }
}

/** Contorno tracejado claro sobre outro escuro, visível sobre qualquer cor. */
export function destacarBloco(
  contexto: CanvasRenderingContext2D,
  bloco: Bloco,
  espessura: number,
): void {
  contexto.save();
  contexto.lineWidth = espessura * 2;
  contexto.strokeStyle = "rgba(0, 0, 0, 0.85)";
  tracarContorno(contexto, bloco);
  contexto.lineWidth = espessura;
  contexto.setLineDash([espessura * 3, espessura * 2]);
  contexto.strokeStyle = "#ffffff";
  tracarContorno(contexto, bloco);
  contexto.restore();
}

/** O bloco desenhado por último (o de cima) que contém o ponto. */
export function blocoNoPonto(
  blocos: readonly Bloco[],
  x: number,
  y: number,
): Bloco | undefined {
  return [...blocos].reverse().find((bloco) => pontoPertenceAoBloco(x, y, bloco));
}

export function formatarMedida(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1);
}

export function normalizarHex(cor: string): string {
  return cor.toUpperCase();
}

function tracarContorno(contexto: CanvasRenderingContext2D, bloco: Bloco): void {
  contexto.beginPath();
  if (bloco.shape === "circle") {
    contexto.ellipse(
      bloco.x + bloco.width / 2,
      bloco.y + bloco.height / 2,
      bloco.width / 2,
      bloco.height / 2,
      0,
      0,
      Math.PI * 2,
    );
  } else {
    contexto.rect(bloco.x, bloco.y, bloco.width, bloco.height);
  }
  contexto.stroke();
}

function pontoPertenceAoBloco(x: number, y: number, bloco: Bloco): boolean {
  if (bloco.shape === "circle") {
    const raioX = bloco.width / 2;
    const raioY = bloco.height / 2;
    const centroX = bloco.x + raioX;
    const centroY = bloco.y + raioY;

    if (raioX <= 0 || raioY <= 0) {
      return false;
    }

    return (
      ((x - centroX) * (x - centroX)) / (raioX * raioX) +
        ((y - centroY) * (y - centroY)) / (raioY * raioY) <=
      1
    );
  }

  return (
    x >= bloco.x &&
    x <= bloco.x + bloco.width &&
    y >= bloco.y &&
    y <= bloco.y + bloco.height
  );
}

function desenharCirculo(
  contexto: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  contexto.beginPath();
  contexto.ellipse(
    x + width / 2,
    y + height / 2,
    width / 2,
    height / 2,
    0,
    0,
    Math.PI * 2,
  );
  contexto.fill();
}

function desenharRetanguloArredondado(
  contexto: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  raioSolicitado: number,
): void {
  const raio = Math.max(0, Math.min(raioSolicitado, width / 2, height / 2));

  if (raio === 0) {
    contexto.fillRect(x, y, width, height);
    return;
  }

  contexto.beginPath();
  contexto.moveTo(x + raio, y);
  contexto.lineTo(x + width - raio, y);
  contexto.quadraticCurveTo(x + width, y, x + width, y + raio);
  contexto.lineTo(x + width, y + height - raio);
  contexto.quadraticCurveTo(
    x + width,
    y + height,
    x + width - raio,
    y + height,
  );
  contexto.lineTo(x + raio, y + height);
  contexto.quadraticCurveTo(x, y + height, x, y + height - raio);
  contexto.lineTo(x, y + raio);
  contexto.quadraticCurveTo(x, y, x + raio, y);
  contexto.closePath();
  contexto.fill();
}
