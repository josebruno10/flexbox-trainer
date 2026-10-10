import * as vscode from "vscode";
import { AuthService } from "../auth/authService";
import { LoginProvider } from "../auth/loginProvider";
import {
  ConfiguracaoServidor,
  Desafio,
  EstadoAutenticacao,
  FormaMedida,
  GabaritoGerado,
  MensagemRecebidaBarraLateral,
  ResumoWorkspace,
  ResultadoAvaliacao,
  StatusConexaoServidor,
} from "../types";
import { criarDesafioGerado } from "../services/desafio";
import {
  criarResumoWorkspaceVazio,
  lerResumoWorkspace,
} from "../services/workspace";
import { avaliarTentativa } from "../services/avaliacao";
import {
  ErroHttpServidor,
  lerConfiguracaoServidor,
  verificarConexaoServidor,
} from "../services/servidor";
import { obterHtmlAutenticacao, obterHtmlWebview } from "../webview/html";

const CRIAR_DINAMICA = "Criar dinâmica de treino";

export class ProvedorBarraLateralFlexBox implements vscode.WebviewViewProvider {
  public static readonly viewType = "flexbox-trainer.sidebar";

  private readonly extensionUri: vscode.Uri;

  private readonly authService: AuthService;

  private readonly loginProvider: LoginProvider;

  private visualizacaoWebview?: vscode.WebviewView;

  private desafioAtual?: Desafio;

  private gabaritoAtual?: GabaritoGerado;

  private resumoWorkspaceAtual: ResumoWorkspace = criarResumoWorkspaceVazio();

  private avaliacaoAtual?: ResultadoAvaliacao;

  private inicioTentativaMs = Date.now();

  private fimTentativaMs?: number;

  private estadoAutenticacao: EstadoAutenticacao;

  public constructor(
    extensionUri: vscode.Uri,
    authService: AuthService,
    // Guarda qual gabarito do evento de treino esta instalação criou.
    private readonly registroGabaritos: vscode.Memento,
  ) {
    this.extensionUri = extensionUri;
    this.authService = authService;
    this.loginProvider = new LoginProvider(authService);
    this.estadoAutenticacao = authService.getEstadoAtual();

    this.authService.onDidChangeEstado((estado) => {
      this.estadoAutenticacao = estado;
      this.renderizarWebviewAtual();

      if (estado.status === "authenticated") {
        void this.atualizarPreviewWorkspace();
      } else if (estado.status === "unauthenticated") {
        this.desafioAtual = undefined;
        this.fimTentativaMs = undefined;
        this.gabaritoAtual = undefined;
        this.avaliacaoAtual = undefined;
      }

      this.enviarEstado();
    });
  }

