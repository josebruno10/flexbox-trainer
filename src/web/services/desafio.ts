import { Bloco, Desafio, DificuldadeDesafio } from "../types";

export const LARGURA_GABARITO = 960;
export const ALTURA_GABARITO = 540;

const MARGEM_EXTERNA = 16;
const ESPACO_SECOES = 8;
const COR_FUNDO = "#9ca3af";

const CORES_VIVAS = [
  "#dc2626",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#84cc16",
  "#22c55e",
  "#06b6d4",
  "#2563eb",
  "#7c3aed",
  "#db2777",
];

const CORES_CLARAS = ["#f8fafc", "#e2e8f0", "#dbeafe", "#dcfce7"];
const CORES_SECAO = ["#aeb4bc", "#b8bec6", "#c1c7ce"];

type Retangulo = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Aleatorio = () => number;

type ConfiguracaoNivel = {
  itensNavegacao: [number, number];
  gruposConteudo: number;
  linhasPorGrupo: [number, number];
  chanceCirculo: number;
  chanceArredondado: number;
  chanceRodape: number;
  profundidadeCartao: number;
  raioMaximo: number;
};

type ContextoGeracao = {
  aleatorio: Aleatorio;
  blocks: Bloco[];
  configuracao: ConfiguracaoNivel;
  proximoId: number;
  indiceCor: number;
};

export type OpcoesGeracaoDesafio = {
  dificuldade?: DificuldadeDesafio;
  aleatorio?: Aleatorio;
};

const CONFIGURACOES: Record<DificuldadeDesafio, ConfiguracaoNivel> = {
  facil: {
    itensNavegacao: [2, 3],
    gruposConteudo: 2,
    linhasPorGrupo: [2, 3],
    chanceCirculo: 0.1,
    chanceArredondado: 0.15,
    chanceRodape: 0.15,
    profundidadeCartao: 1,
    raioMaximo: 8,
  },
  medio: {
    itensNavegacao: [3, 5],
    gruposConteudo: 3,
    linhasPorGrupo: [3, 4],
    chanceCirculo: 0.28,
    chanceArredondado: 0.35,
    chanceRodape: 0.55,
    profundidadeCartao: 2,
    raioMaximo: 14,
  },
  dificil: {
    itensNavegacao: [4, 6],
    gruposConteudo: 4,
    linhasPorGrupo: [4, 6],
    chanceCirculo: 0.45,
    chanceArredondado: 0.55,
    chanceRodape: 1,
    profundidadeCartao: 3,
    raioMaximo: 22,
  },
};

/**
 * Gera um gabarito 960x540 seguindo a linguagem visual dos desafios:
 * fundo cinza, cabeçalho, navegação, faixas, cartões, formas aninhadas e
 * grupos de linhas. Cada chamada produz uma nova combinação aleatória.
 */
export function criarDesafioGerado(
  opcoes: OpcoesGeracaoDesafio = {},
): Desafio {
  const dificuldade = opcoes.dificuldade ?? "facil";
  const aleatorio = opcoes.aleatorio ?? Math.random;
  const contexto: ContextoGeracao = {
    aleatorio,
    blocks: [],
    configuracao: CONFIGURACOES[dificuldade],
    proximoId: 1,
    indiceCor: inteiroAleatorio(aleatorio, 0, CORES_VIVAS.length - 1),
  };

  const area: Retangulo = {
    x: MARGEM_EXTERNA,
    y: MARGEM_EXTERNA,
    width: LARGURA_GABARITO - MARGEM_EXTERNA * 2,
    height: ALTURA_GABARITO - MARGEM_EXTERNA * 2,
  };
  const temRodape = aleatorio() < contexto.configuracao.chanceRodape;
  const alturaCabecalho = inteiroAleatorio(
    aleatorio,
    dificuldade === "dificil" ? 104 : 112,
    dificuldade === "facil" ? 132 : 124,
  );
  const alturaFaixa = inteiroAleatorio(aleatorio, 48, 60);
  const alturaRodape = temRodape ? inteiroAleatorio(aleatorio, 42, 54) : 0;
  const quantidadeEspacos = temRodape ? 3 : 2;
  const alturaConteudo =
    area.height -
    alturaCabecalho -
    alturaFaixa -
    alturaRodape -
    quantidadeEspacos * ESPACO_SECOES;

  const cabecalho: Retangulo = {
    x: area.x,
    y: area.y,
    width: area.width,
    height: alturaCabecalho,
  };
  const faixa: Retangulo = {
    x: area.x,
    y: cabecalho.y + cabecalho.height + ESPACO_SECOES,
    width: area.width,
    height: alturaFaixa,
  };
  const conteudo: Retangulo = {
    x: area.x,
    y: faixa.y + faixa.height + ESPACO_SECOES,
    width: area.width,
    height: alturaConteudo,
  };

  gerarCabecalho(contexto, cabecalho);
  gerarFaixaDestaque(contexto, faixa);
  gerarConteudo(contexto, conteudo);

  if (temRodape) {
    gerarRodape(contexto, {
      x: area.x,
      y: conteudo.y + conteudo.height + ESPACO_SECOES,
      width: area.width,
      height: alturaRodape,
    });
  }

  return {
    challengeId: criarIdDesafio(aleatorio),
    dificuldade,
    width: LARGURA_GABARITO,
    height: ALTURA_GABARITO,
    backgroundColor: COR_FUNDO,
    blocks: contexto.blocks,
  };
}

