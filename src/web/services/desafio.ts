import { Bloco, Desafio, Nivel } from "../types";
import { nivelDoCodigo } from "../niveis";
import { aleatorioDoCodigo, sortearCodigo } from "./codigoDesafio";

// Porta do gerador de Vitor Costa (Gerador-de-imagens-para-torneio-de-CSS,
// commit 6cbe24e). As decisões aleatórias seguem o script original; muda a
// saída, que vira uma lista de blocos com hierarquia em vez de desenho direto
// no canvas, e o gerador de números, que pode ser injetado nos testes.
export const LARGURA_GABARITO = 800;
export const ALTURA_GABARITO = 800;

// Nenhuma parte de um corte fica menor que isto.
const TAMANHO_MINIMO = 70;
// Cada elemento fica a esta distância das bordas da região que o contém.
const MARGEM = 15;
const PROFUNDIDADE_MAXIMA_CORTE = 2;
const ESPACO_SEQUENCIA = 10;
const ESPACO_MINIMO_CIRCULOS = 30;
const DIAMETRO_MINIMO = 20;

// Quantos componentes saem em cada nível, dos menores para os maiores.
const REMOVIDOS_POR_NIVEL: Record<Nivel, number> = {
  facil: 15,
  medio: 9,
  dificil: 0,
};
// Nenhum nível tira tanto que sobrem menos componentes que isto.
const MINIMO_DE_COMPONENTES = 8;

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
  // Os blocos criados juntos (uma sequência, uma fileira de círculos) saem
  // juntos nos níveis mais fáceis, para nenhum padrão ficar pela metade.
  grupoDoBloco: Map<number, number>;
  proximoGrupo: number;
};

type Regiao = {
  area: Retangulo;
  // O bloco visível mais próximo que contém a região: as partes dos cortes
  // não aparecem na imagem.
  parentId: number | undefined;
  // A cor de onde saem as dos filhos: a do próprio bloco ou, numa parte de
  // corte, a do bloco visível mais próximo (ou a do fundo).
  rgb: Rgb;
  // Profundidade de cortes; filhos de padrões internos recomeçam em 0.
  count: number;
  cortado: boolean;
};

export type OpcoesGeracaoDesafio = {
  aleatorio?: Aleatorio;
  nivel?: Nivel;
};

/**
 * O desafio de um código: o mesmo código gera sempre a mesma imagem, no nível
 * que ele carrega. Sem código, sorteia um médio. Cada vez é uma tentativa
 * nova, com outro challengeId.
 */
export function criarDesafioPorCodigo(codigo: string = sortearCodigo()): Desafio {
  const desafio = criarDesafioGerado({
    aleatorio: aleatorioDoCodigo(codigo),
    nivel: nivelDoCodigo(codigo),
  });
  const tentativa =
    Date.now().toString(36) +
    Math.floor(Math.random() * 0xffffff)
      .toString(36)
      .padStart(5, "0");
  return { ...desafio, challengeId: `challenge-${codigo}-${tentativa}`, codigo };
}

