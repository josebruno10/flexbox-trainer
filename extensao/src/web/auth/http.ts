import * as vscode from "vscode";
import { comoObjeto } from "./leitura";

// Os pedidos HTTP do login: tempo limite, leitura do corpo e erros com o
// status, para distinguir sessão recusada (401/403) de servidor fora do ar.

export const TIMEOUT_AUTENTICACAO_MS = 15_000;
export const TIMEOUT_PERFIL_MS = 10_000;

export class ErroApiAutenticacao extends Error {
  public constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ErroApiAutenticacao";
  }
}

export async function fetchComTimeout(
  url: string,
  opcoes: RequestInit,
  timeoutMs: number,
  contexto: string,
): Promise<Response> {
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), timeoutMs);

  try {
    return await fetch(url, { ...opcoes, signal: controlador.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Tempo limite de ${Math.round(timeoutMs / 1000)} segundos ao ${contexto}.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function extrairDetalheResposta(resposta: Response): Promise<string> {
  try {
    const dados = comoObjeto(await lerJSONOuVazio(resposta));
    const detalhe = dados?.detail;
    if (typeof dados?.message === "string") {
      return dados.message;
    }
    if (typeof detalhe === "string") {
      return detalhe;
    }
    if (Array.isArray(detalhe) && detalhe.length > 0) {
      return JSON.stringify(detalhe[0]);
    }
  } catch {
    // Usa o status HTTP como fallback.
  }
  return `HTTP ${resposta.status}`;
}

export async function lerJSONObrigatorio(
  resposta: Response,
  contexto: string,
): Promise<unknown> {
  const dados = await lerJSONOuVazio(resposta);
  if (!dados || typeof dados !== "object") {
    throw new Error(`O servidor retornou ${contexto} em formato inválido.`);
  }
  return dados;
}

export async function lerJSONOuVazio(resposta: Response): Promise<unknown> {
  const texto = await resposta.text();
  if (!texto.trim()) {
    return {};
  }
  try {
    return JSON.parse(texto);
  } catch {
    return texto.trim();
  }
}

// O servidor responde alguns 404 dentro de um 500 ("...: 404: ... não
// encontrado"). Outros erros viram exceção com o detalhe do servidor.
export async function respostaDeInexistente(
  resposta: Response,
  acao: string,
): Promise<boolean> {
  if (resposta.ok) {
    return false;
  }

  if (resposta.status === 404) {
    return true;
  }

  const detalhe = await extrairDetalheResposta(resposta);

  if (resposta.status === 500 && /\b404\b|não encontrad/i.test(detalhe)) {
    return true;
  }

  throw new ErroApiAutenticacao(
    `Não foi possível ${acao} (HTTP ${resposta.status}): ${detalhe}`,
    resposta.status,
  );
}

export function lerUrlBaseApiAutenticacao(): string {
  const valor = vscode.workspace
    .getConfiguration("flexboxTrainer")
    .get<string>(
      "authApiBaseUrl",
      "https://frontendteamscup.com.br/api",
    )
    .trim();
  const url = validarUrlHttps(valor, "API de autenticação");
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/docs\/?$/, "").replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

export function validarUrlHttps(valor: string, contexto: string): URL {
  const url = new URL(valor);
  if (url.protocol !== "https:") {
    throw new Error(`A URL do ${contexto} precisa usar HTTPS.`);
  }
  if (url.username || url.password) {
    throw new Error(`A URL do ${contexto} não pode conter credenciais.`);
  }
  return url;
}
