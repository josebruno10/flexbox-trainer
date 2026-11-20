import * as vscode from "vscode";
import { AuthService } from "../../auth/authService";
import {
  lerConfiguracaoServidor,
  verificarConexaoServidor,
} from "../../services/servidor/configuracao";
import { ErroHttp } from "../../services/http";
import { ConfiguracaoServidor, StatusConexaoServidor } from "../../types";

// A sessão no servidor: o teste de conexão, a configuração com o aluno e o
// time da sessão e o que fazer quando o servidor a recusa.

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
      httpStatus: error instanceof ErroHttp ? error.status : undefined,
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

/**
 * O servidor e a sessão de quem entrou. Aluno e time vêm só da sessão, que os
 * busca no servidor pelo e-mail; assim ninguém corrige em nome de outra pessoa.
 */
export function configuracaoDaSessao(authService: AuthService): ConfiguracaoServidor {
  const sessao = authService.getSessaoAtual();
  return {
    ...lerConfiguracaoServidor(authService.getAccessToken()),
    userId: sessao?.userId ?? 0,
    teamId: sessao?.teamId ?? 0,
  };
}

/** Encerra a sessão quando o servidor a recusou (veja sessaoRecusada). */
export async function encerrarSessaoSeRecusada(
  authService: AuthService,
  httpStatus?: number,
  incluirAcessoNegado = false,
): Promise<void> {
  if (sessaoRecusada(httpStatus, incluirAcessoNegado)) {
    await authService.invalidarSessao("O servidor recusou a sessão. Entre novamente.");
  }
}

/** O comando Testar Servidor: o resultado vem numa notificação. */
export async function testarServidorPeloComando(
  autenticado: boolean,
  testar: () => Promise<StatusConexaoServidor>,
): Promise<void> {
  if (!autenticado) {
    void vscode.window.showWarningMessage("Entre antes de testar o servidor.");
    return;
  }

  const status = await testar();
  if (status.ok) {
    void vscode.window.showInformationMessage(status.mensagem);
  } else {
    void vscode.window.showErrorMessage(`Servidor: ${status.mensagem}`);
  }
}

export function mostrarFalhaAoAbrirLogin(error: unknown): void {
  const mensagem =
    error instanceof Error ? error.message : "Não foi possível abrir o login.";
  void vscode.window.showErrorMessage(`Erro no login: ${mensagem}`);
}