export function criarDesafioGerado(
  opcoes: OpcoesGeracaoDesafio = {},
): Desafio {
  const aleatorio = opcoes.aleatorio ?? Math.random;
  const nivel = opcoes.nivel ?? "dificil";
  const contexto: ContextoGeracao = {
    aleatorio,
    blocks: [],
    proximoId: 1,
    grupoDoBloco: new Map(),
    proximoGrupo: 1,
  };
  const corFundo = corAleatoria(aleatorio);
  const direcao = aleatorio() < 0.5 ? 0 : 1;

  for (const faixa of escolherLayoutPrimario(aleatorio, direcao)) {
    const regiao: Regiao = {
      area: faixa.area,
      parentId: undefined,
      rgb: corFundo,
      count: 0,
      cortado: true,
    };
    cortarRegiao(contexto, regiao, faixa.direcao);
  }

  return {
    challengeId: criarIdDesafio(aleatorio),
    width: LARGURA_GABARITO,
    height: ALTURA_GABARITO,
    backgroundColor: rgbParaHex(corFundo),
    nivel,
    blocks: tirarOsMenores(contexto, REMOVIDOS_POR_NIVEL[nivel]),
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

// EscolheLayout do original: as partes só organizam o espaço e não aparecem
// na imagem; os elementos dentro delas tiram a cor do bloco visível mais
// próximo.
function cortarRegiao(
  contexto: ContextoGeracao,
  regiao: Regiao,
  direcao: 0 | 1,
): void {
  for (const parte of dividirArea(regiao.area, direcao, contexto.aleatorio)) {
    processarRegiao(
      contexto,
      { ...regiao, area: parte, count: regiao.count + 1, cortado: true },
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
  const maximoDivisoes = Math.min(Math.floor(restante / TAMANHO_MINIMO), 3);
  const quantidade =
    maximoDivisoes <= 1
      ? 0
      : direcao === 0
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
              aleatorio() * (restante - TAMANHO_MINIMO * (partesSeguintes + 1)),
            ) + TAMANHO_MINIMO,
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
  const { width, height } = regiao.area;
  const blocosAntes = contexto.blocks.length;

  if (deveDividir(aleatorio, width, height, direcao)) {
    // Quanto mais profundo o corte, menor a chance de cortar de novo.
    const cortar =
      regiao.count < PROFUNDIDADE_MAXIMA_CORTE &&
      aleatorio() > regiao.count * 0.25 + 0.1;

    if (cortar) {
      cortarRegiao(contexto, regiao, direcao === 0 ? 1 : 0);
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
    (width > 100 && height > 80) || (height > 100 && width > 80);

  if (cabeElemento) {
    adicionarPadraoInterno(
      contexto,
      regiao,
      inteiroAleatorio(aleatorio, 0, 2),
      false,
    );
  }

  // Equivale à verificação confirmFilho do original: uma parte de corte que
  // terminou vazia (pequena demais para um elemento) ganha um.
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
  // O lado que pode ser dividido e o outro, que também precisa ter espaço.
  const [lado, outro] =
    direcao === 0
      ? [height, width]
      : direcao === 1
        ? [width, height]
        : [Math.max(width, height), Math.min(width, height)];

  if (lado <= TAMANHO_MINIMO * 2 || outro <= TAMANHO_MINIMO) {
    return false;
  }

  const proporcao = lado / TAMANHO_MINIMO;
  return Math.floor(aleatorio() * proporcao) + (proporcao < 3 ? 0 : 2) > 0;
}

// AddRet do original. O padrão ocupa a região menos a margem. Com
// continuarDividindo, cada filho volta a ser processado como região; caso
// contrário, é um elemento final.
function adicionarPadraoInterno(
  contexto: ContextoGeracao,
  pai: Regiao,
  tipoSorteado: number,
  continuarDividindo: boolean,
): void {
  const { aleatorio } = contexto;
  const area: Retangulo = {
    x: pai.area.x + MARGEM,
    y: pai.area.y + MARGEM,
    width: pai.area.width - MARGEM * 2,
    height: pai.area.height - MARGEM * 2,
  };
  const { width, height } = area;
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
      ? [[retanguloComum(aleatorio, area)], "rectangle"]
      : tipo === 1
        ? [[retanguloAlinhado(aleatorio, area)], "rectangle"]
        : tipo === 2
          ? [sequencia(aleatorio, area), "rectangle"]
          : [circulos(aleatorio, area), "circle"];
  const grupo = contexto.proximoGrupo++;

  for (const areaFilho of areas) {
    const bloco = adicionarBloco(
      contexto,
      areaFilho,
      rgb,
      pai.parentId,
      forma,
      grupo,
    );

    if (continuarDividindo) {
      processarRegiao(
        contexto,
        { area: bloco, parentId: bloco.id, rgb, count: 0, cortado: false },
        null,
      );
    }
  }
}

function retanguloComum(aleatorio: Aleatorio, area: Retangulo): Retangulo {
  const width = inteiroAleatorio(aleatorio, area.width * 0.8, area.width);
  const height = inteiroAleatorio(aleatorio, area.height * 0.8, area.height);

  return {
    x: area.x + inteiroAleatorio(aleatorio, 0, area.width - width),
    y: area.y + inteiroAleatorio(aleatorio, 0, area.height - height),
    width,
    height,
  };
}

function retanguloAlinhado(aleatorio: Aleatorio, area: Retangulo): Retangulo {
  const width = inteiroAleatorio(aleatorio, area.width * 0.7, area.width);
  const height = inteiroAleatorio(aleatorio, area.height * 0.7, area.height);
  const centroX = area.x + Math.floor((area.width - width) / 2);
  const centroY = area.y + Math.floor((area.height - height) / 2);
  let x = centroX;
  let y = centroY;

  // Centraliza em um eixo e escolhe início, centro ou fim no outro.
  if (aleatorio() < 0.5) {
    y = itemAleatorio(aleatorio, [
      area.y,
      centroY,
      area.y + area.height - height,
    ]);
  } else {
    x = itemAleatorio(aleatorio, [area.x, centroX, area.x + area.width - width]);
  }

  return { x, y, width, height };
}

// Grade de 2 a 6 itens iguais, preenchida no sentido do maior lado.
function sequencia(aleatorio: Aleatorio, area: Retangulo): Retangulo[] {
  const W = area.width;
  const H = area.height;
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
      const areaItem = candidata.largura * candidata.altura;

      if (candidata.largura > 0 && candidata.altura > 0 && areaItem > maiorArea) {
        maiorArea = areaItem;
        grade = candidata;
      }
    }
  }

  if (!grade) {
    return [retanguloComum(aleatorio, area)];
  }

  const limiteLargura = Math.min(W, grade.largura);
  const limiteAltura = Math.min(H, grade.altura);
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
      x: area.x + espacoX + coluna * (width + espacoX),
      y: area.y + espacoY + linha * (height + espacoY),
      width,
      height,
    });
  }

  return areas;
}

