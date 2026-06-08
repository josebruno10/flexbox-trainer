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
const DURACAO_SESSAO_TEMPORARIA_MS = 12 * 60 * 60 * 1000;

export class AuthService implements vscode.Disposable {
  private readonly tokenManager: TokenManager;

  private readonly estadoMudou = new vscode.EventEmitter<EstadoAutenticacao>();

  private estadoAtual: EstadoAutenticacao = {
    status: "checking",
    message: "Validando sessão...",
  };

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
    this.definirEstado({
      status: "checking",
      message: "Validando sua sessão no IFMS...",
    });

    const sessao = await this.tokenManager.carregarSessao();

    if (!sessao) {
      this.definirEstado({
        status: "unauthenticated",
        message:
          "Você precisa criar uma conta ou fazer login para usar esta extensão.",
      });
      return;
    }

    this.sessaoAtual = sessao;

    if (sessao.expiresAt <= Date.now()) {
      await this.encerrarSessao(
        "Sua sessão expirou. Faça login novamente para continuar.",
      );
      return;
    }

    await this.validarSessaoComApi();
  }

  public async revalidarSessao(): Promise<void> {
    const sessao = await this.tokenManager.carregarSessao();

    if (!sessao) {
      this.definirEstado({
        status: "unauthenticated",
        message:
          "Você precisa criar uma conta ou fazer login para usar esta extensão.",
      });
      return;
    }

    this.sessaoAtual = sessao;
    this.definirEstado({
      status: "checking",
      message: "Revalidando sua sessão...",
    });
    await this.validarSessaoComApi();
  }

  public async abrirFluxoAutenticacao(modo: ModoAutenticacao): Promise<void> {
    const urlSiteAutenticacao = this.lerUrlSiteAutenticacao();

    if (!urlSiteAutenticacao) {
      vscode.window.showErrorMessage(
        "Configure flexboxTrainer.authSiteUrl com a URL publicada do site de login.",
      );
      return;
    }

    const callbackBase = vscode.Uri.parse(
      `${vscode.env.uriScheme}://${this.context.extension.id}/auth/callback`,
    );
    const callbackExterno = await vscode.env.asExternalUri(callbackBase);
    const url = new URL(urlSiteAutenticacao);
    url.searchParams.set("mode", modo);
    url.searchParams.set("callback", callbackExterno.toString());
    url.searchParams.set("apiBaseUrl", this.lerUrlBaseApiAutenticacao());

    if (this.sessaoAtual?.email) {
      url.searchParams.set("email", this.sessaoAtual.email);
    }

    await vscode.env.openExternal(vscode.Uri.parse(url.toString()));
  }

  public async processarCallback(uri: vscode.Uri): Promise<void> {
    const parametros = new URLSearchParams(uri.query || uri.fragment);
    const email = sanitizarTexto(parametros.get("email"));
    const tokenGmail = email;
    const nome = sanitizarTexto(
      parametros.get("nome") ?? parametros.get("name"),
    );
    const remember = lerBooleano(parametros.get("remember"));

    if (!email) {
      throw new Error(
        "O retorno da autenticação está incompleto. Tente fazer login novamente.",
      );
    }

    const usuario = await this.buscarUsuarioPorEmail(email);

    if (!usuario) {
      throw new Error(
        "Não foi possível localizar sua conta na API do IFMS. Verifique seu cadastro.",
      );
    }

    const sessao: SessaoAutenticacao = {
      accessToken: gerarIdSessao(),
      email: usuario.email,
      displayName: nome || usuario.nome,
      tokenGmail: usuario.tokenGmail,
      userId: usuario.id,
      remember,
      authenticatedAt: Date.now(),
      expiresAt:
        Date.now() +
        (remember
          ? DURACAO_SESSAO_PERSISTENTE_MS
          : DURACAO_SESSAO_TEMPORARIA_MS),
    };

    await this.tokenManager.salvarSessao(sessao);
    this.sessaoAtual = sessao;
    this.definirEstado({
      status: "authenticated",
      email: sessao.email,
      displayName: sessao.displayName,
      message: `Bem-vindo, ${sessao.displayName}.`,
    });
  }

  public async logout(): Promise<void> {
    await this.encerrarSessao(
      "Você saiu da extensão. Faça login para continuar.",
    );
  }

  private async encerrarSessao(mensagem: string): Promise<void> {
    await this.tokenManager.limparSessao();
    this.sessaoAtual = undefined;
    this.definirEstado({
      status: "unauthenticated",
      message: mensagem,
    });
  }

  private async validarSessaoComApi(): Promise<void> {
    const sessao = this.sessaoAtual;

    if (!sessao) {
      this.definirEstado({
        status: "unauthenticated",
        message:
          "Você precisa criar uma conta ou fazer login para usar esta extensão.",
      });
      return;
    }

    try {
      const usuario = await this.buscarUsuarioPorEmail(sessao.email);

      if (!usuario) {
        await this.encerrarSessao(
          "Sua conta não foi encontrada na API do IFMS. Faça login novamente.",
        );
        return;
      }

      if (usuario.tokenGmail !== sessao.tokenGmail) {
        await this.encerrarSessao(
          "Sua sessão não é mais válida. Faça login novamente.",
        );
        return;
      }

      const sessaoValidada: SessaoAutenticacao = {
        ...sessao,
        displayName: usuario.nome,
        userId: usuario.id,
        expiresAt:
          Date.now() +
          (sessao.remember
            ? DURACAO_SESSAO_PERSISTENTE_MS
            : DURACAO_SESSAO_TEMPORARIA_MS),
      };

      this.sessaoAtual = sessaoValidada;
      await this.tokenManager.salvarSessao(sessaoValidada);
      this.definirEstado({
        status: "authenticated",
        email: sessaoValidada.email,
        displayName: sessaoValidada.displayName,
        message: `Bem-vindo, ${sessaoValidada.displayName}.`,
      });
    } catch (error) {
      this.definirEstado({
        status: "error",
        email: sessao.email,
        displayName: sessao.displayName,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível validar sua sessão agora.",
      });
    }
  }

  private async buscarUsuarioPorEmail(
    email: string,
  ): Promise<ResultadoUsuario | undefined> {
    const url = new URL(
      "/usuarios/por-email",
      this.lerUrlBaseApiAutenticacao(),
    );
    url.searchParams.set("email", email);

    const resposta = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!resposta.ok) {
      if (resposta.status === 404) {
        return undefined;
      }

      const detalhe = await extrairDetalheDeErro(resposta);
      throw new Error(`Falha ao consultar usuário no IFMS: ${detalhe}`);
    }

    const dados = (await resposta.json()) as unknown;
    return normalizarUsuario(dados);
  }

  private lerUrlSiteAutenticacao(): string {
    return vscode.workspace
      .getConfiguration("flexboxTrainer")
      .get<string>("authSiteUrl", "")
      .trim();
  }

  private lerUrlBaseApiAutenticacao(): string {
    return vscode.workspace
      .getConfiguration("flexboxTrainer")
      .get<string>("authApiBaseUrl", "https://ifms.pro.br:6005")
      .trim()
      .replace(/\/+$/, "");
  }

  private definirEstado(estado: EstadoAutenticacao): void {
    this.estadoAtual = estado;
    this.estadoMudou.fire({ ...estado });
  }
}

