import * as vscode from "vscode";
import { log } from "../services/logger";
import { EstadoAutenticacao } from "../types";
import {
  ProvedorAutenticacao,
  buscarPerfilAutenticado,
  encerrarNoServidor,
  trocarTokenProvedorPorTokenServidor,
} from "./apiTorneio";
import { EstadoOAuth } from "./estadoOAuth";
import { ErroApiAutenticacao, validarUrlHttps } from "./http";
import { lerBooleano } from "./leitura";
import {
  abrirNoNavegador,
  abrirRetornoLocalSePuder,
  montarEnderecoDoSite,
  prepararVolta,
} from "./loginPeloSite";
import {
  ProvedorVSCode,
  buscarPerfilProvedor,
  obterSessaoProvedor,
} from "./perfilProvedor";
import { PerfilServidor, extrairExpiracao } from "./respostasServidor";
import {
  RetornoDoSite,
  lerParametrosCallback,
  loginDoRetorno,
} from "./retornoDoSite";
import type { ResultadoDoLogin, RetornoLocal } from "./retornoLocal";
import { SessaoAutenticacao, TokenManager } from "./tokenManager";

export type { ResultadoDoLogin } from "./retornoLocal";

export type OpcoesAuthService = {
  // O servidor local que recebe o login com Google no desktop; os testes
  // trocam por outro, ou por nenhum, para testar a volta pelo vscode://.
  abrirRetornoLocal?: () => Promise<RetornoLocal | undefined>;
};

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
  private readonly abrirRetornoLocal: () => Promise<RetornoLocal | undefined>;
  // O servidor que espera o navegador voltar do login com Google.
  private retornoLocal?: RetornoLocal;
  private readonly voltaDoNavegador = new vscode.EventEmitter<ResultadoDoLogin>();

  public readonly onDidChangeEstado = this.estadoMudou.event;
  /** O login com Google voltou do navegador pelo servidor local. */
  public readonly onDidVoltarDoNavegador = this.voltaDoNavegador.event;

  public constructor(
    private readonly context: vscode.ExtensionContext,
    opcoes: OpcoesAuthService = {},
  ) {
    this.tokenManager = new TokenManager(context.secrets);
    this.abrirRetornoLocal = opcoes.abrirRetornoLocal ?? abrirRetornoLocalSePuder;
  }

  public dispose(): void {
    this.estadoOAuth.limpar();
    this.retornoLocal?.fechar();
    this.estadoMudou.dispose();
    this.voltaDoNavegador.dispose();
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
        // O comando de login também liga a extensão: um login que começou
        // enquanto a sessão era lida continua esperando o navegador.
        if (this.estadoOAuth.emAndamento()) {
          await this.tokenManager.limparSessao();
          return;
        }
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
    const { callback, retornoLocal } = await prepararVolta(
      this.context.extension.id,
      this.abrirRetornoLocal,
    );
    // Um login novo substitui o que ainda esperava o navegador, inclusive o
    // de um segundo clique enquanto este se preparava.
    this.retornoLocal?.fechar();
    this.retornoLocal = retornoLocal;
    const estado = this.estadoOAuth.criar(() => {
      retornoLocal?.fechar();
      this.restaurarEstadoAposFalhaOAuth(
        "O login expirou. Inicie o processo novamente.",
      );
    });
    montarEnderecoDoSite(url, {
      callback,
      estado,
      googleClientId: configuracao.get<string>("googleClientId", "").trim(),
    });

    this.definirEstado({
      status: "checking",
      message: "Aguardando o Google…",
    });

    try {
      if (!(await abrirNoNavegador(url, estado, retornoLocal))) {
        throw new Error("Não foi possível abrir o login do Google.");
      }
    } catch (error) {
      retornoLocal?.fechar();
      this.estadoOAuth.limpar();
      this.restaurarEstadoAposFalhaOAuth(
        "Não foi possível abrir o login do Google.",
      );
      throw error;
    }

    if (retornoLocal) {
      void this.aguardarRetornoLocal(retornoLocal);
    }
  }

  // A volta do navegador pelo servidor local: confere e salva a sessão,
  // mostra o resultado na página e avisa a extensão, que traz o VS Code para
  // a frente.
  private async aguardarRetornoLocal(retornoLocal: RetornoLocal): Promise<void> {
    let retorno: RetornoDoSite;
    try {
      retorno = await retornoLocal.recebido;
    } catch {
      // Fechado antes: o login expirou, foi substituído ou a extensão parou.
      return;
    }

    let resultado: ResultadoDoLogin;
    try {
      await this.processarCallback(retorno);
      resultado = { ok: true, nome: this.sessaoAtual?.displayName };
    } catch (error) {
      resultado = {
        ok: false,
        mensagem: error instanceof Error ? error.message : "Falha na autenticação.",
      };
    }
    retornoLocal.concluir(resultado);
    if (this.retornoLocal === retornoLocal) {
      this.retornoLocal = undefined;
    }
    this.voltaDoNavegador.fire(resultado);
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

  public async processarCallback(uri: RetornoDoSite): Promise<void> {
    try {
      const parametros = lerParametrosCallback(uri);
      this.estadoOAuth.consumir(parametros.get("state") || "");
      const { provedor, tokenServidor, respostaLogin } = await loginDoRetorno(
        uri,
        parametros,
      );

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
    // Sair também desiste de um login que esperava o navegador.
    this.estadoOAuth.limpar();
    this.retornoLocal?.fechar();

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
    });
  }

  // Não cancela um login em andamento: a sessão pode acabar (expirar, ser
  // recusada) enquanto o aluno entra de novo pelo navegador.
  private async encerrarSessao(mensagem?: string): Promise<void> {
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
