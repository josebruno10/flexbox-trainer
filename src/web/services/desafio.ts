import { Bloco, Desafio } from "../types";

export const LARGURA_GABARITO = 960;
export const ALTURA_GABARITO = 540;

const COR_FUNDO = "#9ca3af";
const MARGEM_EXTERNA = 12;
const TAMANHO_MINIMO_CORTE = 72;
const PROFUNDIDADE_MAXIMA = 3;
const LIMITE_BLOCOS = 90;

type Retangulo = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Direcao = "row" | "column";
type Aleatorio = () => number;

type ContextoGeracao = {
  aleatorio: Aleatorio;
  blocks: Bloco[];
  proximoId: number;
};

export type OpcoesGeracaoDesafio = {
  aleatorio?: Aleatorio;
};

/**
 * Adapta o gerador experimental baseado em cortes para o modelo da extensão.
 * Cada chamada divide o gabarito em regiões aleatórias e preenche as regiões
 * finais com retângulos comuns, alinhados, em sequência ou em lados opostos.
 */
export function criarDesafioGerado(
  opcoes: OpcoesGeracaoDesafio = {},
): Desafio {
  const aleatorio = opcoes.aleatorio ?? Math.random;
  const contexto: ContextoGeracao = {
    aleatorio,
    blocks: [],
    proximoId: 1,
  };
  const areaUtil: Retangulo = {
    x: MARGEM_EXTERNA,
    y: MARGEM_EXTERNA,
    width: LARGURA_GABARITO - MARGEM_EXTERNA * 2,
    height: ALTURA_GABARITO - MARGEM_EXTERNA * 2,
  };
  const direcaoInicial: Direcao = aleatorio() < 0.5 ? "row" : "column";

  gerarCortes(contexto, areaUtil, direcaoInicial, 0, undefined, COR_FUNDO);

  return {
    challengeId: criarIdDesafio(aleatorio),
    width: LARGURA_GABARITO,
    height: ALTURA_GABARITO,
    backgroundColor: COR_FUNDO,
    blocks: contexto.blocks,
  };
}

function gerarCortes(
  contexto: ContextoGeracao,
  area: Retangulo,
  direcao: Direcao,
  profundidade: number,
  parentId: number | undefined,
  corPai: string,
): void {
  if (contexto.blocks.length >= LIMITE_BLOCOS) {
    return;
  }

  const partes = dividirRetangulo(area, direcao, contexto.aleatorio);

  for (const parte of partes) {
    if (contexto.blocks.length >= LIMITE_BLOCOS) {
      break;
    }

    const bloco = adicionarBloco(
      contexto,
      parte,
      gerarCorContrastante(contexto.aleatorio, corPai),
      parentId,
    );
    const proximaDirecao: Direcao = direcao === "row" ? "column" : "row";
    const tamanhoParaNovoCorte =
      proximaDirecao === "row" ? bloco.width : bloco.height;
    const chanceNovoCorte = [0.65, 0.4, 0.15][profundidade] ?? 0;
    const podeCortar =
      profundidade + 1 < PROFUNDIDADE_MAXIMA &&
      tamanhoParaNovoCorte >= TAMANHO_MINIMO_CORTE * 2;

    if (podeCortar && contexto.aleatorio() < chanceNovoCorte) {
      gerarCortes(
        contexto,
        bloco,
        proximaDirecao,
        profundidade + 1,
        bloco.id,
        bloco.color,
      );
    } else {
      adicionarPadraoInterno(contexto, bloco);
    }
  }
}

function dividirRetangulo(
  area: Retangulo,
  direcao: Direcao,
  aleatorio: Aleatorio,
): Retangulo[] {
  const tamanhoTotal = direcao === "row" ? area.width : area.height;
  const maximoPartes = Math.min(
    3,
    Math.floor(tamanhoTotal / TAMANHO_MINIMO_CORTE),
  );

  if (maximoPartes < 2) {
    return [area];
  }

  const quantidade = inteiroAleatorio(aleatorio, 2, maximoPartes);
  const tamanhos: number[] = [];
  let restante = tamanhoTotal;

  for (let indice = 0; indice < quantidade; indice++) {
    const partesRestantes = quantidade - indice - 1;
    const tamanho =
      partesRestantes === 0
        ? restante
        : inteiroAleatorio(
            aleatorio,
            TAMANHO_MINIMO_CORTE,
            restante - partesRestantes * TAMANHO_MINIMO_CORTE,
          );
    tamanhos.push(tamanho);
    restante -= tamanho;
  }

  let deslocamento = 0;
  return tamanhos.map((tamanho) => {
    const parte: Retangulo =
      direcao === "row"
        ? {
            x: area.x + deslocamento,
            y: area.y,
            width: tamanho,
            height: area.height,
          }
        : {
            x: area.x,
            y: area.y + deslocamento,
            width: area.width,
            height: tamanho,
          };
    deslocamento += tamanho;
    return parte;
  });
}