  public resolveWebviewView(
    visualizacaoWebview: vscode.WebviewView,
  ): void | Thenable<void> {
    this.visualizacaoWebview = visualizacaoWebview;
    visualizacaoWebview.webview.options = { enableScripts: true };
    this.renderizarWebviewAtual();

    visualizacaoWebview.webview.onDidReceiveMessage(
      (mensagem: MensagemRecebidaBarraLateral) => {
        if (mensagem.type === "pronto") {
          this.enviarEstado();

          if (this.authService.isAutenticado()) {
            void this.atualizarPreviewWorkspace();
          }

          return;
        }

        if (mensagem.type === "abrirLogin") {
          void this.loginProvider.abrirLogin().catch(mostrarFalhaAoAbrirLogin);
          return;
        }

        if (mensagem.type === "abrirCadastro") {
          void this.loginProvider
            .abrirCadastro()
            .catch(mostrarFalhaAoAbrirLogin);
          return;
        }

        if (mensagem.type === "loginGitHub") {
          void this.authService.loginComProvedorVSCode("github");
          return;
        }

        if (mensagem.type === "loginMicrosoft") {
          void this.authService.loginComProvedorVSCode("microsoft");
          return;
        }

        if (mensagem.type === "loginGoogle") {
          void this.authService
            .abrirLoginGoogle()
            .catch(mostrarFalhaAoAbrirLogin);
          return;
        }

        if (mensagem.type === "revalidarSessao") {
          void this.loginProvider.revalidarSessao();
          return;
        }

        if (mensagem.type === "logout") {
          void this.loginProvider.sair();
          return;
        }

        if (mensagem.type === "gabaritoGerado") {
          if (
            mensagem.challengeId === this.desafioAtual?.challengeId &&
            mensagem.width === this.desafioAtual.width &&
            mensagem.height === this.desafioAtual.height &&
            mensagem.imagemDataUrl.startsWith("data:image/png;base64,")
          ) {
            this.gabaritoAtual = {
              challengeId: mensagem.challengeId,
              imagemDataUrl: mensagem.imagemDataUrl,
              width: mensagem.width,
              height: mensagem.height,
            };
            console.log(
              `[FlexBox Trainer] Gabarito PNG gerado: ${mensagem.challengeId} (${mensagem.width}x${mensagem.height})`,
            );
          }
          return;
        }

        if (!this.authService.isAutenticado()) {
          return;
        }

        if (mensagem.type === "novoDesafio") {
          void this.iniciarNovoDesafio();
          void this.atualizarPreviewWorkspace();
          return;
        }

        if (mensagem.type === "encerrarDesafio") {
          this.encerrarDesafioAtual();
          return;
        }

        if (mensagem.type === "testarConexao") {
          void this.testarConexaoServidor();
          return;
        }

        if (mensagem.type === "atualizarPreview") {
          void this.atualizarPreviewWorkspace();
          return;
        }

        if (mensagem.type === "solicitarVerificacao") {
          if (mensagem.challengeId !== this.desafioAtual?.challengeId) {
            return;
          }

          void this.verificarTentativaAtual(
            mensagem.challengeId,
            sanitizarFormas(mensagem.formas),
          );
        }
      },
      undefined,
    );

    if (this.authService.isAutenticado()) {
      void this.atualizarPreviewWorkspace();
    }
  }

  public async iniciarNovoDesafio(): Promise<void> {
    if (!this.authService.isAutenticado()) {
      return;
    }

    console.log("[FlexBox Trainer] Iniciando novo desafio...");
    const desafioGerado = criarDesafioGerado();
    // A captura do aluno precisa casar com o gabarito. As dimensões saem do
    // próprio desafio, não das settings, porque nem todo gabarito é 960x540.
    this.desafioAtual = {
      ...desafioGerado,
      captureWidth: desafioGerado.width,
      captureHeight: desafioGerado.height,
    };
    this.gabaritoAtual = undefined;
    this.avaliacaoAtual = undefined;
    this.inicioTentativaMs = Date.now();
    this.fimTentativaMs = undefined;
    this.enviarEstado();
    void this.testarConexaoServidor();
  }

  public obterDesafioAtual(): Desafio | undefined {
    return this.desafioAtual;
  }

  public async atualizarPreviewWorkspace(): Promise<void> {
    if (!this.authService.isAutenticado()) {
      return;
    }

    this.resumoWorkspaceAtual = await lerResumoWorkspace();
    this.enviarEstado();
  }

  private encerrarDesafioAtual(): void {
    if (!this.desafioAtual || this.fimTentativaMs !== undefined) {
      return;
    }

    this.fimTentativaMs = Date.now();
    this.enviarEstado();
  }

