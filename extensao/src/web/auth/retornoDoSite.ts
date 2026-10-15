import * as vscode from "vscode";
import type { ProvedorAutenticacao } from "./apiTorneio";

// O retorno do site de login (authSiteUrl) para a extensão. Os tokens só
// valem no fragmento, que não vai para os registros de acesso dos servidores.

const PROVEDORES_SUPORTADOS = new Set<ProvedorAutenticacao>([
  "gmail",
  "github",
  "microsoft",
]);

/** Os parâmetros da query e do fragmento juntos; o fragmento vale mais. */
export function lerParametrosCallback(uri: vscode.Uri): URLSearchParams {
  const parametros = new URLSearchParams(uri.query);
  const fragmento = new URLSearchParams(uri.fragment);
  fragmento.forEach((valor, chave) => parametros.set(chave, valor));
  return parametros;
}

export function tokensDoRetorno(uri: vscode.Uri): {
  tokenServidor: string;
  tokenProvedor: string;
} {
  const credenciais = new URLSearchParams(uri.fragment);
  return {
    tokenServidor: (
      credenciais.get("server_token") ||
      credenciais.get("serverToken") ||
      ""
    ).trim(),
    tokenProvedor: (
      credenciais.get("token") ||
      credenciais.get("provider_token") ||
      credenciais.get("google_token") ||
      credenciais.get("credential") ||
      credenciais.get("id_token") ||
      ""
    ).trim(),
  };
}

export function normalizarProvedor(valor: string): ProvedorAutenticacao {
  const provedor =
    valor.toLowerCase().trim() === "google"
      ? "gmail"
      : valor.toLowerCase().trim();

  if (!PROVEDORES_SUPORTADOS.has(provedor as ProvedorAutenticacao)) {
    throw new Error(`Provedor de autenticação não suportado: ${valor}.`);
  }

  return provedor as ProvedorAutenticacao;
}
