import {
  ConfiguracaoServidor,
  FormaMedida,
  ResultadoAvaliacao,
} from "../../types";
import { log } from "../logger";
import {
  ehRegistro,
  extrairMensagemServidor,
  requisitarApi,
} from "./requisicao";

// A correção da página do aluno pela rota corrigir-formas.

export async function corrigirFormas(
  configuracao: ConfiguracaoServidor,
  gabaritoCod: number,
  largura: number,
  altura: number,
  formas: FormaMedida[],
): Promise<ResultadoAvaliacao> {
  const dados = await requisitarApi(
    configuracao,
    "POST",
    `/tipo-dinamica/${encodeURIComponent(configuracao.eventoTreino)}/corrigir-formas`,
    JSON.stringify({
      time_id: configuracao.teamId,
      integrante_id: configuracao.userId,
      // A extensão oficial identifica cada envio assim ("vscode-<instante>").
      submissao_id: `flexbox-trainer-${Date.now()}`,
      // Treino não entra no ranking do torneio.
      salvar_pontuacao: false,
      frames: [
        {
          gabarito_cod: gabaritoCod,
          viewport: { width: largura, height: altura },
          formas,
        },
      ],
    }),
    "corrigir as formas",
  );
  log.info(
    `Resposta de corrigir-formas (${formas.length} formas): ` +
      JSON.stringify(dados).slice(0, 1500),
  );
  const nota = extrairPercentualCorrecao(dados);

  if (nota === undefined) {
    return {
      precision: 0,
      score: 0,
      source: "servidor-sem-nota",
      error: extrairMensagemServidor(
        dados,
        "A correção respondeu sem nota/precisão. Veja a resposta em FlexBox Trainer Logs.",
      ),
    };
  }

  return { precision: nota, score: nota, source: "servidor" };
}

/**
 * Lê a resposta de corrigir-formas como a extensão oficial do torneio: a
 * porcentagem geral vem em pontuacao, percentual ou ultima_pontuacao; sem
 * ela, a nota é a média das porcentagens de cada gabarito.
 */
export function extrairPercentualCorrecao(dados: unknown): number | undefined {
  if (!ehRegistro(dados)) {
    return undefined;
  }

  const geral = percentualInformado(dados);

  if (geral !== undefined) {
    return geral;
  }

  const pontos = ehRegistro(dados.pontuacao) ? dados.pontuacao : dados;
  const porGabarito = [pontos.por_gabarito, dados.por_gabarito].find(
    (valor): valor is Record<string, unknown> =>
      ehRegistro(valor) && Object.keys(valor).length > 0,
  );
  const itens = porGabarito
    ? Object.values(porGabarito)
    : percentualDoGabarito(pontos) !== undefined
      ? [pontos]
      : Object.values(pontos);
  const percentuais = itens
    .map((item) => (ehRegistro(item) ? percentualDoGabarito(item) : undefined))
    .filter((valor): valor is number => valor !== undefined);

  return percentuais.length > 0
    ? percentuais.reduce((soma, valor) => soma + valor, 0) / percentuais.length
    : undefined;
}

function percentualInformado(dados: Record<string, unknown>): number | undefined {
  for (const valor of [dados.pontuacao, dados.percentual, dados.ultima_pontuacao]) {
    if (
      (typeof valor === "number" || typeof valor === "string") &&
      String(valor).trim() !== ""
    ) {
      const numero = Number(valor);

      if (Number.isFinite(numero)) {
        return numero;
      }
    }
  }

  return undefined;
}

function percentualDoGabarito(dados: Record<string, unknown>): number | undefined {
  const informado = percentualInformado(dados);

  if (informado !== undefined) {
    return informado;
  }

  const total = Number(dados.pontuacao_total ?? dados.total ?? dados.obtida);
  const maxima = Number(dados.pontuacao_maxima ?? dados.maxima ?? dados.maximo);
  return Number.isFinite(total) && Number.isFinite(maxima) && maxima > 0
    ? (total / maxima) * 100
    : undefined;
}
