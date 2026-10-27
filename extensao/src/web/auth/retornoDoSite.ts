import {
  ProvedorAutenticacao,
  trocarTokenProvedorPorTokenServidor,
} from "./apiTorneio";

// O retorno do site de login (authSiteUrl) para a extensão. Os tokens só
// valem no fragmento, que não vai para os registros de acesso dos servidores.

/**
 * A query e o fragmento com que o site voltou: de um endereço vscode:// (o
 * vscode.Uri serve) ou do servidor local do login (retornoLocal.ts).
 */
export type RetornoDoSite = { query: string; fragment: string };

const PROVEDORES_SUPORTADOS = new Set<ProvedorAutenticacao>([
  "gmail",
  "github",
  "microsoft",
]);

/** Os parâmetros da query e do fragmento juntos; o fragmento vale mais. */
export function lerParametrosCallback(uri: RetornoDoSite): URLSearchParams {
  const parametros = new URLSearchParams(uri.query);
  const fragmento = new URLSearchParams(uri.fragment);
  fragmento.forEach((valor, chave) => parametros.set(chave, valor));
  return parametros;
}

export function tokensDoRetorno(uri: RetornoDoSite): {
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

/**
 * O login que o site devolveu (depois de conferido o state): o token do
 * servidor, trocando por ele o do provedor quando o site manda só esse.
 */
export async function loginDoRetorno(
  retorno: RetornoDoSite,
  parametros: URLSearchParams,
): Promise<{
  provedor: ProvedorAutenticacao;
  tokenServidor: string;
  respostaLogin: unknown;
}> {
  const erroProvedor = (parametros.get("error") || "").trim();
  if (erroProvedor) {
    throw new Error(`O provedor recusou o login: ${erroProvedor}.`);
  }

  const provedor = normalizarProvedor(
    parametros.get("provider") || parametros.get("provedor") || "gmail",
  );
  const { tokenServidor, tokenProvedor } = tokensDoRetorno(retorno);
  if (tokenServidor) {
    return { provedor, tokenServidor, respostaLogin: {} };
  }
  if (!tokenProvedor) {
    throw new Error("O site de autenticação não devolveu um token válido.");
  }

  const resultado = await trocarTokenProvedorPorTokenServidor(provedor, tokenProvedor);
  return {
    provedor,
    tokenServidor: resultado.serverToken,
    respostaLogin: resultado.resposta,
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
