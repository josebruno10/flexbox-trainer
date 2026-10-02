import * as vscode from "vscode";
import { EstadoAutenticacao } from "../types";
import { SessaoAutenticacao, TokenManager } from "./tokenManager";

type ModoAutenticacao = "login" | "register";
type ProvedorAutenticacao = "gmail" | "github" | "microsoft";

type PerfilServidor = {
  email: string;
  displayName: string;
  avatarUrl?: string;
  userId?: number;
  teamId?: number;
};

type PerfilProvedor = {
  emails: string[];
  nome: string;
  avatarUrl?: string;
};

type ResultadoTrocaLogin = {
  serverToken: string;
  resposta: unknown;
};

type EstadoOAuthPendente = {
  valor: string;
  criadoEm: number;
};

const DURACAO_SESSAO_PADRAO_MS = 30 * 24 * 60 * 60 * 1000;
const DURACAO_ESTADO_OAUTH_MS = 10 * 60 * 1000;
const TIMEOUT_AUTENTICACAO_MS = 15_000;
const TIMEOUT_PERFIL_MS = 10_000;
const TENTATIVAS_PROVEDOR_VSCODE = 3;
const PROVEDORES_SUPORTADOS = new Set<ProvedorAutenticacao>([
  "gmail",
  "github",
  "microsoft",
]);

class ErroApiAutenticacao extends Error {
  public constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ErroApiAutenticacao";
  }
}

export class AuthService implements vscode.Disposable {
  private readonly tokenManager: TokenManager;
  private readonly estadoMudou = new vscode.EventEmitter<EstadoAutenticacao>();
  private estadoAtual: EstadoAutenticacao = {
    status: "checking",
    message: "Validando sessão...",
  };
  private sessaoAtual?: SessaoAutenticacao;
  private estadoOAuthPendente?: EstadoOAuthPendente;
  private timeoutEstadoOAuth?: ReturnType<typeof setTimeout>;

