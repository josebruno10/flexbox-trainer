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

  public async loginComProvedorVSCode(provedor: 'github' | 'microsoft'): Promise<void> {
    try {
      this.definirEstado({
        status: "checking",
        message: `Conectando à sua conta ${provedor === 'github' ? 'GitHub' : 'Microsoft'}...`,
      });

      const session = await vscode.authentication.getSession(
        provedor,
        provedor === 'github' ? ['user:email'] : ['profile', 'email', 'openid'],
        { createIfNone: true }
      );

      if (!session) {
        throw new Error(`Autenticação com ${provedor} cancelada.`);
      }

      let email = "";

      if (provedor === 'github') {
        try {
          const res = await fetch('https://api.github.com/user/emails', {
            headers: {
              Authorization: `token ${session.accessToken}`,
              'User-Agent': 'VSCode-FlexBox-Trainer'
            }
          });
          if (res.ok) {
            const emails = await res.json() as { email: string; primary: boolean }[];
            email = emails.find(e => e.primary)?.email || emails[0]?.email || "";
          }
        } catch (e) {
          console.error("Erro ao buscar email do GitHub:", e);
        }
      }

      if (!email || !email.includes('@')) {
        email = session.account.label;
      }

      if (!email || !email.includes('@')) {
        throw new Error(`Não conseguimos identificar o e-mail da sua conta ${provedor}.`);
      }

      email = email.toLowerCase().trim();

      this.definirEstado({
        status: "checking",
        message: "Procurando este e-mail no servidor do IFMS...",
      });

      const usuario = await this.buscarUsuarioPorEmail(email);

      if (!usuario) {
        throw new Error(`Conta não encontrada. Você precisa criar uma conta no site do FlexBox Trainer com o e-mail "${email}" antes de usar este atalho.`);
      }

      const sessaoAuth: SessaoAutenticacao = {
        accessToken: gerarIdSessao(),
        email: usuario.email,
        displayName: usuario.nome,
        tokenGmail: usuario.tokenGmail || "vscode-auth",
        userId: usuario.id,
        remember: true,
        authenticatedAt: Date.now(),
        expiresAt: Date.now() + DURACAO_SESSAO_PERSISTENTE_MS,
      };

      await this.tokenManager.salvarSessao(sessaoAuth);
      this.sessaoAtual = sessaoAuth;
      this.definirEstado({
        status: "authenticated",
        email: sessaoAuth.email,
        displayName: sessaoAuth.displayName,
        message: `Bem-vindo, ${sessaoAuth.displayName}. Conectado via ${provedor === 'github' ? 'GitHub' : 'Microsoft'}.`,
      });

      vscode.window.showInformationMessage(`Login automático concluído via ${provedor}!`);

    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha na autenticação nativa.";
      this.definirEstado({
        status: "error",
        message: msg,
      });
      vscode.window.showErrorMessage(msg);
    }
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
    const email = sanitizarTexto(parametros.get("email")).toLowerCase();
    const tokenGmail = sanitizarTexto(
      parametros.get("token_gmail") ?? parametros.get("tokenGmail") ?? parametros.get("senha"),
    );
    const nome = sanitizarTexto(
      parametros.get("nome") ?? parametros.get("name"),
    );
    const remember = lerBooleano(parametros.get("remember"));

    if (!email || !tokenGmail) {
      throw new Error(
        "O retorno da autenticação está incompleto. Tente fazer login novamente.",
      );
    }

    let usuario;
    let tentativas = 0;

    while (!usuario && tentativas < 6) {
      try {
        usuario = await this.buscarUsuarioPorEmail(email);
      } catch (error) {
        if (tentativas === 5) throw error;
      }
      if (!usuario) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      tentativas++;
    }

    if (!usuario) {
      throw new Error(
        "Sua conta foi criada, mas a API está demorando muito para responder. Por favor, clique em 'Fazer Login' e entre manualmente.",
      );
    }

    if (usuario.tokenGmail && usuario.tokenGmail !== tokenGmail) {
      throw new Error(
        "A credencial informada está incorreta ou inválida. Faça login novamente.",
      );
    }

    const sessao: SessaoAutenticacao = {
      accessToken: gerarIdSessao(),
      email: usuario.email,
      displayName: nome || usuario.nome,
      tokenGmail: tokenGmail,
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

      if (sessao.tokenGmail !== "vscode-auth" && usuario.tokenGmail && usuario.tokenGmail !== sessao.tokenGmail) {
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

  private async buscarUsuarioPorEmail(email: string): Promise<ResultadoUsuario | undefined> {
    const urlBase = this.lerUrlBaseApiAutenticacao();
    
    if (!urlBase) {
      throw new Error("A configuração 'flexboxTrainer.authApiBaseUrl' está vazia no VS Code.");
    }

    const url = new URL("/usuarios/por-email", urlBase);
    url.searchParams.set("email", email);
    url.searchParams.set("_t", Date.now().toString());

    let resposta: Response;

    try {
      resposta = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" }
      });
    } catch (error) {
      console.error("Erro de Fetch na Extensão:", error);
      throw new Error(`Falha de rede ao conectar com a API (${urlBase}). O servidor pode estar bloqueando (CORS).`);
    }

    if (!resposta.ok) {
      if (resposta.status === 404) {
        return undefined;
      }
      const detalhe = await extrairDetalheDeErro(resposta);
      throw new Error(`Falha na API do IFMS (HTTP ${resposta.status}): ${detalhe}`);
    }

    const dados = (await resposta.json()) as unknown;
    return normalizarUsuario(dados);
  }

  private lerUrlSiteAutenticacao(): string {
    return vscode.workspace.getConfiguration("flexboxTrainer").get<string>("authSiteUrl", "").trim();
  }

  private lerUrlBaseApiAutenticacao(): string {
    return vscode.workspace.getConfiguration("flexboxTrainer").get<string>("authApiBaseUrl", "http://ifms.pro.br:6009").trim().replace(/\/+$/, "");
  }

  private definirEstado(estado: EstadoAutenticacao): void {
    this.estadoAtual = estado;
    this.estadoMudou.fire({ ...estado });
  }
}