function adicionarPadraoInterno(
  contexto: ContextoGeracao,
  pai: Bloco,
): void {
  if (
    contexto.blocks.length >= LIMITE_BLOCOS ||
    pai.width < 24 ||
    pai.height < 24
  ) {
    return;
  }

  const tiposPossiveis = [0, 1];
  if (Math.max(pai.width, pai.height) >= 150) {
    tiposPossiveis.push(2);
  }
  if (Math.max(pai.width, pai.height) >= 180) {
    tiposPossiveis.push(3);
  }

  const tipo = itemAleatorio(contexto.aleatorio, tiposPossiveis);

  if (tipo === 0) {
    adicionarRetanguloComum(contexto, pai);
    return;
  }

  if (tipo === 1) {
    adicionarRetanguloAlinhado(contexto, pai);
    return;
  }

  if (tipo === 2) {
    adicionarSequencia(contexto, pai);
    return;
  }

  adicionarOpostos(contexto, pai);
}

function adicionarRetanguloComum(
  contexto: ContextoGeracao,
  pai: Bloco,
): void {
  const margem = Math.max(4, Math.floor(Math.min(pai.width, pai.height) * 0.05));
  const width = limitarInteiro(
    Math.floor(pai.width * faixa(contexto.aleatorio, 0.8, 0.9)),
    1,
    pai.width - margem * 2,
  );
  const height = limitarInteiro(
    Math.floor(pai.height * faixa(contexto.aleatorio, 0.8, 0.9)),
    1,
    pai.height - margem * 2,
  );
  const x = inteiroAleatorio(
    contexto.aleatorio,
    pai.x + margem,
    pai.x + pai.width - margem - width,
  );
  const y = inteiroAleatorio(
    contexto.aleatorio,
    pai.y + margem,
    pai.y + pai.height - margem - height,
  );

  adicionarBloco(
    contexto,
    { x, y, width, height },
    gerarCorContrastante(contexto.aleatorio, pai.color),
    pai.id,
  );
}

function adicionarRetanguloAlinhado(
  contexto: ContextoGeracao,
  pai: Bloco,
): void {
  const margem = Math.max(4, Math.floor(Math.min(pai.width, pai.height) * 0.05));
  const width = limitarInteiro(
    Math.floor(pai.width * faixa(contexto.aleatorio, 0.7, 0.8)),
    1,
    pai.width - margem * 2,
  );
  const height = limitarInteiro(
    Math.floor(pai.height * faixa(contexto.aleatorio, 0.7, 0.8)),
    1,
    pai.height - margem * 2,
  );
  const centralizarHorizontal = contexto.aleatorio() < 0.5;
  const posicoesX = [
    pai.x + margem,
    pai.x + Math.floor((pai.width - width) / 2),
    pai.x + pai.width - margem - width,
  ];
  const posicoesY = [
    pai.y + margem,
    pai.y + Math.floor((pai.height - height) / 2),
    pai.y + pai.height - margem - height,
  ];
  const x = centralizarHorizontal
    ? posicoesX[1]
    : itemAleatorio(contexto.aleatorio, posicoesX);
  const y = centralizarHorizontal
    ? itemAleatorio(contexto.aleatorio, posicoesY)
    : posicoesY[1];

  adicionarBloco(
    contexto,
    { x, y, width, height },
    gerarCorContrastante(contexto.aleatorio, pai.color),
    pai.id,
  );
}

function adicionarSequencia(contexto: ContextoGeracao, pai: Bloco): void {
  const horizontal = pai.width >= pai.height;
  const tamanhoPrimario = horizontal ? pai.width : pai.height;
  const maximo = Math.min(6, Math.floor(tamanhoPrimario / 60));

  if (maximo < 2) {
    adicionarRetanguloComum(contexto, pai);
    return;
  }

  const quantidade = inteiroAleatorio(contexto.aleatorio, 2, maximo);
  const maximoPrimario = Math.max(1, Math.floor((tamanhoPrimario - 12) / 54));
  const itensPrimarios = Math.min(quantidade, maximoPrimario);
  const colunas = horizontal ? itensPrimarios : Math.ceil(quantidade / itensPrimarios);
  const linhas = horizontal ? Math.ceil(quantidade / itensPrimarios) : itensPrimarios;
  const padding = 6;
  const gap = 6;
  const larguraCelula = Math.floor(
    (pai.width - padding * 2 - gap * (colunas - 1)) / colunas,
  );
  const alturaCelula = Math.floor(
    (pai.height - padding * 2 - gap * (linhas - 1)) / linhas,
  );

  if (larguraCelula < 4 || alturaCelula < 4) {
    adicionarRetanguloComum(contexto, pai);
    return;
  }

  for (
    let indice = 0;
    indice < quantidade && contexto.blocks.length < LIMITE_BLOCOS;
    indice++
  ) {
    const linha = horizontal
      ? Math.floor(indice / colunas)
      : indice % linhas;
    const coluna = horizontal
      ? indice % colunas
      : Math.floor(indice / linhas);
    const width = Math.max(
      2,
      Math.floor(larguraCelula * faixa(contexto.aleatorio, 0.72, 0.92)),
    );
    const height = Math.max(
      2,
      Math.floor(alturaCelula * faixa(contexto.aleatorio, 0.72, 0.92)),
    );
    const origemX = pai.x + padding + coluna * (larguraCelula + gap);
    const origemY = pai.y + padding + linha * (alturaCelula + gap);

    adicionarBloco(
      contexto,
      {
        x: origemX + Math.floor((larguraCelula - width) / 2),
        y: origemY + Math.floor((alturaCelula - height) / 2),
        width,
        height,
      },
      gerarCorContrastante(contexto.aleatorio, pai.color),
      pai.id,
    );
  }
}

