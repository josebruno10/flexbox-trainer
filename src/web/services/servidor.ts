import * as vscode from "vscode";
import { ConfiguracaoServidor, ResultadoAvaliacao } from "../types";

export function lerConfiguracaoServidor(): ConfiguracaoServidor {
  const config = vscode.workspace.getConfiguration("flexboxTrainer");

  return {
    apiBaseUrl: config.get<string>("apiBaseUrl", "").trim(),
    apiToken: config.get<string>("apiToken", "").trim(),
    dinamicaId: config.get<string>("dinamicaId", "").trim().toUpperCase(),
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

export async function criarPastaDoAluno(
  configuracao: ConfiguracaoServidor,
): Promise<string> {
  const rotaCriarPasta = `${configuracao.apiBaseUrl}/criar-pasta/${encodeURIComponent(configuracao.dinamicaId)}/${configuracao.teamId}/${configuracao.userId}`;

  const resposta = await fetch(rotaCriarPasta, {
    method: "POST",
    headers: montarCabecalhos(configuracao),
  });

  if (!resposta.ok) {
    const detalhe = await extrairDetalheDeErro(resposta);
    throw new Error(`Falha ao criar pasta: ${detalhe}`);
  }

  const dados = (await resposta.json()) as unknown;
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
  const formulario = new URLSearchParams();
  formulario.set("code_pasta", codigoPasta);
  formulario.set("tipo", "ambos");
  formulario.set("index_conteudo", html);
  formulario.set("style_conteudo", css);

  const resposta = await fetch(`${configuracao.apiBaseUrl}/salvar-conteudo`, {
    method: "POST",
    headers: montarCabecalhos(configuracao, {
      "Content-Type": "application/x-www-form-urlencoded",
    }),
    body: formulario.toString(),
  });

  if (!resposta.ok) {
    const detalhe = await extrairDetalheDeErro(resposta);
    throw new Error(`Falha ao enviar conteúdo: ${detalhe}`);
  }

  const dados = (await resposta.json()) as {
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
    const dados = (await response.json()) as {
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

function extrairCodigoPasta(dados: unknown): string | undefined {
  if (typeof dados === "string" && dados.trim()) {
    return dados;
  }

  if (!dados || typeof dados !== "object") {
    return undefined;
  }

  const resposta = dados as Record<string, unknown>;
  const candidatos = [
    resposta.codigoPasta,
    resposta.codigo_pasta,
    resposta.codPasta,
    resposta.cod_pasta,
    resposta.pastaCodigo,
    resposta.codigo,
  ];

  const encontrado = candidatos.find(
    (valor): valor is string =>
      typeof valor === "string" && valor.trim().length > 0,
  );

  return encontrado;
}

function montarCabecalhos(
  configuracao: ConfiguracaoServidor,
  overrides?: Record<string, string>,
): Record<string, string> {
  const cabecalhos: Record<string, string> = {
    "Content-Type": "application/json",
    ...(overrides ?? {}),
  };

  if (configuracao.apiToken) {
    cabecalhos.Authorization = `Bearer ${configuracao.apiToken}`;
  }

  return cabecalhos;
}
