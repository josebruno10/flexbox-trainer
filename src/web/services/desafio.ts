import { Bloco, Desafio } from "../types";

export const LARGURA_GABARITO = 960;
export const ALTURA_GABARITO = 540;

const PROFUNDIDADE_MAXIMA = 3;
const TAMANHO_MINIMO_DIVISAO = 72;
const MARGEM_EXTERNA = 18;

const PALETA = [
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#14b8a6",
  "#38bdf8",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#334155",
];

type Retangulo = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Direcao = "row" | "column";
type Aleatorio = () => number;

/**
 * Gera o gabarito visual usado no treinamento livre.
 *
 * O algoritmo trabalha em coordenadas fixas de 960x540. Cada bloco conhece o
 * pai que o originou, permitindo validar contenção e evitar os conflitos de
 * índice que existiam na versão experimental baseada em arrays por camada.
 */
export function criarDesafioGerado(seed = criarSeedAleatoria()): Desafio {
  const seedNormalizada = seed >>> 0;
  const aleatorio = criarGeradorAleatorio(seedNormalizada);
  const blocks: Bloco[] = [];
  let proximoId = 1;
  let indiceCor = inteiroAleatorio(aleatorio, 0, PALETA.length - 1);

  const proximaCor = (corPai?: string): string => {
    for (let tentativa = 0; tentativa < PALETA.length; tentativa++) {
      const cor = PALETA[indiceCor % PALETA.length];
      indiceCor += inteiroAleatorio(aleatorio, 1, 3);

      if (cor !== corPai) {
        return cor;
      }
    }

    return PALETA[0];
  };

  const adicionarBloco = (
    retangulo: Retangulo,
    parentId?: number,
    corPai?: string,
  ): Bloco => {
    const bloco: Bloco = {
      id: proximoId++,
      parentId,
      x: Math.round(retangulo.x),
      y: Math.round(retangulo.y),
      width: Math.max(1, Math.round(retangulo.width)),
      height: Math.max(1, Math.round(retangulo.height)),
      color: proximaCor(corPai),
      borderRadius: aleatorio() < 0.2 ? inteiroAleatorio(aleatorio, 4, 16) : 0,
    };

    blocks.push(bloco);
    return bloco;
  };

  const processarRegiao = (
    retangulo: Retangulo,
    profundidade: number,
    direcao: Direcao,
    parentId?: number,
    corPai?: string,
  ): void => {
    const pai = adicionarBloco(retangulo, parentId, corPai);

    if (
      profundidade >= PROFUNDIDADE_MAXIMA ||
      retangulo.width < TAMANHO_MINIMO_DIVISAO * 1.6 ||
      retangulo.height < TAMANHO_MINIMO_DIVISAO * 1.6
    ) {
      return;
    }

    const escolha = aleatorio();
    const proximaDirecao: Direcao = direcao === "row" ? "column" : "row";

    if (escolha < 0.4) {
      const partes = dividirRetangulo(retangulo, proximaDirecao, aleatorio);

      if (partes.length > 1) {
        for (const parte of partes) {
          processarRegiao(
            parte,
            profundidade + 1,
            proximaDirecao,
            pai.id,
            pai.color,
          );
        }
        return;
      }
    }

    const tipoRetangulo = inteiroAleatorio(aleatorio, 0, 3);
    const filhos = criarRetangulosInternos(
      retangulo,
      tipoRetangulo,
      aleatorio,
    );

    for (const filho of filhos) {
      const deveContinuar =
        profundidade + 1 < PROFUNDIDADE_MAXIMA && aleatorio() < 0.28;

      if (deveContinuar) {
        processarRegiao(
          filho,
          profundidade + 1,
          proximaDirecao,
          pai.id,
          pai.color,
        );
      } else {
        adicionarBloco(filho, pai.id, pai.color);
      }
    }
  };

  const areaUtil: Retangulo = {
    x: MARGEM_EXTERNA,
    y: MARGEM_EXTERNA,
    width: LARGURA_GABARITO - MARGEM_EXTERNA * 2,
    height: ALTURA_GABARITO - MARGEM_EXTERNA * 2,
  };
  const direcaoInicial: Direcao = aleatorio() < 0.5 ? "row" : "column";
  const regioesIniciais = dividirRetangulo(
    areaUtil,
    direcaoInicial,
    aleatorio,
    2,
    3,
  );

  for (const regiao of regioesIniciais) {
    processarRegiao(regiao, 0, direcaoInicial);
  }

  return {
    challengeId: `challenge-${seedNormalizada}`,
    seed: seedNormalizada,
    titulo: "Desafio aleatório",
    width: LARGURA_GABARITO,
    height: ALTURA_GABARITO,
    backgroundColor: "#f8fafc",
    blocks,
  };
}

