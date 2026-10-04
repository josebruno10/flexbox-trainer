import { Bloco, Desafio } from "../types";

// HTML e CSS que reproduzem um desafio pixel a pixel, para testar se a
// correção chega a 100%. Não são exibidos ao aluno.
export type Solucao = {
  html: string;
  css: string;
};

type Caixa = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Direcao = "row" | "column";

// Um bloco do desafio ou um agrupador sem cor, com os itens na ordem do eixo
// principal do contêiner.
type No = {
  classe: string;
  caixa: Caixa;
  bloco?: Bloco;
  direcao?: Direcao;
  // Itens que nenhuma linha reta separa ficam em posição absoluta.
  absoluto?: boolean;
  itens: No[];
};

/** Cada bloco dentro do pai, com posição absoluta relativa a ele. */
export function gerarSolucaoAbsoluta(desafio: Desafio): Solucao {
  const filhosPorPai = agruparPorPai(desafio.blocks);
  const blocosPorId = new Map(desafio.blocks.map((bloco) => [bloco.id, bloco]));

  const montarDivs = (paiId: number | undefined, nivel: number): string =>
    (filhosPorPai.get(paiId) ?? [])
      .map((bloco) =>
        montarDiv(`b${bloco.id}`, nivel, montarDivs(bloco.id, nivel + 1)),
      )
      .join("\n");

  const regras = desafio.blocks.map((bloco) => {
    const pai =
      bloco.parentId === undefined ? undefined : blocosPorId.get(bloco.parentId);
    return montarRegra(`b${bloco.id}`, [
      `left: ${bloco.x - (pai?.x ?? 0)}px;`,
      `top: ${bloco.y - (pai?.y ?? 0)}px;`,
      ...aparencia(bloco, bloco),
    ]);
  });

  return {
    html: montarDocumento(montarDivs(undefined, 2)),
    css: montarFolha(desafio, [
      montarRegra("gabarito", [
        "position: relative;",
        ...aparencia({ x: 0, y: 0, width: desafio.width, height: desafio.height }),
        `background: ${desafio.backgroundColor};`,
      ]),
      ".gabarito div {\n  position: absolute;\n}",
      ...regras,
    ]),
  };
}

/**
 * Mesma imagem montada com flexbox e sem position: cada contêiner é dividido
 * por linhas retas que não cortam nenhum bloco, como contêineres em linha e
 * coluna. Usa gap, padding e alinhamento quando eles dão posições inteiras;
 * margens só onde o gerador arredondou espaços diferentes.
 */
export function gerarSolucaoFlexbox(desafio: Desafio): Solucao {
  const filhosPorPai = agruparPorPai(desafio.blocks);
  let agrupadores = 0;

  const criarNo = (
    classe: string,
    caixa: Caixa,
    filhos: Bloco[],
    bloco?: Bloco,
  ): No => {
    const no: No = { classe, caixa, bloco, itens: [] };
    const divisao = dividir(filhos);

    if (!divisao) {
      no.absoluto = true;
      no.itens = filhos.map((filho) =>
        criarNo(`b${filho.id}`, filho, filhosPorPai.get(filho.id) ?? [], filho),
      );
      return no;
    }

    no.direcao = divisao.direcao;
    no.itens = divisao.grupos.map((grupo) =>
      grupo.length === 1
        ? criarNo(
            `b${grupo[0].id}`,
            grupo[0],
            filhosPorPai.get(grupo[0].id) ?? [],
            grupo[0],
          )
        : criarNo(`g${++agrupadores}`, caixaEnvolvente(grupo), grupo),
    );
    return no;
  };

  const raiz = criarNo(
    "gabarito",
    { x: 0, y: 0, width: desafio.width, height: desafio.height },
    filhosPorPai.get(undefined) ?? [],
  );
  const regras: string[] = [];

  const emitir = (no: No, nivel: number, posicao: string[]): string => {
    const arranjo = arranjar(no);
    regras.push(
      montarRegra(no.classe, [
        ...aparencia(no.caixa, no.bloco),
        ...(no === raiz ? [`background: ${desafio.backgroundColor};`] : []),
        ...arranjo.propriedades,
        ...posicao,
      ]),
    );
    const internos = no.itens
      .map((item) => emitir(item, nivel + 1, arranjo.posicoes.get(item) ?? []))
      .join("\n");
    return montarDiv(no.classe, nivel, internos);
  };

  const divs = emitir(raiz, 1, []);

  return {
    html: montarDocumento(divs, true),
    css: montarFolha(desafio, [
      ".gabarito div {\n  flex-shrink: 0;\n}",
      ...regras,
    ]),
  };
}