  public readonly onDidChangeEstado = this.estadoMudou.event;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.tokenManager = new TokenManager(context.secrets);
  }

  public dispose(): void {
    this.limparEstadoOAuthPendente();
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
        await this.encerrarSessao("Aguardando login.");
        return;
      }

      this.sessaoAtual = sessao;
      await this.validarSessaoComApi();
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
          "Sua sessão expirou. Faça login novamente.",
        );
        return;
      }

      this.sessaoAtual = sessao;
      this.definirEstado({
        status: "checking",
        message: "Revalidando sua sessão no servidor...",
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

  public async abrirFluxoAutenticacao(
    modo: ModoAutenticacao,
  ): Promise<void> {
    await this.abrirLoginGoogle(modo);
  }

  public async abrirLoginGoogle(
    modo: ModoAutenticacao = "login",
  ): Promise<void> {
    const configuracao = vscode.workspace.getConfiguration("flexboxTrainer");
    const urlSite = configuracao.get<string>("authSiteUrl", "").trim();

    if (!urlSite) {
      throw new Error(
        "Configure flexboxTrainer.authSiteUrl para usar o login do Google.",
      );
    }

    const url = this.validarUrlHttps(urlSite, "site de autenticação");
    const callbackBase = vscode.Uri.parse(
      `${vscode.env.uriScheme}://${this.context.extension.id}/auth/callback`,
    );
    const callbackExterno = await vscode.env.asExternalUri(callbackBase);
    const estado = this.criarEstadoOAuth();

    this.estadoOAuthPendente = { valor: estado, criadoEm: Date.now() };
    this.agendarExpiracaoEstadoOAuth(estado);

    // toString() codificaria = e & da query do callback do vscode.dev.
    url.searchParams.set("callback", callbackExterno.toString(true));
    url.searchParams.set("state", estado);
    url.searchParams.set("mode", modo);
    url.searchParams.set("apiBaseUrl", this.lerUrlBaseApiAutenticacao());

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
      message: "Aguardando a autenticação do Google...",
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
      this.limparEstadoOAuthPendente();
      this.restaurarEstadoAposFalhaOAuth(
        "Não foi possível abrir o login do Google.",
      );
      throw error;
    }
  }

  public async loginComProvedorVSCode(
    provedor: "github" | "microsoft",
  ): Promise<void> {
    try {
      this.definirEstado({
        status: "checking",
        message: `Conectando ao ${provedor}...`,
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
      const sessaoProvedor = await this.obterSessaoProvedor(provedor, scopes);

      if (!sessaoProvedor) {
        throw new Error("Autenticação cancelada.");
      }

      const perfilProvedor = await this.buscarPerfilProvedor(
        provedor,
        sessaoProvedor.accessToken,
        sessaoProvedor.account.label,
      );
      const resultadoLogin = await this.trocarTokenProvedorPorTokenServidor(
        provedor,
        sessaoProvedor.accessToken,
      );
      const perfilServidor = await this.buscarPerfilAutenticado(
        resultadoLogin.serverToken,
      );

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
      );
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Falha na autenticação.";
      this.definirEstado({ status: "error", message: mensagem });
      void vscode.window.showErrorMessage(mensagem);
    }
  }

  // No primeiro pedido o VS Code ativa a extensão do provedor e espera só 5 s
  // pelo registro dele. Numa janela recém-aberta isso leva mais (medido: 5,6 s
  // para o GitHub e 11,4 s para a Microsoft), e o provedor continua
  // registrando depois do erro; o erro vem antes de qualquer tela de login.
  private async obterSessaoProvedor(
    provedor: "github" | "microsoft",
    scopes: string[],
  ): Promise<vscode.AuthenticationSession> {
    for (let tentativa = 1; ; tentativa++) {
      try {
        return await vscode.authentication.getSession(provedor, scopes, {
          createIfNone: true,
        });
      } catch (error) {
        const aguardandoRegistro =
          error instanceof Error &&
          /timed out waiting for authentication provider/i.test(error.message);

        if (!aguardandoRegistro) {
          throw error;
        }

        if (tentativa >= TENTATIVAS_PROVEDOR_VSCODE) {
          const nome = provedor === "github" ? "GitHub" : "Microsoft";
          throw new Error(
            `O VS Code não disponibilizou o login do ${nome}. Confira se a ` +
              `extensão embutida "${nome} Authentication" está habilitada e ` +
              "tente novamente.",
          );
        }

        this.definirEstado({
          status: "checking",
          message: `Aguardando o login do ${provedor} ficar disponível...`,
        });
      }
    }
  }

  public async processarCallback(uri: vscode.Uri): Promise<void> {
    try {
      const parametros = this.lerParametrosCallback(uri);
      const credenciaisCallback = new URLSearchParams(uri.fragment);
      this.validarEConsumirEstadoOAuth(parametros.get("state") || "");

      const erroProvedor = (parametros.get("error") || "").trim();
      if (erroProvedor) {
        throw new Error(`O provedor recusou o login: ${erroProvedor}.`);
      }

      const provedor = this.normalizarProvedor(
        parametros.get("provider") || parametros.get("provedor") || "gmail",
      );
      const tokenServidorRecebido = (
        credenciaisCallback.get("server_token") ||
        credenciaisCallback.get("serverToken") ||
        ""
      ).trim();
      const tokenProvedor = (
        credenciaisCallback.get("token") ||
        credenciaisCallback.get("provider_token") ||
        credenciaisCallback.get("google_token") ||
        credenciaisCallback.get("credential") ||
        credenciaisCallback.get("id_token") ||
        ""
      ).trim();

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

        const resultado = await this.trocarTokenProvedorPorTokenServidor(
          provedor,
          tokenProvedor,
        );
        tokenServidor = resultado.serverToken;
        respostaLogin = resultado.resposta;
      }

      this.definirEstado({
        status: "checking",
        message: "Validando sua sessão no servidor...",
      });

      const perfil = await this.buscarPerfilAutenticado(tokenServidor);
      await this.salvarSessaoServidor(
        tokenServidor,
        perfil,
        provedor,
        this.lerBooleano(parametros.get("remember"), true),
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
        await this.fetchComTimeout(
          `${this.lerUrlBaseApiAutenticacao()}/logout`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${tokenServidor}`,
            },
          },
          TIMEOUT_PERFIL_MS,
          "encerrar a sessão",
        );
      }
    } catch {
      // O logout local precisa funcionar mesmo com a API indisponível.
    } finally {
      await this.encerrarSessao("Desconectado.");
    }
  }

  public async invalidarSessao(mensagem: string): Promise<void> {
    await this.encerrarSessao(mensagem);
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
      remember,
      authenticatedAt: Date.now(),
      expiresAt: this.extrairExpiracao(respostaLogin, tokenServidor),
    };

    await this.tokenManager.salvarSessao(sessao);
    this.sessaoAtual = sessao;
    this.publicarSessaoAutenticada(sessao);
  }

  private async trocarTokenProvedorPorTokenServidor(
    provedor: ProvedorAutenticacao,
    tokenProvedor: string,
  ): Promise<ResultadoTrocaLogin> {
    const resposta = await this.fetchComTimeout(
      `${this.lerUrlBaseApiAutenticacao()}/login`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider: provedor, token: tokenProvedor }),
      },
      TIMEOUT_AUTENTICACAO_MS,
      "validar o login",
    );

    if (!resposta.ok) {
      const detalhe = await this.extrairDetalheResposta(resposta);
      throw new ErroApiAutenticacao(
        `Falha ao validar o login no servidor (HTTP ${resposta.status}): ${detalhe}`,
        resposta.status,
      );
    }

    const dados = await this.lerJSONObrigatorio(resposta, "login");
    const tokenServidor = this.extrairTokenServidor(dados);

    if (!tokenServidor) {
      throw new Error("A API de login não retornou token de acesso.");
    }

    return { serverToken: tokenServidor, resposta: dados };
  }

  private async buscarPerfilAutenticado(
    tokenServidor: string,
  ): Promise<PerfilServidor> {
    const resposta = await this.fetchComTimeout(
      `${this.lerUrlBaseApiAutenticacao()}/auth/me`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${tokenServidor}`,
        },
      },
      TIMEOUT_PERFIL_MS,
      "validar a sessão",
    );

    if (!resposta.ok) {
      const detalhe = await this.extrairDetalheResposta(resposta);
      throw new ErroApiAutenticacao(
        `Não foi possível validar a sessão (HTTP ${resposta.status}): ${detalhe}`,
        resposta.status,
      );
    }

    const dados = await this.lerJSONObrigatorio(
      resposta,
      "perfil autenticado",
    );
    const perfil = this.extrairPerfil(dados);

    if (!perfil.email) {
      throw new Error("A API /auth/me não retornou o e-mail do usuário.");
    }

    if (!perfil.userId) {
      throw new Error("A API /auth/me não retornou o ID do usuário.");
    }

    if (!perfil.teamId) {
      perfil.teamId = await this.buscarTimeDoUsuario(
        tokenServidor,
        perfil.userId,
      );
    }

    return perfil;
  }

  private async buscarTimeDoUsuario(
    tokenServidor: string,
    userId: number,
  ): Promise<number | undefined> {
    const resposta = await this.fetchComTimeout(
      `${this.lerUrlBaseApiAutenticacao()}/usuarios/${userId}/time`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${tokenServidor}`,
        },
      },
      TIMEOUT_PERFIL_MS,
      "consultar a equipe do usuário",
    );

    if (resposta.status === 404) {
      return undefined;
    }

    if (!resposta.ok) {
      const detalhe = await this.extrairDetalheResposta(resposta);
      throw new ErroApiAutenticacao(
        `Não foi possível consultar a equipe (HTTP ${resposta.status}): ${detalhe}`,
        resposta.status,
      );
    }

    return this.extrairTimeId(
      await this.lerJSONObrigatorio(resposta, "equipe do usuário"),
    );
  }

  private async validarSessaoComApi(): Promise<void> {
    if (!this.sessaoAtual) {
      return;
    }

    try {
      const perfil = await this.buscarPerfilAutenticado(
        this.sessaoAtual.serverToken,
      );
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
      if (
        error instanceof ErroApiAutenticacao &&
        (error.status === 401 || error.status === 403)
      ) {
        await this.encerrarSessao(
          "Sua sessão expirou. Faça login novamente.",
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

  private async buscarPerfilProvedor(
    provedor: "github" | "microsoft",
    accessToken: string,
    nomeFallback: string,
  ): Promise<PerfilProvedor> {
    return provedor === "github"
      ? this.buscarPerfilGitHub(accessToken, nomeFallback)
      : this.buscarPerfilMicrosoft(accessToken, nomeFallback);
  }

  private async buscarPerfilGitHub(
    accessToken: string,
    nomeFallback: string,
  ): Promise<PerfilProvedor> {
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const usuarioRes = await this.fetchComTimeout(
      "https://api.github.com/user",
      { headers },
      TIMEOUT_PERFIL_MS,
      "consultar o perfil do GitHub",
    );

    if (!usuarioRes.ok) {
      throw new Error(`Falha ao consultar GitHub: HTTP ${usuarioRes.status}`);
    }

    const usuario = this.comoObjeto(
      await this.lerJSONObrigatorio(usuarioRes, "perfil do GitHub"),
    );
    const emails: string[] = [this.primeiroTexto(usuario?.email)];
    const emailsRes = await this.fetchComTimeout(
      "https://api.github.com/user/emails",
      { headers },
      TIMEOUT_PERFIL_MS,
      "consultar os e-mails do GitHub",
    );

    if (emailsRes.ok) {
      const dadosEmails = await this.lerJSONObrigatorio(
        emailsRes,
        "e-mails do GitHub",
      );

      if (Array.isArray(dadosEmails)) {
        const verificados = dadosEmails
          .map((item) => this.comoObjeto(item))
          .filter((item) => item?.verified === true && item.email);
        const principal = verificados.find((item) => item?.primary === true);
        emails.push(this.primeiroTexto(principal?.email));
        verificados.forEach((item) => emails.push(this.primeiroTexto(item?.email)));
      }
    }

    return {
      emails: this.normalizarEmails(emails),
      nome:
        this.primeiroTexto(
          usuario?.name,
          usuario?.login,
          usuario?.email,
          nomeFallback,
        ) || "GitHub",
      avatarUrl: this.primeiroTexto(usuario?.avatar_url) || undefined,
    };
  }

  private async buscarPerfilMicrosoft(
    accessToken: string,
    nomeFallback: string,
  ): Promise<PerfilProvedor> {
    try {
      const resposta = await this.fetchComTimeout(
        "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName",
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        },
        TIMEOUT_PERFIL_MS,
        "consultar o perfil da Microsoft",
      );

      if (resposta.ok) {
        const dados = this.comoObjeto(
          await this.lerJSONObrigatorio(resposta, "perfil da Microsoft"),
        );
        return {
          emails: this.normalizarEmails([
            this.primeiroTexto(dados?.mail),
            this.primeiroTexto(dados?.userPrincipalName),
            this.extrairEmailDeTexto(nomeFallback),
          ]),
          nome:
            this.primeiroTexto(
              dados?.displayName,
              dados?.userPrincipalName,
              dados?.mail,
              nomeFallback,
            ) || "Microsoft",
          avatarUrl: await this.buscarFotoMicrosoft(accessToken),
        };
      }
    } catch {
      // O rótulo da sessão ainda pode conter um e-mail utilizável.
    }

    const emailFallback = this.extrairEmailDeTexto(nomeFallback);
    return {
      emails: this.normalizarEmails([emailFallback]),
      nome: nomeFallback || emailFallback || "Microsoft",
    };
  }

  private async buscarFotoMicrosoft(
    accessToken: string,
  ): Promise<string | undefined> {
    try {
      const resposta = await this.fetchComTimeout(
        "https://graph.microsoft.com/v1.0/me/photo/$value",
        { headers: { Authorization: `Bearer ${accessToken}` } },
        TIMEOUT_PERFIL_MS,
        "consultar a foto da Microsoft",
      );

      if (!resposta.ok) {
        return undefined;
      }

      const blob = await resposta.blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binario = "";
      for (const byte of bytes) {
        binario += String.fromCharCode(byte);
      }
      return `data:${blob.type || "image/jpeg"};base64,${btoa(binario)}`;
    } catch {
      return undefined;
    }
  }

  private publicarSessaoAutenticada(sessao: SessaoAutenticacao): void {
    this.definirEstado({
      status: "authenticated",
      email: sessao.email,
      displayName: sessao.displayName,
      avatarUrl: sessao.avatarUrl,
      message: `Conectado como ${sessao.displayName}.`,
    });
  }

  private async encerrarSessao(mensagem: string): Promise<void> {
    this.limparEstadoOAuthPendente();
    await this.tokenManager.limparSessao();
    this.sessaoAtual = undefined;
    this.definirEstado({ status: "unauthenticated", message: mensagem });
  }

  private validarEConsumirEstadoOAuth(estadoRecebido: string): void {
    const pendente = this.estadoOAuthPendente;

    if (!pendente || !estadoRecebido || pendente.valor !== estadoRecebido) {
      throw new Error(
        "Retorno de autenticação inválido ou não iniciado por esta extensão.",
      );
    }

    if (Date.now() - pendente.criadoEm > DURACAO_ESTADO_OAUTH_MS) {
      this.limparEstadoOAuthPendente();
      throw new Error("O login expirou. Inicie o processo novamente.");
    }

    this.limparEstadoOAuthPendente();
  }

  private criarEstadoOAuth(): string {
    if (
      typeof globalThis.crypto !== "undefined" &&
      typeof globalThis.crypto.getRandomValues === "function"
    ) {
      const bytes = new Uint8Array(24);
      globalThis.crypto.getRandomValues(bytes);
      return Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
    }

    throw new Error(
      "O ambiente não disponibilizou geração criptográfica segura para iniciar o login.",
    );
  }

  private agendarExpiracaoEstadoOAuth(estado: string): void {
    if (this.timeoutEstadoOAuth) {
      clearTimeout(this.timeoutEstadoOAuth);
    }

    this.timeoutEstadoOAuth = setTimeout(() => {
      if (this.estadoOAuthPendente?.valor !== estado) {
        return;
      }

      this.limparEstadoOAuthPendente();
      this.restaurarEstadoAposFalhaOAuth(
        "O login expirou. Inicie o processo novamente.",
      );
    }, DURACAO_ESTADO_OAUTH_MS);
  }

  private limparEstadoOAuthPendente(): void {
    if (this.timeoutEstadoOAuth) {
      clearTimeout(this.timeoutEstadoOAuth);
      this.timeoutEstadoOAuth = undefined;
    }

    this.estadoOAuthPendente = undefined;
  }

  private restaurarEstadoAposFalhaOAuth(mensagem: string): void {
    if (this.sessaoAtual && this.sessaoAtual.expiresAt > Date.now()) {
      this.publicarSessaoAutenticada(this.sessaoAtual);
      return;
    }

    this.definirEstado({ status: "unauthenticated", message: mensagem });
  }

  private lerParametrosCallback(uri: vscode.Uri): URLSearchParams {
    const parametros = new URLSearchParams(uri.query);
    const fragmento = new URLSearchParams(uri.fragment);
    fragmento.forEach((valor, chave) => parametros.set(chave, valor));
    return parametros;
  }

  private normalizarProvedor(valor: string): ProvedorAutenticacao {
    const provedor =
      valor.toLowerCase().trim() === "google"
        ? "gmail"
        : valor.toLowerCase().trim();

    if (!PROVEDORES_SUPORTADOS.has(provedor as ProvedorAutenticacao)) {
      throw new Error(`Provedor de autenticação não suportado: ${valor}.`);
    }

    return provedor as ProvedorAutenticacao;
  }

  private extrairTokenServidor(dados: unknown): string | undefined {
    const raiz = this.comoObjeto(dados);
    const data = this.comoObjeto(raiz?.data);
    const tokens = this.comoObjeto(raiz?.tokens);
    const auth = this.comoObjeto(raiz?.auth);
    const session = this.comoObjeto(raiz?.session);
    return (
      this.primeiroTexto(
        raiz?.server_token,
        raiz?.serverToken,
        raiz?.access_token,
        raiz?.accessToken,
        raiz?.token,
        raiz?.jwt,
        raiz?.bearerToken,
        data?.server_token,
        data?.serverToken,
        data?.access_token,
        data?.accessToken,
        data?.token,
        tokens?.server_token,
        tokens?.serverToken,
        tokens?.access_token,
        tokens?.accessToken,
        auth?.token,
        session?.token,
      ) || undefined
    );
  }

  private extrairPerfil(dados: unknown): PerfilServidor {
    const raiz = this.comoObjeto(dados) ?? {};
    const data = this.comoObjeto(raiz.data);
    const candidato =
      this.comoObjeto(raiz.usuario) ??
      this.comoObjeto(raiz.user) ??
      this.comoObjeto(raiz.perfil) ??
      this.comoObjeto(data?.usuario) ??
      this.comoObjeto(data?.user) ??
      this.comoObjeto(data?.perfil) ??
      data ??
      raiz;
    const time =
      this.comoObjeto(candidato.time) ??
      this.comoObjeto(candidato.team) ??
      this.comoObjeto(candidato.equipe);
    const email = this.primeiroTexto(
      candidato.email,
      candidato.mail,
      candidato.user_email,
      candidato.preferred_username,
      candidato.upn,
    ).toLowerCase();

    return {
      email,
      displayName:
        this.primeiroTexto(
          candidato.nome,
          candidato.name,
          candidato.display_name,
          candidato.displayName,
          candidato.nome_completo,
          email,
        ) || "Usuário",
      avatarUrl:
        this.primeiroTexto(
          candidato.url_image_perfil,
          candidato.avatar_url,
          candidato.avatarUrl,
          candidato.avatar,
          candidato.picture,
        ) || undefined,
      userId: this.primeiroNumeroPositivo(
        candidato.usuario_id,
        candidato.user_id,
        candidato.userId,
        candidato.integrante_id,
        candidato.id,
      ),
      teamId: this.primeiroNumeroPositivo(
        candidato.time_id,
        candidato.team_id,
        candidato.teamId,
        candidato.equipe_id,
        time?.id,
      ),
    };
  }

  private extrairTimeId(dados: unknown): number | undefined {
    const raiz = Array.isArray(dados)
      ? this.comoObjeto(dados[0])
      : this.comoObjeto(dados);
    const data = this.comoObjeto(raiz?.data);
    const candidato =
      this.comoObjeto(raiz?.time) ??
      this.comoObjeto(raiz?.team) ??
      this.comoObjeto(raiz?.equipe) ??
      this.comoObjeto(data?.time) ??
      this.comoObjeto(data?.team) ??
      this.comoObjeto(data?.equipe) ??
      data ??
      raiz;

    return candidato
      ? this.primeiroNumeroPositivo(
          candidato.time_id,
          candidato.team_id,
          candidato.equipe_id,
          candidato.id,
        )
      : undefined;
  }

  private extrairExpiracao(
    dados: unknown,
    tokenServidor: string,
  ): number {
    const raiz = this.comoObjeto(dados) ?? {};
    const data = this.comoObjeto(raiz.data) ?? {};
    const expiresIn = this.primeiroNumeroPositivo(
      raiz.expires_in,
      raiz.expiresIn,
      data.expires_in,
      data.expiresIn,
    );

    if (expiresIn) {
      return Date.now() + expiresIn * 1000;
    }

    const expiresAt = this.converterInstante(
      raiz.expires_at ?? raiz.expiresAt ?? data.expires_at ?? data.expiresAt,
    );
    return (
      expiresAt ??
      this.extrairExpiracaoJwt(tokenServidor) ??
      Date.now() + DURACAO_SESSAO_PADRAO_MS
    );
  }

  private extrairExpiracaoJwt(token: string): number | undefined {
    try {
      const payload = token.split(".")[1];
      if (!payload) {
        return undefined;
      }
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const normalizado = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      const dados = JSON.parse(atob(normalizado)) as { exp?: unknown };
      const exp = this.primeiroNumeroPositivo(dados.exp);
      return exp ? exp * 1000 : undefined;
    } catch {
      return undefined;
    }
  }

  private converterInstante(valor: unknown): number | undefined {
    if (typeof valor === "number" && Number.isFinite(valor)) {
      return valor > 10_000_000_000 ? valor : valor * 1000;
    }

    if (typeof valor === "string" && valor.trim()) {
      const numero = Number(valor);
      if (Number.isFinite(numero)) {
        return numero > 10_000_000_000 ? numero : numero * 1000;
      }
      const data = Date.parse(valor);
      return Number.isFinite(data) ? data : undefined;
    }

    return undefined;
  }

  private extrairEmailDeTexto(texto: string): string {
    const valor = texto.trim();
    const candidato =
      valor.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || valor;
    return candidato.includes("@") ? candidato.toLowerCase() : "";
  }

  private normalizarEmails(emails: string[]): string[] {
    return Array.from(
      new Set(
        emails
          .map((email) => email.trim().toLowerCase())
          .filter((email) => email.includes("@")),
      ),
    );
  }

  private async extrairDetalheResposta(resposta: Response): Promise<string> {
    try {
      const dados = this.comoObjeto(await this.lerJSONOuVazio(resposta));
      const detalhe = dados?.detail;
      if (typeof dados?.message === "string") {
        return dados.message;
      }
      if (typeof detalhe === "string") {
        return detalhe;
      }
      if (Array.isArray(detalhe) && detalhe.length > 0) {
        return JSON.stringify(detalhe[0]);
      }
    } catch {
      // Usa o status HTTP como fallback.
    }
    return `HTTP ${resposta.status}`;
  }

  private async lerJSONObrigatorio(
    resposta: Response,
    contexto: string,
  ): Promise<unknown> {
    const dados = await this.lerJSONOuVazio(resposta);
    if (!dados || typeof dados !== "object") {
      throw new Error(`O servidor retornou ${contexto} em formato inválido.`);
    }
    return dados;
  }

  private async lerJSONOuVazio(resposta: Response): Promise<unknown> {
    const texto = await resposta.text();
    if (!texto.trim()) {
      return {};
    }
    try {
      return JSON.parse(texto);
    } catch {
      return texto.trim();
    }
  }

  private comoObjeto(
    valor: unknown,
  ): Record<string, unknown> | undefined {
    return valor !== null && typeof valor === "object" && !Array.isArray(valor)
      ? (valor as Record<string, unknown>)
      : undefined;
  }

  private primeiroTexto(...valores: unknown[]): string {
    const valor = valores.find(
      (candidato): candidato is string =>
        typeof candidato === "string" && candidato.trim().length > 0,
    );
    return valor?.trim() ?? "";
  }

  private primeiroNumeroPositivo(...valores: unknown[]): number | undefined {
    for (const valor of valores) {
      const numero = typeof valor === "number" ? valor : Number(valor);
      if (Number.isFinite(numero) && numero > 0) {
        return numero;
      }
    }
    return undefined;
  }

  private lerBooleano(valor: string | null, padrao: boolean): boolean {
    if (valor === null || !valor.trim()) {
      return padrao;
    }
    return valor === "1" || valor.toLowerCase() === "true";
  }

  private lerUrlBaseApiAutenticacao(): string {
    const valor = vscode.workspace
      .getConfiguration("flexboxTrainer")
      .get<string>(
        "authApiBaseUrl",
        "https://frontendteamscup.com.br/api",
      )
      .trim();
    const url = this.validarUrlHttps(valor, "API de autenticação");
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/docs\/?$/, "").replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  }

  private validarUrlHttps(valor: string, contexto: string): URL {
    const url = new URL(valor);
    if (url.protocol !== "https:") {
      throw new Error(`A URL do ${contexto} precisa usar HTTPS.`);
    }
    if (url.username || url.password) {
      throw new Error(`A URL do ${contexto} não pode conter credenciais.`);
    }
    return url;
  }

  private async fetchComTimeout(
    url: string,
    opcoes: RequestInit,
    timeoutMs: number,
    contexto: string,
  ): Promise<Response> {
    const controlador = new AbortController();
    const timeout = setTimeout(() => controlador.abort(), timeoutMs);

    try {
      return await fetch(url, { ...opcoes, signal: controlador.signal });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `Tempo limite de ${Math.round(timeoutMs / 1000)} segundos ao ${contexto}.`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private definirEstado(estado: EstadoAutenticacao): void {
    this.estadoAtual = estado;
    this.estadoMudou.fire({ ...estado });
  }
}