function gerarCabecalho(
  contexto: ContextoGeracao,
  retangulo: Retangulo,
): void {
  const corSecao = itemAleatorio(contexto.aleatorio, CORES_SECAO);
  const cabecalho = adicionarBloco(contexto, retangulo, corSecao);
  const padding = 14;
  const gap = 14;
  const painelNaEsquerda = contexto.aleatorio() < 0.5;
  const larguraPainel = Math.floor(retangulo.width * faixa(contexto.aleatorio, 0.28, 0.36));
  const larguraPrincipal = retangulo.width - padding * 2 - gap - larguraPainel;
  const xPrincipal = painelNaEsquerda
    ? retangulo.x + padding + larguraPainel + gap
    : retangulo.x + padding;
  const xPainel = painelNaEsquerda
    ? retangulo.x + padding
    : xPrincipal + larguraPrincipal + gap;
  const quantidadeNavegacao = inteiroAleatorio(
    contexto.aleatorio,
    contexto.configuracao.itensNavegacao[0],
    contexto.configuracao.itensNavegacao[1],
  );
  const gapNavegacao = 10;
  const larguraItem = Math.floor(
    (larguraPrincipal - gapNavegacao * (quantidadeNavegacao - 1)) /
      quantidadeNavegacao,
  );
  const alturaItem = inteiroAleatorio(contexto.aleatorio, 20, 28);
  const yNavegacao = retangulo.y + padding;

  for (let indice = 0; indice < quantidadeNavegacao; indice++) {
    adicionarBloco(
      contexto,
      {
        x: xPrincipal + indice * (larguraItem + gapNavegacao),
        y: yNavegacao,
        width: larguraItem,
        height: alturaItem,
      },
      proximaCor(contexto),
      cabecalho.id,
      raioAleatorio(contexto),
    );
  }

  const yCaixa = yNavegacao + alturaItem + 12;
  const caixa = adicionarBloco(
    contexto,
    {
      x: xPrincipal,
      y: yCaixa,
      width: larguraPrincipal,
      height: retangulo.y + retangulo.height - padding - yCaixa,
    },
    itemAleatorio(contexto.aleatorio, CORES_CLARAS),
    cabecalho.id,
    raioAleatorio(contexto),
  );
  const caixaPadding = 10;
  const larguraMarcador = Math.max(18, Math.floor(caixa.width * 0.12));

  adicionarBloco(
    contexto,
    {
      x: caixa.x + caixaPadding,
      y: caixa.y + caixaPadding,
      width: larguraMarcador,
      height: caixa.height - caixaPadding * 2,
    },
    proximaCor(contexto),
    caixa.id,
    raioAleatorio(contexto),
  );
  adicionarBloco(
    contexto,
    {
      x: caixa.x + caixa.width - caixaPadding - larguraMarcador * 1.8,
      y: caixa.y + caixaPadding,
      width: larguraMarcador * 1.8,
      height: caixa.height - caixaPadding * 2,
    },
    proximaCor(contexto),
    caixa.id,
    raioAleatorio(contexto),
  );

  const painel = adicionarBloco(
    contexto,
    {
      x: xPainel,
      y: retangulo.y + padding,
      width: larguraPainel,
      height: retangulo.height - padding * 2,
    },
    itemAleatorio(contexto.aleatorio, CORES_CLARAS),
    cabecalho.id,
    raioAleatorio(contexto),
  );

  if (contexto.configuracao.profundidadeCartao > 1) {
    const lado = Math.floor(Math.min(painel.width, painel.height) * 0.36);
    adicionarBloco(
      contexto,
      {
        x: painel.x + (painel.width - lado) / 2,
        y: painel.y + (painel.height - lado) / 2,
        width: lado,
        height: lado,
      },
      proximaCor(contexto),
      painel.id,
      raioAleatorio(contexto),
      contexto.aleatorio() < contexto.configuracao.chanceCirculo
        ? "circle"
        : "rectangle",
    );
  }
}