// Divide os blocos por linhas retas verticais (lado a lado) ou horizontais
// (empilhados) que não cortam nenhum deles.
function dividir(
  blocos: Bloco[],
): { direcao: Direcao; grupos: Bloco[][] } | undefined {
  if (blocos.length === 0) {
    return { direcao: "row", grupos: [] };
  }

  for (const direcao of ["row", "column"] as const) {
    const grupos = separar(blocos, direcao);

    if (grupos.length > 1 || blocos.length === 1) {
      return { direcao, grupos };
    }
  }

  return undefined;
}

function separar(blocos: Bloco[], direcao: Direcao): Bloco[][] {
  const inicio = (bloco: Bloco) => (direcao === "row" ? bloco.x : bloco.y);
  const fim = (bloco: Bloco) =>
    inicio(bloco) + (direcao === "row" ? bloco.width : bloco.height);
  const grupos: Bloco[][] = [];
  let limite = -Infinity;

  for (const bloco of [...blocos].sort((a, b) => inicio(a) - inicio(b))) {
    if (inicio(bloco) >= limite) {
      grupos.push([bloco]);
    } else {
      grupos[grupos.length - 1].push(bloco);
    }
    limite = Math.max(limite, fim(bloco));
  }

  return grupos;
}

// Propriedades do contêiner e a posição de cada item dentro dele.
function arranjar(no: No): {
  propriedades: string[];
  posicoes: Map<No, string[]>;
} {
  const posicoes = new Map<No, string[]>();

  if (no.itens.length === 0) {
    return { propriedades: [], posicoes };
  }

  if (no.absoluto) {
    for (const item of no.itens) {
      posicoes.set(item, [
        "position: absolute;",
        `left: ${item.caixa.x - no.caixa.x}px;`,
        `top: ${item.caixa.y - no.caixa.y}px;`,
      ]);
    }
    return { propriedades: ["position: relative;"], posicoes };
  }

  const linha = no.direcao === "row";
  const inicio = (caixa: Caixa) => (linha ? caixa.x : caixa.y);
  const tamanho = (caixa: Caixa) => (linha ? caixa.width : caixa.height);
  const inicioCruzado = (caixa: Caixa) => (linha ? caixa.y : caixa.x);
  const tamanhoCruzado = (caixa: Caixa) => (linha ? caixa.height : caixa.width);
  const itens = no.itens;
  const ultimo = itens[itens.length - 1];
  const antes = inicio(itens[0].caixa) - inicio(no.caixa);
  const depois =
    inicio(no.caixa) +
    tamanho(no.caixa) -
    (inicio(ultimo.caixa) + tamanho(ultimo.caixa));
  const vaos = itens
    .slice(1)
    .map(
      (item, indice) =>
        inicio(item.caixa) -
        (inicio(itens[indice].caixa) + tamanho(itens[indice].caixa)),
    );
  const deslocamentos = itens.map(
    (item) => inicioCruzado(item.caixa) - inicioCruzado(no.caixa),
  );
  const sobras = itens.map(
    (item) =>
      inicioCruzado(no.caixa) +
      tamanhoCruzado(no.caixa) -
      (inicioCruzado(item.caixa) + tamanhoCruzado(item.caixa)),
  );

  const propriedades = ["display: flex;"];
  if (!linha) {
    propriedades.push("flex-direction: column;");
  }

  const ladoPrincipal = linha ? "left" : "top";
  const ladoCruzado = linha ? "top" : "left";
  const preenchimento = { top: 0, left: 0 };
  const margem = (item: No, lado: string, valor: number) => {
    if (valor !== 0) {
      posicoes.set(item, [
        ...(posicoes.get(item) ?? []),
        `margin-${lado}: ${valor}px;`,
      ]);
    }
  };

  // Eixo principal: só usa distribuição do flexbox quando ela dá px inteiros.
  const vaoUnico = vaos.every((vao) => vao === vaos[0]) ? (vaos[0] ?? 0) : undefined;

  if (
    vaoUnico !== undefined &&
    itens.length > 1 &&
    vaoUnico > 0 &&
    antes === vaoUnico &&
    depois === vaoUnico
  ) {
    propriedades.push("justify-content: space-evenly;");
  } else if (vaoUnico !== undefined && antes > 0 && antes === depois) {
    propriedades.push("justify-content: center;");
    if (vaoUnico > 0) {
      propriedades.push(`gap: ${vaoUnico}px;`);
    }
  } else if (vaoUnico !== undefined) {
    if (vaoUnico > 0) {
      propriedades.push(`gap: ${vaoUnico}px;`);
    }
    preenchimento[ladoPrincipal] = antes;
  } else {
    margem(itens[0], ladoPrincipal, antes);
    itens
      .slice(1)
      .forEach((item, indice) => margem(item, ladoPrincipal, vaos[indice]));
  }

  // Eixo cruzado.
  if (
    deslocamentos.some((deslocamento) => deslocamento > 0) &&
    deslocamentos.every((deslocamento, indice) => deslocamento === sobras[indice])
  ) {
    propriedades.push("align-items: center;");
  } else if (deslocamentos.every((deslocamento) => deslocamento === deslocamentos[0])) {
    preenchimento[ladoCruzado] = deslocamentos[0];
  } else {
    itens.forEach((item, indice) => margem(item, ladoCruzado, deslocamentos[indice]));
  }

  if (preenchimento.top && preenchimento.left) {
    propriedades.push(
      `padding: ${preenchimento.top}px 0 0 ${preenchimento.left}px;`,
    );
  } else if (preenchimento.top) {
    propriedades.push(`padding-top: ${preenchimento.top}px;`);
  } else if (preenchimento.left) {
    propriedades.push(`padding-left: ${preenchimento.left}px;`);
  }

  return { propriedades, posicoes };
}

