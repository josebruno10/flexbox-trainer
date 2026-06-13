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

  public dispose(): void { this.estadoMudou.dispose(); }
  
  public getEstadoAtual(): EstadoAutenticacao { return { ...this.estadoAtual }; }
  
  // ---> MÉTODO RESTAURADO AQUI <---
  public getSessaoAtual(): SessaoAutenticacao | undefined { 
    return this.sessaoAtual ? { ...this.sessaoAtual } : undefined; 
  }
  
  public isAutenticado(): boolean { return this.estadoAtual.status === "authenticated"; }

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
    await this.abrirLoginGoogle();
  }

  public async loginComProvedorVSCode(provedor: 'github' | 'microsoft'): Promise<void> {
    try {
      this.definirEstado({ status: "checking", message: `Conectando ao ${provedor}...` });
      const session = await vscode.authentication.getSession(
        provedor,
        provedor === 'github' ? ['user:email'] : ['profile', 'email', 'openid'],
        { createIfNone: true }
      );

      if (!session) throw new Error(`Cancelado.`);

      let email = "";
      if (provedor === 'github') {
        const res = await fetch('https://api.github.com/user/emails', { headers: { Authorization: `token ${session.accessToken}`, 'User-Agent': 'VSCode' } });
        if (res.ok) {
          const emails = await res.json() as { email: string; primary: boolean }[];
          email = emails.find(e => e.primary)?.email || emails[0]?.email || "";
        }
      }

      if (!email || !email.includes('@')) email = session.account.label;
      if (!email || !email.includes('@')) throw new Error("E-mail não identificado.");

      const usuario = await this.buscarUsuarioPorEmail(email.toLowerCase().trim());
      if (!usuario) throw new Error("Conta não encontrada na API do IFMS.");

      await this.salvarSessaoValidada(usuario, provedor);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha.";
      this.definirEstado({ status: "error", message: msg });
      vscode.window.showErrorMessage(msg);
    }
  }

  public async abrirLoginGoogle(): Promise<void> {
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
    
    await vscode.env.openExternal(vscode.Uri.parse(url.toString()));
  }

  public async processarCallback(uri: vscode.Uri): Promise<void> {
    const parametros = new URLSearchParams(uri.query || uri.fragment);
    const email = (parametros.get("email") || "").toLowerCase().trim();

    if (!email) throw new Error("Retorno inválido.");

    const usuario = await this.buscarUsuarioPorEmail(email);
    if (!usuario) throw new Error("Conta não encontrada no IFMS.");

    await this.salvarSessaoValidada(usuario, "google");
  }

  private async salvarSessaoValidada(usuario: ResultadoUsuario, authType: string) {
    const sessao: SessaoAutenticacao = {
      accessToken: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `sessao-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      email: usuario.email,
      displayName: usuario.nome,
      tokenGmail: authType, 
      userId: usuario.id,
      remember: true,
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
    if (!this.sessaoAtual) return;
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
    const url = new URL("/usuarios/por-email", urlBase);
    url.searchParams.set("email", email);

    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) {
      if (res.status === 404) return undefined;
      throw new Error(`Falha API HTTP ${res.status}`);
    }
    const dados = await res.json() as any;
    return dados && dados.email ? { id: dados.id, nome: dados.nome, email: dados.email, tokenGmail: dados.token_gmail } : undefined;
  }

  private lerUrlBaseApiAutenticacao(): string {
    return vscode.workspace.getConfiguration("flexboxTrainer").get<string>("authApiBaseUrl", "http://ifms.pro.br:6009").trim().replace(/\/+$/, "");
  }

  private definirEstado(estado: EstadoAutenticacao): void {
    this.estadoAtual = estado;
    this.estadoMudou.fire({ ...estado });
  }
}