function gerarFaixaDestaque(
  contexto: ContextoGeracao,
  retangulo: Retangulo,
): void {
  const faixa = adicionarBloco(
    contexto,
    retangulo,
    proximaCor(contexto),
    undefined,
    raioAleatorio(contexto),
  );
  const padding = 9;
  const alturaLinha = Math.max(7, Math.floor(retangulo.height * 0.18));
  const alturaChip = retangulo.height - padding * 2 - alturaLinha - 5;
  const larguraChip = inteiroAleatorio(
    contexto.aleatorio,
    Math.floor(retangulo.width * 0.08),
    Math.floor(retangulo.width * 0.16),
  );

  adicionarBloco(
    contexto,
    {
      x: retangulo.x + padding,
      y: retangulo.y + padding,
      width: larguraChip,
      height: alturaChip,
    },
    proximaCor(contexto, faixa.color),
    faixa.id,
    raioAleatorio(contexto),
  );
  adicionarBloco(
    contexto,
    {
      x: retangulo.x + retangulo.width - padding - larguraChip,
      y: retangulo.y + padding,
      width: larguraChip,
      height: alturaChip,
    },
    proximaCor(contexto, faixa.color),
    faixa.id,
    raioAleatorio(contexto),
  );
  adicionarBloco(
    contexto,
    {
      x: retangulo.x + padding,
      y: retangulo.y + retangulo.height - padding - alturaLinha,
      width: retangulo.width - padding * 2,
      height: alturaLinha,
    },
    proximaCor(contexto, faixa.color),
    faixa.id,
    raioAleatorio(contexto),
  );
}

function gerarConteudo(
  contexto: ContextoGeracao,
  retangulo: Retangulo,
): void {
  const corConteudo = itemAleatorio(contexto.aleatorio, CORES_SECAO);
  const conteudo = adicionarBloco(contexto, retangulo, corConteudo);
  const padding = 12;
  const gap = 12;
  const quantidade = contexto.configuracao.gruposConteudo;
  const colunas = 2;
  const linhas = Math.ceil(quantidade / colunas);
  const larguraGrupo = Math.floor(
    (retangulo.width - padding * 2 - gap * (colunas - 1)) / colunas,
  );
  const alturaGrupo = Math.floor(
    (retangulo.height - padding * 2 - gap * (linhas - 1)) / linhas,
  );
  const inverterOrdem = contexto.aleatorio() < 0.5;

  for (let indice = 0; indice < quantidade; indice++) {
    const indiceVisual = inverterOrdem ? quantidade - indice - 1 : indice;
    const coluna = indiceVisual % colunas;
    const linha = Math.floor(indiceVisual / colunas);
    const grupo = adicionarBloco(
      contexto,
      {
        x: retangulo.x + padding + coluna * (larguraGrupo + gap),
        y: retangulo.y + padding + linha * (alturaGrupo + gap),
        width: larguraGrupo,
        height: alturaGrupo,
      },
      corConteudo,
      conteudo.id,
    );
    gerarGrupoCartao(contexto, grupo);
  }
}

