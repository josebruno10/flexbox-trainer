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
  provider?: string;
  providerToken?: string;
  serverToken?: string;
  remember?: boolean;
};

type ResultadoTrocaLogin = {
  serverToken: string;
  email?: string;
  nome?: string;
  userId?: number;
};

type PerfilProvedor = {
  emails: string[];
  nome: string;
};

const DURACAO_SESSAO_PERSISTENTE_MS = 30 * 24 * 60 * 60 * 1000;
const PROVEDORES_SUPORTADOS = new Set(["gmail", "github", "microsoft"]);

class ErroSessaoInvalida extends Error {}

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
    if (!sessao || !sessao.serverToken || sessao.expiresAt <= Date.now()) {
      await this.encerrarSessao("Aguardando login.");
      return;
    }
    this.sessaoAtual = sessao;
    await this.validarSessaoComApi();
  }

  public async revalidarSessao(): Promise<void> {
    const sessao = await this.tokenManager.carregarSessao();
    if (!sessao || !sessao.serverToken) {
      await this.tokenManager.limparSessao();
      this.definirEstado({
        status: "unauthenticated",
        message: "Sua sessão não possui um token válido. Faça login novamente.",
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

      const resultadoTroca = await this.trocarTokenProvedorPorTokenServidor(
        provedor,
        session.accessToken,
      );

      const perfil = await this.buscarPerfilProvedor(
        provedor,
        session.accessToken,
        session.account.label,
      );

      const emails = this.normalizarEmails([
        resultadoTroca.email || "",
        ...perfil.emails,
      ]);

      if (emails.length === 0) {
        throw new Error("Não foi possível identificar o e-mail da conta.");
      }

      const usuarioDaApi = await this.buscarPrimeiroUsuarioCadastrado(
        emails,
        resultadoTroca.serverToken,
        provedor,
      );

      const usuarioAutenticado = usuarioDaApi
        ?? await this.cadastrarUsuarioAutomaticamente(
          {
            emails,
            nome: resultadoTroca.nome || perfil.nome,
          },
          provedor,
          resultadoTroca.serverToken,
        );

      if (!usuarioAutenticado) {
        const emailsTentados = emails.join(", ");
        throw new Error(
          `Não foi possível localizar nem cadastrar a conta para o(s) e-mail(s): ${emailsTentados}.`,
        );
      }

      const usuario: ResultadoUsuario = {
        id: usuarioAutenticado.id,
        nome: usuarioAutenticado.nome || perfil.nome || session.account.label,
        email: usuarioAutenticado.email,
        tokenGmail: usuarioAutenticado.tokenGmail || provedor,
      };

      await this.salvarSessaoValidada(
        usuario,
        true,
        resultadoTroca.serverToken,
      );
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
    const googleClientId = vscode.workspace
      .getConfiguration("flexboxTrainer")
      .get<string>("googleClientId", "")
      .trim();
    if (googleClientId) {
      url.searchParams.set("googleClientId", googleClientId);
    }
    if (modo) {
      url.searchParams.set("mode", modo);
    }

    await vscode.env.openExternal(vscode.Uri.parse(url.toString()));
  }

  public async processarCallback(uri: vscode.Uri): Promise<void> {
    const parametros = this.lerParametrosCallback(uri);
    const dadosCallback = this.lerDadosCallback(parametros);

    if (dadosCallback.serverToken) {
      const provider = dadosCallback.provider === "google"
        ? "gmail"
        : dadosCallback.provider || "gmail";
      const usuario = await this.buscarUsuarioAutenticado(
        dadosCallback.serverToken,
        provider,
      );

      await this.salvarSessaoValidada(
        usuario,
        dadosCallback.remember ?? true,
        dadosCallback.serverToken,
      );
      return;
    }

    if (!dadosCallback.provider || !dadosCallback.providerToken) {
      throw new Error("Retorno inválido: token do provedor não informado.");
    }

    const resultadoTroca = await this.trocarTokenProvedorPorTokenServidor(
      dadosCallback.provider,
      dadosCallback.providerToken,
    );
    const tokenServidor = resultadoTroca.serverToken;
    const identidadeGoogle =
      dadosCallback.provider === "gmail" || dadosCallback.provider === "google"
        ? this.extrairIdentidadeTokenJwt(dadosCallback.providerToken)
        : undefined;
    const email = resultadoTroca.email || identidadeGoogle?.email;

    if (!email) {
      throw new Error("Retorno inválido: e-mail não informado pelo provedor.");
    }

    const providerNormalizado = dadosCallback.provider === "google"
      ? "gmail"
      : dadosCallback.provider;
    const usuarioDaApi = await this.buscarUsuarioPorEmail(
      email,
      tokenServidor,
      providerNormalizado,
    );
    const usuario = usuarioDaApi || {
      id: resultadoTroca.userId,
      nome: resultadoTroca.nome || identidadeGoogle?.nome || email,
      email,
      tokenGmail: providerNormalizado,
    };

    if (!usuario) {
      throw new Error("Conta não encontrada.");
    }

    await this.salvarSessaoValidada(
      usuario,
      dadosCallback.remember ?? true,
      tokenServidor,
    );
  }

  private async salvarSessaoValidada(
    usuario: ResultadoUsuario,
    remember: boolean,
    tokenServidor: string,
  ) {
    const sessao: SessaoAutenticacao = {
      accessToken: tokenServidor,
      serverToken: tokenServidor,
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
      const usuario = await this.buscarUsuarioPorEmail(
        this.sessaoAtual.email,
        this.sessaoAtual.serverToken,
        PROVEDORES_SUPORTADOS.has(this.sessaoAtual.tokenGmail)
          ? this.sessaoAtual.tokenGmail
          : "gmail",
      );
      if (!usuario) {
        await this.encerrarSessao("Sua conta não foi encontrada.");
        return;
      }
      this.definirEstado({
        status: "authenticated", email: this.sessaoAtual.email, displayName: usuario.nome,
        message: `Conectado como ${usuario.nome}.`,
      });
    } catch (erro) {
      if (erro instanceof ErroSessaoInvalida) {
        await this.encerrarSessao("Sua sessão expirou. Faça login novamente.");
        return;
      }

      this.definirEstado({ status: "error", message: "Servidor offline, mas sessão mantida." });
    }
  }

  private async buscarUsuarioPorEmail(
    email: string,
    bearerToken: string,
    provider = "gmail",
  ): Promise<ResultadoUsuario | undefined> {
    const urlBase = this.lerUrlBaseApiAutenticacao();
    const url = new URL(`${urlBase}/usuarios/por-email`);
    url.searchParams.set("email", email);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...this.criarCabecalhoAutorizacao(bearerToken),
      },
    });
    if (!res.ok) {
      if (res.status === 404) {
        return undefined;
      }
      if (res.status === 401 || res.status === 403) {
        throw new ErroSessaoInvalida(`Sessão rejeitada pela API (HTTP ${res.status}).`);
      }
      throw new Error(`Falha API HTTP ${res.status}`);
    }
    const dados = await res.json() as any;
    return dados && dados.email
      ? {
          id: dados.id,
          nome: dados.nome || dados.name || dados.nome_completo || email,
          email: dados.email,
          tokenGmail: provider,
        }
      : undefined;
  }

  private async buscarUsuarioAutenticado(
    bearerToken: string,
    provider: string,
  ): Promise<ResultadoUsuario> {
    const urlBase = this.lerUrlBaseApiAutenticacao();
    let resposta: Response;

    try {
      resposta = await fetch(`${urlBase}/auth/me`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...this.criarCabecalhoAutorizacao(bearerToken),
        },
      });
    } catch (erro) {
      const detalhe = erro instanceof Error ? erro.message : "Erro de rede";
      throw new Error(
        `Falha de rede ao consultar ${urlBase}/auth/me: ${detalhe}.`,
      );
    }

    if (!resposta.ok) {
      if (resposta.status === 401 || resposta.status === 403) {
        throw new ErroSessaoInvalida(
          `Token do sistema rejeitado pela API (HTTP ${resposta.status}).`,
        );
      }

      const detalhe = await this.extrairDetalheResposta(resposta);
      throw new Error(
        `Falha ao consultar a sessão autenticada (HTTP ${resposta.status}): ${detalhe}`,
      );
    }

    const dados = await this.lerJSONOuVazio(resposta) as any;
    const registros = [
      dados?.user,
      dados?.usuario,
      dados?.data?.user,
      dados?.data?.usuario,
      dados?.data,
      dados?.claims,
      dados,
    ];
    const registro = registros.find((item) => {
      const email = item?.email || item?.preferred_username || item?.upn;
      return typeof email === "string" && email.trim().length > 0;
    });
    const identidadeToken = this.extrairIdentidadeTokenJwt(bearerToken);
    const emailBruto =
      registro?.email ||
      registro?.preferred_username ||
      registro?.upn ||
      identidadeToken?.email;
    const email = typeof emailBruto === "string"
      ? emailBruto.toLowerCase().trim()
      : undefined;

    if (!email) {
      throw new Error("A API /auth/me não retornou o e-mail do usuário.");
    }

    const idBruto =
      registro?.id ??
      registro?.userId ??
      registro?.user_id ??
      registro?.usuario_id;
    const id = Number(idBruto);

    return {
      id: Number.isFinite(id) ? id : undefined,
      nome: String(
        registro?.nome ||
        registro?.name ||
        registro?.displayName ||
        identidadeToken?.nome ||
        email,
      ).trim(),
      email,
      tokenGmail: provider,
    };
  }

  private async buscarPrimeiroUsuarioCadastrado(
    emails: string[],
    bearerToken: string,
    provider: string,
  ): Promise<ResultadoUsuario | undefined> {
    for (const email of emails) {
      const usuario = await this.buscarUsuarioPorEmail(
        email,
        bearerToken,
        provider,
      );

      if (usuario) {
        return usuario;
      }
    }

    return undefined;
  }

  private async cadastrarUsuarioAutomaticamente(
    perfil: PerfilProvedor,
    provedor: 'github' | 'microsoft',
    bearerToken: string,
  ): Promise<ResultadoUsuario | undefined> {
    const emailPrincipal = perfil.emails[0];

    if (!emailPrincipal) {
      return undefined;
    }

    const urlBase = this.lerUrlBaseApiAutenticacao();
    const resposta = await fetch(`${urlBase}/usuarios`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        ...this.criarCabecalhoAutorizacao(bearerToken),
      },
      body: new URLSearchParams({
        nome: perfil.nome,
        email: emailPrincipal,
        token_gmail: provedor,
      }).toString(),
    });

    if (!resposta.ok) {
      if (resposta.status === 409) {
        return this.buscarPrimeiroUsuarioCadastrado(
          perfil.emails,
          bearerToken,
          provedor,
        );
      }

      const detalhe = await this.extrairDetalheResposta(resposta);
      throw new Error(`Falha ao cadastrar usuário automaticamente (HTTP ${resposta.status}): ${detalhe}`);
    }

    const dados = await this.lerJSONOuVazio(resposta) as any;

    return {
      id: dados?.id,
      nome: dados?.nome || dados?.name || perfil.nome,
      email: dados?.email || emailPrincipal,
      tokenGmail: provedor,
    };
  }

  private async buscarPerfilProvedor(
    provedor: 'github' | 'microsoft',
    accessToken: string,
    nomeFallback: string,
  ): Promise<PerfilProvedor> {
    if (provedor === 'github') {
      return this.buscarPerfilGitHub(accessToken, nomeFallback);
    }

    return this.buscarPerfilMicrosoft(accessToken, nomeFallback);
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

    const usuarioRes = await fetch("https://api.github.com/user", { headers });
    if (!usuarioRes.ok) {
      throw new Error(`Falha ao consultar GitHub: HTTP ${usuarioRes.status}`);
    }

    const usuario = await usuarioRes.json() as any;
    const emails: string[] = [String(usuario.email || "").trim()];

    const emailsRes = await fetch("https://api.github.com/user/emails", { headers });
    if (emailsRes.ok) {
      const dadosEmails = await emailsRes.json() as Array<{
        email?: string;
        primary?: boolean;
        verified?: boolean;
      }>;

      const principal = dadosEmails.find(
        (item) => item.primary && item.verified && item.email,
      );
      emails.push(String(principal?.email || "").trim());

      dadosEmails
        .filter((item) => item.verified && item.email)
        .forEach((item) => {
          emails.push(String(item.email || "").trim());
        });
    }

    return {
      emails: this.normalizarEmails(emails),
      nome: String(usuario.name || usuario.login || usuario.email || nomeFallback || "GitHub").trim(),
    };
  }

  private async buscarPerfilMicrosoft(
    accessToken: string,
    nomeFallback: string,
  ): Promise<PerfilProvedor> {
    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (res.ok) {
        const dados = await res.json() as any;
        const emails = this.normalizarEmails([
          String(dados.mail || "").trim(),
          String(dados.userPrincipalName || "").trim(),
          this.extrairEmailDeTexto(nomeFallback),
        ]);

        return {
          emails,
          nome: String(dados.displayName || dados.userPrincipalName || dados.mail || nomeFallback || "Microsoft").trim(),
        };
      }
    } catch {
      // fallback abaixo
    }

    const emailFallback = this.extrairEmailDeTexto(nomeFallback);
    return {
      emails: this.normalizarEmails([emailFallback]),
      nome: String(nomeFallback || emailFallback || "Microsoft").trim(),
    };
  }

  private extrairEmailDeTexto(texto: string): string {
    const valor = String(texto || "").trim();
    const candidato = valor.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || valor;
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

  private lerDadosCallback(parametros: URLSearchParams): DadosCallbackAutenticacao {
    const provider = (parametros.get("provider") || parametros.get("provedor") || "").toLowerCase().trim();
    const providerToken = (parametros.get("token") || parametros.get("provider_token") || "").trim();
    const serverToken = (parametros.get("server_token") || parametros.get("serverToken") || "").trim();
    const remember = (parametros.get("remember") || "").trim();

    return {
      provider: provider || undefined,
      providerToken: providerToken || undefined,
      serverToken: serverToken || undefined,
      remember: remember
        ? remember === "1" || remember.toLowerCase() === "true"
        : undefined,
    };
  }

  private lerParametrosCallback(uri: vscode.Uri): URLSearchParams {
    const parametros = new URLSearchParams(uri.query);
    const fragmento = new URLSearchParams(uri.fragment);

    fragmento.forEach((valor, chave) => {
      parametros.set(chave, valor);
    });

    return parametros;
  }

  private extrairIdentidadeTokenJwt(
    token: string,
  ): { email?: string; nome?: string } | undefined {
    try {
      const payloadBase64Url = token.split(".")[1];
      if (!payloadBase64Url) {
        return undefined;
      }

      const payloadBase64 = payloadBase64Url
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const payloadComPadding = payloadBase64.padEnd(
        Math.ceil(payloadBase64.length / 4) * 4,
        "=",
      );
      const payload = JSON.parse(atob(payloadComPadding)) as {
        email?: unknown;
        name?: unknown;
        given_name?: unknown;
      };
      const email = typeof payload.email === "string"
        ? payload.email.toLowerCase().trim()
        : undefined;
      const nomeBruto = payload.name || payload.given_name;
      const nome = typeof nomeBruto === "string" ? nomeBruto.trim() : undefined;

      return { email, nome };
    } catch {
      return undefined;
    }
  }

  private async trocarTokenProvedorPorTokenServidor(
    provider: string,
    providerToken: string,
  ): Promise<ResultadoTrocaLogin> {
    const urlBase = this.lerUrlBaseApiAutenticacao();
    const providerNormalizado = provider === "google" ? "gmail" : provider;

    if (!PROVEDORES_SUPORTADOS.has(providerNormalizado)) {
      throw new Error(`Provedor de autenticação não suportado: ${provider}.`);
    }

    let resposta: Response;

    try {
      resposta = await fetch(`${urlBase}/login`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: providerNormalizado,
          token: providerToken,
        }),
      });
    } catch (erro) {
      const detalhe = erro instanceof Error ? erro.message : "Erro de rede";
      throw new Error(
        `Falha de rede ao chamar ${urlBase}/login: ${detalhe}. Verifique a configuração flexboxTrainer.authApiBaseUrl, conexão com internet e bloqueios de firewall/proxy.`,
      );
    }

    if (!resposta.ok) {
      const detalhe = await this.extrairDetalheResposta(resposta);
      throw new Error(
        `Falha ao validar login com ${providerNormalizado} (HTTP ${resposta.status}): ${detalhe}`,
      );
    }

    const dados = await this.lerJSONOuVazio(resposta) as any;
    const tokenServidor = this.extrairTokenServidor(dados);

    if (!tokenServidor) {
      throw new Error("A API de login não retornou token de acesso.");
    }

    return {
      serverToken: tokenServidor,
      email: this.extrairEmailRetornoLogin(dados),
      nome: this.extrairNomeRetornoLogin(dados),
      userId: this.extrairUserIdRetornoLogin(dados),
    };
  }

  private extrairEmailRetornoLogin(dados: any): string | undefined {
    const candidatos = [
      dados?.email,
      dados?.user?.email,
      dados?.usuario?.email,
      dados?.data?.email,
      dados?.data?.user?.email,
    ];

    const email = candidatos.find(
      (valor): valor is string =>
        typeof valor === "string" && valor.trim().length > 0,
    );

    return email?.toLowerCase().trim();
  }

  private extrairNomeRetornoLogin(dados: any): string | undefined {
    const candidatos = [
      dados?.nome,
      dados?.name,
      dados?.user?.nome,
      dados?.user?.name,
      dados?.usuario?.nome,
      dados?.usuario?.name,
      dados?.data?.nome,
      dados?.data?.name,
    ];

    return candidatos.find(
      (valor): valor is string =>
        typeof valor === "string" && valor.trim().length > 0,
    )?.trim();
  }

  private extrairUserIdRetornoLogin(dados: any): number | undefined {
    const candidatos = [
      dados?.userId,
      dados?.user_id,
      dados?.id,
      dados?.user?.id,
      dados?.usuario?.id,
      dados?.data?.userId,
      dados?.data?.id,
    ];

    const id = candidatos.find(
      (valor): valor is number | string =>
        (typeof valor === "number" && Number.isFinite(valor)) ||
        (typeof valor === "string" && valor.trim().length > 0),
    );

    if (typeof id === "number") {
      return Number.isFinite(id) ? id : undefined;
    }

    const convertido = Number(id);
    return Number.isFinite(convertido) ? convertido : undefined;
  }

  private extrairTokenServidor(dados: any): string | undefined {
    const candidatos = [
      dados?.access_token,
      dados?.accessToken,
      dados?.token,
      dados?.jwt,
      dados?.bearerToken,
      dados?.data?.access_token,
      dados?.data?.accessToken,
      dados?.data?.token,
      dados?.auth?.token,
      dados?.session?.token,
    ];

    return candidatos.find(
      (valor): valor is string =>
        typeof valor === "string" && valor.trim().length > 0,
    );
  }

  private criarCabecalhoAutorizacao(
    bearerToken?: string,
  ): Record<string, string> {
    const token = bearerToken || this.sessaoAtual?.serverToken;

    if (!token) {
      return {};
    }

    return { Authorization: `Bearer ${token}` };
  }

  private async extrairDetalheResposta(resposta: Response): Promise<string> {
    try {
      const dados = await this.lerJSONOuVazio(resposta) as any;
      return dados?.message || dados?.detail || `HTTP ${resposta.status}`;
    } catch {
      return `HTTP ${resposta.status}`;
    }
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