  private async verificarTentativaAtual(
    challengeId: string,
    formas: FormaMedida[],
  ): Promise<void> {
    if (!this.authService.isAutenticado()) {
      return;
    }

    if (!this.desafioAtual || this.desafioAtual.challengeId !== challengeId) {
      return;
    }

    const desafioAindaEhAtual = (): boolean =>
      this.desafioAtual?.challengeId === challengeId;

    try {
      const resumoLido = await lerResumoWorkspace();
      const resumoWorkspace =
        resumoLido.temArquivoHtml && resumoLido.temArquivoCss
          ? resumoLido
          : this.resumoWorkspaceAtual;

      if (!desafioAindaEhAtual()) {
        return;
      }

      this.resumoWorkspaceAtual = resumoWorkspace;

      if (
        !resumoWorkspace.temArquivoHtml ||
        !resumoWorkspace.temArquivoCss
      ) {
        this.avaliacaoAtual = {
          precision: 0,
          score: 0,
          source: "missing-files",
          error: "Abra ou crie index.html e style.css na pasta do projeto.",
        };
        this.enviarEstado();
        return;
      }

      const gabarito = this.gabaritoAtual;

      if (gabarito?.challengeId !== challengeId) {
        this.avaliacaoAtual = {
          precision: 0,
          score: 0,
          source: "gabarito-error",
          error:
            "A imagem do desafio ainda não foi gerada. Aguarde a barra lateral desenhá-lo.",
        };
        this.enviarEstado();
        return;
      }

      // Primeiro uso: oferece criar a dinâmica aqui mesmo, sem a paleta de
      // comandos; sem ela, avaliarTentativa explica como configurar.
      if (!this.lerConfiguracaoServidorAtual().eventoTreino) {
        const escolha = await vscode.window.showInformationMessage(
          "Você ainda não tem uma dinâmica de treino.",
          {
            modal: true,
            detail:
              "A extensão precisa de uma dinâmica só sua no servidor para " +
              "cadastrar o gabarito e corrigir. Ela é criada uma única vez.",
          },
          CRIAR_DINAMICA,
        );

        if (escolha === CRIAR_DINAMICA) {
          await vscode.commands.executeCommand(
            "flexbox-trainer.criarDinamicaTreino",
          );
        }

        if (!desafioAindaEhAtual()) {
          return;
        }
      }

      const resultadoServidor = await avaliarTentativa(
        { challengeId, formas, gabarito },
        this.lerConfiguracaoServidorAtual(),
        this.registroGabaritos,
      );

      if (!desafioAindaEhAtual()) {
        return;
      }

      this.avaliacaoAtual = resultadoServidor;

      this.enviarEstado();

      if (resultadoServidor.source === "authentication-error") {
        await this.invalidarSessaoSeRecusada(
          resultadoServidor.httpStatus,
        );
      }
    } catch (error) {
      if (!desafioAindaEhAtual()) {
        return;
      }

      const mensagem =
        error instanceof Error ? error.message : "Erro desconhecido";
      this.avaliacaoAtual = {
        precision: 0,
        score: 0,
        source: "api-error",
        error: mensagem,
      };
      this.enviarEstado();

      if (error instanceof ErroHttpServidor) {
        await this.invalidarSessaoSeRecusada(error.status);
      }
    }
  }

  private async testarConexaoServidor(): Promise<void> {
    const configuracao = this.lerConfiguracaoServidorAtual();
    let status: StatusConexaoServidor;

    try {
      const mensagem = await verificarConexaoServidor(configuracao);
      status = { ok: true, mensagem };
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Erro desconhecido";
      status = { ok: false, mensagem };

      if (error instanceof ErroHttpServidor) {
        await this.invalidarSessaoSeRecusada(error.status, true);
      }
    }

    void this.visualizacaoWebview?.webview.postMessage({
      type: "statusServidor",
      payload: status,
    });
  }

