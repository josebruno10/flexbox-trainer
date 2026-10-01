import type { FormaMedida } from "../types";

// Porta da coleta de formas da extensão oficial do torneio (Frontend Teams
// Cup 0.0.51), para que o servidor receba as formas no mesmo formato que ele
// compara com o gabarito.

type Caixa = {
  x: number;
  y: number;
  largura: number;
  altura: number;
};

type Forma = Caixa & {
  // #RRGGBB maiúsculo.
  cor: string;
  raio: number;
  tipo: string;
  ordem: number;
  raiz?: boolean;
};

const IGNORAR = new Set(["HTML", "BODY", "HEAD", "META", "LINK", "STYLE", "SCRIPT", "TITLE", "BASE", "BR"]);
const MINIMO_FRAGMENTO = 3;

/**
 * Mede os elementos pintados da página do aluno, nas coordenadas do gabarito.
 * Fundos cobertos por outras formas viram só as faixas que continuam visíveis,
 * e blocos da mesma cor colados lado a lado viram uma forma só.
 */
export function medirFormas(
  corpo: Element,
  origem: DOMRect,
  largura: number,
  altura: number,
): FormaMedida[] {
  const raizHtml = corpo.parentElement;
  const corRaiz =
    normalizarCor(getComputedStyle(corpo).backgroundColor) ||
    (raizHtml ? normalizarCor(getComputedStyle(raizHtml).backgroundColor) : "");
  const formas: Forma[] = [];

  if (corRaiz) {
    formas.push({
      x: 0,
      y: 0,
      largura,
      altura,
      cor: corRaiz,
      raio: 0,
      tipo: classificar(largura, altura, 0),
      ordem: 0,
      raiz: true,
    });
  }

  for (const elemento of Array.from(corpo.querySelectorAll("*"))) {
    if (IGNORAR.has(elemento.tagName.toUpperCase())) {
      continue;
    }

    const estilo = getComputedStyle(elemento);

    if (
      estilo.display === "none" ||
      estilo.visibility === "hidden" ||
      Number(estilo.opacity || 1) <= 0.01
    ) {
      continue;
    }

    const limites = elemento.getBoundingClientRect();
    const esquerda = limites.left - origem.left;
    const topo = limites.top - origem.top;
    const direita = limites.right - origem.left;
    const baixo = limites.bottom - origem.top;

    if (
      limites.width < 2 ||
      limites.height < 2 ||
      direita <= 0 ||
      baixo <= 0 ||
      esquerda >= largura ||
      topo >= altura
    ) {
      continue;
    }

    const fundo = normalizarCor(estilo.backgroundColor);
    const corBorda = normalizarCor(estilo.borderColor);
    const espessuraBorda = Math.max(
      px(estilo.borderTopWidth),
      px(estilo.borderRightWidth),
      px(estilo.borderBottomWidth),
      px(estilo.borderLeftWidth),
    );

    if (!fundo && !(corBorda && espessuraBorda > 0)) {
      continue;
    }

    // Um bloco da cor do fundo atrás dele não aparece na imagem.
    if (
      fundo &&
      espessuraBorda <= 0 &&
      coresParecidas(fundo, corDoFundoAtras(elemento, raizHtml, corRaiz))
    ) {
      continue;
    }

    const x = Math.max(0, Math.round(esquerda));
    const y = Math.max(0, Math.round(topo));
    const larguraVisivel = Math.round(Math.min(direita, largura) - Math.max(esquerda, 0));
    const alturaVisivel = Math.round(Math.min(baixo, altura) - Math.max(topo, 0));

    if (larguraVisivel < 2 || alturaVisivel < 2) {
      continue;
    }

    const menorLado = Math.max(1, Math.min(larguraVisivel, alturaVisivel));
    const raio = Math.max(
      px(estilo.borderTopLeftRadius, menorLado),
      px(estilo.borderTopRightRadius, menorLado),
      px(estilo.borderBottomRightRadius, menorLado),
      px(estilo.borderBottomLeftRadius, menorLado),
    );
    formas.push({
      x,
      y,
      largura: larguraVisivel,
      altura: alturaVisivel,
      cor: fundo || corBorda,
      raio: Math.round(raio),
      tipo: classificar(larguraVisivel, alturaVisivel, raio),
      ordem: formas.length,
    });
  }

  return unirFormasColadas(recortarFundosCobertos(formas))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, 400)
    .map(paraServidor)
    .filter((forma) => forma.width >= 2 && forma.height >= 2);
}

