export type ResultadoComparacaoImagem = {
  precisao: number;
  similaridadeMedia: number;
  pixelsProximos: number;
};

const LIMITE_CANAL_PROXIMO = 24;
const LIMITE_PRECISAO_PERFEITA = 99.5;

/**
 * Compara dois quadros RGBA do mesmo tamanho. A combinação entre diferença
 * média de cor e quantidade de pixels próximos reduz notas artificialmente
 * altas em páginas quase vazias.
 */
export function calcularPrecisaoImagem(
  alvo: Uint8ClampedArray,
  atual: Uint8ClampedArray,
): ResultadoComparacaoImagem {
  if (alvo.length === 0 || alvo.length !== atual.length || alvo.length % 4 !== 0) {
    throw new Error("As imagens precisam ter as mesmas dimensões e conter pixels RGBA.");
  }

  const quantidadePixels = alvo.length / 4;
  let somaDiferencas = 0;
  let quantidadeProximos = 0;

  for (let indice = 0; indice < alvo.length; indice += 4) {
    const diferencaVermelho = Math.abs(alvo[indice] - atual[indice]);
    const diferencaVerde = Math.abs(alvo[indice + 1] - atual[indice + 1]);
    const diferencaAzul = Math.abs(alvo[indice + 2] - atual[indice + 2]);

    somaDiferencas += diferencaVermelho + diferencaVerde + diferencaAzul;

    if (
      Math.max(diferencaVermelho, diferencaVerde, diferencaAzul) <=
      LIMITE_CANAL_PROXIMO
    ) {
      quantidadeProximos += 1;
    }
  }

  const similaridadeMedia =
    1 - somaDiferencas / (quantidadePixels * 255 * 3);
  const pixelsProximos = quantidadeProximos / quantidadePixels;
  const precisaoCalculada = limitarPercentual(
    (similaridadeMedia * 0.4 + pixelsProximos * 0.6) * 100,
  );
  // Canvas e CSS rasterizam curvas com pequenas diferenças de antialiasing.
  // A faixa residual evita que uma reprodução geometricamente idêntica fique
  // presa em 99,x% por alguns pixels de borda invisíveis a olho nu.
  const precisao =
    precisaoCalculada >= LIMITE_PRECISAO_PERFEITA ? 100 : precisaoCalculada;

  return {
    precisao: Number(precisao.toFixed(2)),
    similaridadeMedia: Number((similaridadeMedia * 100).toFixed(2)),
    pixelsProximos: Number((pixelsProximos * 100).toFixed(2)),
  };
}

function limitarPercentual(valor: number): number {
  return Math.min(100, Math.max(0, valor));
}
