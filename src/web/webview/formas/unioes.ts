import { Forma, area, caixasQuaseIguais, classificar, ehRetangular } from "./caixas";

// Blocos da mesma cor colados lado a lado viram uma forma só.

export function unirFormasColadas(entrada: Forma[]): Forma[] {
  let formas = [...entrada].sort((a, b) => area(b) - area(a));
  formas = formas.filter(
    (forma, indice) =>
      !formas.some(
        (outra, outroIndice) =>
          outroIndice < indice && outra.cor === forma.cor && caixasQuaseIguais(outra, forma),
      ),
  );
  let mudou = true;

  while (mudou) {
    mudou = false;
    const resultado: Forma[] = [];
    const usadas = new Set<number>();

    for (let i = 0; i < formas.length; i++) {
      if (usadas.has(i)) {
        continue;
      }

      let atual = formas[i];

      for (let j = i + 1; j < formas.length; j++) {
        if (!usadas.has(j) && podemUnir(atual, formas[j])) {
          atual = unir(atual, formas[j]);
          usadas.add(j);
          mudou = true;
        }
      }

      resultado.push(atual);
    }

    formas = resultado;
  }

  return formas;
}

function podemUnir(a: Forma, b: Forma): boolean {
  if (
    a.cor !== b.cor ||
    Boolean(a.raiz) !== Boolean(b.raiz) ||
    !ehRetangular(a) ||
    !ehRetangular(b)
  ) {
    return false;
  }

  const tolerancia = 2;
  const alinhadasNaHorizontal =
    Math.abs(a.y - b.y) <= tolerancia && Math.abs(a.altura - b.altura) <= tolerancia;
  const coladasNaHorizontal =
    Math.abs(a.x + a.largura - b.x) <= tolerancia ||
    Math.abs(b.x + b.largura - a.x) <= tolerancia;
  const alinhadasNaVertical =
    Math.abs(a.x - b.x) <= tolerancia && Math.abs(a.largura - b.largura) <= tolerancia;
  const coladasNaVertical =
    Math.abs(a.y + a.altura - b.y) <= tolerancia ||
    Math.abs(b.y + b.altura - a.y) <= tolerancia;
  return (
    (alinhadasNaHorizontal && coladasNaHorizontal) ||
    (alinhadasNaVertical && coladasNaVertical)
  );
}

function unir(a: Forma, b: Forma): Forma {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const largura = Math.max(1, Math.round(Math.max(a.x + a.largura, b.x + b.largura) - x1));
  const altura = Math.max(1, Math.round(Math.max(a.y + a.altura, b.y + b.altura) - y1));
  const raio = Math.max(a.raio, b.raio);
  return {
    ...a,
    x: Math.round(x1),
    y: Math.round(y1),
    largura,
    altura,
    raio,
    tipo: classificar(largura, altura, raio),
  };
}
