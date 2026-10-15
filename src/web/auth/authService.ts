import * as vscode from "vscode";
import { log } from "../services/logger";
import { EstadoAutenticacao } from "../types";
import {
  ProvedorAutenticacao,
  buscarPerfilAutenticado,
  encerrarNoServidor,
  trocarTokenProvedorPorTokenServidor,
} from "./apiTorneio";
import {
  DadosCadastro,
  OpcoesCadastro,
  cadastrarAluno,
  carregarOpcoesCadastro,
} from "./cadastroTorneio";
import { EstadoOAuth } from "./estadoOAuth";
import {
  ErroApiAutenticacao,
  lerUrlBaseApiAutenticacao,
  validarUrlHttps,
} from "./http";
import { lerBooleano } from "./leitura";
import {
  ProvedorVSCode,
  buscarPerfilProvedor,
  obterSessaoProvedor,
} from "./perfilProvedor";
import { PerfilServidor, extrairExpiracao } from "./respostasServidor";
import {
  lerParametrosCallback,
  normalizarProvedor,
  tokensDoRetorno,
} from "./retornoDoSite";
import { SessaoAutenticacao, TokenManager } from "./tokenManager";

export type { DadosCadastro, OpcoesCadastro } from "./cadastroTorneio";

// A sessão do aluno no servidor do torneio: o login (pelo site, para o
// Google, ou pelas contas do VS Code, para o GitHub e a Microsoft), a sessão
// guardada e o estado que a barra lateral mostra.
export class AuthService implements vscode.Disposable {
  private readonly tokenManager: TokenManager;
  private readonly estadoMudou = new vscode.EventEmitter<EstadoAutenticacao>();
  private readonly estadoOAuth = new EstadoOAuth();
  private estadoAtual: EstadoAutenticacao = {
    status: "checking",
    message: "Validando a sessão…",
  };
  private sessaoAtual?: SessaoAutenticacao;
  // Preenchido quando o e-mail do login não está cadastrado no torneio.
  private avisoCadastro?: string;

