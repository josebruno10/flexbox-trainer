import {
  ConfiguracaoServidor,
  ResultadoAvaliacao,
  TentativaPayload,
} from "../types";
import {
  enviarConteudoDaTentativa,
  lerConfiguracaoServidor,
  temConfiguracaoServidorMinima,
} from "./servidor";

export async function avaliarTentativa(
  payload: TentativaPayload,
  configuracaoAtual?: ConfiguracaoServidor,
): Promise<ResultadoAvaliacao> {
  const configuracao = configuracaoAtual || lerConfiguracaoServidor();

  if (!configuracao.apiBaseUrl) {
    return {
      precision: criarPrecisaoMock(payload.html, payload.css),
      score: 0,
      source: "mock-local",
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
    return { precision: 0, score: 0, source: "api-error", error: message };
  }
}

function criarPrecisaoMock(html: string, css: string): number {
  const texto = `${html.trim()}|${css.trim()}`;
  if (!texto.trim()) {
    return 0;
  }

  const base = Math.min(100, Math.max(10, texto.length / 20));
  return Number(base.toFixed(2));
}