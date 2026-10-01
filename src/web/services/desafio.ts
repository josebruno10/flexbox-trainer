import { Bloco, Desafio } from "../types";

// Porta do gerador de Vitor Maia (Gerador-de-imagens-para-torneio-de-CSS,
// commit 05ac618). As decisões aleatórias seguem o script original; muda a
// saída, que vira uma lista de blocos com hierarquia em vez de desenho direto
// no canvas, e o gerador de números, que pode ser injetado nos testes.
export const LARGURA_GABARITO = 800;
export const ALTURA_GABARITO = 800;

const TAMANHO_MINIMO_CORTE = 100;
const PROFUNDIDADE_MAXIMA_CORTE = 3;
const ESPACO_SEQUENCIA = 10;
const ESPACO_MINIMO_CIRCULOS = 30;

type Retangulo = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Rgb = { r: number; g: number; b: number };

// 0 corta em partes lado a lado, 1 em faixas empilhadas. Filhos de padrões
// internos não têm direção e passam a considerar o maior lado.
type Direcao = 0 | 1 | null;
type Aleatorio = () => number;
type Forma = NonNullable<Bloco["shape"]>;

type ContextoGeracao = {
  aleatorio: Aleatorio;
  blocks: Bloco[];
  proximoId: number;
};

type Regiao = {
  bloco: Bloco;
  rgb: Rgb;
  // Profundidade de cortes; filhos de padrões internos recomeçam em 0.
  count: number;
  cortado: boolean;
};

export type OpcoesGeracaoDesafio = {
  aleatorio?: Aleatorio;
};

export function criarDesafioGerado(
  opcoes: OpcoesGeracaoDesafio = {},
): Desafio {
  const aleatorio = opcoes.aleatorio ?? Math.random;
  const contexto: ContextoGeracao = {
    aleatorio,
    blocks: [],
    proximoId: 1,
  };
  const corFundo = corAleatoria(aleatorio);
  const direcao = aleatorio() < 0.5 ? 0 : 1;

  for (const faixa of escolherLayoutPrimario(aleatorio, direcao)) {
    cortarRegiao(contexto, faixa.area, faixa.direcao, 0, undefined);
  }

  return {
    challengeId: criarIdDesafio(aleatorio),
    width: LARGURA_GABARITO,
    height: ALTURA_GABARITO,
    backgroundColor: rgbParaHex(corFundo),
    blocks: contexto.blocks,
  };
}

// Coordenadas fixas do script original, em px do gabarito 800x800.
function escolherLayoutPrimario(
  aleatorio: Aleatorio,
  direcao: 0 | 1,
): { area: Retangulo; direcao: 0 | 1 }[] {
  switch (inteiroAleatorio(aleatorio, 0, 2)) {
    case 0:
      // Cabeçalho, conteúdo e rodapé.
      return [
        { area: { x: 0, y: 0, width: 800, height: 200 }, direcao: 0 },
        { area: { x: 0, y: 200, width: 800, height: 400 }, direcao },
        { area: { x: 0, y: 600, width: 800, height: 200 }, direcao: 0 },
      ];
    case 1:
      // Três colunas.
      return [
        { area: { x: 0, y: 0, width: 200, height: 800 }, direcao: 1 },
        { area: { x: 200, y: 0, width: 400, height: 800 }, direcao },
        { area: { x: 600, y: 0, width: 200, height: 800 }, direcao: 1 },
      ];
    default:
      // Duas colunas sobre um rodapé.
      return [
        { area: { x: 0, y: 0, width: 300, height: 600 }, direcao },
        { area: { x: 300, y: 0, width: 500, height: 600 }, direcao },
        { area: { x: 0, y: 600, width: 800, height: 200 }, direcao },
      ];
  }
}

// EscolheLayout do original: as partes cobrem a área inteira e recebem cores
// independentes, já que o pai fica totalmente escondido por elas.
function cortarRegiao(
  contexto: ContextoGeracao,
  area: Retangulo,
  direcao: 0 | 1,
  count: number,
  parentId: number | undefined,
): void {
  for (const parte of dividirArea(area, direcao, contexto.aleatorio)) {
    const rgb = corAleatoria(contexto.aleatorio);
    const bloco = adicionarBloco(contexto, parte, rgb, parentId, "rectangle");
    processarRegiao(
      contexto,
      { bloco, rgb, count: count + 1, cortado: true },
      direcao,
    );
  }
}