function dividirRetangulo(
  retangulo: Retangulo,
  direcao: Direcao,
  aleatorio: Aleatorio,
  minimoPartes = 2,
  maximoPartes = 3,
): Retangulo[] {
  const total = direcao === "row" ? retangulo.width : retangulo.height;
  const maximoPossivel = Math.min(
    maximoPartes,
    Math.floor(total / TAMANHO_MINIMO_DIVISAO),
  );

  if (maximoPossivel < minimoPartes) {
    return [retangulo];
  }

  const quantidade = inteiroAleatorio(
    aleatorio,
    minimoPartes,
    maximoPossivel,
  );
  const partes: Retangulo[] = [];
  let posicao = direcao === "row" ? retangulo.x : retangulo.y;
  let restante = total;

  for (let indice = 0; indice < quantidade; indice++) {
    const restantesDepois = quantidade - indice - 1;
    const tamanho =
      restantesDepois === 0
        ? restante
        : inteiroAleatorio(
            aleatorio,
            TAMANHO_MINIMO_DIVISAO,
            Math.floor(restante - restantesDepois * TAMANHO_MINIMO_DIVISAO),
          );

    partes.push(
      direcao === "row"
        ? {
            x: posicao,
            y: retangulo.y,
            width: tamanho,
            height: retangulo.height,
          }
        : {
            x: retangulo.x,
            y: posicao,
            width: retangulo.width,
            height: tamanho,
          },
    );
    posicao += tamanho;
    restante -= tamanho;
  }

  return partes;
}

function criarRetangulosInternos(
  pai: Retangulo,
  tipo: number,
  aleatorio: Aleatorio,
): Retangulo[] {
  switch (tipo) {
    case 0:
      return [criarRetanguloInset(pai, aleatorio)];
    case 1:
      return criarParDeQuadrados(pai, aleatorio);
    case 2:
      return [criarQuadradoAlinhado(pai, aleatorio)];
    default:
      return criarGrade(pai, aleatorio);
  }
}

function criarRetanguloInset(
  pai: Retangulo,
  aleatorio: Aleatorio,
): Retangulo {
  const padding = Math.max(6, Math.floor(Math.min(pai.width, pai.height) * 0.04));
  const larguraMaxima = Math.max(1, pai.width - padding * 2);
  const alturaMaxima = Math.max(1, pai.height - padding * 2);
  const width = Math.max(1, Math.floor(larguraMaxima * faixa(aleatorio, 0.78, 0.92)));
  const height = Math.max(1, Math.floor(alturaMaxima * faixa(aleatorio, 0.72, 0.9)));
  const espacoX = Math.max(0, larguraMaxima - width);
  const espacoY = Math.max(0, alturaMaxima - height);

  return {
    x: pai.x + padding + inteiroAleatorio(aleatorio, 0, Math.floor(espacoX)),
    y: pai.y + padding + inteiroAleatorio(aleatorio, 0, Math.floor(espacoY)),
    width,
    height,
  };
}

