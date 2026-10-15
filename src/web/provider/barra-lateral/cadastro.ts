import * as vscode from "vscode";
import { AuthService } from "../../auth/authService";
import { pedirDadosCadastro } from "../../auth/formularioCadastro";
import { log } from "../../services/logger";

const CADASTRAR = "Cadastrar";

/**
 * Cadastra no torneio o e-mail da sessão, que ainda não existe lá, para a
 * correção funcionar. Cria um usuário no servidor da competição.
 */
export async function cadastrarNoTorneio(authService: AuthService): Promise<void> {
  const sessao = authService.getSessaoAtual();
  if (!sessao || !authService.podeCadastrarNoTorneio()) {
    return;
  }

  const confirmacao = await vscode.window.showInformationMessage(
    `Cadastrar ${sessao.email} no Frontend Teams Cup?`,
    {
      modal: true,
      detail:
        "O e-mail desta conta não está no torneio. O cadastro cria o seu " +
        "usuário no servidor e coloca você no time genérico, para poder corrigir.",
    },
    CADASTRAR,
  );
  if (confirmacao !== CADASTRAR) {
    return;
  }

  try {
    const opcoes = await authService.carregarOpcoesCadastro();
    const dados = await pedirDadosCadastro(sessao.email, sessao.displayName, opcoes);
    if (!dados) {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Cadastrando no torneio…",
      },
      () => authService.cadastrarNoTorneio(dados),
    );
    void vscode.window.showInformationMessage(
      "Cadastro feito. Você já pode corrigir os desafios.",
    );
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Erro desconhecido.";
    log.error("Não foi possível cadastrar no torneio", error);
    void vscode.window.showErrorMessage(`Cadastro no torneio: ${mensagem}`);
  }
}
