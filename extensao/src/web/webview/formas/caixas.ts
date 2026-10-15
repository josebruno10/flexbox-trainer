// As caixas das formas medidas e as contas com elas.

export type Caixa = {
  x: number;
  y: number;
  largura: number;
  altura: number;
};

export type Forma = Caixa & {
  // #RRGGBB maiúsculo.
  cor: string;
  raio: number;
  tipo: string;
  ordem: number;
  raiz?: boolean;
};

export const MINIMO_FRAGMENTO = 3;

export function classificar(largura: number, altura: number, raio: number): string {
  const w = Math.max(1, largura);
  const h = Math.max(1, altura);
  const proporcao = w / h;
  const raioRelativo = raio / Math.max(1, Math.min(w, h));

  if (raioRelativo >= 0.42 && Math.abs(proporcao - 1) <= 0.18) {
    return "circulo";
  }

  if (raioRelativo >= 0.08) {
    return Math.abs(proporcao - 1) <= 0.12
      ? "quadrado-arredondado"
      : "retangulo-arredondado";
  }

  return Math.abs(proporcao - 1) <= 0.08 ? "quadrado" : "retangulo";
}

export function ehRetangular(forma: Forma): boolean {
  return (
    !forma.tipo.includes("circulo") &&
    !forma.tipo.includes("triangulo") &&
    forma.raio <= Math.min(forma.largura, forma.altura) * 0.08
  );
}

export function intersectar(a: Caixa, b: Caixa): Caixa | undefined {
  const esquerda = Math.max(a.x, b.x);
  const topo = Math.max(a.y, b.y);
  const largura = Math.round(Math.min(a.x + a.largura, b.x + b.largura) - esquerda);
  const altura = Math.round(Math.min(a.y + a.altura, b.y + b.altura) - topo);
  return largura > 0 && altura > 0
    ? { x: Math.round(esquerda), y: Math.round(topo), largura, altura }
    : undefined;
}

export function caixasQuaseIguais(a: Caixa, b: Caixa): boolean {
  return (
    Math.abs(a.x - b.x) <= 1 &&
    Math.abs(a.y - b.y) <= 1 &&
    Math.abs(a.largura - b.largura) <= 1 &&
    Math.abs(a.altura - b.altura) <= 1
  );
}

export function area(caixa: Caixa): number {
  return Math.max(0, caixa.largura) * Math.max(0, caixa.altura);
}

export function subtrairCaixas(base: Caixa, cortes: Caixa[]): Caixa[] {
  let fragmentos: Caixa[] = [{ x: base.x, y: base.y, largura: base.largura, altura: base.altura }];

  for (const corte of cortes) {
    fragmentos = fragmentos.flatMap((fragmento) => subtrairCaixa(fragmento, corte));

    if (fragmentos.length === 0 || fragmentos.length > 80) {
      break;
    }
  }

  return fragmentos;
}

function subtrairCaixa(fragmento: Caixa, corte: Caixa): Caixa[] {
  const intersecao = intersectar(fragmento, corte);

  if (!intersecao) {
    return [fragmento];
  }

  const fx2 = fragmento.x + fragmento.largura;
  const fy2 = fragmento.y + fragmento.altura;
  const ix2 = intersecao.x + intersecao.largura;
  const iy2 = intersecao.y + intersecao.altura;
  return [
    { x: fragmento.x, y: fragmento.y, largura: fragmento.largura, altura: intersecao.y - fragmento.y },
    { x: fragmento.x, y: iy2, largura: fragmento.largura, altura: fy2 - iy2 },
    { x: fragmento.x, y: intersecao.y, largura: intersecao.x - fragmento.x, altura: intersecao.altura },
    { x: ix2, y: intersecao.y, largura: fx2 - ix2, altura: intersecao.altura },
  ].filter(
    (caixa) => caixa.largura >= MINIMO_FRAGMENTO && caixa.altura >= MINIMO_FRAGMENTO,
  );
}
