import { ConfiguracaoServidor } from "../../types";
import { log } from "../logger";
import { ehNaoEncontrado, requisitarApi } from "./requisicao";

/**
 * Garante que a imagem do desafio esteja cadastrada como gabarito no evento de
 * treino e devolve o código dele. O servidor nomeia o arquivo só por evento e
 * tamanho, então um segundo gabarito do mesmo tamanho sobrescreveria o
 * primeiro: só substitui (via PUT) o gabarito que a própria extensão criou.
 */
export async function enviarGabaritoDeTreino(
  configuracao: ConfiguracaoServidor,
  png: Uint8Array<ArrayBuffer>,
  largura: number,
  altura: number,
  codCriadoPelaExtensao: number | undefined,
): Promise<number> {
  const evento = configuracao.eventoTreino;
  const existentes = await listarGabaritos(configuracao, evento);

  if (existentes.some((item) => !temNomeDeGabarito(item))) {
    throw new Error(
      `Não foi possível identificar o tamanho dos gabaritos do evento "${evento}". ` +
        "Para não sobrescrever nenhum, nada foi enviado.",
    );
  }

  const mesmoTamanho = existentes.filter((item) =>
    temTamanho(item, largura, altura),
  );
  let cod: number | undefined;

  if (mesmoTamanho.length === 0) {
    const resposta = await requisitarApi(
      configuracao,
      "POST",
      `/tipo-dinamica/${encodeURIComponent(evento)}/gabarito`,
      criarFormularioImagem(png),
      "cadastrar o gabarito",
    );
    log.info(`Gabarito cadastrado: ${JSON.stringify(resposta).slice(0, 500)}`);
    cod = extrairCodGabarito(resposta);

    if (!cod) {
      // A resposta não é documentada; o código também aparece na listagem.
      const cadastrados = (await listarGabaritos(configuracao, evento)).filter(
        (item) => temTamanho(item, largura, altura),
      );
      cod =
        cadastrados.length === 1
          ? extrairCodGabarito(cadastrados[0])
          : undefined;
    }

    if (!cod) {
      throw new Error("O servidor não informou o código do gabarito cadastrado.");
    }
  } else if (
    mesmoTamanho.length === 1 &&
    codCriadoPelaExtensao !== undefined &&
    extrairCodGabarito(mesmoTamanho[0]) === codCriadoPelaExtensao
  ) {
    cod = codCriadoPelaExtensao;
    await requisitarApi(
      configuracao,
      "PUT",
      `/tipo-dinamica/gabarito/${cod}`,
      criarFormularioImagem(png),
      "substituir o gabarito",
    );
  } else {
    throw new Error(
      `O evento "${evento}" já tem um gabarito ${largura}x${altura} que não ` +
        "foi criado por esta extensão. Para não sobrescrevê-lo, nada foi enviado.",
    );
  }

  await registrarMedidasDoGabarito(configuracao, largura, altura);
  return cod;
}

async function listarGabaritos(
  configuracao: ConfiguracaoServidor,
  evento: string,
): Promise<unknown[]> {
  try {
    const dados = await requisitarApi(
      configuracao,
      "GET",
      `/tipo-dinamica/${encodeURIComponent(evento)}/gabaritos`,
      undefined,
      "listar os gabaritos do evento",
    );
    const lista = Array.isArray(dados)
      ? dados
      : dados && typeof dados === "object"
        ? Object.values(dados as Record<string, unknown>).find(Array.isArray)
        : undefined;

    if (!lista) {
      // Sem entender a listagem não dá para garantir que nada será sobrescrito.
      throw new Error(
        `Listagem de gabaritos em formato inesperado: ${JSON.stringify(dados).slice(0, 200)}`,
      );
    }

    return lista;
  } catch (error) {
    // Evento ainda sem gabaritos.
    if (ehNaoEncontrado(error)) {
      return [];
    }
    throw error;
  }
}

// Só registra o que o servidor detectou, para conferir tipo e cor das formas.
async function registrarMedidasDoGabarito(
  configuracao: ConfiguracaoServidor,
  largura: number,
  altura: number,
): Promise<void> {
  const nome = `gab_${configuracao.eventoTreino}_tam_${largura}x${altura}.png`;

  try {
    const medidas = await requisitarApi(
      configuracao,
      "GET",
      `/medidas-gabarito?gabarito=${encodeURIComponent(nome)}`,
      undefined,
      "consultar as medidas do gabarito",
    );
    // A rota devolve um ZIP com a imagem rotulada; texto binário só polui o log.
    log.info(
      typeof medidas === "string" && medidas.startsWith("PK")
        ? `Medidas do gabarito ${nome}: arquivo ZIP com ${medidas.length} bytes.`
        : `Medidas do gabarito ${nome}: ${JSON.stringify(medidas).slice(0, 1500)}`,
    );
  } catch (error) {
    log.info(
      `Medidas do gabarito ${nome} indisponíveis: ${
        error instanceof Error ? error.message : "erro desconhecido"
      }`,
    );
  }
}

const NOME_GABARITO = /gab_.+_tam_(\d+)x(\d+)\.\w+/i;

function temNomeDeGabarito(item: unknown): boolean {
  return textosDoItem(item).some((texto) => NOME_GABARITO.test(texto));
}

function temTamanho(item: unknown, largura: number, altura: number): boolean {
  // O nome segue gab_[evento]_tam_[A]x[B]; a ordem de A e B varia na documentação.
  return textosDoItem(item).some((texto) => {
    const tamanho = NOME_GABARITO.exec(texto);
    return Boolean(
      tamanho &&
        ((Number(tamanho[1]) === largura && Number(tamanho[2]) === altura) ||
          (Number(tamanho[1]) === altura && Number(tamanho[2]) === largura)),
    );
  });
}

function textosDoItem(item: unknown): string[] {
  if (typeof item === "string") {
    return [item];
  }

  return item && typeof item === "object"
    ? Object.values(item as Record<string, unknown>).filter(
        (valor): valor is string => typeof valor === "string",
      )
    : [];
}

export function extrairCodGabarito(dados: unknown): number | undefined {
  if (!dados || typeof dados !== "object") {
    return undefined;
  }

  // A listagem também chega em pares [código, caminho]; a extensão oficial
  // usa o primeiro número do par como código.
  if (Array.isArray(dados)) {
    const cod: unknown = dados.find((valor) => typeof valor === "number");
    return typeof cod === "number" && Number.isInteger(cod) && cod > 0
      ? cod
      : undefined;
  }

  const registro = dados as Record<string, unknown>;
  const candidatos = [
    registro.cod,
    registro.codigo,
    registro.gabarito_cod,
    registro.cod_gabarito,
    registro.id,
  ];
  const cod = candidatos
    .map((valor) => Number(valor))
    .find((valor) => Number.isInteger(valor) && valor > 0);

  if (cod) {
    return cod;
  }

  const aninhado = registro.gabarito ?? registro.data;
  return aninhado && typeof aninhado === "object"
    ? extrairCodGabarito(aninhado)
    : undefined;
}

function criarFormularioImagem(png: Uint8Array<ArrayBuffer>): FormData {
  const formulario = new FormData();
  formulario.append(
    "arquivo",
    new Blob([png], { type: "image/png" }),
    "gabarito.png",
  );
  return formulario;
}