function adicionarOpostos(contexto: ContextoGeracao, pai: Bloco): void {
  const horizontal = pai.width >= pai.height;
  const margem = 5;
  const limitePrimario = Math.floor(
    ((horizontal ? pai.width : pai.height) - margem * 3) / 2,
  );
  const limiteSecundario =
    (horizontal ? pai.height : pai.width) - margem * 2;
  const ladoMaximo = Math.max(
    2,
    Math.min(
      limitePrimario,
      limiteSecundario,
      Math.floor(Math.min(pai.width, pai.height) * 0.47),
    ),
  );
  const ladoMinimo = Math.max(2, Math.floor(ladoMaximo * 0.85));

  for (let indice = 0; indice < 2; indice++) {
    const lado = inteiroAleatorio(contexto.aleatorio, ladoMinimo, ladoMaximo);
    const alinharInicio = contexto.aleatorio() < 0.5;
    const x = horizontal
      ? indice === 0
        ? pai.x + margem
        : pai.x + pai.width - margem - lado
      : alinharInicio
        ? pai.x + margem
        : pai.x + pai.width - margem - lado;
    const y = horizontal
      ? alinharInicio
        ? pai.y + margem
        : pai.y + pai.height - margem - lado
      : indice === 0
        ? pai.y + margem
        : pai.y + pai.height - margem - lado;

    adicionarBloco(
      contexto,
      { x, y, width: lado, height: lado },
      gerarCorContrastante(contexto.aleatorio, pai.color),
      pai.id,
    );
  }
}

function adicionarBloco(
  contexto: ContextoGeracao,
  retangulo: Retangulo,
  color: string,
  parentId?: number,
): Bloco {
  const bloco: Bloco = {
    id: contexto.proximoId++,
    parentId,
    x: Math.round(retangulo.x),
    y: Math.round(retangulo.y),
    width: Math.max(1, Math.round(retangulo.width)),
    height: Math.max(1, Math.round(retangulo.height)),
    color,
    borderRadius: 0,
    shape: "rectangle",
  };
  contexto.blocks.push(bloco);
  return bloco;
}

function gerarCorContrastante(aleatorio: Aleatorio, evitar: string): string {
  const corEvitada = hexParaRgb(evitar);

  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const rgb = {
      r: inteiroAleatorio(aleatorio, 0, 255),
      g: inteiroAleatorio(aleatorio, 0, 255),
      b: inteiroAleatorio(aleatorio, 0, 255),
    };
    const diferenca =
      Math.abs(rgb.r - corEvitada.r) +
      Math.abs(rgb.g - corEvitada.g) +
      Math.abs(rgb.b - corEvitada.b);

    if (diferenca >= 180) {
      return rgbParaHex(rgb.r, rgb.g, rgb.b);
    }
  }

  return rgbParaHex(
    255 - corEvitada.r,
    255 - corEvitada.g,
    255 - corEvitada.b,
  );
}

function hexParaRgb(cor: string): { r: number; g: number; b: number } {
  const valor = Number.parseInt(cor.replace("#", ""), 16);
  return {
    r: (valor >> 16) & 255,
    g: (valor >> 8) & 255,
    b: valor & 255,
  };
}

function rgbParaHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((canal) => limitarInteiro(canal, 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function criarIdDesafio(aleatorio: Aleatorio): string {
  const trechoAleatorio = Math.floor(aleatorio() * 0xffffffff)
    .toString(36)
    .padStart(7, "0");
  return `challenge-${Date.now().toString(36)}-${trechoAleatorio}`;
}

function inteiroAleatorio(
  aleatorio: Aleatorio,
  minimo: number,
  maximo: number,
): number {
  const inicio = Math.ceil(Math.min(minimo, maximo));
  const fim = Math.floor(Math.max(minimo, maximo));
  return Math.floor(aleatorio() * (fim - inicio + 1)) + inicio;
}

function limitarInteiro(valor: number, minimo: number, maximo: number): number {
  const limiteSuperior = Math.max(minimo, maximo);
  return Math.max(minimo, Math.min(limiteSuperior, Math.round(valor)));
}

function faixa(aleatorio: Aleatorio, minimo: number, maximo: number): number {
  return minimo + aleatorio() * (maximo - minimo);
}

function itemAleatorio<T>(aleatorio: Aleatorio, itens: readonly T[]): T {
  return itens[inteiroAleatorio(aleatorio, 0, itens.length - 1)];
}