function gerarGrupoCartao(contexto: ContextoGeracao, grupo: Bloco): void {
  const padding = 8;
  const gap = 10;
  const cartaoNaEsquerda = contexto.aleatorio() < 0.5;
  const larguraUtil = grupo.width - padding * 2;
  const larguraCartao = Math.floor(
    larguraUtil *
      faixa(
        contexto.aleatorio,
        contexto.configuracao.gruposConteudo > 3 ? 0.46 : 0.52,
        0.62,
      ),
  );
  const larguraLinhas = larguraUtil - larguraCartao - gap;
  const alturaCartao = Math.floor(
    (grupo.height - padding * 2) * faixa(contexto.aleatorio, 0.72, 1),
  );
  const xCartao = cartaoNaEsquerda
    ? grupo.x + padding
    : grupo.x + grupo.width - padding - larguraCartao;
  const xLinhas = cartaoNaEsquerda
    ? xCartao + larguraCartao + gap
    : grupo.x + padding;
  const yCartao =
    grupo.y +
    padding +
    inteiroAleatorio(
      contexto.aleatorio,
      0,
      Math.max(0, grupo.height - padding * 2 - alturaCartao),
    );
  const cartao = adicionarBloco(
    contexto,
    {
      x: xCartao,
      y: yCartao,
      width: larguraCartao,
      height: alturaCartao,
    },
    proximaCor(contexto),
    grupo.id,
    raioAleatorio(contexto),
  );

  gerarFormasDoCartao(contexto, cartao);
  gerarLinhas(contexto, grupo, {
    x: xLinhas,
    y: grupo.y + padding,
    width: larguraLinhas,
    height: grupo.height - padding * 2,
  });
}

function gerarFormasDoCartao(
  contexto: ContextoGeracao,
  cartao: Bloco,
): void {
  const padding = Math.max(7, Math.floor(Math.min(cartao.width, cartao.height) * 0.08));
  const ladoMaximo = Math.max(
    1,
    Math.min(cartao.width - padding * 2, cartao.height - padding * 2),
  );
  const lado = Math.max(
    1,
    Math.floor(ladoMaximo * faixa(contexto.aleatorio, 0.58, 0.92)),
  );
  const posicoesX = [
    cartao.x + padding,
    cartao.x + (cartao.width - lado) / 2,
    cartao.x + cartao.width - padding - lado,
  ];
  const posicoesY = [
    cartao.y + padding,
    cartao.y + (cartao.height - lado) / 2,
    cartao.y + cartao.height - padding - lado,
  ];
  let forma = adicionarBloco(
    contexto,
    {
      x: itemAleatorio(contexto.aleatorio, posicoesX),
      y: itemAleatorio(contexto.aleatorio, posicoesY),
      width: lado,
      height: lado,
    },
    proximaCor(contexto, cartao.color),
    cartao.id,
    raioAleatorio(contexto),
    contexto.aleatorio() < contexto.configuracao.chanceCirculo
      ? "circle"
      : "rectangle",
  );

  for (
    let nivel = 1;
    nivel < contexto.configuracao.profundidadeCartao;
    nivel++
  ) {
    const novoLado = Math.floor(Math.min(forma.width, forma.height) * 0.46);

    if (novoLado < 6) {
      break;
    }

    forma = adicionarBloco(
      contexto,
      {
        x: forma.x + (forma.width - novoLado) / 2,
        y: forma.y + (forma.height - novoLado) / 2,
        width: novoLado,
        height: novoLado,
      },
      proximaCor(contexto, forma.color),
      forma.id,
      raioAleatorio(contexto),
      contexto.aleatorio() < contexto.configuracao.chanceCirculo
        ? "circle"
        : "rectangle",
    );
  }
}

