import { AuthService } from "./authService";

export class LoginProvider {
  public constructor(private readonly authService: AuthService) {}

  public async abrirLogin(): Promise<void> {
    await this.authService.abrirLoginGoogle();
  }

  public async revalidarSessao(): Promise<void> {
    await this.authService.revalidarSessao();
  }

  public async sair(): Promise<void> {
    await this.authService.logout();
  }
}
