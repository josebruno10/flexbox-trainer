import * as vscode from "vscode";
import { EstadoAutenticacao } from "../types";
import { SessaoAutenticacao, TokenManager } from "./tokenManager";

type ModoAutenticacao = "login";

type PerfilServidor = {
  email: string;
  displayName: string;
  avatarUrl?: string;
  userId: number;
  teamId?: number;
};

type EstadoOAuthPendente = {
  valor: string;
  criadoEm: number;
};

const DURACAO_SESSAO_PADRAO_MS = 30 * 24 * 60 * 60 * 1000;
const DURACAO_ESTADO_OAUTH_MS = 10 * 60 * 1000;
const TIMEOUT_AUTENTICACAO_MS = 15_000;
const TIMEOUT_PERFIL_MS = 10_000;
const TIMEOUT_SITE_AUTENTICACAO_MS = 5_000;
const VERSAO_FLUXO_AUTENTICACAO = 2;

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

  public getSessaoAtual(): Omit<SessaoAutenticacao, "accessToken"> | undefined {
    if (!this.sessaoAtual) {
      return undefined;
    }

    return {
      email: this.sessaoAtual.email,
      displayName: this.sessaoAtual.displayName,
      avatarUrl: this.sessaoAtual.avatarUrl,
      userId: this.sessaoAtual.userId,
      teamId: this.sessaoAtual.teamId,
      remember: this.sessaoAtual.remember,
      authenticatedAt: this.sessaoAtual.authenticatedAt,
      expiresAt: this.sessaoAtual.expiresAt,
    };
  }

  public getAccessToken(): string | undefined {
    if (!this.isAutenticado() || !this.sessaoAtual) {
      return undefined;
    }

    return this.sessaoAtual.accessToken;
  }

  public isAutenticado(): boolean {
    return this.estadoAtual.status === "authenticated";
  }

  public async inicializar(): Promise<void> {
    try {
      const sessao = await this.tokenManager.carregarSessao();

      if (!sessao || !sessao.accessToken || sessao.expiresAt <= Date.now()) {
        await this.encerrarSessao("Aguardando login com Google.");
        return;
      }

      this.sessaoAtual = sessao;
      await this.validarSessaoComApi();
    } catch (error) {
      this.sessaoAtual = undefined;
      const detalhe = error instanceof Error ? error.message : "erro desconhecido";
      this.definirEstado({
        status: "error",
        message: `Não foi possível carregar sua sessão (${detalhe}).`,
      });
    }
  }

  public async revalidarSessao(): Promise<void> {
    const sessao = await this.tokenManager.carregarSessao();

    if (!sessao || !sessao.accessToken || sessao.expiresAt <= Date.now()) {
      await this.encerrarSessao(
        "Sua sessão expirou. Entre novamente com o Google.",
      );
      return;
    }

    this.sessaoAtual = sessao;
    this.definirEstado({
      status: "checking",
      message: "Revalidando sua sessão no servidor...",
    });
    await this.validarSessaoComApi();
  }

  public async abrirFluxoAutenticacao(modo: ModoAutenticacao): Promise<void> {
    await this.abrirLoginGoogle(modo);
  }

  public async abrirLoginGoogle(modo: ModoAutenticacao = "login"): Promise<void> {
    const urlSite = vscode.workspace
      .getConfiguration("flexboxTrainer")
      .get<string>("authSiteUrl", "")
      .trim();

    if (!urlSite) {
      throw new Error(
        "Configure flexboxTrainer.authSiteUrl para usar o login do Google.",
      );
    }

    const url = this.validarUrlHttps(urlSite, "site de autenticação");

    try {
      await this.validarSiteAutenticacao(url);
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível validar o site de login.";
      this.restaurarEstadoAposFalhaOAuth(mensagem, true);
      throw error;
    }

    const callbackBase = vscode.Uri.parse(
      `${vscode.env.uriScheme}://${this.context.extension.id}/auth/callback`,
    );
    const callbackExterno = await vscode.env.asExternalUri(callbackBase);
    const estado = this.criarEstadoOAuth();
    this.estadoOAuthPendente = { valor: estado, criadoEm: Date.now() };
    this.agendarExpiracaoEstadoOAuth(estado);

    url.searchParams.set("callback", callbackExterno.toString());
    url.searchParams.set("state", estado);
    url.searchParams.set("mode", modo);
    url.searchParams.set(
      "flowVersion",
      String(VERSAO_FLUXO_AUTENTICACAO),
    );

    const googleClientId = vscode.workspace
      .getConfiguration("flexboxTrainer")
      .get<string>("googleClientId", "")
      .trim();

    if (googleClientId) {
      url.searchParams.set("clientId", googleClientId);
    }

    this.definirEstado({
      status: "checking",
      message: "Aguardando a autenticação do Google...",
    });

    let abriu = false;

    try {
      abriu = await vscode.env.openExternal(vscode.Uri.parse(url.toString()));
    } catch (error) {
      this.limparEstadoOAuthPendente();
      this.restaurarEstadoAposFalhaOAuth(
        "Não foi possível abrir o login do Google.",
      );
      throw error;
    }

    if (!abriu) {
      this.limparEstadoOAuthPendente();
      this.restaurarEstadoAposFalhaOAuth(
        "Não foi possível abrir o login do Google.",
      );
      throw new Error("Não foi possível abrir o login do Google.");
    }
  }

  public async processarCallback(uri: vscode.Uri): Promise<void> {
    try {
      const parametros = new URLSearchParams(uri.query);

      for (const [chave, valor] of new URLSearchParams(uri.fragment)) {
        parametros.set(chave, valor);
      }

      const erroGoogle = (parametros.get("error") || "").trim();

      this.validarEConsumirEstadoOAuth(parametros.get("state") || "");

      if (erroGoogle) {
        throw new Error(`O Google recusou o login: ${erroGoogle}.`);
      }

      const tokenGoogle = (
        parametros.get("google_token") ||
        parametros.get("credential") ||
        parametros.get("id_token") ||
        ""
      ).trim();

      if (!tokenGoogle) {
        throw new Error(
          "O site de autenticação não devolveu o token do Google. Atualize o site auxiliar e tente novamente.",
        );
      }

      this.definirEstado({
        status: "checking",
        message: "Validando o token do Google no servidor...",
      });

      const respostaLogin = await this.trocarTokenGoogle(tokenGoogle);
      const accessToken = this.extrairAccessToken(respostaLogin);

      if (!accessToken) {
        throw new Error(
          "O servidor validou o Google, mas não retornou access_token.",
        );
      }

      const perfil = await this.buscarPerfilAutenticado(accessToken);
      const sessao: SessaoAutenticacao = {
        accessToken,
        email: perfil.email,
        displayName: perfil.displayName,
        avatarUrl: perfil.avatarUrl,
        userId: perfil.userId,
        teamId: perfil.teamId,
        remember: this.lerBooleano(parametros.get("remember"), true),
        authenticatedAt: Date.now(),
        expiresAt: this.extrairExpiracao(respostaLogin, accessToken),
      };

      await this.tokenManager.salvarSessao(sessao);
      this.sessaoAtual = sessao;
      this.publicarSessaoAutenticada(sessao);
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
    const accessToken = this.sessaoAtual?.accessToken;

    try {
      if (accessToken) {
        await this.fetchComTimeout(
          `${this.lerUrlBaseApiAutenticacao()}/logout`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          },
          TIMEOUT_PERFIL_MS,
          "encerrar a sessão",
        );
      }
    } catch {
      // O logout local precisa funcionar mesmo se o servidor estiver offline.
    } finally {
      await this.encerrarSessao("Desconectado.");
    }
  }

  public async invalidarSessao(mensagem: string): Promise<void> {
    await this.encerrarSessao(mensagem);
  }

  private async trocarTokenGoogle(tokenGoogle: string): Promise<unknown> {
    const resposta = await this.fetchComTimeout(
      `${this.lerUrlBaseApiAutenticacao()}/login`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "gmail",
          token: tokenGoogle,
        }),
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

    return this.lerJSONObrigatorio(resposta, "login");
  }

  private async buscarPerfilAutenticado(
    accessToken: string,
  ): Promise<PerfilServidor> {
    const resposta = await this.fetchComTimeout(
      `${this.lerUrlBaseApiAutenticacao()}/auth/me`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
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

    const dados = await this.lerJSONObrigatorio(resposta, "perfil autenticado");
    const perfil = this.extrairPerfil(dados);

    if (!perfil.userId) {
      throw new Error(
        "O servidor autenticou a conta, mas não informou o ID do usuário em /auth/me.",
      );
    }

    if (!perfil.teamId) {
      perfil.teamId = await this.buscarTimeDoUsuario(
        accessToken,
        perfil.userId,
      );
    }

    return perfil;
  }

  private async buscarTimeDoUsuario(
    accessToken: string,
    userId: number,
  ): Promise<number | undefined> {
    const resposta = await this.fetchComTimeout(
      `${this.lerUrlBaseApiAutenticacao()}/usuarios/${userId}/time`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
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

    const dados = await this.lerJSONObrigatorio(resposta, "equipe do usuário");
    return this.extrairTimeId(dados);
  }

  private async validarSessaoComApi(): Promise<void> {
    if (!this.sessaoAtual) {
      return;
    }

    try {
      const perfil = await this.buscarPerfilAutenticado(
        this.sessaoAtual.accessToken,
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
          "Sua sessão expirou. Entre novamente com o Google.",
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
      email: sessao.email || undefined,
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
      throw new Error("O login do Google expirou. Inicie o processo novamente.");
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
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
        "",
      );
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
        "O login do Google expirou. Inicie o processo novamente.",
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

  private restaurarEstadoAposFalhaOAuth(
    mensagem: string,
    comoErro = false,
  ): void {
    if (this.sessaoAtual && this.sessaoAtual.expiresAt > Date.now()) {
      this.publicarSessaoAutenticada(this.sessaoAtual);
      return;
    }

    this.definirEstado({
      status: comoErro ? "error" : "unauthenticated",
      message: mensagem,
    });
  }

  private async validarSiteAutenticacao(urlSite: URL): Promise<void> {
    const urlBase = new URL(urlSite.toString());
    urlBase.hash = "";
    urlBase.search = "";

    if (!urlBase.pathname.endsWith("/")) {
      const ultimoSegmento = urlBase.pathname.split("/").pop() || "";
      urlBase.pathname = ultimoSegmento.includes(".")
        ? urlBase.pathname.replace(/[^/]+$/, "")
        : `${urlBase.pathname}/`;
    }

    const urlManifesto = new URL("auth-flow.json", urlBase);
    let resposta: Response;

    try {
      resposta = await this.fetchComTimeout(
        urlManifesto.toString(),
        {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        },
        TIMEOUT_SITE_AUTENTICACAO_MS,
        "verificar a página de login",
      );
    } catch (error) {
      const detalhe =
        error instanceof Error ? error.message : "erro de rede desconhecido";
      throw new Error(
        `Não foi possível acessar a página de login (${detalhe}).`,
      );
    }

    if (!resposta.ok) {
      throw new Error(
        `A página de login publicada está desatualizada (auth-flow.json respondeu HTTP ${resposta.status}). Publique a versão atual da pasta auth-site.`,
      );
    }

    const dados = this.comoObjeto(
      await this.lerJSONObrigatorio(resposta, "manifesto de autenticação"),
    );

    if (
      dados?.protocolVersion !== VERSAO_FLUXO_AUTENTICACAO ||
      dados?.provider !== "google"
    ) {
      throw new Error(
        `A página de login usa um fluxo incompatível. A extensão exige a versão ${VERSAO_FLUXO_AUTENTICACAO} com Google.`,
      );
    }
  }

  private extrairAccessToken(dados: unknown): string | undefined {
    const objeto = this.comoObjeto(dados);
    const data = this.comoObjeto(objeto?.data);
    const tokens = this.comoObjeto(objeto?.tokens);
    const candidatos = [
      objeto?.access_token,
      objeto?.accessToken,
      data?.access_token,
      data?.accessToken,
      tokens?.access_token,
      tokens?.accessToken,
    ];

    return candidatos.find(
      (valor): valor is string =>
        typeof valor === "string" && valor.trim().length > 0,
    )?.trim();
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
    );
    const displayName =
      this.primeiroTexto(
        candidato.nome,
        candidato.name,
        candidato.display_name,
        candidato.displayName,
        candidato.nome_completo,
        email,
      ) || "Usuário Google";

    return {
      email,
      displayName,
      avatarUrl:
        this.primeiroTexto(
          candidato.url_image_perfil,
          candidato.avatar_url,
          candidato.avatarUrl,
          candidato.avatar,
          candidato.picture,
        ) || undefined,
      userId:
        this.primeiroNumeroPositivo(
          candidato.usuario_id,
          candidato.user_id,
          candidato.integrante_id,
          candidato.id,
        ) ?? 0,
      teamId: this.primeiroNumeroPositivo(
        candidato.time_id,
        candidato.team_id,
        candidato.equipe_id,
        time?.id,
      ),
    };
  }

  private extrairTimeId(dados: unknown): number | undefined {
    const raiz = Array.isArray(dados) ? this.comoObjeto(dados[0]) : this.comoObjeto(dados);
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

    if (!candidato) {
      return undefined;
    }

    return this.primeiroNumeroPositivo(
      candidato.time_id,
      candidato.team_id,
      candidato.equipe_id,
      candidato.id,
    );
  }

  private extrairExpiracao(dados: unknown, accessToken: string): number {
    const objeto = this.comoObjeto(dados) ?? {};
    const data = this.comoObjeto(objeto.data) ?? {};
    const expiresIn = this.primeiroNumeroPositivo(
      objeto.expires_in,
      objeto.expiresIn,
      data.expires_in,
      data.expiresIn,
    );

    if (expiresIn) {
      return Date.now() + expiresIn * 1000;
    }

    const expiresAt = this.converterInstante(
      objeto.expires_at ??
        objeto.expiresAt ??
        data.expires_at ??
        data.expiresAt,
    );

    if (expiresAt) {
      return expiresAt;
    }

    const expiracaoJwt = this.extrairExpiracaoJwt(accessToken);
    return expiracaoJwt ?? Date.now() + DURACAO_SESSAO_PADRAO_MS;
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

  private async extrairDetalheResposta(resposta: Response): Promise<string> {
    try {
      const dados = await this.lerJSONOuVazio(resposta);
      const objeto = this.comoObjeto(dados);
      const detalhe = objeto?.detail;

      if (typeof objeto?.message === "string") {
        return objeto.message;
      }

      if (typeof detalhe === "string") {
        return detalhe;
      }

      if (Array.isArray(detalhe) && detalhe.length > 0) {
        return JSON.stringify(detalhe[0]);
      }
    } catch {
      // Usa o status HTTP como fallback abaixo.
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
    const urlBase = vscode.workspace
      .getConfiguration("flexboxTrainer")
      .get<string>(
        "authApiBaseUrl",
        "https://frontendteamscup.com.br/api",
      )
      .trim();
    const url = this.validarUrlHttps(urlBase, "API de autenticação");
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
