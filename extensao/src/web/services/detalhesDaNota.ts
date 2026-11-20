import type {
  ComponenteCorrigido,
  Desafio,
  DetalhesDaNota,
  DetalhesDoServidor,
  FormaDoServidor,
  FormaMedida,
  ParDoServidor,
  ProblemaDoComponente,
} from "../types";

// O detalhe da nota: a rota corrigir-formas diz, para cada forma do gabarito,
// qual forma da página ela ligou e quanto ela valeu (tamanho, distância e
// cor), além das formas que faltaram e das que sobraram. Nem a extensão
// oficial mostra isso. Como o gabarito foi desenhado pela extensão, cada forma
// do servidor corresponde a um componente do desafio (os blocos e o fundo):
// aqui cada uma é ligada ao componente dela, para o aluno ver o que corrigir.

// Uma parte da nota abaixo disso (o servidor arredonda para 0,01) conta como
// algo a corrigir.
const ACERTO = 0.995;

// Até onde a cor da forma do gabarito pode se afastar da cor do componente
// (soma das diferenças de R, G e B): o servidor lê a cor da imagem.
const LIMITE_COR = 60;

/** Lê o detalhe da resposta de corrigir-formas; sem ele, undefined. */
export function lerDetalhesDoServidor(
  dados: unknown,
  formasEnviadas: readonly FormaMedida[] = [],
): DetalhesDoServidor | undefined {
  if (!ehRegistro(dados) || !Array.isArray(dados.detalhes)) {
    return undefined;
  }

  const detalhes: DetalhesDoServidor = { pares: [], aMais: [], naoEncontradas: 0 };
  for (const frame of dados.detalhes) {
    if (!ehRegistro(frame)) {
      continue;
    }
    for (const item of Array.isArray(frame.pares) ? frame.pares : []) {
      const par = lerPar(item);
      if (par) {
        detalhes.pares.push(par);
      }
    }
    for (const item of Array.isArray(frame.extras) ? frame.extras : []) {
      const forma = lerFormaAMais(item, formasEnviadas);
      if (forma) {
        detalhes.aMais.push(forma);
      }
    }
    detalhes.naoEncontradas += Array.isArray(frame.nao_encontradas)
      ? frame.nao_encontradas.length
      : Math.max(0, Number(frame.nao_encontradas) || 0);
  }
  return detalhes;
}

type Componente = {
  componente: number | "fundo";
  x: number;
  y: number;
  width: number;
  height: number;
  cor: string;
  circulo: boolean;
};

/**
 * Liga cada forma do gabarito que o servidor corrigiu ao componente do
 * desafio que ela desenha e diz o que falta acertar em cada componente.
 */
export function ligarAosComponentes(
  desafio: Pick<Desafio, "width" | "height" | "backgroundColor" | "blocks">,
  detalhes: DetalhesDoServidor,
): DetalhesDaNota {
  const componentes: Componente[] = [
    {
      componente: "fundo",
      x: 0,
      y: 0,
      width: desafio.width,
      height: desafio.height,
      cor: desafio.backgroundColor,
      circulo: false,
    },
    ...desafio.blocks.map((bloco) => ({
      componente: bloco.id,
      x: bloco.x,
      y: bloco.y,
      width: bloco.width,
      height: bloco.height,
      cor: bloco.color,
      circulo: bloco.shape === "circle",
    })),
  ];

  // Da ligação mais parecida para a menos: blocos da mesma cor se separam
  // pela posição e pelo tamanho.
  const candidatas: { par: number; componente: number; custo: number }[] = [];
  detalhes.pares.forEach((par, indicePar) => {
    componentes.forEach((componente, indiceComponente) => {
      const custo = custoDaLigacao(par.gabarito, componente);
      if (custo !== undefined) {
        candidatas.push({ par: indicePar, componente: indiceComponente, custo });
      }
    });
  });
  candidatas.sort((a, b) => a.custo - b.custo);

  const parDoComponente = new Map<number, ParDoServidor>();
  const paresUsados = new Set<number>();
  for (const candidata of candidatas) {
    if (paresUsados.has(candidata.par) || parDoComponente.has(candidata.componente)) {
      continue;
    }
    paresUsados.add(candidata.par);
    parDoComponente.set(candidata.componente, detalhes.pares[candidata.par]);
  }

  return {
    componentes: componentes.map((componente, indice) =>
      corrigirComponente(componente, parDoComponente.get(indice)),
    ),
    aMais: detalhes.aMais,
  };
}