function dividirArea(
  area: Retangulo,
  direcao: 0 | 1,
  aleatorio: Aleatorio,
): Retangulo[] {
  let restante = direcao === 0 ? area.width : area.height;
  const maximoDivisoes = Math.min(restante / TAMANHO_MINIMO_CORTE, 3);
  const quantidade =
    direcao === 0
      ? Math.ceil(aleatorio() * (maximoDivisoes - 1))
      : Math.floor(aleatorio() * (maximoDivisoes - 1)) + 1;
  const partes: Retangulo[] = [];
  let deslocamento = 0;

  for (let indice = 0; indice <= quantidade; indice++) {
    const partesSeguintes = quantidade - indice;
    const tamanho =
      partesSeguintes === 0
        ? restante
        : limitar(
            Math.floor(
              aleatorio() *
                (restante - TAMANHO_MINIMO_CORTE * (partesSeguintes + 1)),
            ) + TAMANHO_MINIMO_CORTE,
            1,
            restante - partesSeguintes,
          );

    partes.push(
      direcao === 0
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
          },
    );
    restante -= tamanho;
    deslocamento += tamanho;
  }

  return partes;
}

// VerificaDiv do original, aplicado a uma única região.
function processarRegiao(
  contexto: ContextoGeracao,
  regiao: Regiao,
  direcao: Direcao,
): void {
  const { aleatorio } = contexto;
  const { width, height } = regiao.bloco;
  const blocosAntes = contexto.blocks.length;

  if (deveDividir(aleatorio, width, height, direcao)) {
    // Quanto mais profundo o corte, menor a chance de cortar de novo.
    const cortar =
      regiao.count < PROFUNDIDADE_MAXIMA_CORTE &&
      aleatorio() > regiao.count * 0.25 + 0.1;

    if (cortar) {
      cortarRegiao(
        contexto,
        regiao.bloco,
        direcao === 0 ? 1 : 0,
        regiao.count,
        regiao.bloco.id,
      );
    } else {
      adicionarPadraoInterno(
        contexto,
        regiao,
        inteiroAleatorio(aleatorio, 0, 2),
        true,
      );
    }
    return;
  }

  const cabeElemento =
    (width > 100 && height > 50) || (height > 100 && width > 50);

  if (cabeElemento) {
    adicionarPadraoInterno(
      contexto,
      regiao,
      inteiroAleatorio(aleatorio, 0, 2),
      false,
    );
  }

  // Equivale à verificação confirmFilho do original: uma parte de corte que
  // terminou vazia (pequena ou sem espaço para círculos) ganha um elemento.
  if (regiao.cortado && contexto.blocks.length === blocosAntes) {
    adicionarPadraoInterno(
      contexto,
      regiao,
      inteiroAleatorio(aleatorio, 0, 2),
      false,
    );
  }
}

function deveDividir(
  aleatorio: Aleatorio,
  width: number,
  height: number,
  direcao: Direcao,
): boolean {
  const lado =
    direcao === 0
      ? height
      : direcao === 1
        ? width
        : Math.max(width, height);

  if (lado <= TAMANHO_MINIMO_CORTE * 2) {
    return false;
  }

  const proporcao = lado / TAMANHO_MINIMO_CORTE;
  return Math.floor(aleatorio() * proporcao) + (proporcao < 3 ? 0 : 2) > 0;
}

// AddRet do original. Com continuarDividindo, cada filho volta a ser
// processado como região; caso contrário, é um elemento final.
function adicionarPadraoInterno(
  contexto: ContextoGeracao,
  pai: Regiao,
  tipoSorteado: number,
  continuarDividindo: boolean,
): void {
  const { aleatorio } = contexto;
  const { width, height } = pai.bloco;
  const cabeSequencia =
    (width >= 190 && height >= 50) || (width >= 60 && height >= 190);
  let tipo = cabeSequencia ? tipoSorteado : inteiroAleatorio(aleatorio, 0, 1);

  if (!continuarDividindo) {
    // Elementos finais são círculos (3), retângulos comuns (0) ou alinhados (1).
    tipo = (inteiroAleatorio(aleatorio, 0, 2) + 3) % 4;
  }

  const rgb = corDerivada(aleatorio, pai.rgb);
  const [areas, forma]: [Retangulo[], Forma] =
    tipo === 0
      ? [[retanguloComum(aleatorio, pai.bloco)], "rectangle"]
      : tipo === 1
        ? [[retanguloAlinhado(aleatorio, pai.bloco)], "rectangle"]
        : tipo === 2
          ? [sequencia(aleatorio, pai.bloco), "rectangle"]
          : [circulos(aleatorio, pai.bloco), "circle"];

  for (const area of areas) {
    const bloco = adicionarBloco(contexto, area, rgb, pai.bloco.id, forma);

    if (continuarDividindo) {
      processarRegiao(
        contexto,
        { bloco, rgb, count: 0, cortado: false },
        null,
      );
    }
  }
}

