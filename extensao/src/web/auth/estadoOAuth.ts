import { hexAleatorio } from "./aleatorio";

// O state do login pelo site: um valor aleatório que vai ao site e precisa
// voltar igual no retorno, e só vale por dez minutos.
const DURACAO_ESTADO_OAUTH_MS = 10 * 60 * 1000;

export class EstadoOAuth {
  private pendente?: { valor: string; criadoEm: number };
  private timeout?: ReturnType<typeof setTimeout>;

  /** Um state novo; aoExpirar roda se o retorno não chegar a tempo. */
  public criar(aoExpirar: () => void): string {
    const valor = hexAleatorio(24);
    this.pendente = { valor, criadoEm: Date.now() };

    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(() => {
      if (this.pendente?.valor !== valor) {
        return;
      }

      this.limpar();
      aoExpirar();
    }, DURACAO_ESTADO_OAUTH_MS);

    return valor;
  }

  /** Confere o state do retorno; cada state vale uma vez só. */
  public consumir(recebido: string): void {
    const pendente = this.pendente;

    if (!pendente || !recebido || pendente.valor !== recebido) {
      throw new Error(
        "Retorno de autenticação inválido ou não iniciado por esta extensão.",
      );
    }

    if (Date.now() - pendente.criadoEm > DURACAO_ESTADO_OAUTH_MS) {
      this.limpar();
      throw new Error("O login expirou. Inicie o processo novamente.");
    }

    this.limpar();
  }

  /** Se há um login esperando a volta do site. */
  public emAndamento(): boolean {
    return this.pendente !== undefined;
  }

  public limpar(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }

    this.pendente = undefined;
  }
}