function corrigirComponente(
  componente: Componente,
  par: ParDoServidor | undefined,
): ComponenteCorrigido {
  if (!par) {
    return {
      componente: componente.componente,
      pontos: 0,
      problemas: [{ tipo: "faltando" }],
    };
  }

  const problemas: ProblemaDoComponente[] = [];
  if (par.formaCorreta === false) {
    problemas.push({
      tipo: "forma",
      esperada: componente.circulo ? "circulo" : "retangulo",
    });
  }

  // O servidor mede o gabarito na imagem, com até 1 px de diferença: só
  // vira problema o que ele descontou e que a página tem de fato diferente.
  const sua = {
    width: Math.round(par.pagina.width),
    height: Math.round(par.pagina.height),
  };
  if (
    (par.tamanho ?? 1) < ACERTO &&
    (sua.width !== componente.width || sua.height !== componente.height)
  ) {
    problemas.push({
      tipo: "tamanho",
      sua,
      esperada: { width: componente.width, height: componente.height },
    });
  }

  const dx = Math.round(par.pagina.x - (componente.x + componente.width / 2));
  const dy = Math.round(par.pagina.y - (componente.y + componente.height / 2));
  if ((par.distancia ?? 1) < ACERTO && (dx !== 0 || dy !== 0)) {
    problemas.push({ tipo: "posicao", dx, dy });
  }

  if (
    (par.cor ?? 1) < ACERTO &&
    (distanciaDeCor(par.pagina.cor, componente.cor) ?? Infinity) > 0
  ) {
    problemas.push({ tipo: "cor", sua: par.pagina.cor, esperada: componente.cor });
  }

  return {
    componente: componente.componente,
    pontos: Math.max(0, Math.min(1, par.pontos)),
    problemas,
  };
}

// Quanto a forma do gabarito se afasta do componente; undefined quando ela
// não pode ser dele (outra cor ou longe demais).
function custoDaLigacao(forma: FormaDoServidor, componente: Componente): number | undefined {
  const cor = distanciaDeCor(forma.cor, componente.cor);
  if (cor === undefined || cor > LIMITE_COR) {
    return undefined;
  }
  const geometria =
    Math.abs(forma.x - (componente.x + componente.width / 2)) +
    Math.abs(forma.y - (componente.y + componente.height / 2)) +
    Math.abs(forma.width - componente.width) +
    Math.abs(forma.height - componente.height);
  const limite = 12 + 0.15 * (componente.width + componente.height);
  return geometria <= limite ? geometria + cor : undefined;
}

function lerPar(item: unknown): ParDoServidor | undefined {
  if (!ehRegistro(item)) {
    return undefined;
  }
  const gabarito = lerForma(item.gabarito_forma);
  const pagina = lerForma(item.cliente_forma);
  const pontos = Number(item.pontos);
  if (!gabarito || !pagina || !Number.isFinite(pontos)) {
    return undefined;
  }
  // As partes da nota vêm no texto: "0.80 pts (tam:1.00, dist:1.00, cor:0.00)".
  return {
    pontos,
    tamanho: parteDaNota(item.status, "tam"),
    distancia: parteDaNota(item.status, "dist"),
    cor: parteDaNota(item.status, "cor"),
    formaCorreta: typeof item.forma_correta === "boolean" ? item.forma_correta : undefined,
    gabarito,
    pagina,
  };
}

// Uma forma a mais vem como o índice da forma enviada ou como a forma.
function lerFormaAMais(
  item: unknown,
  formasEnviadas: readonly FormaMedida[],
): FormaDoServidor | undefined {
  if (typeof item === "number") {
    const enviada = formasEnviadas[item];
    return enviada ? lerForma(enviada) : undefined;
  }
  if (!ehRegistro(item)) {
    return undefined;
  }
  if (typeof item.cliente_index === "number" && formasEnviadas[item.cliente_index]) {
    return lerForma(formasEnviadas[item.cliente_index]);
  }
  return lerForma(item.cliente_forma ?? item.forma ?? item);
}

function lerForma(valor: unknown): FormaDoServidor | undefined {
  if (!ehRegistro(valor)) {
    return undefined;
  }
  const [x, y, width, height] = [valor.x, valor.y, valor.width, valor.height].map(Number);
  if (![x, y, width, height].every(Number.isFinite)) {
    return undefined;
  }
  const cor = typeof valor.cor === "string" ? valor.cor.trim().toLowerCase() : "";
  return { x, y, width, height, cor };
}

function parteDaNota(status: unknown, nome: string): number | undefined {
  if (typeof status !== "string") {
    return undefined;
  }
  const encontrada = new RegExp(`\\b${nome}:\\s*(-?\\d+(?:\\.\\d+)?)`).exec(status);
  const valor = encontrada ? Number(encontrada[1]) : NaN;
  return Number.isFinite(valor) ? valor : undefined;
}

/** Soma das diferenças de R, G e B entre duas cores #rrggbb (ou #rgb). */
function distanciaDeCor(a: string, b: string): number | undefined {
  const rgbA = lerHex(a);
  const rgbB = lerHex(b);
  if (!rgbA || !rgbB) {
    return undefined;
  }
  return (
    Math.abs(rgbA[0] - rgbB[0]) +
    Math.abs(rgbA[1] - rgbB[1]) +
    Math.abs(rgbA[2] - rgbB[2])
  );
}

function lerHex(cor: string): [number, number, number] | undefined {
  const texto = cor.trim().toLowerCase();
  const curta = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(texto);
  const longa = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(texto);
  const partes = longa
    ? [longa[1], longa[2], longa[3]]
    : curta
      ? [curta[1] + curta[1], curta[2] + curta[2], curta[3] + curta[3]]
      : undefined;
  return partes
    ? (partes.map((parte) => Number.parseInt(parte, 16)) as [number, number, number])
    : undefined;
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}
