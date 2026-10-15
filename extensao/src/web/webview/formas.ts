import type { FormaMedida } from "../types";
import { Forma, classificar } from "./formas/caixas";
import { coresParecidas, corDoFundoAtras, normalizarCor } from "./formas/cores";
import { recortarFundosCobertos } from "./formas/recortes";
import { unirFormasColadas } from "./formas/unioes";

// Porta da coleta de formas da extensão oficial do torneio (Frontend Teams
// Cup 0.0.51), para que o servidor receba as formas no mesmo formato que ele
// compara com o gabarito.
// As partes ficam em ./formas; aqui fica a medição dos elementos.

const IGNORAR = new Set(["HTML", "BODY", "HEAD", "META", "LINK", "STYLE", "SCRIPT", "TITLE", "BASE", "BR"]);

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

function px(valor: string, base = 0): number {
  const texto = (valor || "0").trim();
  const numero = Number.parseFloat(texto);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return texto.includes("%") ? (Math.max(0, base) * numero) / 100 : numero;
}
