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
  criarArquivosDeTreino,
  criarResumoWorkspaceVazio,
  lerResumoWorkspace,
} from "../services/workspace";
import { avaliarTentativa } from "../services/avaliacao";
import { AlteracaoExterna } from "../services/alteracoesExternas";
import { log } from "../services/logger";
import {
  abrirExtensoesIa,
  encontrarExtensoesIa,
  ExtensaoIa,
} from "../services/extensoesIa";
import {
  ErroHttpServidor,
  lerConfiguracaoServidor,
  verificarConexaoServidor,
} from "../services/servidor";
import { obterHtmlAutenticacao, obterHtmlWebview } from "../webview/html";
import { PainelGabarito } from "./painel-gabarito";

const CRIAR_DINAMICA = "Criar dinâmica de treino";
const ABRIR_PASTA = "Abrir pasta";
const VER_EXTENSOES = "Ver extensões";
// Tamanho dos arquivos criados antes do primeiro desafio (o do gerador).
const LARGURA_PADRAO = 800;
const ALTURA_PADRAO = 800;

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

  // Por que o desafio atual não pode mais ser corrigido. Fica só na memória,
  // como o desafio: a extensão de IA que estava rodando só sai da lista
  // depois de "Reiniciar Extensões", que reinicia esta extensão também.
  private motivoInvalidacao?: string;

  private estadoAutenticacao: EstadoAutenticacao;

  // Criada na primeira vez que o aluno abre o gabarito em uma aba.
  private painelGabarito?: PainelGabarito;

  // Última correção com nota: uma página igual não é reenviada ao servidor.
  private ultimaCorrecao?: {
    challengeId: string;
    assinatura: string;
    resultado: ResultadoAvaliacao;
  };

  public constructor(
    extensionUri: vscode.Uri,
    authService: AuthService,
    // Guarda qual gabarito do evento de treino esta instalação criou.
    private readonly registroGabaritos: vscode.Memento,
    private readonly detectarExtensoesIa: () => ExtensaoIa[] = () =>
      encontrarExtensoesIa(),
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
        this.motivoInvalidacao = undefined;
        this.gabaritoAtual = undefined;
        this.avaliacaoAtual = undefined;
        this.painelGabarito?.atualizar(undefined);
        this.painelGabarito?.atualizarPagina(undefined);
        this.ultimaCorrecao = undefined;
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

        if (mensagem.type === "abrirPainelGabarito") {
          this.abrirPainelGabarito();
          return;
        }

        if (mensagem.type === "verExtensoesIa") {
          void this.verExtensoesIa();
          return;
        }

        if (mensagem.type === "criarArquivos") {
          void this.criarArquivosDeTreino();
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
            typeof mensagem.verificacaoId === "number"
              ? mensagem.verificacaoId
              : undefined,
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

    // Como no torneio, o desafio começa e termina sem IA.
    const extensoesIa = this.detectarExtensoesIa();
    if (extensoesIa.length > 0) {
      const nomes = extensoesIa.map((extensao) => extensao.nome).join(", ");
      void vscode.window
        .showWarningMessage(
          "Como no torneio, desabilite as extensões de IA antes de começar " +
            `um desafio: ${nomes}. Se já desabilitou, clique em ` +
            '"Reiniciar Extensões".',
          VER_EXTENSOES,
        )
        .then((escolha) => {
          if (escolha === VER_EXTENSOES) {
            void abrirExtensoesIa(extensoesIa);
          }
        });
      this.enviarEstado();
      return;
    }

    console.log("[FlexBox Trainer] Iniciando novo desafio...");
    this.desafioAtual = criarDesafioGerado();
    this.motivoInvalidacao = undefined;
    this.painelGabarito?.atualizar(this.desafioAtual);
    this.gabaritoAtual = undefined;
    this.avaliacaoAtual = undefined;
    this.inicioTentativaMs = Date.now();
    this.fimTentativaMs = undefined;
    this.enviarEstado();
    void this.testarConexaoServidor();
    // Sem esperar: numa pasta nova, cria index.html e style.css para o aluno.
    void this.criarArquivosSeFaltarem();
  }

  /** Cria os arquivos de treino que faltarem e avisa o que aconteceu. */
  public async criarArquivosDeTreino(
    avisarSeExistirem = true,
  ): Promise<void> {
    const resultado = await criarArquivosDeTreino(
      this.desafioAtual?.width ?? LARGURA_PADRAO,
      this.desafioAtual?.height ?? ALTURA_PADRAO,
    );

    if (resultado.status === "sem-pasta") {
      // Não espera a resposta: a notificação pode ficar aberta.
      void vscode.window
        .showInformationMessage(
          "Abra uma pasta para treinar: o FlexBox Trainer cria nela o " +
            "index.html e o style.css.",
          ABRIR_PASTA,
        )
        .then((escolha) => {
          if (escolha === ABRIR_PASTA) {
            void vscode.commands.executeCommand(
              "workbench.action.files.openFolder",
            );
          }
        });
      return;
    }

    if (resultado.status === "ja-existiam") {
      if (avisarSeExistirem) {
        void vscode.window.showInformationMessage(
          "index.html e style.css já existem nesta pasta.",
        );
      }
      return;
    }

    // O index.html fica em primeiro plano, com o style.css na aba ao lado.
    const ordenados = [...resultado.arquivos].sort((a, b) =>
      a.path.endsWith("index.html") ? 1 : b.path.endsWith("index.html") ? -1 : 0,
    );
    for (const arquivo of ordenados) {
      await vscode.window.showTextDocument(arquivo, { preview: false });
    }
    void vscode.window.showInformationMessage(
      `Criei ${resultado.arquivos
        .map((arquivo) => arquivo.path.split("/").pop())
        .join(" e ")} na pasta do projeto para você recriar o desafio.`,
    );
    await this.atualizarPreviewWorkspace();
  }

  private async criarArquivosSeFaltarem(): Promise<void> {
    const resumo = await lerResumoWorkspace();
    if (!resumo.temArquivoHtml || !resumo.temArquivoCss) {
      await this.criarArquivosDeTreino(false);
    }
  }

  public obterDesafioAtual(): Desafio | undefined {
    return this.desafioAtual;
  }

  /**
   * As extensões habilitadas mudaram. Uma de IA habilitada durante o desafio
   * o invalida, mesmo que seja desabilitada depois.
   */
  public atualizarExtensoesIa(): void {
    const extensoesIa = this.detectarExtensoesIa();
    if (extensoesIa.length > 0) {
      this.invalidarDesafio(motivoExtensoesIa(extensoesIa));
    }
    this.enviarEstado();
  }

  /**
   * Um index.html ou style.css mudou no disco sem ter saído do editor. Se for
   * um arquivo de treino, durante o desafio, o desafio fica invalidado.
   */
  public async registrarAlteracaoExterna(
    alteracao: AlteracaoExterna,
  ): Promise<void> {
    // A página mudou: o preview e a aba do gabarito mostram o conteúdo novo.
    await this.atualizarPreviewWorkspace();

    if (
      !this.desafioAtual ||
      this.motivoInvalidacao ||
      alteracao.instante < this.inicioTentativaMs
    ) {
      return;
    }

    const resumo = this.resumoWorkspaceAtual;
    const caminho = normalizarCaminho(alteracao.uri.fsPath);
    const arquivosDeTreino = [
      resumo.temArquivoHtml ? resumo.caminhoHtml : undefined,
      resumo.temArquivoCss ? resumo.caminhoCss : undefined,
    ];

    if (
      !arquivosDeTreino.some(
        (arquivo) =>
          arquivo !== undefined && normalizarCaminho(arquivo) === caminho,
      )
    ) {
      return;
    }

    const nome = alteracao.uri.path.split("/").pop() ?? "arquivo";
    this.invalidarDesafio(`o ${nome} foi alterado fora do editor.`);
    this.enviarEstado();
  }

  private invalidarDesafio(motivo: string): void {
    if (!this.desafioAtual || this.motivoInvalidacao) {
      return;
    }

    this.motivoInvalidacao = motivo;
    this.avaliacaoAtual = this.resultadoDesafioInvalidado();
    log.info(
      `Desafio ${this.desafioAtual.challengeId} invalidado: ${motivo}`,
    );
  }

  private resultadoDesafioInvalidado(): ResultadoAvaliacao {
    return {
      precision: 0,
      score: 0,
      source: "desafio-invalidado",
      error:
        `Desafio invalidado: ${this.motivoInvalidacao} Como no torneio, ele ` +
        "não pode mais ser corrigido. Gere um novo desafio e faça-o no " +
        "editor, sem IA.",
    };
  }

  /** Abre a página das extensões de IA habilitadas, para desabilitá-las. */
  public async verExtensoesIa(): Promise<ExtensaoIa[]> {
    const lista = this.detectarExtensoesIa();
    await abrirExtensoesIa(lista);
    return lista;
  }

  public abrirPainelGabarito(): void {
    this.painelGabarito ??= new PainelGabarito(this.extensionUri);
    this.painelGabarito.mostrar(this.desafioAtual, this.paginaDoAluno());
  }

  private definirResumoWorkspace(resumo: ResumoWorkspace): void {
    this.resumoWorkspaceAtual = resumo;
    this.painelGabarito?.atualizarPagina(this.paginaDoAluno());
  }

  private paginaDoAluno(): string | undefined {
    const resumo = this.resumoWorkspaceAtual;
    return resumo.temArquivoHtml || resumo.temArquivoCss
      ? resumo.htmlPreview
      : undefined;
  }

  public async atualizarPreviewWorkspace(): Promise<void> {
    if (!this.authService.isAutenticado()) {
      return;
    }

    this.definirResumoWorkspace(await lerResumoWorkspace());
    this.enviarEstado();
  }

  private encerrarDesafioAtual(): void {
    if (!this.desafioAtual || this.fimTentativaMs !== undefined) {
      return;
    }

    this.fimTentativaMs = Date.now();
    this.enviarEstado();
  }

  // A barra lateral mostra as etapas e espera o aviso de conclusão, que vai
  // sempre, mesmo quando a verificação para no meio.
  private async verificarTentativaAtual(
    challengeId: string,
    formas: FormaMedida[],
    verificacaoId?: number,
  ): Promise<void> {
    const avisar = (type: string, mensagem?: string): void => {
      void this.visualizacaoWebview?.webview.postMessage({
        type,
        payload: { id: verificacaoId, mensagem },
      });
    };

    try {
      await vscode.window.withProgress(
        { location: { viewId: ProvedorBarraLateralFlexBox.viewType } },
        () =>
          this.executarVerificacao(challengeId, formas, (mensagem) =>
            avisar("progressoVerificacao", mensagem),
          ),
      );
    } finally {
      avisar("verificacaoConcluida");
    }
  }

  private async executarVerificacao(
    challengeId: string,
    formas: FormaMedida[],
    aoProgredir: (mensagem: string) => void,
  ): Promise<void> {
    if (!this.authService.isAutenticado()) {
      return;
    }

    if (!this.desafioAtual || this.desafioAtual.challengeId !== challengeId) {
      return;
    }

    // Como no torneio, nada é corrigido com uma extensão de IA habilitada.
    const extensoesIa = this.detectarExtensoesIa();
    if (extensoesIa.length > 0) {
      this.invalidarDesafio(motivoExtensoesIa(extensoesIa));
    }

    if (this.motivoInvalidacao) {
      this.avaliacaoAtual = this.resultadoDesafioInvalidado();
      this.enviarEstado();
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

      this.definirResumoWorkspace(resumoWorkspace);

      if (
        !resumoWorkspace.temArquivoHtml ||
        !resumoWorkspace.temArquivoCss
      ) {
        this.avaliacaoAtual = {
          precision: 0,
          score: 0,
          source: "missing-files",
          error:
            "Não encontrei index.html e style.css: recrie o desafio neles e " +
            "verifique de novo.",
        };
        this.enviarEstado();
        void this.criarArquivosDeTreino(false);
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

      const configuracao = this.lerConfiguracaoServidorAtual();
      // As formas medidas são o que o servidor compara: se não mudaram, a
      // nota também não mudaria.
      const assinatura = JSON.stringify([configuracao.eventoTreino, formas]);
      const anterior = this.ultimaCorrecao;

      if (
        anterior?.challengeId === challengeId &&
        anterior.assinatura === assinatura
      ) {
        this.avaliacaoAtual = { ...anterior.resultado, repetida: true };
        this.enviarEstado();
        return;
      }

      const resultadoServidor = await avaliarTentativa(
        { challengeId, formas, gabarito },
        configuracao,
        this.registroGabaritos,
        aoProgredir,
      );

      if (!desafioAindaEhAtual()) {
        return;
      }

      this.avaliacaoAtual = resultadoServidor;
      this.ultimaCorrecao =
        resultadoServidor.source === "servidor"
          ? { challengeId, assinatura, resultado: resultadoServidor }
          : undefined;

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
    // Aluno e time vêm só da sessão, que os busca no servidor pelo e-mail;
    // assim ninguém corrige em nome de outra pessoa.
    return {
      ...lerConfiguracaoServidor(this.authService.getAccessToken()),
      userId: sessao?.userId ?? 0,
      teamId: sessao?.teamId ?? 0,
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

    this.visualizacaoWebview.webview.postMessage({
      type: "extensoesIa",
      payload: this.detectarExtensoesIa(),
    });

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

function motivoExtensoesIa(extensoes: ExtensaoIa[]): string {
  const nomes = extensoes.map((extensao) => extensao.nome).join(", ");
  return extensoes.length === 1
    ? `uma extensão de IA ficou habilitada durante ele (${nomes}).`
    : `extensões de IA ficaram habilitadas durante ele (${nomes}).`;
}

function normalizarCaminho(caminho: string): string {
  return caminho.replace(/\\/g, "/").toLowerCase();
}

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
