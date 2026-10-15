import * as vscode from "vscode";
import { ConfiguracaoServidor } from "../../types";
import { log } from "../logger";
import {
  ErroHttpServidor,
  extrairDetalheDeErro,
  montarCabecalhos,
  normalizarApiBaseUrl,
} from "./requisicao";

// Onde fica o servidor (das configurações) e o teste de conexão com ele.

export function lerConfiguracaoServidor(
  tokenSessao?: string,
): ConfiguracaoServidor {
  const config = vscode.workspace.getConfiguration("flexboxTrainer");

  let apiBaseUrl = config.get<string>("apiBaseUrl", "").trim();
  if (!apiBaseUrl) {
    apiBaseUrl = config
      .get<string>("authApiBaseUrl", "https://frontendteamscup.com.br/api")
      .trim();
  }

  return {
    apiBaseUrl: normalizarApiBaseUrl(apiBaseUrl),
    apiToken:
      tokenSessao?.trim() || config.get<string>("apiToken", "").trim(),
    eventoTreino: config.get<string>("eventoTreino", "").trim(),
    // Preenchidos com o aluno e o time da sessão autenticada.
    userId: 0,
    teamId: 0,
  };
}

export async function verificarConexaoServidor(
  configuracao: ConfiguracaoServidor,
): Promise<string> {
  if (!configuracao.apiBaseUrl) {
    throw new Error("A URL base da API não está configurada.");
  }

  if (!configuracao.apiToken) {
    throw new Error("Configure o token da API antes de testar o servidor.");
  }

  const apiBaseUrl = normalizarApiBaseUrl(configuracao.apiBaseUrl);
  const rotaPerfil = `${apiBaseUrl}/auth/me`;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 10000);

  log.info(`Testando sessão com o servidor: ${rotaPerfil}`);

  const resposta = await fetch(rotaPerfil, {
    method: "GET",
    mode: "cors",
    headers: montarCabecalhos(configuracao),
    signal: abortController.signal,
  })
    .catch((erro: unknown) => {
      const mensagem =
        erro instanceof Error ? erro.message : "Erro de rede desconhecido";
      const detalhe =
        erro instanceof Error && erro.name === "AbortError"
          ? "Tempo limite de 10 segundos excedido."
          : mensagem;

      throw new Error(`Não foi possível conectar ao servidor: ${detalhe}`);
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });

  if (!resposta.ok) {
    const detalhe = await extrairDetalheDeErro(resposta);
    throw new ErroHttpServidor(
      `Servidor respondeu com erro (HTTP ${resposta.status}): ${detalhe}`,
      resposta.status,
    );
  }

  return `Servidor OK, sessão válida (HTTP ${resposta.status}).`;
}