function gerarLinhas(
  contexto: ContextoGeracao,
  grupo: Bloco,
  area: Retangulo,
): void {
  const quantidade = inteiroAleatorio(
    contexto.aleatorio,
    contexto.configuracao.linhasPorGrupo[0],
    contexto.configuracao.linhasPorGrupo[1],
  );
  const gap = Math.max(4, Math.floor(area.height * 0.045));
  const altura = Math.max(
    3,
    Math.min(14, Math.floor((area.height - gap * (quantidade - 1)) / quantidade)),
  );
  const alturaTotal = quantidade * altura + gap * (quantidade - 1);
  const inicioY = area.y + Math.max(0, (area.height - alturaTotal) / 2);
  const cor = proximaCor(contexto);

  for (let indice = 0; indice < quantidade; indice++) {
    const width = Math.max(
      5,
      Math.floor(area.width * faixa(contexto.aleatorio, 0.62, 1)),
    );
    const alinhadoDireita = contexto.aleatorio() < 0.5;
    adicionarBloco(
      contexto,
      {
        x: alinhadoDireita ? area.x + area.width - width : area.x,
        y: inicioY + indice * (altura + gap),
        width,
        height: altura,
      },
      cor,
      grupo.id,
      raioAleatorio(contexto),
    );
  }
}

function gerarRodape(contexto: ContextoGeracao, retangulo: Retangulo): void {
  const rodape = adicionarBloco(
    contexto,
    retangulo,
    proximaCor(contexto),
    undefined,
    raioAleatorio(contexto),
  );
  const padding = 8;
  const alturaLinha = Math.max(6, Math.floor(retangulo.height * 0.2));
  const larguraChip = Math.floor(retangulo.width * 0.11);
  const alturaChip = retangulo.height - padding * 2 - alturaLinha - 4;

  adicionarBloco(
    contexto,
    {
      x: retangulo.x + padding,
      y: retangulo.y + padding,
      width: larguraChip,
      height: alturaChip,
    },
    proximaCor(contexto, rodape.color),
    rodape.id,
    raioAleatorio(contexto),
  );
  adicionarBloco(
    contexto,
    {
      x: retangulo.x + retangulo.width - padding - larguraChip,
      y: retangulo.y + padding,
      width: larguraChip,
      height: alturaChip,
    },
    proximaCor(contexto, rodape.color),
    rodape.id,
    raioAleatorio(contexto),
  );
  adicionarBloco(
    contexto,
    {
      x: retangulo.x + padding,
      y: retangulo.y + retangulo.height - padding - alturaLinha,
      width: retangulo.width - padding * 2,
      height: alturaLinha,
    },
    proximaCor(contexto, rodape.color),
    rodape.id,
    raioAleatorio(contexto),
  );
}

function adicionarBloco(
  contexto: ContextoGeracao,
  retangulo: Retangulo,
  color: string,
  parentId?: number,
  borderRadius = 0,
  shape: Bloco["shape"] = "rectangle",
): Bloco {
  const bloco: Bloco = {
    id: contexto.proximoId++,
    parentId,
    x: Math.round(retangulo.x),
    y: Math.round(retangulo.y),
    width: Math.max(1, Math.round(retangulo.width)),
    height: Math.max(1, Math.round(retangulo.height)),
    color,
    borderRadius: shape === "circle" ? 0 : Math.max(0, Math.round(borderRadius)),
    shape,
  };

  contexto.blocks.push(bloco);
  return bloco;
}

function proximaCor(contexto: ContextoGeracao, evitar?: string): string {
  for (let tentativa = 0; tentativa < CORES_VIVAS.length; tentativa++) {
    const cor = CORES_VIVAS[contexto.indiceCor % CORES_VIVAS.length];
    contexto.indiceCor += inteiroAleatorio(contexto.aleatorio, 1, 3);

    if (cor !== evitar) {
      return cor;
    }
  }

  return CORES_VIVAS[0];
}

function raioAleatorio(contexto: ContextoGeracao): number {
  if (contexto.aleatorio() >= contexto.configuracao.chanceArredondado) {
    return 0;
  }

  return inteiroAleatorio(
    contexto.aleatorio,
    4,
    contexto.configuracao.raioMaximo,
  );
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
  const inicio = Math.ceil(minimo);
  const fim = Math.max(inicio, Math.floor(maximo));
  return Math.floor(aleatorio() * (fim - inicio + 1)) + inicio;
}

function faixa(aleatorio: Aleatorio, minimo: number, maximo: number): number {
  return minimo + aleatorio() * (maximo - minimo);
}

function itemAleatorio<T>(aleatorio: Aleatorio, itens: readonly T[]): T {
  return itens[inteiroAleatorio(aleatorio, 0, itens.length - 1)];
}
