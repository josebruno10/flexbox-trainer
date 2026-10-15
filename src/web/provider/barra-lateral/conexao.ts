import { verificarConexaoServidor } from "../../services/servidor/configuracao";
import { ErroHttpServidor } from "../../services/servidor/requisicao";
import { ConfiguracaoServidor, StatusConexaoServidor } from "../../types";

/** Se a sessão está valendo no servidor; com erro HTTP, o código dele. */
export async function testarConexao(
  configuracao: ConfiguracaoServidor,
): Promise<{ status: StatusConexaoServidor; httpStatus?: number }> {
  try {
    return { status: { ok: true, mensagem: await verificarConexaoServidor(configuracao) } };
  } catch (error) {
    return {
      status: {
        ok: false,
        mensagem: error instanceof Error ? error.message : "Erro desconhecido",
      },
      httpStatus: error instanceof ErroHttpServidor ? error.status : undefined,
    };
  }
}

/**
 * Se a resposta do servidor quer dizer que a sessão não vale mais: 401 e,
 * no teste de conexão, também 403.
 */
export function sessaoRecusada(
  httpStatus: number | undefined,
  incluirAcessoNegado = false,
): boolean {
  return httpStatus === 401 || (incluirAcessoNegado && httpStatus === 403);
}
