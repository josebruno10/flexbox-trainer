import { ResultadoAvaliacao, TentativaPayload } from "../types";
import {
  ErroHttpServidor,
  enviarConteudoDaTentativa,
  lerConfiguracaoServidor,
  temConfiguracaoServidorMinima,
} from "./servidor";

export async function avaliarTentativa(
  payload: TentativaPayload,
): Promise<ResultadoAvaliacao> {
  const configuracao = lerConfiguracaoServidor();

  if (!configuracao.apiBaseUrl) {
    return {
      precision: 0,
      score: 0,
      source: "config-missing",
      error: "Configure a URL base da API para verificar a tentativa.",
    };
  }

  if (!configuracao.apiToken) {
    return {
      precision: 0,
      score: 0,
      source: "authentication-error",
      error: "Configure o token da API antes de verificar a tentativa.",
    };
  }

  if (!temConfiguracaoServidorMinima(configuracao)) {
    return {
      precision: 0,
      score: 0,
      source: "config-missing",
      error:
        "Preencha dinamicaId, userId e teamId nas configurações da extensão.",
    };
  }

  if (!payload.codigoPasta) {
    return {
      precision: 0,
      score: 0,
      source: "folder-error",
      error: "O código da pasta do aluno ainda não foi criado no servidor.",
    };
  }

  try {
    return await enviarConteudoDaTentativa(
      configuracao,
      payload.codigoPasta,
      payload.html,
      payload.css,
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