function agruparPorPai(blocos: Bloco[]): Map<number | undefined, Bloco[]> {
  const filhosPorPai = new Map<number | undefined, Bloco[]>();

  for (const bloco of blocos) {
    filhosPorPai.set(bloco.parentId, [
      ...(filhosPorPai.get(bloco.parentId) ?? []),
      bloco,
    ]);
  }

  return filhosPorPai;
}

function caixaEnvolvente(blocos: Bloco[]): Caixa {
  const x = Math.min(...blocos.map((bloco) => bloco.x));
  const y = Math.min(...blocos.map((bloco) => bloco.y));
  return {
    x,
    y,
    width: Math.max(...blocos.map((bloco) => bloco.x + bloco.width)) - x,
    height: Math.max(...blocos.map((bloco) => bloco.y + bloco.height)) - y,
  };
}

function aparencia(caixa: Caixa, bloco?: Bloco): string[] {
  return [
    `width: ${caixa.width}px;`,
    `height: ${caixa.height}px;`,
    ...(bloco ? [`background: ${bloco.color};`] : []),
    ...(bloco?.shape === "circle" ? ["border-radius: 50%;"] : []),
  ];
}

function montarDiv(classe: string, nivel: number, internos: string): string {
  const recuo = "  ".repeat(nivel);
  return internos
    ? `${recuo}<div class="${classe}">\n${internos}\n${recuo}</div>`
    : `${recuo}<div class="${classe}"></div>`;
}

function montarRegra(classe: string, propriedades: string[]): string {
  return `.${classe} {\n  ${propriedades.join("\n  ")}\n}`;
}

// Na solução absoluta o contêiner .gabarito é escrito à parte; na flexbox ele
// já vem nas divs, porque também é um nó do layout.
function montarDocumento(divs: string, incluiGabarito = false): string {
  return [
    "<!doctype html>",
    '<html lang="pt-BR">',
    "<head>",
    '  <meta charset="UTF-8">',
    '  <link rel="stylesheet" href="style.css">',
    "</head>",
    "<body>",
    ...(incluiGabarito ? [divs] : ['  <div class="gabarito">', divs, "  </div>"]),
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function montarFolha(desafio: Desafio, regras: string[]): string {
  return [
    `/* Solução exata do desafio ${desafio.challengeId}, só para testar a correção. */`,
    "* {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}",
    ...regras,
    "",
  ].join("\n\n");
}