function paraServidor(forma: Forma, indice: number): FormaMedida {
  const width = Math.max(0, Math.round(forma.largura));
  const height = Math.max(0, Math.round(forma.altura));
  const tipo = forma.tipo.includes("circulo")
    ? "circulo"
    : forma.tipo.includes("quadrado")
      ? "quadrado"
      : width >= height
        ? "retangulo_deitado"
        : "retangulo_em_pe";

  // O servidor espera x e y no centro da forma.
  return {
    id: `forma_${indice + 1}`,
    tipo,
    x: Math.round(forma.x + width / 2),
    y: Math.round(forma.y + height / 2),
    width,
    height,
    area: Math.max(
      0,
      Math.round(
        tipo === "circulo" ? Math.PI * (width / 2) * (height / 2) : width * height,
      ),
    ),
    cor: forma.cor.toLowerCase(),
  };
}

function classificar(largura: number, altura: number, raio: number): string {
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

function recortarFundosCobertos(entrada: Forma[]): Forma[] {
  // Um elemento com a mesma caixa de outro desenhado depois fica escondido.
  const base = [...entrada]
    .sort((a, b) => a.ordem - b.ordem)
    .filter(
      (forma, _indice, lista) =>
        !lista.some((outra) => outra.ordem > forma.ordem && caixasQuaseIguais(outra, forma)),
    );
  const resultado: Forma[] = [];

  for (const forma of base) {
    if (!ehRetangular(forma) || area(forma) < 25) {
      resultado.push(forma);
      continue;
    }

    const cobertas = base
      .filter(
        (outra) =>
          outra !== forma &&
          outra.cor !== forma.cor &&
          area(outra) > 0 &&
          area(outra) < area(forma) * 0.98,
      )
      .flatMap((outra) => {
        const intersecao = intersectar(forma, outra);
        return intersecao &&
          area(intersecao) >= MINIMO_FRAGMENTO * MINIMO_FRAGMENTO &&
          area(intersecao) / Math.max(1, area(outra)) >= 0.75
          ? [intersecao]
          : [];
      });

    if (!deveRecortar(forma, cobertas)) {
      resultado.push(forma);
      continue;
    }

    const fragmentos = subtrairCaixas(
      forma,
      cobertas.sort((a, b) => area(b) - area(a)),
    ).filter((fragmento) => area(fragmento) >= MINIMO_FRAGMENTO * MINIMO_FRAGMENTO);

    fragmentos.forEach((fragmento, indice) => {
      resultado.push({
        ...forma,
        ...fragmento,
        raio: 0,
        tipo: classificar(fragmento.largura, fragmento.altura, 0),
        ordem: forma.ordem + (indice + 1) / 1000,
      });
    });
  }

  return resultado;
}

function deveRecortar(base: Caixa, cobertas: Caixa[]): boolean {
  if (cobertas.length === 0) {
    return false;
  }

  const tolerancia = 2;
  let tocaEsquerda = false;
  let tocaDireita = false;
  let tocaTopo = false;
  let tocaBaixo = false;
  let areaCoberta = 0;

  for (const coberta of cobertas) {
    if (
      coberta.largura >= base.largura - tolerancia ||
      coberta.altura >= base.altura - tolerancia
    ) {
      return true;
    }

    tocaEsquerda ||= coberta.x <= base.x + tolerancia;
    tocaDireita ||= coberta.x + coberta.largura >= base.x + base.largura - tolerancia;
    tocaTopo ||= coberta.y <= base.y + tolerancia;
    tocaBaixo ||= coberta.y + coberta.altura >= base.y + base.altura - tolerancia;
    areaCoberta += area(coberta);
  }

  return (
    ((tocaEsquerda && tocaDireita) || (tocaTopo && tocaBaixo)) &&
    Math.min(1, areaCoberta / Math.max(1, area(base))) >= 0.25
  );
}

function subtrairCaixas(base: Caixa, cortes: Caixa[]): Caixa[] {
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

function unirFormasColadas(entrada: Forma[]): Forma[] {
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

function ehRetangular(forma: Forma): boolean {
  return (
    !forma.tipo.includes("circulo") &&
    !forma.tipo.includes("triangulo") &&
    forma.raio <= Math.min(forma.largura, forma.altura) * 0.08
  );
}

function intersectar(a: Caixa, b: Caixa): Caixa | undefined {
  const esquerda = Math.max(a.x, b.x);
  const topo = Math.max(a.y, b.y);
  const largura = Math.round(Math.min(a.x + a.largura, b.x + b.largura) - esquerda);
  const altura = Math.round(Math.min(a.y + a.altura, b.y + b.altura) - topo);
  return largura > 0 && altura > 0
    ? { x: Math.round(esquerda), y: Math.round(topo), largura, altura }
    : undefined;
}

function caixasQuaseIguais(a: Caixa, b: Caixa): boolean {
  return (
    Math.abs(a.x - b.x) <= 1 &&
    Math.abs(a.y - b.y) <= 1 &&
    Math.abs(a.largura - b.largura) <= 1 &&
    Math.abs(a.altura - b.altura) <= 1
  );
}

function area(caixa: Caixa): number {
  return Math.max(0, caixa.largura) * Math.max(0, caixa.altura);
}

function corDoFundoAtras(
  elemento: Element,
  raizHtml: Element | null,
  corRaiz: string,
): string {
  for (
    let atual = elemento.parentElement;
    atual && atual !== raizHtml;
    atual = atual.parentElement
  ) {
    const cor = normalizarCor(getComputedStyle(atual).backgroundColor);

    if (cor) {
      return cor;
    }
  }

  return corRaiz;
}

function coresParecidas(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }

  const rgbA = canaisHex(a);
  const rgbB = canaisHex(b);
  return Boolean(
    rgbA && rgbB && rgbA.every((canal, indice) => Math.abs(canal - rgbB[indice]) <= 8),
  );
}

function canaisHex(cor: string): number[] | undefined {
  const hex = /^#([0-9a-f]{6})$/i.exec(cor)?.[1];
  return hex
    ? [0, 2, 4].map((inicio) => Number.parseInt(hex.slice(inicio, inicio + 2), 16))
    : undefined;
}

// Devolve "" para cores transparentes ou que não sabe ler.
function normalizarCor(cor: string): string {
  const texto = cor.trim();
  const canais = /rgba?\(([^)]+)\)/i
    .exec(texto)?.[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);

  if (!canais) {
    const hex = /^#?([0-9a-f]{6})$/i.exec(texto)?.[1];
    return hex ? `#${hex.toUpperCase()}` : "";
  }

  if (
    canais.length < 3 ||
    canais.slice(0, 3).some((canal) => !Number.isFinite(canal)) ||
    (canais.length >= 4 && canais[3] <= 0.01)
  ) {
    return "";
  }

  return `#${canais
    .slice(0, 3)
    .map((canal) =>
      Math.max(0, Math.min(255, Math.round(canal))).toString(16).padStart(2, "0"),
    )
    .join("")
    .toUpperCase()}`;
}

function px(valor: string, base = 0): number {
  const texto = (valor || "0").trim();
  const numero = Number.parseFloat(texto);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return texto.includes("%") ? (Math.max(0, base) * numero) / 100 : numero;
}
