import { Bloco } from "../../types";
import { Rgb, corDerivada, rgbParaHex } from "./cores";
import { Medidas } from "./medidas";
import {
  Retangulo,
  circulos,
  retanguloAlinhado,
  retanguloComum,
  sequencia,
} from "./padroes";
import { Aleatorio, inteiroAleatorio, limitar } from "./sorteio";

// O layout do desafio: as faixas principais, os cortes delas e os padrões
// dentro de cada parte, que viram os blocos da imagem.

const PROFUNDIDADE_MAXIMA_CORTE = 2;

// 0 corta em partes lado a lado, 1 em faixas empilhadas. Filhos de padrões
// internos não têm direção e passam a considerar o maior lado.
type Direcao = 0 | 1 | null;
type Forma = NonNullable<Bloco["shape"]>;

export type ContextoGeracao = {
  aleatorio: Aleatorio;
  // O tamanho mínimo, a margem e as medidas dos círculos, que acompanham a
  // imagem.
  medidas: Medidas;
  blocks: Bloco[];
  proximoId: number;
  // Os blocos criados juntos (uma sequência, uma fileira de círculos) saem
  // juntos nos níveis mais fáceis, para nenhum padrão ficar pela metade.
  grupoDoBloco: Map<number, number>;
  proximoGrupo: number;
};

export type Regiao = {
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

// EscolheLayout do original: as partes só organizam o espaço e não aparecem
// na imagem; os elementos dentro delas tiram a cor do bloco visível mais
// próximo.
export function cortarRegiao(
  contexto: ContextoGeracao,
  regiao: Regiao,
  direcao: 0 | 1,
): void {
  const partes = dividirArea(
    regiao.area,
    direcao,
    contexto.aleatorio,
    contexto.medidas.tamanhoMinimo,
  );
  for (const parte of partes) {
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
  tamanhoMinimo: number,
): Retangulo[] {
  let restante = direcao === 0 ? area.width : area.height;
  const maximoDivisoes = Math.min(Math.floor(restante / tamanhoMinimo), 3);
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
              aleatorio() * (restante - tamanhoMinimo * (partesSeguintes + 1)),
            ) + tamanhoMinimo,
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

  if (deveDividir(aleatorio, width, height, direcao, contexto.medidas.tamanhoMinimo)) {
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
  tamanhoMinimo: number,
): boolean {
  // O lado que pode ser dividido e o outro, que também precisa ter espaço.
  const [lado, outro] =
    direcao === 0
      ? [height, width]
      : direcao === 1
        ? [width, height]
        : [Math.max(width, height), Math.min(width, height)];

  if (lado <= tamanhoMinimo * 2 || outro <= tamanhoMinimo) {
    return false;
  }

  const proporcao = lado / tamanhoMinimo;
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
  const { margem } = contexto.medidas;
  const area: Retangulo = {
    x: pai.area.x + margem,
    y: pai.area.y + margem,
    width: pai.area.width - margem * 2,
    height: pai.area.height - margem * 2,
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
          : [circulos(aleatorio, area, contexto.medidas), "circle"];
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
  let width = Math.max(1, Math.round(area.x + area.width) - x);
  let height = Math.max(1, Math.round(area.y + area.height) - y);
  // Com as faixas em frações de px (L / 3), um círculo pode arredondar 1 px
  // mais largo que alto: fica o menor lado, dentro da mesma caixa.
  if (shape === "circle") {
    width = height = Math.min(width, height);
  }
  const bloco: Bloco = {
    id: contexto.proximoId++,
    parentId,
    x,
    y,
    width,
    height,
    color: rgbParaHex(rgb),
    borderRadius: shape === "circle" ? width / 2 : 0,
    shape,
  };
  contexto.blocks.push(bloco);
  contexto.grupoDoBloco.set(bloco.id, grupo);
  return bloco;
}