function normalizarUsuario(dados: unknown): ResultadoUsuario | undefined {
  const registro = extrairRegistro(dados);
  if (!registro) return undefined;

  const nome = sanitizarTexto(valorTexto(registro.nome) ?? valorTexto(registro.name) ?? valorTexto(registro.nome_completo));
  const email = sanitizarTexto(valorTexto(registro.email)).toLowerCase();
  const tokenGmail = sanitizarTexto(valorTexto(registro.token_gmail) ?? valorTexto(registro.tokenGmail));
  const id = valorNumero(registro.id) ?? valorNumero(registro.usuario_id) ?? valorNumero(registro.usuarioId);

  if (!nome || !email) return undefined;
  return { id, nome, email, tokenGmail };
}

function extrairRegistro(dados: unknown): Record<string, unknown> | undefined {
  if (!dados) return undefined;
  if (Array.isArray(dados)) {
    const primeiro = dados[0];
    return primeiro && typeof primeiro === "object" ? (primeiro as Record<string, unknown>) : undefined;
  }
  if (typeof dados === "object") return dados as Record<string, unknown>;
  return undefined;
}

function valorTexto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor.trim() : undefined;
}

function valorNumero(valor: unknown): number | undefined {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
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
  if (!valor) return false;
  return ["1", "true", "yes", "on"].includes(valor.toLowerCase());
}

function gerarIdSessao(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `sessao-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function extrairDetalheDeErro(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}`;
  try {
    const dados = (await response.json()) as { detail?: unknown; message?: string; };
    if (typeof dados.message === "string" && dados.message.trim()) return dados.message;
    if (typeof dados.detail === "string" && dados.detail.trim()) return dados.detail;
    if (Array.isArray(dados.detail) && dados.detail.length > 0) return JSON.stringify(dados.detail[0]);
    return fallback;
  } catch {
    return fallback;
  }
}