function retanguloComum(aleatorio: Aleatorio, pai: Retangulo): Retangulo {
  const width = inteiroAleatorio(aleatorio, pai.width * 0.8, pai.width * 0.9);
  const height = inteiroAleatorio(
    aleatorio,
    pai.height * 0.8,
    pai.height * 0.9,
  );

  return {
    x:
      pai.x +
      limitar(
        inteiroAleatorio(aleatorio, 5, pai.width - width - 5),
        0,
        pai.width - width,
      ),
    y:
      pai.y +
      limitar(
        inteiroAleatorio(aleatorio, 5, pai.height - height - 5),
        0,
        pai.height - height,
      ),
    width,
    height,
  };
}

function retanguloAlinhado(aleatorio: Aleatorio, pai: Retangulo): Retangulo {
  const width = inteiroAleatorio(aleatorio, pai.width * 0.7, pai.width * 0.8);
  const height = inteiroAleatorio(
    aleatorio,
    pai.height * 0.7,
    pai.height * 0.8,
  );
  const centroX = pai.x + Math.floor((pai.width - width) / 2);
  const centroY = pai.y + Math.floor((pai.height - height) / 2);
  let x = centroX;
  let y = centroY;

  // Centraliza em um eixo e escolhe início, centro ou fim no outro.
  if (aleatorio() < 0.5) {
    y = itemAleatorio(aleatorio, [
      pai.y + 5,
      centroY,
      pai.y + pai.height - height - 5,
    ]);
  } else {
    x = itemAleatorio(aleatorio, [
      pai.x + 5,
      centroX,
      pai.x + pai.width - width - 5,
    ]);
  }

  return {
    x: limitar(x, pai.x, pai.x + pai.width - width),
    y: limitar(y, pai.y, pai.y + pai.height - height),
    width,
    height,
  };
}

// Grade de 2 a 6 itens iguais, preenchida no sentido do maior lado.
function sequencia(aleatorio: Aleatorio, pai: Retangulo): Retangulo[] {
  const W = pai.width;
  const H = pai.height;
  const horizontal = W >= H;
  const metadePerimetroUtil = (W - 10 + (H - 10)) / 2;
  const maximo = Math.min(6, metadePerimetroUtil / (horizontal ? 65 : 70));
  const total = Math.max(2, inteiroAleatorio(aleatorio, 2, maximo));
  const capacidade = (colunas: number, linhas: number) => ({
    colunas,
    linhas,
    largura: (W - (colunas + 1) * ESPACO_SEQUENCIA) / colunas,
    altura: (H - (linhas + 1) * ESPACO_SEQUENCIA) / linhas,
  });

  // Prefere o máximo de itens no sentido principal com o tamanho mínimo
  // desejado; sem isso, usa a grade com a maior área livre por item.
  let grade: ReturnType<typeof capacidade> | undefined;

  for (let principal = total; principal >= 1 && !grade; principal--) {
    const secundario = Math.ceil(total / principal);
    const candidata = horizontal
      ? capacidade(principal, secundario)
      : capacidade(secundario, principal);

    if (candidata.largura >= W * 0.5 && candidata.altura >= H * 0.5) {
      grade = candidata;
    }
  }

  if (!grade) {
    let maiorArea = 0;

    for (let colunas = 1; colunas <= total; colunas++) {
      const candidata = capacidade(colunas, Math.ceil(total / colunas));
      const area = candidata.largura * candidata.altura;

      if (candidata.largura > 0 && candidata.altura > 0 && area > maiorArea) {
        maiorArea = area;
        grade = candidata;
      }
    }
  }

  if (!grade) {
    return [retanguloComum(aleatorio, pai)];
  }

  const limiteLargura = Math.min(W * 0.9, grade.largura);
  const limiteAltura = Math.min(H * 0.9, grade.altura);
  const inicioLargura = Math.min(W * 0.5, limiteLargura);
  const inicioAltura = Math.min(H * 0.5, limiteAltura);
  const width = inicioLargura + aleatorio() * (limiteLargura - inicioLargura);
  const height = inicioAltura + aleatorio() * (limiteAltura - inicioAltura);
  // Espaços iguais nas bordas e entre itens deixam a grade centralizada.
  const espacoX = (W - width * grade.colunas) / (grade.colunas + 1);
  const espacoY = (H - height * grade.linhas) / (grade.linhas + 1);
  const areas: Retangulo[] = [];

  for (let indice = 0; indice < total; indice++) {
    const linha = horizontal
      ? Math.floor(indice / grade.colunas)
      : indice % grade.linhas;
    const coluna = horizontal
      ? indice % grade.colunas
      : Math.floor(indice / grade.linhas);

    areas.push({
      x: pai.x + espacoX + coluna * (width + espacoX),
      y: pai.y + espacoY + linha * (height + espacoY),
      width,
      height,
    });
  }

  return areas;
}