  public readonly onDidChangeEstado = this.estadoMudou.event;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.tokenManager = new TokenManager(context.secrets);
  }

  public dispose(): void {
    this.estadoOAuth.limpar();
    this.estadoMudou.dispose();
  }

  public getEstadoAtual(): EstadoAutenticacao {
    return { ...this.estadoAtual };
  }

  public getSessaoAtual():
    | Omit<SessaoAutenticacao, "accessToken" | "serverToken">
    | undefined {
    if (!this.sessaoAtual) {
      return undefined;
    }

    const { accessToken: _accessToken, serverToken: _serverToken, ...metadados } =
      this.sessaoAtual;
    return { ...metadados };
  }

  public getAccessToken(): string | undefined {
    if (!this.isAutenticado() || !this.sessaoAtual) {
      return undefined;
    }

    return this.sessaoAtual.serverToken;
  }

  public isAutenticado(): boolean {
    return this.estadoAtual.status === "authenticated";
  }

  public async inicializar(): Promise<void> {
    try {
      const sessao = await this.tokenManager.carregarSessao();

      if (!this.sessaoEhValidaLocalmente(sessao)) {
        await this.encerrarSessao();
        return;
      }

      // A sessão guardada aparece na hora: confirmá-la no servidor leva
      // segundos numa rede lenta, e a barra lateral ficava em "Validando a
      // sessão…" até lá. A confirmação continua em segundo plano.
      this.sessaoAtual = sessao;
      this.publicarSessaoAutenticada(sessao);
      await this.validarSessaoComApi(true);
    } catch (error) {
      this.sessaoAtual = undefined;
      const detalhe =
        error instanceof Error ? error.message : "erro desconhecido";
      this.definirEstado({
        status: "error",
        message: `Não foi possível carregar sua sessão (${detalhe}).`,
      });
    }
  }

  public async revalidarSessao(): Promise<void> {
    try {
      const sessao = await this.tokenManager.carregarSessao();

      if (!this.sessaoEhValidaLocalmente(sessao)) {
        await this.encerrarSessao(
          "A sessão expirou. Entre de novo.",
        );
        return;
      }

      this.sessaoAtual = sessao;
      this.definirEstado({
        status: "checking",
        message: "Validando a sessão…",
      });
      await this.validarSessaoComApi();
    } catch (error) {
      const detalhe =
        error instanceof Error ? error.message : "erro desconhecido";
      this.definirEstado({
        status: "error",
        message: `Não foi possível revalidar sua sessão (${detalhe}).`,
      });
    }
  }

  public async abrirLoginGoogle(): Promise<void> {
    const configuracao = vscode.workspace.getConfiguration("flexboxTrainer");
    const urlSite = configuracao.get<string>("authSiteUrl", "").trim();

    if (!urlSite) {
      throw new Error(
        "Configure flexboxTrainer.authSiteUrl para usar o login do Google.",
      );
    }

    const url = validarUrlHttps(urlSite, "site de autenticação");
    const callbackBase = vscode.Uri.parse(
      `${vscode.env.uriScheme}://${this.context.extension.id}/auth/callback`,
    );
    const callbackExterno = await vscode.env.asExternalUri(callbackBase);
    const estado = this.estadoOAuth.criar(() =>
      this.restaurarEstadoAposFalhaOAuth(
        "O login expirou. Inicie o processo novamente.",
      ),
    );

    // toString() codificaria = e & da query do callback do vscode.dev.
    url.searchParams.set("callback", callbackExterno.toString(true));
    url.searchParams.set("state", estado);
    // O site devolve o modo no retorno; só existe o login.
    url.searchParams.set("mode", "login");
    url.searchParams.set("apiBaseUrl", lerUrlBaseApiAutenticacao());

    const googleClientId = configuracao
      .get<string>("googleClientId", "")
      .trim();

    if (googleClientId) {
      // O site mais novo usa clientId; googleClientId mantém compatibilidade
      // com a versão anterior publicada pelo projeto.
      url.searchParams.set("clientId", googleClientId);
      url.searchParams.set("googleClientId", googleClientId);
    }

    this.definirEstado({
      status: "checking",
      message: "Aguardando o Google…",
    });

    try {
      // Um Uri passa por encodeURI(uri.toString(true)) antes de chegar ao
      // navegador, o que codifica os parâmetros em dobro (https%253A...) e faz
      // o site recusar apiBaseUrl e callback. Uma string é aberta como está,
      // inclusive quando o callback do vscode.dev contém ? e &.
      const abriu = await vscode.env.openExternal(
        url.toString() as unknown as vscode.Uri,
      );

      if (!abriu) {
        throw new Error("Não foi possível abrir o login do Google.");
      }
    } catch (error) {
      this.estadoOAuth.limpar();
      this.restaurarEstadoAposFalhaOAuth(
        "Não foi possível abrir o login do Google.",
      );
      throw error;
    }
  }

  public async loginComProvedorVSCode(provedor: ProvedorVSCode): Promise<void> {
    try {
      this.definirEstado({
        status: "checking",
        message: `Conectando ao ${provedor}…`,
      });

      // Sem VSCODE_TENANT, o provedor da Microsoft usa "organizations" e
      // recusa contas pessoais (outlook.com, hotmail.com).
      const scopes =
        provedor === "github"
          ? ["read:user", "user:email"]
          : [
              "https://graph.microsoft.com/User.Read",
              "email",
              "VSCODE_TENANT:common",
            ];
      const sessaoProvedor = await obterSessaoProvedor(provedor, scopes, () =>
        this.definirEstado({
          status: "checking",
          message: `Aguardando o ${provedor}…`,
        }),
      );

      if (!sessaoProvedor) {
        throw new Error("Autenticação cancelada.");
      }

      const perfilProvedor = await buscarPerfilProvedor(
        provedor,
        sessaoProvedor.accessToken,
        sessaoProvedor.account.label,
      );
      const resultadoLogin = await trocarTokenProvedorPorTokenServidor(
        provedor,
        sessaoProvedor.accessToken,
      );
      const { perfil: perfilServidor, avisoCadastro } =
        await buscarPerfilAutenticado(
          resultadoLogin.serverToken,
          perfilProvedor.emails,
        );
      this.avisoCadastro = avisoCadastro;

      await this.salvarSessaoServidor(
        resultadoLogin.serverToken,
        {
          ...perfilServidor,
          displayName:
            perfilServidor.displayName ||
            perfilProvedor.nome ||
            sessaoProvedor.account.label,
          avatarUrl: perfilServidor.avatarUrl || perfilProvedor.avatarUrl,
        },
        provedor,
        true,
        resultadoLogin.resposta,
        perfilProvedor.emails,
      );
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Falha na autenticação.";
      this.definirEstado({ status: "error", message: mensagem });
      void vscode.window.showErrorMessage(mensagem);
    }
  }

  public async processarCallback(uri: vscode.Uri): Promise<void> {
    try {
      const parametros = lerParametrosCallback(uri);
      this.estadoOAuth.consumir(parametros.get("state") || "");

      const erroProvedor = (parametros.get("error") || "").trim();
      if (erroProvedor) {
        throw new Error(`O provedor recusou o login: ${erroProvedor}.`);
      }

      const provedor = normalizarProvedor(
        parametros.get("provider") || parametros.get("provedor") || "gmail",
      );
      const { tokenServidor: tokenServidorRecebido, tokenProvedor } =
        tokensDoRetorno(uri);

      let tokenServidor: string;
      let respostaLogin: unknown = {};

      if (tokenServidorRecebido) {
        tokenServidor = tokenServidorRecebido;
      } else {
        if (!tokenProvedor) {
          throw new Error(
            "O site de autenticação não devolveu um token válido.",
          );
        }

        const resultado = await trocarTokenProvedorPorTokenServidor(
          provedor,
          tokenProvedor,
        );
        tokenServidor = resultado.serverToken;
        respostaLogin = resultado.resposta;
      }

      this.definirEstado({
        status: "checking",
        message: "Validando a sessão…",
      });

      const { perfil, avisoCadastro } =
        await buscarPerfilAutenticado(tokenServidor);
      this.avisoCadastro = avisoCadastro;
      await this.salvarSessaoServidor(
        tokenServidor,
        perfil,
        provedor,
        lerBooleano(parametros.get("remember"), true),
        respostaLogin,
      );
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Falha na autenticação.";

      if (this.sessaoAtual && this.sessaoAtual.expiresAt > Date.now()) {
        this.publicarSessaoAutenticada(this.sessaoAtual);
      } else {
        this.definirEstado({ status: "error", message: mensagem });
      }

      throw error;
    }
  }

  public async logout(): Promise<void> {
    const tokenServidor = this.sessaoAtual?.serverToken;

    try {
      if (tokenServidor) {
        await encerrarNoServidor(tokenServidor);
      }
    } catch {
      // O logout local precisa funcionar mesmo com a API indisponível.
    } finally {
      await this.encerrarSessao("Desconectado.");
    }
  }

  /**
   * O pré-cadastro cria o aluno no servidor da competição; fica desligado
   * até as rotas serem confirmadas com a organização do torneio.
   */
  public preCadastroLigado(): boolean {
    return (
      vscode.workspace
        .getConfiguration("flexboxTrainer")
        .get<boolean>("preCadastro", false) === true
    );
  }

  /** Republica a sessão quando a configuração do pré-cadastro muda. */
  public atualizarOfertaCadastro(): void {
    if (this.isAutenticado() && this.sessaoAtual) {
      this.publicarSessaoAutenticada(this.sessaoAtual);
    }
  }

  public podeCadastrarNoTorneio(): boolean {
    return Boolean(
      this.isAutenticado() && this.avisoCadastro && this.preCadastroLigado(),
    );
  }

  /** Sedes do evento e níveis do torneio, para o formulário de cadastro. */
  public async carregarOpcoesCadastro(): Promise<OpcoesCadastro> {
    return carregarOpcoesCadastro(this.exigirTokenParaCadastro());
  }

  /**
   * Cadastra no torneio o e-mail da sessão, põe o aluno no time genérico se
   * ele ficar sem time e procura o aluno de novo, para a correção funcionar.
   */
  public async cadastrarNoTorneio(dados: DadosCadastro): Promise<void> {
    if (!this.podeCadastrarNoTorneio()) {
      throw new Error("O cadastro no torneio não está disponível nesta sessão.");
    }

    const token = this.exigirTokenParaCadastro();
    await cadastrarAluno(token, this.sessaoAtual as SessaoAutenticacao, dados);
    await this.validarSessaoComApi();

    if (this.avisoCadastro) {
      throw new Error(
        "O cadastro foi enviado, mas o servidor ainda não encontra o aluno. Saia e entre de novo.",
      );
    }
  }

  public async invalidarSessao(mensagem: string): Promise<void> {
    await this.encerrarSessao(mensagem);
  }

  private exigirTokenParaCadastro(): string {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error("Entre antes de se cadastrar no torneio.");
    }
    return token;
  }

  private sessaoEhValidaLocalmente(
    sessao: SessaoAutenticacao | undefined,
  ): sessao is SessaoAutenticacao {
    return Boolean(
      sessao?.serverToken &&
        sessao.accessToken === sessao.serverToken &&
        sessao.expiresAt > Date.now(),
    );
  }

  private async salvarSessaoServidor(
    tokenServidor: string,
    perfil: PerfilServidor,
    provedor: ProvedorAutenticacao,
    remember: boolean,
    respostaLogin: unknown,
    emailsProvedor: string[] = [],
  ): Promise<void> {
    if (!tokenServidor.trim()) {
      throw new Error("O servidor não retornou um token de acesso.");
    }

    if (!perfil.email) {
      throw new Error("A API /auth/me não retornou o e-mail do usuário.");
    }

    if (!perfil.userId) {
      throw new Error(
        "A API /auth/me não retornou o ID do usuário autenticado.",
      );
    }

    const sessao: SessaoAutenticacao = {
      // Os dois campos mantêm compatibilidade interna, mas contêm somente o
      // token emitido pelo servidor. A credencial OAuth nunca é persistida.
      accessToken: tokenServidor,
      serverToken: tokenServidor,
      email: perfil.email,
      displayName: perfil.displayName || perfil.email,
      avatarUrl: perfil.avatarUrl,
      tokenGmail: provedor,
      userId: perfil.userId,
      teamId: perfil.teamId,
      emailsProvedor: emailsProvedor.length > 0 ? emailsProvedor : undefined,
      remember,
      authenticatedAt: Date.now(),
      expiresAt: extrairExpiracao(respostaLogin, tokenServidor),
    };

    await this.tokenManager.salvarSessao(sessao);
    this.sessaoAtual = sessao;
    this.publicarSessaoAutenticada(sessao);
  }

  // Em segundo plano, a sessão guardada já está na tela: sem resposta do
  // servidor ela continua (a correção avisa se ele estiver fora do ar), e só
  // uma recusa (401/403) encerra a sessão.
  private async validarSessaoComApi(emSegundoPlano = false): Promise<void> {
    const sessao = this.sessaoAtual;
    if (!sessao) {
      return;
    }

    try {
      const { perfil, avisoCadastro } = await buscarPerfilAutenticado(
        sessao.serverToken,
        sessao.emailsProvedor,
      );
      if (this.sessaoAtual?.serverToken !== sessao.serverToken) {
        // O aluno saiu ou entrou com outra conta enquanto isto rodava.
        return;
      }
      this.avisoCadastro = avisoCadastro;
      this.sessaoAtual = {
        ...this.sessaoAtual,
        email: perfil.email || this.sessaoAtual.email,
        displayName: perfil.displayName || this.sessaoAtual.displayName,
        avatarUrl: perfil.avatarUrl || this.sessaoAtual.avatarUrl,
        userId: perfil.userId ?? this.sessaoAtual.userId,
        teamId: perfil.teamId ?? this.sessaoAtual.teamId,
      };
      await this.tokenManager.salvarSessao(this.sessaoAtual);
      this.publicarSessaoAutenticada(this.sessaoAtual);
    } catch (error) {
      if (this.sessaoAtual?.serverToken !== sessao.serverToken) {
        return;
      }

      if (
        error instanceof ErroApiAutenticacao &&
        (error.status === 401 || error.status === 403)
      ) {
        await this.encerrarSessao(
          "A sessão expirou. Entre de novo.",
        );
        return;
      }

      if (emSegundoPlano) {
        // log.info, e não log.error, para não abrir a aba Saída ao iniciar.
        log.info(
          "A sessão guardada não foi confirmada no servidor e continua valendo: " +
            (error instanceof Error ? error.message : "erro desconhecido"),
        );
        return;
      }

      this.definirEstado({
        status: "error",
        message: `Não foi possível validar a sessão no servidor: ${
          error instanceof Error ? error.message : "erro desconhecido"
        }. O token permaneceu protegido no armazenamento do VS Code.`,
      });
    }
  }

  private publicarSessaoAutenticada(sessao: SessaoAutenticacao): void {
    this.definirEstado({
      status: "authenticated",
      email: sessao.email,
      displayName: sessao.displayName,
      avatarUrl: sessao.avatarUrl,
      message: `Conectado como ${sessao.displayName}.`,
      aviso: this.avisoCadastro,
      podeCadastrar: Boolean(this.avisoCadastro && this.preCadastroLigado()),
    });
  }

  private async encerrarSessao(mensagem?: string): Promise<void> {
    this.estadoOAuth.limpar();
    await this.tokenManager.limparSessao();
    this.sessaoAtual = undefined;
    this.avisoCadastro = undefined;
    this.definirEstado({ status: "unauthenticated", message: mensagem });
  }

  private restaurarEstadoAposFalhaOAuth(mensagem: string): void {
    if (this.sessaoAtual && this.sessaoAtual.expiresAt > Date.now()) {
      this.publicarSessaoAutenticada(this.sessaoAtual);
      return;
    }

    this.definirEstado({ status: "unauthenticated", message: mensagem });
  }

  private definirEstado(estado: EstadoAutenticacao): void {
    this.estadoAtual = estado;
    this.estadoMudou.fire({ ...estado });
  }
}
