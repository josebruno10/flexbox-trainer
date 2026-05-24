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
  const resposta = await fetch(`${configuracao.apiBaseUrl}/pasta`, {
    method: "POST",
    headers: montarCabecalhos(configuracao),
    body: JSON.stringify({
      dinamicaId: configuracao.dinamicaId,
      userId: configuracao.userId,
      teamId: configuracao.teamId,
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao criar pasta: HTTP ${resposta.status}`);
  }

  const dados = (await resposta.json()) as { codigoPasta?: string };

  if (!dados.codigoPasta) {
    throw new Error("A API não retornou o código da pasta.");
  }

  return dados.codigoPasta;
}

export async function enviarImagemDaTentativa(
  configuracao: ConfiguracaoServidor,
  codigoPasta: string,
  imagemBase64: string,
): Promise<ResultadoAvaliacao> {
  const resposta = await fetch(`${configuracao.apiBaseUrl}/salvarConteudo`, {
    method: "POST",
    headers: montarCabecalhos(configuracao),
    body: JSON.stringify({
      codigoPasta,
      imagem: imagemBase64,
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao enviar imagem: HTTP ${resposta.status}`);
  }

  const dados = (await resposta.json()) as { nota?: number };

  if (typeof dados.nota !== "number") {
    throw new Error("A API não retornou a nota da submissão.");
  }

  return {
    precision: dados.nota,
    score: dados.nota,
    source: "servidor",
  };
}

function montarCabecalhos(
  configuracao: ConfiguracaoServidor,
): Record<string, string> {
  const cabecalhos: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (configuracao.apiToken) {
    cabecalhos.Authorization = `Bearer ${configuracao.apiToken}`;
  }

  return cabecalhos;
}
