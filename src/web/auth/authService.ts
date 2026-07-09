// src/web/auth/authService.ts

import * as vscode from "vscode";
import { EstadoAutenticacao } from "../types";
import { SessaoAutenticacao, TokenManager } from "./tokenManager";

type ModoAutenticacao = "login" | "register";

type ResultadoUsuario = {
  id?: number;
  nome: string;
  email: string;
  tokenGmail: string;
};

type DadosCallbackAutenticacao = {
  email: string;
  nome?: string;
  tokenGmail?: string;
  remember?: boolean;
  userId?: number;
};

const DURACAO_SESSAO_PERSISTENTE_MS = 30 * 24 * 60 * 60 * 1000;

export class AuthService implements vscode.Disposable {
  private readonly tokenManager: TokenManager;
  private readonly estadoMudou = new vscode.EventEmitter<EstadoAutenticacao>();
  private estadoAtual: EstadoAutenticacao = { status: "checking", message: "Validando sessão..." };
  private sessaoAtual?: SessaoAutenticacao;

  public readonly onDidChangeEstado = this.estadoMudou.event;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.tokenManager = new TokenManager(context.secrets);
  }

  public dispose(): void {
    this.estadoMudou.dispose();
  }

  public getEstadoAtual(): EstadoAutenticacao {
    return { ...this.estadoAtual };
  }

  public getSessaoAtual(): SessaoAutenticacao | undefined {
    return this.sessaoAtual ? { ...this.sessaoAtual } : undefined;
  }

  public isAutenticado(): boolean {
    return this.estadoAtual.status === "authenticated";
  }

  public async inicializar(): Promise<void> {
    const sessao = await this.tokenManager.carregarSessao();
    if (!sessao || sessao.expiresAt <= Date.now()) {
      await this.encerrarSessao("Aguardando login.");
      return;
    }
    this.sessaoAtual = sessao;
    await this.validarSessaoComApi();
  }

  public async revalidarSessao(): Promise<void> {
    const sessao = await this.tokenManager.carregarSessao();
    if (!sessao) {
      this.definirEstado({
        status: "unauthenticated",
        message: "Você precisa fazer login para usar esta extensão.",
      });
      return;
    }
    this.sessaoAtual = sessao;
    this.definirEstado({ status: "checking", message: "Revalidando sua sessão..." });
    await this.validarSessaoComApi();
  }

  public async abrirFluxoAutenticacao(modo: ModoAutenticacao): Promise<void> {
    await this.abrirLoginGoogle(modo);
  }

  public async loginComProvedorVSCode(provedor: 'github' | 'microsoft'): Promise<void> {
    try {
      this.definirEstado({ status: "checking", message: `Conectando ao ${provedor}...` });

      const scopes = provedor === 'github' ? ['read:user', 'user:email'] : ['https://graph.microsoft.com/User.Read', 'email'];

      const session = await vscode.authentication.getSession(provedor, scopes, { createIfNone: true });
      if (!session) {
        throw new Error(`Cancelado.`);
      }

      const perfil = await this.buscarPerfilProvedor(provedor, session.accessToken, session.account.label);
      if (!perfil.email) {
        throw new Error("Não foi possível identificar o e-mail da conta.");
      }

      const usuarioDaApi = await this.buscarUsuarioPorEmail(perfil.email);
      if (!usuarioDaApi) {
        throw new Error("Conta não encontrada. Faça o cadastro com esse e-mail antes de tentar entrar.");
      }

      const usuario: ResultadoUsuario = {
        id: usuarioDaApi.id,
        nome: usuarioDaApi.nome || perfil.nome || session.account.label,
        email: usuarioDaApi.email,
        tokenGmail: usuarioDaApi.tokenGmail || provedor,
      };

      await this.salvarSessaoValidada(usuario, true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha.";
      this.definirEstado({ status: "error", message: msg });
      vscode.window.showErrorMessage(msg);
    }
  }

  public async abrirLoginGoogle(modo?: ModoAutenticacao): Promise<void> {
    const urlSite = vscode.workspace.getConfiguration("flexboxTrainer").get<string>("authSiteUrl", "").trim();
    if (!urlSite) {
      vscode.window.showErrorMessage("Configure a flexboxTrainer.authSiteUrl nas configurações para usar o login do Google.");
      return;
    }

    const callbackBase = vscode.Uri.parse(`${vscode.env.uriScheme}://${this.context.extension.id}/auth/callback`);
    const callbackExterno = await vscode.env.asExternalUri(callbackBase);

    const url = new URL(urlSite);
    url.searchParams.set("callback", callbackExterno.toString());
    url.searchParams.set("apiBaseUrl", this.lerUrlBaseApiAutenticacao());
    if (modo) {
      url.searchParams.set("mode", modo);
    }

    await vscode.env.openExternal(vscode.Uri.parse(url.toString()));
  }

  public async processarCallback(uri: vscode.Uri): Promise<void> {
    const parametros = new URLSearchParams(uri.query || uri.fragment);
    const dadosCallback = this.lerDadosCallback(parametros);
    const email = dadosCallback.email;

    if (!email) {
      throw new Error("Retorno inválido.");
    }

    const usuario =
      dadosCallback.nome && dadosCallback.tokenGmail
        ? {
            id: dadosCallback.userId,
            nome: dadosCallback.nome,
            email,
            tokenGmail: dadosCallback.tokenGmail,
          }
        : await this.buscarUsuarioPorEmail(email);

    if (!usuario) {
      throw new Error("Conta não encontrada.");
    }

    await this.salvarSessaoValidada(usuario, dadosCallback.remember ?? true);
  }

  private async salvarSessaoValidada(usuario: ResultadoUsuario, remember: boolean) {
    const sessao: SessaoAutenticacao = {
      accessToken:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `sessao-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      email: usuario.email,
      displayName: usuario.nome,
      tokenGmail: usuario.tokenGmail,
      userId: usuario.id,
      remember,
      authenticatedAt: Date.now(),
      expiresAt: Date.now() + DURACAO_SESSAO_PERSISTENTE_MS,
    };

    await this.tokenManager.salvarSessao(sessao);
    this.sessaoAtual = sessao;
    this.definirEstado({
      status: "authenticated", email: sessao.email, displayName: sessao.displayName,
      message: `Conectado como ${sessao.displayName}.`,
    });
  }

  public async logout(): Promise<void> { await this.encerrarSessao("Desconectado."); }

  private async encerrarSessao(mensagem: string): Promise<void> {
    await this.tokenManager.limparSessao();
    this.sessaoAtual = undefined;
    this.definirEstado({ status: "unauthenticated", message: mensagem });
  }

  private async validarSessaoComApi(): Promise<void> {
    if (!this.sessaoAtual) {
      return;
    }
    try {
      const usuario = await this.buscarUsuarioPorEmail(this.sessaoAtual.email);
      if (!usuario) {
        await this.encerrarSessao("Sua conta não foi encontrada.");
        return;
      }
      this.definirEstado({
        status: "authenticated", email: this.sessaoAtual.email, displayName: usuario.nome,
        message: `Conectado como ${usuario.nome}.`,
      });
    } catch {
      this.definirEstado({ status: "error", message: "Servidor offline, mas sessão mantida." });
    }
  }

  private async buscarUsuarioPorEmail(email: string): Promise<ResultadoUsuario | undefined> {
    const urlBase = this.lerUrlBaseApiAutenticacao();
    const url = new URL(`${urlBase}/usuarios/por-email`);
    url.searchParams.set("email", email);

    const res = await fetch(url.toString(), {
        method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });
    if (!res.ok) {
      if (res.status === 404) {
        return undefined;
      }
      throw new Error(`Falha API HTTP ${res.status}`);
    }
    const dados = await res.json() as any;
    return dados && dados.email
      ? {
          id: dados.id,
          nome: dados.nome || dados.name || dados.nome_completo || email,
          email: dados.email,
          tokenGmail: dados.token_gmail || dados.tokenGmail || "google",
        }
      : undefined;
  }

  private async buscarPerfilProvedor(provedor: 'github' | 'microsoft', accessToken: string, nomeFallback: string): Promise<{ email: string; nome: string }> {
    if (provedor === 'github') {
      return this.buscarPerfilGitHub(accessToken, nomeFallback);
    }

    return this.buscarPerfilMicrosoft(accessToken, nomeFallback);
  }

  private async buscarPerfilGitHub(accessToken: string, nomeFallback: string): Promise<{ email: string; nome: string }> {
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };

    const usuarioRes = await fetch("https://api.github.com/user", { headers });
    if (!usuarioRes.ok) {
      throw new Error(`Falha ao consultar GitHub: HTTP ${usuarioRes.status}`);
    }

    const usuario = await usuarioRes.json() as any;
    let email = String(usuario.email || "").trim();

    if (!email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", { headers });
      if (emailsRes.ok) {
        const emails = await emailsRes.json() as Array<{ email?: string; primary?: boolean; verified?: boolean }>;
        const principal = emails.find((item) => item.primary && item.verified && item.email);
        email = String(principal?.email || emails.find((item) => item.verified && item.email)?.email || "").trim();
      }
    }

    return {
      email,
      nome: String(usuario.name || usuario.login || usuario.email || nomeFallback || "GitHub").trim(),
    };
  }

  private async buscarPerfilMicrosoft(accessToken: string, nomeFallback: string): Promise<{ email: string; nome: string }> {
    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (res.ok) {
        const dados = await res.json() as any;
        const email = String(dados.mail || dados.userPrincipalName || "").trim();
        if (email) {
          return {
            email,
            nome: String(dados.displayName || dados.userPrincipalName || dados.mail || nomeFallback || "Microsoft").trim(),
          };
        }
      }
    } catch {
      // fallback abaixo
    }

    const emailFallback = this.extrairEmailDeTexto(nomeFallback);
    return {
      email: emailFallback,
      nome: String(nomeFallback || emailFallback || "Microsoft").trim(),
    };
  }

  private extrairEmailDeTexto(texto: string): string {
    const valor = String(texto || "").trim();
    const candidato = valor.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || valor;
    return candidato.includes("@") ? candidato.toLowerCase() : "";
  }

  private lerDadosCallback(parametros: URLSearchParams): DadosCallbackAutenticacao {
    const email = (parametros.get("email") || "").toLowerCase().trim();
    const nome = (parametros.get("nome") || parametros.get("displayName") || "").trim();
    const tokenGmail = (parametros.get("token_gmail") || parametros.get("tokenGmail") || "").trim();
    const remember = (parametros.get("remember") || "").trim();
    const userIdTexto = (parametros.get("userId") || parametros.get("id") || "").trim();

    return {
      email,
      nome: nome || undefined,
      tokenGmail: tokenGmail || undefined,
      remember: remember === "1" || remember.toLowerCase() === "true",
      userId: userIdTexto ? Number(userIdTexto) : undefined,
    };
  }

  private lerUrlBaseApiAutenticacao(): string {
    return vscode.workspace.getConfiguration("flexboxTrainer")
      .get<string>("authApiBaseUrl", "https://frontendteamscup.com.br/api")
      .trim()
      .replace(/\/docs\/?$/, "")
      .replace(/\/+$/, "");
  }

  private definirEstado(estado: EstadoAutenticacao): void {
    this.estadoAtual = estado;
    this.estadoMudou.fire({ ...estado });
  }
}