import * as vscode from "vscode";
import {
  ErroHttp,
  extrairDetalhe,
  indicaNaoEncontrado,
  lerCorpo,
  normalizarUrlApi,
} from "../services/http";

// O que só o login usa dos pedidos HTTP (veja services/http.ts): os tempos
// limite, o endereço da API de autenticação e a leitura das respostas dela.

export const TIMEOUT_AUTENTICACAO_MS = 15_000;
export const TIMEOUT_PERFIL_MS = 10_000;

export async function lerJSONObrigatorio(
  resposta: Response,
  contexto: string,
): Promise<unknown> {
  const dados = await lerCorpo(resposta);
  if (!dados || typeof dados !== "object") {
    throw new Error(`O servidor retornou ${contexto} em formato inválido.`);
  }
  return dados;
}

// Um 404 (ou um 404 dentro de um 500) é "não existe". Outros erros viram
// exceção com o detalhe do servidor.
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

  const detalhe = await extrairDetalhe(resposta);

  if (indicaNaoEncontrado(resposta.status, detalhe)) {
    return true;
  }

  throw new ErroHttp(
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
  return normalizarUrlApi(valor, "da API de autenticação");
}