function criarParDeQuadrados(
  pai: Retangulo,
  aleatorio: Aleatorio,
): Retangulo[] {
  const padding = Math.max(6, Math.floor(Math.min(pai.width, pai.height) * 0.05));
  const gap = padding;
  const ladoMaximo = Math.max(
    1,
    Math.floor(Math.min(pai.height - padding * 2, (pai.width - padding * 2 - gap) / 2)),
  );
  const ladoMinimo = Math.max(1, Math.floor(ladoMaximo * 0.62));
  const lado = inteiroAleatorio(aleatorio, ladoMinimo, ladoMaximo);
  const ySuperior = pai.y + padding;
  const yInferior = pai.y + pai.height - padding - lado;

  return [
    {
      x: pai.x + padding,
      y: aleatorio() < 0.5 ? ySuperior : yInferior,
      width: lado,
      height: lado,
    },
    {
      x: pai.x + pai.width - padding - lado,
      y: aleatorio() < 0.5 ? ySuperior : yInferior,
      width: lado,
      height: lado,
    },
  ];
}

function criarQuadradoAlinhado(
  pai: Retangulo,
  aleatorio: Aleatorio,
): Retangulo {
  const padding = Math.max(4, Math.floor(Math.min(pai.width, pai.height) * 0.04));
  const ladoMaximo = Math.max(1, Math.min(pai.width, pai.height) - padding * 2);
  const lado = Math.max(1, Math.floor(ladoMaximo * faixa(aleatorio, 0.28, 0.52)));
  const posicoesX = [
    pai.x + padding,
    pai.x + (pai.width - lado) / 2,
    pai.x + pai.width - padding - lado,
  ];
  const posicoesY = [
    pai.y + padding,
    pai.y + (pai.height - lado) / 2,
    pai.y + pai.height - padding - lado,
  ];

  return {
    x: posicoesX[inteiroAleatorio(aleatorio, 0, posicoesX.length - 1)],
    y: posicoesY[inteiroAleatorio(aleatorio, 0, posicoesY.length - 1)],
    width: lado,
    height: lado,
  };
}

function criarGrade(pai: Retangulo, aleatorio: Aleatorio): Retangulo[] {
  const quantidade = inteiroAleatorio(aleatorio, 3, 6);
  const padding = Math.max(6, Math.floor(Math.min(pai.width, pai.height) * 0.06));
  const gap = Math.max(4, Math.floor(padding * 0.65));
  const horizontal = aleatorio() < 0.5;
  const colunasSugeridas = horizontal
    ? Math.min(3, quantidade)
    : Math.ceil(quantidade / Math.min(3, quantidade));
  const colunas = Math.max(1, colunasSugeridas);
  const linhas = Math.ceil(quantidade / colunas);
  const larguraDisponivel = pai.width - padding * 2 - gap * (colunas - 1);
  const alturaDisponivel = pai.height - padding * 2 - gap * (linhas - 1);
  const width = Math.max(1, Math.floor(larguraDisponivel / colunas));
  const height = Math.max(1, Math.floor(alturaDisponivel / linhas));
  const filhos: Retangulo[] = [];

  for (let indice = 0; indice < quantidade; indice++) {
    const coluna = indice % colunas;
    const linha = Math.floor(indice / colunas);
    filhos.push({
      x: pai.x + padding + coluna * (width + gap),
      y: pai.y + padding + linha * (height + gap),
      width,
      height,
    });
  }

  return filhos;
}

function criarSeedAleatoria(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

function criarGeradorAleatorio(seed: number): Aleatorio {
  let estado = seed >>> 0;

  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let valor = estado;
    valor = Math.imul(valor ^ (valor >>> 15), valor | 1);
    valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61);
    return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296;
  };
}

function inteiroAleatorio(
  aleatorio: Aleatorio,
  minimo: number,
  maximo: number,
): number {
  const inicio = Math.ceil(minimo);
  const fim = Math.max(inicio, Math.floor(maximo));
  return Math.floor(aleatorio() * (fim - inicio + 1)) + inicio;
}

function faixa(aleatorio: Aleatorio, minimo: number, maximo: number): number {
  return minimo + aleatorio() * (maximo - minimo);
}
