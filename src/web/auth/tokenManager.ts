import * as vscode from "vscode";

export type SessaoAutenticacao = {
  accessToken: string;
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
  public constructor(private readonly secrets: vscode.SecretStorage) {}

  public async carregarSessao(): Promise<SessaoAutenticacao | undefined> {
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
    await this.secrets.store(CHAVE_SESSAO, JSON.stringify(sessao));
  }

  public async limparSessao(): Promise<void> {
    await this.secrets.delete(CHAVE_SESSAO);
  }
}