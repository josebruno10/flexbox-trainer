import type { FormaMedida } from "../types";

type Caixa = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  circulo: boolean;
  cor: string;
};

/**
 * Mede os elementos com cor de fundo da página do aluno, nas coordenadas do
 * gabarito. Um contêiner totalmente escondido pelos próprios descendentes
 * fica de fora, assim como as regiões cortadas não aparecem na imagem do
 * gabarito que o servidor analisa.
 */
export function medirFormas(
  corpo: Element,
  origem: DOMRect,
  largura: number,
  altura: number,
): FormaMedida[] {
  const pintados = new Map<Element, Caixa>();

  for (const elemento of Array.from(corpo.querySelectorAll("*"))) {
    const estilo = getComputedStyle(elemento);
    const cor = corOpaca(estilo.backgroundColor);

    if (!cor || estilo.visibility !== "visible" || Number(estilo.opacity) === 0) {
      continue;
    }

    const limites = elemento.getBoundingClientRect();
    const caixa: Caixa = {
      x1: limitar(limites.left - origem.left, 0, largura),
      y1: limitar(limites.top - origem.top, 0, altura),
      x2: limitar(limites.right - origem.left, 0, largura),
      y2: limitar(limites.bottom - origem.top, 0, altura),
      circulo: ehCirculo(estilo, limites),
      cor,
    };

    if (caixa.x2 - caixa.x1 >= 1 && caixa.y2 - caixa.y1 >= 1) {
      pintados.set(elemento, caixa);
    }
  }

  const formas: FormaMedida[] = [];

  for (const [elemento, caixa] of pintados) {
    const descendentes = Array.from(pintados)
      .filter(([outro]) => outro !== elemento && elemento.contains(outro))
      .map(([, outraCaixa]) => outraCaixa);

    if (estaCoberta(caixa, descendentes)) {
      continue;
    }

    const x = Math.round(caixa.x1);
    const y = Math.round(caixa.y1);
    formas.push({
      id: String(formas.length + 1),
      tipo: caixa.circulo ? "circulo" : "retangulo",
      x,
      y,
      width: Math.round(caixa.x2) - x,
      height: Math.round(caixa.y2) - y,
      cor: caixa.cor,
    });
  }

  return formas;
}

// Amostra a área visível do elemento a cada ~4 px.
function estaCoberta(caixa: Caixa, cobertores: Caixa[]): boolean {
  if (cobertores.length === 0) {
    return false;
  }

  const largura = caixa.x2 - caixa.x1;
  const altura = caixa.y2 - caixa.y1;
  const colunas = Math.max(1, Math.ceil(largura / 4));
  const linhas = Math.max(1, Math.ceil(altura / 4));

  for (let linha = 0; linha < linhas; linha++) {
    const y = caixa.y1 + ((linha + 0.5) * altura) / linhas;

    for (let coluna = 0; coluna < colunas; coluna++) {
      const x = caixa.x1 + ((coluna + 0.5) * largura) / colunas;

      if (
        contemPonto(caixa, x, y) &&
        !cobertores.some((cobertor) => contemPonto(cobertor, x, y))
      ) {
        return false;
      }
    }
  }

  return true;
}

function contemPonto(caixa: Caixa, x: number, y: number): boolean {
  if (caixa.circulo) {
    const raioX = (caixa.x2 - caixa.x1) / 2;
    const raioY = (caixa.y2 - caixa.y1) / 2;
    const dx = (x - caixa.x1 - raioX) / raioX;
    const dy = (y - caixa.y1 - raioY) / raioY;
    return dx * dx + dy * dy <= 1;
  }

  return x >= caixa.x1 && x <= caixa.x2 && y >= caixa.y1 && y <= caixa.y2;
}

function ehCirculo(estilo: CSSStyleDeclaration, limites: DOMRect): boolean {
  const menorLado = Math.min(limites.width, limites.height);

  if (menorLado <= 0 || Math.abs(limites.width - limites.height) > 1) {
    return false;
  }

  return [
    estilo.borderTopLeftRadius,
    estilo.borderTopRightRadius,
    estilo.borderBottomRightRadius,
    estilo.borderBottomLeftRadius,
  ].every((valor) => {
    const primeiro = valor.split(" ")[0] ?? "0";
    const raio = primeiro.endsWith("%")
      ? (Number.parseFloat(primeiro) / 100) * menorLado
      : Number.parseFloat(primeiro);
    return raio >= menorLado / 2 - 0.5;
  });
}

function corOpaca(cor: string): string | undefined {
  const canais = /rgba?\(([^)]+)\)/i
    .exec(cor)?.[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);

  if (
    !canais ||
    canais.length < 3 ||
    canais.slice(0, 3).some((canal) => !Number.isFinite(canal)) ||
    canais[3] === 0
  ) {
    return undefined;
  }

  return `#${canais
    .slice(0, 3)
    .map((canal) =>
      Math.round(limitar(canal, 0, 255)).toString(16).padStart(2, "0"),
    )
    .join("")}`;
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(maximo, valor));
}