// Círculos enfileirados no maior lado, centralizados no outro. A fileira usa
// o comprimento inteiro da região, sem a margem, e tem ao menos um círculo.
function circulos(aleatorio: Aleatorio, area: Retangulo): Retangulo[] {
  const menorLado = Math.min(area.width, area.height);
  const diametro = Math.max(
    inteiroAleatorio(aleatorio, menorLado * 0.9, menorLado),
    DIAMETRO_MINIMO,
  );
  const comprimento = Math.max(area.width, area.height) + MARGEM * 2;
  const quantidade = Math.max(
    1,
    Math.floor(
      (comprimento - ESPACO_MINIMO_CIRCULOS) / (diametro + ESPACO_MINIMO_CIRCULOS),
    ),
  );
  const espaco = (comprimento - quantidade * diametro) / (quantidade + 1);
  const areas: Retangulo[] = [];

  for (let indice = 0; indice < quantidade; indice++) {
    const deslocamento = espaco + indice * (diametro + espaco) - MARGEM;
    areas.push(
      area.width >= area.height
        ? {
            x: area.x + deslocamento,
            y: area.y + (area.height - diametro) / 2,
            width: diametro,
            height: diametro,
          }
        : {
            x: area.x + (area.width - diametro) / 2,
            y: area.y + deslocamento,
            width: diametro,
            height: diametro,
          },
    );
  }

  return areas;
}

// SelecionaDificuldade do original: tira os componentes menores. Um padrão
// sai inteiro (sem deixar uma sequência pela metade), dos menores para os
// maiores, até tirar a quantidade do nível; por isso podem sair alguns a
// mais. Os filhos são sempre menores que o pai, então saem antes dele. Os
// que ficam são numerados de novo, para a lista ir de #1 a #N sem buracos.
function tirarOsMenores(contexto: ContextoGeracao, quantidade: number): Bloco[] {
  if (quantidade === 0) {
    return contexto.blocks;
  }

  const grupos = new Map<number, { tamanho: number; ids: number[] }>();
  for (const bloco of contexto.blocks) {
    const grupo = contexto.grupoDoBloco.get(bloco.id) ?? -bloco.id;
    const tamanho = (bloco.width + bloco.height) / 2;
    const atual = grupos.get(grupo) ?? { tamanho, ids: [] };
    atual.tamanho = Math.max(atual.tamanho, tamanho);
    atual.ids.push(bloco.id);
    grupos.set(grupo, atual);
  }

  const removidos = new Set<number>();
  const limite = contexto.blocks.length - MINIMO_DE_COMPONENTES;
  for (const grupo of [...grupos.values()].sort((a, b) => a.tamanho - b.tamanho)) {
    if (
      removidos.size >= quantidade ||
      removidos.size + grupo.ids.length > limite
    ) {
      break;
    }
    grupo.ids.forEach((id) => removidos.add(id));
  }

  const ficam = contexto.blocks.filter((bloco) => !removidos.has(bloco.id));
  const novoId = new Map(ficam.map((bloco, indice) => [bloco.id, indice + 1]));
  return ficam.map((bloco) => ({
    ...bloco,
    id: novoId.get(bloco.id) ?? bloco.id,
    parentId:
      bloco.parentId === undefined ? undefined : novoId.get(bloco.parentId),
  }));
}

function adicionarBloco(
  contexto: ContextoGeracao,
  area: Retangulo,
  rgb: Rgb,
  parentId: number | undefined,
  shape: Forma,
  grupo: number,
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
  contexto.grupoDoBloco.set(bloco.id, grupo);
  return bloco;
}

function corAleatoria(aleatorio: Aleatorio): Rgb {
  return {
    r: Math.floor(aleatorio() * 256),
    g: Math.floor(aleatorio() * 256),
    b: Math.floor(aleatorio() * 256),
  };
}

// Cor do filho a partir da do pai: soma de 75 a 179 em cada canal e, se os
// canais ficarem próximos demais, desloca um deles para fugir do cinza. Como
// no original, o canal deslocado depende do canal mais forte do pai: com o
// vermelho, o verde ou o azul; com o verde, o azul; com o azul, o vermelho ou
// o verde.
function corDerivada(aleatorio: Aleatorio, pai: Rgb): Rgb {
  const canal = (valor: number) =>
    Math.abs(Math.floor(aleatorio() * 105) + valor + 75) % 255;
  const cor = { r: canal(pai.r), g: canal(pai.g), b: canal(pai.b) };

  if (cor.r - cor.g < 40 && cor.r - cor.b < 40 && cor.g - cor.b < 40) {
    const sorteio =
      pai.r >= pai.b && pai.r >= pai.g
        ? aleatorio() * 2 + 1
        : pai.g >= pai.r && pai.g >= pai.b
          ? aleatorio() * 2 + 2
          : aleatorio() * 2;

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
