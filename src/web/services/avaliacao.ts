import type * as vscode from "vscode";
import {
  ConfiguracaoServidor,
  ResultadoAvaliacao,
  TentativaPayload,
} from "../types";
import {
  corrigirFormas,
  enviarGabaritoDeTreino,
  ErroHttpServidor,
} from "./servidor";

// Gabarito que esta instalação criou no evento de treino e o desafio que ele
// representa agora.
type GabaritoRegistrado = {
  cod: number;
  challengeId: string;
};

export async function avaliarTentativa(
  tentativa: TentativaPayload,
  configuracao: ConfiguracaoServidor,
  registro: vscode.Memento,
): Promise<ResultadoAvaliacao> {
  if (!configuracao.apiBaseUrl) {
    return falha(
      "config-missing",
      "Configure a URL base da API para verificar a tentativa.",
    );
  }

  if (!configuracao.apiToken) {
    return falha(
      "authentication-error",
      "Faça login antes de verificar a tentativa.",
    );
  }

  if (!configuracao.eventoTreino) {
    return falha(
      "config-missing",
      'Crie sua dinâmica de treino com o comando "FlexBox Trainer: Criar ' +
        'Dinâmica de Treino" (ou preencha flexboxTrainer.eventoTreino). A ' +
        "extensão cadastra a imagem de cada desafio nela e nunca usa o " +
        "evento da competição.",
    );
  }

  if (configuracao.userId <= 0 || configuracao.teamId <= 0) {
    return falha(
      "config-missing",
      "Não foi possível identificar seu usuário e sua equipe no servidor.",
    );
  }

  if (tentativa.formas.length === 0) {
    return falha(
      "sem-formas",
      "Nenhum elemento com cor de fundo foi encontrado na sua página. " +
        "Use background-color nos elementos que recriam o desafio.",
    );
  }

  const { gabarito } = tentativa;
  const chave =
    `flexboxTrainer.gabaritoTreino|${configuracao.apiBaseUrl}|` +
    `${configuracao.eventoTreino}|${gabarito.width}x${gabarito.height}`;
  const registrado = registro.get<GabaritoRegistrado>(chave);

  try {
    let cod =
      registrado?.challengeId === tentativa.challengeId
        ? registrado.cod
        : undefined;

    if (cod === undefined) {
      try {
        cod = await enviarGabaritoDeTreino(
          configuracao,
          dataUrlParaPng(gabarito.imagemDataUrl),
          gabarito.width,
          gabarito.height,
          registrado?.cod,
        );
      } catch (error) {
        if (error instanceof ErroHttpServidor) {
          throw error;
        }

        return falha(
          "gabarito-error",
          error instanceof Error ? error.message : "Falha ao enviar o gabarito.",
        );
      }

      await registro.update(chave, {
        cod,
        challengeId: tentativa.challengeId,
      } satisfies GabaritoRegistrado);
    }

    return await corrigirFormas(
      configuracao,
      cod,
      gabarito.width,
      gabarito.height,
      tentativa.formas,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return {
      precision: 0,
      score: 0,
      source:
        error instanceof ErroHttpServidor &&
        (error.status === 401 || error.status === 403)
          ? "authentication-error"
          : "api-error",
      error: message,
      httpStatus:
        error instanceof ErroHttpServidor ? error.status : undefined,
    };
  }
}

function falha(
  source: ResultadoAvaliacao["source"],
  error: string,
): ResultadoAvaliacao {
  return { precision: 0, score: 0, source, error };
}

function dataUrlParaPng(dataUrl: string): Uint8Array<ArrayBuffer> {
  const binario = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  return Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
}