function normalizarUsuario(dados: unknown): ResultadoUsuario | undefined {
  const registro = extrairRegistro(dados);

  if (!registro) {
    return undefined;
  }

  const nome = sanitizarTexto(
    valorTexto(registro.nome) ??
      valorTexto(registro.name) ??
      valorTexto(registro.nome_completo),
  );
  const email = sanitizarTexto(valorTexto(registro.email));
  const tokenGmail = email;
  const id =
    valorNumero(registro.id) ??
    valorNumero(registro.usuario_id) ??
    valorNumero(registro.usuarioId);

  if (!nome || !email || !tokenGmail) {
    return undefined;
  }

  return {
    id,
    nome,
    email,
    tokenGmail,
  };
}

function extrairRegistro(dados: unknown): Record<string, unknown> | undefined {
  if (!dados) {
    return undefined;
  }

  if (Array.isArray(dados)) {
    const primeiro = dados[0];
    return primeiro && typeof primeiro === "object"
      ? (primeiro as Record<string, unknown>)
      : undefined;
  }

  if (typeof dados === "object") {
    return dados as Record<string, unknown>;
  }

  return undefined;
}

function valorTexto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor.trim() : undefined;
}

function valorNumero(valor: unknown): number | undefined {
  if (typeof valor === "number" && Number.isFinite(valor)) {
    return valor;
  }

  if (typeof valor === "string") {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : undefined;
  }

  return undefined;
}

function sanitizarTexto(valor: string | null | undefined): string {
  return valor ? valor.trim() : "";
}

function lerBooleano(valor: string | null | undefined): boolean {
  if (!valor) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(valor.toLowerCase());
}

function gerarIdSessao(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `sessao-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function extrairDetalheDeErro(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}`;

  try {
    const dados = (await response.json()) as {
      detail?: unknown;
      message?: string;
    };

    if (typeof dados.message === "string" && dados.message.trim()) {
      return dados.message;
    }

    if (typeof dados.detail === "string" && dados.detail.trim()) {
      return dados.detail;
    }

    if (Array.isArray(dados.detail) && dados.detail.length > 0) {
      return JSON.stringify(dados.detail[0]);
    }

    return fallback;
  } catch {
    return fallback;
  }
}