  private lerConfiguracaoServidorAtual(): ConfiguracaoServidor {
    const sessao = this.authService.getSessaoAtual();
    const configuracao = lerConfiguracaoServidor(
      this.authService.getAccessToken(),
    );
    // Por padrão a sessão vence, para ninguém submeter com o ID de outra
    // pessoa. O override existe porque o servidor pode devolver em /auth/me
    // um id do provedor OAuth que não existe na tabela `usuarios`.
    const preferirConfiguracoes = vscode.workspace
      .getConfiguration("flexboxTrainer")
      .get<boolean>("usarIdsDasConfiguracoes", false);

    const escolherId = (
      valorConfigurado: number,
      valorSessao: number | undefined,
    ): number => {
      if (preferirConfiguracoes && valorConfigurado > 0) {
        return valorConfigurado;
      }

      return typeof valorSessao === "number" && valorSessao > 0
        ? valorSessao
        : valorConfigurado;
    };

    return {
      ...configuracao,
      userId: escolherId(configuracao.userId, sessao?.userId),
      teamId: escolherId(configuracao.teamId, sessao?.teamId),
    };
  }

  private async invalidarSessaoSeRecusada(
    httpStatus?: number,
    incluirAcessoNegado = false,
  ): Promise<void> {
    if (httpStatus !== 401 && !(incluirAcessoNegado && httpStatus === 403)) {
      return;
    }

    await this.authService.invalidarSessao(
      "O servidor recusou a sessão. Entre novamente.",
    );
  }

  private enviarEstado(): void {
    if (!this.visualizacaoWebview) {
      return;
    }

    this.visualizacaoWebview.webview.postMessage({
      type: "estadoAutenticacao",
      payload: this.estadoAutenticacao,
    });

    if (!this.authService.isAutenticado()) {
      return;
    }

    if (this.desafioAtual) {
      this.visualizacaoWebview.webview.postMessage({
        type: "dadosDesafio",
        payload: {
          ...this.desafioAtual,
          tempoAtualMs:
            (this.fimTentativaMs ?? Date.now()) - this.inicioTentativaMs,
          encerrado: this.fimTentativaMs !== undefined,
        },
      });
    }

    this.visualizacaoWebview.webview.postMessage({
      type: "dadosWorkspace",
      payload: this.resumoWorkspaceAtual,
    });

    if (this.avaliacaoAtual) {
      this.visualizacaoWebview.webview.postMessage({
        type: "resultadoAvaliacao",
        payload: this.avaliacaoAtual,
      });
    }
  }

  private renderizarWebviewAtual(): void {
    if (!this.visualizacaoWebview) {
      return;
    }

    if (this.authService.isAutenticado()) {
      this.visualizacaoWebview.webview.html = obterHtmlWebview(
        this.visualizacaoWebview.webview,
        this.extensionUri,
        this.authService.getSessaoAtual()?.displayName,
      );
      return;
    }

    this.visualizacaoWebview.webview.html = obterHtmlAutenticacao(
      this.visualizacaoWebview.webview,
      this.extensionUri,
    );
  }
}

const TIPOS_FORMA: ReadonlySet<unknown> = new Set<FormaMedida["tipo"]>([
  "circulo",
  "quadrado",
  "retangulo_deitado",
  "retangulo_em_pe",
]);

// A mensagem vem da webview; só passam formas com números e cor válidos.
function sanitizarFormas(formas: unknown): FormaMedida[] {
  if (!Array.isArray(formas)) {
    return [];
  }

  return formas
    .filter(
      (forma): forma is FormaMedida =>
        typeof forma === "object" &&
        forma !== null &&
        TIPOS_FORMA.has(forma.tipo) &&
        typeof forma.id === "string" &&
        typeof forma.cor === "string" &&
        /^#[0-9a-f]{6}$/i.test(forma.cor) &&
        [forma.x, forma.y, forma.width, forma.height, forma.area].every(
          (valor) => typeof valor === "number" && Number.isFinite(valor),
        ),
    )
    .slice(0, 1000)
    .map(({ id, tipo, x, y, width, height, area, cor }) => ({
      id,
      tipo,
      x,
      y,
      width,
      height,
      area,
      cor,
    }));
}

function mostrarFalhaAoAbrirLogin(error: unknown): void {
  const mensagem =
    error instanceof Error ? error.message : "Não foi possível abrir o login.";
  void vscode.window.showErrorMessage(`Erro no Login: ${mensagem}`);
}
