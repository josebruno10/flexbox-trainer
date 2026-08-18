// src/web/services/servidor.ts

import * as vscode from "vscode";
import { ConfiguracaoServidor, ResultadoAvaliacao } from "../types";
import { log } from "./logger";

export function lerConfiguracaoServidor(tokenSessao?: string): ConfiguracaoServidor {
  const config = vscode.workspace.getConfiguration("flexboxTrainer");

  let apiBaseUrl = config.get<string>("apiBaseUrl", "").trim();
  if (!apiBaseUrl) {
    apiBaseUrl = config
      .get<string>("authApiBaseUrl", "https://frontendteamscup.com.br/api")
      .trim();
  }

  return {
    apiBaseUrl: normalizarApiBaseUrl(apiBaseUrl),
    apiToken: tokenSessao || config.get<string>("apiToken", "").trim(),
    dinamicaId: config.get<string>("dinamicaId", "").trim(),
    userId: config.get<number>("userId", 0),
    teamId: config.get<number>("teamId", 0),
    captureWidth: config.get<number>("captureWidth", 960),
    captureHeight: config.get<number>("captureHeight", 540),
  };
}

export function temConfiguracaoServidorMinima(
  configuracao: ConfiguracaoServidor,
): boolean {
  return Boolean(
    configuracao.apiBaseUrl &&
      configuracao.dinamicaId &&
      configuracao.userId > 0 &&
      configuracao.teamId > 0,
  );
}

export async function verificarConexaoServidor(
  configuracao: ConfiguracaoServidor,
): Promise<string> {
  if (!configuracao.apiBaseUrl) {
    throw new Error("A URL base da API não está configurada.");
  }

  const apiBaseUrl = normalizarApiBaseUrl(configuracao.apiBaseUrl);
  const rotaUsuarios = `${apiBaseUrl}/usuarios`;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 10000);

  log.info(`Testando conexão com o servidor: ${rotaUsuarios}`);

  const resposta = await fetch(rotaUsuarios, {
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
    throw new Error(`Servidor respondeu com erro: ${detalhe}`);
  }

  return `Conexão realizada com sucesso (HTTP ${resposta.status}).`;
}

export async function criarPastaDoAluno(
  configuracao: ConfiguracaoServidor,
): Promise<string> {
  const apiBaseUrl = normalizarApiBaseUrl(configuracao.apiBaseUrl);
  const rotaCriarPasta = `${apiBaseUrl}/criar-pasta/${encodeURIComponent(configuracao.dinamicaId)}/${configuracao.teamId}/${configuracao.userId}`;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 10000);

  log.info(`Chamando API criar-pasta: ${rotaCriarPasta}`);

  const resposta = await fetch(rotaCriarPasta, {
    method: "POST",
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

      log.error(`Erro fatal no fetch (criar-pasta): ${detalhe}`);
      throw new Error(`Não foi possível conectar ao servidor: ${detalhe}`);
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });

  if (!resposta.ok) {
    const detalhe = await extrairDetalheDeErro(resposta);
    throw new Error(`Falha ao criar pasta (HTTP ${resposta.status}): ${detalhe}`);
  }

  const dados = await extrairCorpoResposta(resposta);
  const codigoPasta = extrairCodigoPasta(dados);

  if (!codigoPasta) {
    throw new Error("A API não retornou o código da pasta.");
  }

  return codigoPasta;
}

export async function enviarConteudoDaTentativa(
  configuracao: ConfiguracaoServidor,
  codigoPasta: string,
  html: string,
  css: string,
): Promise<ResultadoAvaliacao> {
  const apiBaseUrl = normalizarApiBaseUrl(configuracao.apiBaseUrl);
  const rotaSalvarConteudo = `${apiBaseUrl}/salvar-conteudo`;
  const formulario = new URLSearchParams();
  formulario.set("code_pasta", codigoPasta);
  formulario.set("tipo", "ambos");
  formulario.set("index_conteudo", html);
  formulario.set("style_conteudo", css);

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 15000);

  log.info(`Enviando conteúdo para pasta: ${codigoPasta}`);

  const resposta = await fetch(rotaSalvarConteudo, {
    method: "POST",
    mode: "cors",
    headers: montarCabecalhos(configuracao, {
      "Content-Type": "application/x-www-form-urlencoded",
    }),
    signal: abortController.signal,
    body: formulario.toString(),
  })
    .catch((erro: unknown) => {
      const mensagem =
        erro instanceof Error ? erro.message : "Erro de rede desconhecido";
      const detalhe =
        erro instanceof Error && erro.name === "AbortError"
          ? "Tempo limite de 15 segundos excedido."
          : mensagem;

      log.error(`Erro na rota salvar-conteudo: ${detalhe}`);
      throw new Error(`Falha de rede ao enviar a tentativa: ${detalhe}`);
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });

  if (!resposta.ok) {
    const detalhe = await extrairDetalheDeErro(resposta);
    throw new Error(
      `Falha ao enviar conteúdo (HTTP ${resposta.status}): ${detalhe}`,
    );
  }

  const dados = (await extrairCorpoResposta(resposta)) as {
    message?: string;
    nota?: number;
    score?: number;
    precisao?: number;
    precision?: number;
  };

  const nota = dados.nota ?? dados.score ?? dados.precisao ?? dados.precision;

  if (typeof nota !== "number") {
    return {
      precision: 0,
      score: 0,
      source: "servidor-sem-nota",
      error:
        dados.message ||
        "Conteúdo salvo, mas a API não retornou nota/precisão nesta rota.",
    };
  }

  return {
    precision: nota,
    score: nota,
    source: "servidor",
  };
}

async function extrairDetalheDeErro(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}`;

  try {
    const dados = (await extrairCorpoResposta(response)) as {
      detail?: unknown;
      message?: string;
    };

    if (typeof dados.message === "string" && dados.message.trim()) {
      return dados.message;
    }

    if (typeof dados.detail === "string" && dados.detail.trim()) {
      return dados.detail;
    }

    if (Array.isArray(dados.detail) && dados.detail.length > 0) {
      return JSON.stringify(dados.detail[0]);
    }

    return fallback;
  } catch {
    return fallback;
  }
}

async function extrairCorpoResposta(response: Response): Promise<unknown> {
  const texto = await response.text();

  if (!texto.trim()) {
    return {};
  }

  try {
    return JSON.parse(texto);
  } catch {
    return texto.trim();
  }
}

export function extrairCodigoPasta(dados: unknown): string | undefined {
  if (typeof dados === "string" && dados.trim()) {
    return dados;
  }

  if (!dados || typeof dados !== "object") {
    return undefined;
  }

  const resposta = dados as Record<string, unknown>;
  const candidatos = [
    resposta.code_pasta,
    resposta.codigo_pasta,
    resposta.codigoPasta,
    resposta.codPasta,
    resposta.cod_pasta,
    resposta.pastaCodigo,
    resposta.codigo,
  ];

  return candidatos.find(
    (valor): valor is string =>
      typeof valor === "string" &&
      valor.trim().length > 0 &&
      !valor.includes("Sucesso"),
  );
}

function normalizarApiBaseUrl(apiBaseUrl: string): string {
  const url = new URL(apiBaseUrl);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/docs\/?$/, "").replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

function montarCabecalhos(
  configuracao: ConfiguracaoServidor,
  overrides?: Record<string, string>,
): Record<string, string> {
  const cabecalhos: Record<string, string> = {
    Accept: "application/json",
    ...(overrides ?? {}),
  };

  if (configuracao.apiToken) {
    cabecalhos.Authorization = `Bearer ${configuracao.apiToken}`;
  }

  return cabecalhos;
}