// Círculos enfileirados no maior lado. Partes quase quadradas não comportam
// nenhum, e aí a região fica vazia, como no original.
function circulos(aleatorio: Aleatorio, pai: Retangulo): Retangulo[] {
  const menorLado = Math.min(pai.width, pai.height);
  const maiorLado = Math.max(pai.width, pai.height);
  const diametro = inteiroAleatorio(aleatorio, menorLado * 0.8, menorLado * 0.9);
  const quantidade = Math.floor(
    (maiorLado - ESPACO_MINIMO_CIRCULOS) / (diametro + ESPACO_MINIMO_CIRCULOS),
  );
  const espaco = (maiorLado - quantidade * diametro) / (quantidade + 1);
  const areas: Retangulo[] = [];

  for (let indice = 0; indice < quantidade; indice++) {
    const deslocamento = espaco + indice * (diametro + espaco);
    areas.push(
      pai.width >= pai.height
        ? {
            x: pai.x + deslocamento,
            y: pai.y + (pai.height - diametro) / 2,
            width: diametro,
            height: diametro,
          }
        : {
            x: pai.x + (pai.width - diametro) / 2,
            y: pai.y + deslocamento,
            width: diametro,
            height: diametro,
          },
    );
  }

  return areas;
}

function adicionarBloco(
  contexto: ContextoGeracao,
  area: Retangulo,
  rgb: Rgb,
  parentId: number | undefined,
  shape: Forma,
): Bloco {
  // Arredondar as bordas, e não a largura, mantém o filho dentro do pai.
  const x = Math.round(area.x);
  const y = Math.round(area.y);
  const width = Math.max(1, Math.round(area.x + area.width) - x);
  const bloco: Bloco = {
    id: contexto.proximoId++,
    parentId,
    x,
    y,
    width,
    height: Math.max(1, Math.round(area.y + area.height) - y),
    color: rgbParaHex(rgb),
    borderRadius: shape === "circle" ? width / 2 : 0,
    shape,
  };
  contexto.blocks.push(bloco);
  return bloco;
}

function corAleatoria(aleatorio: Aleatorio): Rgb {
  return {
    r: Math.floor(aleatorio() * 256),
    g: Math.floor(aleatorio() * 256),
    b: Math.floor(aleatorio() * 256),
  };
}

// Cor do filho a partir da do pai: soma de 90 a 164 em cada canal e, se os
// canais ficarem próximos demais, desloca um deles para fugir do cinza.
function corDerivada(aleatorio: Aleatorio, pai: Rgb): Rgb {
  const canal = (valor: number) =>
    Math.abs(Math.floor(aleatorio() * 75) + valor + 90) % 255;
  const cor = { r: canal(pai.r), g: canal(pai.g), b: canal(pai.b) };

  if (cor.r - cor.g < 40 && cor.r - cor.b < 40 && cor.g - cor.b < 40) {
    const sorteio = aleatorio() * 3;

    if (sorteio < 1) {
      cor.r = (cor.r + 100) % 255;
    } else if (sorteio < 2) {
      cor.g = (cor.g + 100) % 255;
    } else {
      cor.b = (cor.b + 100) % 255;
    }
  }

  return cor;
}

function rgbParaHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((canal) => limitar(Math.round(canal), 0, 255).toString(16).padStart(2, "0"))
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

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(Math.max(minimo, maximo), valor));
}

function itemAleatorio<T>(aleatorio: Aleatorio, itens: readonly T[]): T {
  return itens[inteiroAleatorio(aleatorio, 0, itens.length - 1)];
}
