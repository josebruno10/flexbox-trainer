import * as vscode from "vscode";

export type SessaoAutenticacao = {
  accessToken: string;
  serverToken: string;
  email: string;
  displayName: string;
  tokenGmail: string;
  userId?: number;
  remember: boolean;
  authenticatedAt: number;
  expiresAt: number;
};

const CHAVE_SESSAO = "flexboxTrainer.auth.session";

export class TokenManager {
  private sessaoTemporaria?: SessaoAutenticacao;

  public constructor(private readonly secrets: vscode.SecretStorage) {}

  public async carregarSessao(): Promise<SessaoAutenticacao | undefined> {
    if (this.sessaoTemporaria) {
      return { ...this.sessaoTemporaria };
    }

    const valor = await this.secrets.get(CHAVE_SESSAO);

    if (!valor) {
      return undefined;
    }

    try {
      return JSON.parse(valor) as SessaoAutenticacao;
    } catch {
      await this.secrets.delete(CHAVE_SESSAO);
      return undefined;
    }
  }

  public async salvarSessao(sessao: SessaoAutenticacao): Promise<void> {
    if (sessao.remember) {
      this.sessaoTemporaria = undefined;
      await this.secrets.store(CHAVE_SESSAO, JSON.stringify(sessao));
      return;
    }

    this.sessaoTemporaria = { ...sessao };
    await this.secrets.delete(CHAVE_SESSAO);
  }

  public async limparSessao(): Promise<void> {
    this.sessaoTemporaria = undefined;
    await this.secrets.delete(CHAVE_SESSAO);
  }
}
