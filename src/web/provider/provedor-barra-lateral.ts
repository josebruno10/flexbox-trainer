import * as vscode from "vscode";
import { AuthService } from "../auth/authService";
import { LoginProvider } from "../auth/loginProvider";
import { pedirDadosCadastro } from "../auth/formularioCadastro";
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
import {
  codigoDoDia,
  diaLocal,
  formatarCodigo,
  normalizarCodigo,
} from "../services/codigoDesafio";
import { criarDesafioPorCodigo } from "../services/desafio";
import {
  HistoricoDesafios,
  NotaDoDia,
  RegistroHistorico,
  SequenciaDoDia,
} from "../services/historico";
import {
  criarArquivosDeTreino,
  criarResumoWorkspaceVazio,
  lerResumoWorkspace,
  limparArquivosDeTreino,
  temTrabalhoDoAluno,
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
import {
  BarraDeStatus,
  COMANDO_ABRIR_BARRA,
  EstadoBarraDeStatus,
  formatarTempo,
} from "./barra-de-status";
import { PainelGabarito } from "./painel-gabarito";

const CRIAR_DINAMICA = "Criar dinâmica de treino";
const ABRIR_PASTA = "Abrir pasta";
const VER_EXTENSOES = "Ver extensões";
const CADASTRAR = "Cadastrar";
const LIMPAR_E_GERAR = "Limpar e gerar";
// Na barra lateral cabem os desafios mais recentes; o resto fica no comando
// Histórico de Desafios.
const HISTORICO_NA_BARRA = 5;
// O gráfico da evolução mostra os últimos 30 dias em que o aluno treinou.
const DIAS_NO_GRAFICO = 30;

/** O que o guia de primeiros passos precisa saber para marcar cada passo. */
export type ProgressoGuia = {
  autenticado: boolean;
  // A chave workspaceFolderCount do VS Code já vale antes de o guia ser
  // registrado, e o guia só percebe mudanças; esta é definida depois.
  pastaAberta: boolean;
  semExtensoesIa: boolean;
  temDesafio: boolean;
  verificou: boolean;
};
// Espera depois da última tecla antes de redesenhar a página do aluno.
const ESPERA_DIGITACAO_MS = 500;
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

  private atualizacaoAgendada?: ReturnType<typeof setTimeout>;

  // Enquanto a extensão pergunta se pode limpar os arquivos, outro clique não
  // gera um segundo desafio.
  private gerandoDesafio = false;

  // Precisões das correções do desafio atual, da primeira à última.
  private historicoNotas: number[] = [];

  // A melhor nota desta vez que o desafio é feito, para Copiar resultado.
  private melhorDaTentativa?: { precisao: number; tempoMs: number };

  // A verificação mede a página dentro da barra lateral: o atalho só a pede
  // quando o script da barra já carregou.
  private barraPronta = false;
  private verificarQuandoPronta = false;

  // Os desafios já verificados, com a melhor nota de cada um.
  private readonly historico: HistoricoDesafios;

  private readonly progressoMudou = new vscode.EventEmitter<ProgressoGuia>();

  /** Para o guia de primeiros passos marcar o que o aluno já fez. */
  public readonly onDidMudarProgresso = this.progressoMudou.event;

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
    // Opcional para os testes não criarem itens na barra de status.
    private readonly barraDeStatus?: BarraDeStatus,
  ) {
    this.extensionUri = extensionUri;
    this.authService = authService;
    this.loginProvider = new LoginProvider(authService);
    // O mesmo armazenamento global da extensão, com uma chave por aluno.
    this.historico = new HistoricoDesafios(registroGabaritos);
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
        this.historicoNotas = [];
        this.melhorDaTentativa = undefined;
        this.verificarQuandoPronta = false;
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
    visualizacaoWebview.onDidDispose(() => {
      this.barraPronta = false;
      this.visualizacaoWebview = undefined;
    });
    visualizacaoWebview.onDidChangeVisibility(() =>
      this.enviarVerificacaoPendente(),
    );

    visualizacaoWebview.webview.onDidReceiveMessage(
      (mensagem: MensagemRecebidaBarraLateral) => {
        if (mensagem.type === "pronto") {
          this.barraPronta = true;
          this.enviarEstado();

          if (this.authService.isAutenticado()) {
            void this.atualizarPreviewWorkspace();
          }

          // O atalho de Verificar abriu a barra: agora ela já pode medir.
          this.enviarVerificacaoPendente();

          return;
        }

        if (mensagem.type === "abrirLogin") {
          void this.loginProvider.abrirLogin().catch(mostrarFalhaAoAbrirLogin);
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
            log.info(
              `Gabarito PNG gerado: ${mensagem.challengeId} (${mensagem.width}x${mensagem.height})`,
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

        if (mensagem.type === "desafioDoDia") {
          void this.abrirDesafioDoDia();
          return;
        }

        if (mensagem.type === "copiarResultado") {
          void this.copiarResultado();
          return;
        }

        if (mensagem.type === "abrirPorCodigo") {
          void this.abrirDesafioPorCodigo();
          return;
        }

        if (mensagem.type === "refazer") {
          void this.refazerDesafio(
            typeof mensagem.codigo === "string" ? mensagem.codigo : undefined,
          );
          return;
        }

        if (mensagem.type === "verHistorico") {
          void this.verHistorico();
          return;
        }

        if (mensagem.type === "copiarCodigo") {
          void this.copiarCodigo();
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

        if (mensagem.type === "cadastrarNoTorneio") {
          void this.cadastrarNoTorneio();
          return;
        }

        if (mensagem.type === "encerrarDesafio") {
          this.encerrarDesafioAtual();
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

  /** Sem código, sorteia um desafio; com código, abre exatamente aquele. */
  public async iniciarNovoDesafio(codigo?: string): Promise<void> {
    if (!this.authService.isAutenticado()) {
      return;
    }

    // Como no torneio, o desafio começa e termina sem IA.
    const extensoesIa = this.detectarExtensoesIa();
    if (extensoesIa.length > 0) {
      const nomes = extensoesIa.map((extensao) => extensao.nome).join(", ");
      void vscode.window
        .showWarningMessage(
          `Desabilite as extensões de IA para começar: ${nomes}. Depois, ` +
            "reinicie as extensões.",
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

    if (this.gerandoDesafio) {
      return;
    }
    this.gerandoDesafio = true;

    try {
      // Como no torneio, cada desafio começa do zero: o que o aluno escreveu
      // no anterior não é reaproveitado nem fica fora do tempo.
      const temTrabalho = temTrabalhoDoAluno(await this.lerArquivosDoAluno());
      if (temTrabalho && !(await this.confirmarLimpeza())) {
        return;
      }

      this.desafioAtual = criarDesafioPorCodigo(codigo);
      log.info(
        `Novo desafio: código ${this.desafioAtual.codigo} (${this.desafioAtual.challengeId}).`,
      );
      this.motivoInvalidacao = undefined;
      this.painelGabarito?.atualizar(this.desafioAtual);
      this.gabaritoAtual = undefined;
      this.avaliacaoAtual = undefined;
      this.historicoNotas = [];
      this.melhorDaTentativa = undefined;
      this.verificarQuandoPronta = false;

      if (temTrabalho) {
        try {
          await this.limparArquivosDoAluno(
            this.desafioAtual.width,
            this.desafioAtual.height,
          );
        } catch (error) {
          const mensagem =
            error instanceof Error ? error.message : "Erro desconhecido.";
          log.error("Não foi possível limpar os arquivos de treino", error);
          void vscode.window.showErrorMessage(
            `Não foi possível limpar index.html e style.css: ${mensagem}`,
          );
        }
      }

      // O tempo começa com os arquivos já limpos.
      this.inicioTentativaMs = Date.now();
      this.fimTentativaMs = undefined;
      this.enviarEstado();
      void this.testarConexaoServidor();
      // Sem esperar: numa pasta nova, cria index.html e style.css para o aluno.
      void this.criarArquivosSeFaltarem();
    } finally {
      this.gerandoDesafio = false;
    }
  }

  private async confirmarLimpeza(): Promise<boolean> {
    const escolha = await vscode.window.showWarningMessage(
      "Gerar um desafio novo apaga o que você escreveu em index.html e style.css.",
      {
        modal: true,
        detail:
          "Como no torneio, cada desafio começa do zero: ficam só o HTML " +
          "básico e o reset do CSS (box-sizing, margin e padding). Assim o " +
          "tempo conta o desafio inteiro.",
      },
      LIMPAR_E_GERAR,
    );
    return escolha === LIMPAR_E_GERAR;
  }

  // Separados para os testes trocarem a leitura e a escrita dos arquivos.
  private lerArquivosDoAluno(): Promise<ResumoWorkspace> {
    return lerResumoWorkspace();
  }

  private limparArquivosDoAluno(largura: number, altura: number): Promise<void> {
    return limparArquivosDeTreino(largura, altura);
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
          "Abra uma pasta para criar index.html e style.css.",
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
    const nomes = resultado.arquivos.map((arquivo) => arquivo.path.split("/").pop());
    void vscode.window.showInformationMessage(
      `${nomes.join(" e ")} ${nomes.length === 1 ? "criado" : "criados"}.`,
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
        `Desafio invalidado: ${this.motivoInvalidacao} Gere outro e faça-o ` +
        "no editor, sem IA.",
    };
  }

  /**
   * Cadastra no torneio o e-mail da sessão, que ainda não existe lá, para a
   * correção funcionar. Cria um usuário no servidor da competição.
   */
  public async cadastrarNoTorneio(): Promise<void> {
    const sessao = this.authService.getSessaoAtual();
    if (!sessao || !this.authService.podeCadastrarNoTorneio()) {
      return;
    }

    const confirmacao = await vscode.window.showInformationMessage(
      `Cadastrar ${sessao.email} no Frontend Teams Cup?`,
      {
        modal: true,
        detail:
          "O e-mail desta conta não está no torneio. O cadastro cria o seu " +
          "usuário no servidor e coloca você no time genérico, para poder corrigir.",
      },
      CADASTRAR,
    );
    if (confirmacao !== CADASTRAR) {
      return;
    }

    try {
      const opcoes = await this.authService.carregarOpcoesCadastro();
      const dados = await pedirDadosCadastro(
        sessao.email,
        sessao.displayName,
        opcoes,
      );
      if (!dados) {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Cadastrando no torneio…",
        },
        () => this.authService.cadastrarNoTorneio(dados),
      );
      void vscode.window.showInformationMessage(
        "Cadastro feito. Você já pode corrigir os desafios.",
      );
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Erro desconhecido.";
      log.error("Não foi possível cadastrar no torneio", error);
      void vscode.window.showErrorMessage(`Cadastro no torneio: ${mensagem}`);
    }
  }

  /**
   * Redesenha a barra lateral e a aba com as cores escolhidas. As duas pedem
   * o estado de novo ao carregar, então nada se perde.
   */
  public aplicarCores(): void {
    this.renderizarWebviewAtual();
    this.painelGabarito?.aplicarCores();
  }

  /** O desafio do dia: o mesmo para todos na mesma data. */
  public async abrirDesafioDoDia(): Promise<void> {
    if (!this.authService.isAutenticado()) {
      void vscode.window.showWarningMessage("Entre antes de abrir um desafio.");
      return;
    }
    await this.iniciarNovoDesafio(codigoDoDia());
  }

  /**
   * O atalho de Verificar: abre a barra lateral, que mede a página, e pede a
   * verificação a ela assim que ela carregar e estiver à vista.
   */
  public async pedirVerificacao(): Promise<void> {
    if (!this.authService.isAutenticado()) {
      void vscode.window.showInformationMessage("Entre antes de verificar.");
      return;
    }
    if (!this.desafioAtual) {
      void vscode.window.showInformationMessage("Gere um desafio antes de verificar.");
      return;
    }

    this.verificarQuandoPronta = true;
    await vscode.commands.executeCommand(COMANDO_ABRIR_BARRA);
    this.enviarVerificacaoPendente();
  }

  /** "Desafio 482 917: 87,42% em 12:34", para colar no grupo da turma. */
  public textoDoResultado(agora = new Date()): string | undefined {
    const desafio = this.desafioAtual;
    const melhor = this.melhorDaTentativa;
    if (!desafio?.codigo || !melhor) {
      return undefined;
    }

    const codigo = formatarCodigo(desafio.codigo);
    const nome =
      desafio.codigo === codigoDoDia(agora)
        ? `Desafio do dia ${agora.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} (${codigo})`
        : `Desafio ${codigo}`;
    return `${nome}: ${formatarPorcentagem(melhor.precisao)}% em ${formatarTempo(melhor.tempoMs)}`;
  }

  public async copiarResultado(): Promise<void> {
    const texto = this.textoDoResultado();
    if (!texto) {
      void vscode.window.showInformationMessage(
        "Verifique o desafio antes de copiar o resultado.",
      );
      return;
    }
    await vscode.env.clipboard.writeText(texto);
    vscode.window.setStatusBarMessage(`Copiado: ${texto}`, 3000);
  }

  /** Pede um código (o que o professor ou um colega passou) e abre o desafio. */
  public async abrirDesafioPorCodigo(): Promise<void> {
    if (!this.authService.isAutenticado()) {
      void vscode.window.showWarningMessage("Entre antes de abrir um desafio.");
      return;
    }

    const texto = await vscode.window.showInputBox({
      title: "Abrir desafio por código",
      prompt: "O código de 6 dígitos que o professor ou um colega passou.",
      placeHolder: "482 917",
      ignoreFocusOut: true,
      validateInput: (valor) =>
        !valor.trim() || normalizarCodigo(valor)
          ? undefined
          : "Digite os 6 dígitos do código.",
    });
    const codigo = texto ? normalizarCodigo(texto) : undefined;
    if (codigo) {
      await this.iniciarNovoDesafio(codigo);
    }
  }

  /** Começa de novo um desafio: o atual ou um do histórico. */
  public async refazerDesafio(codigo = this.desafioAtual?.codigo): Promise<void> {
    const valido = codigo ? normalizarCodigo(codigo) : undefined;
    if (!valido) {
      void vscode.window.showInformationMessage("Gere um desafio antes de refazê-lo.");
      return;
    }
    await this.iniciarNovoDesafio(valido);
  }

  /** Todos os desafios do histórico; escolher um começa ele de novo. */
  public async verHistorico(): Promise<void> {
    const registros = this.historico.listar(this.authService.getSessaoAtual()?.email);
    if (registros.length === 0) {
      void vscode.window.showInformationMessage(
        "Os desafios que você verificar aparecem no histórico.",
      );
      return;
    }

    const escolhido = await vscode.window.showQuickPick(
      registros.map((registro) => ({
        label: formatarCodigo(registro.codigo),
        description: `${formatarPorcentagem(registro.melhor)}% em ${formatarTempo(registro.tempoMelhorMs)}`,
        detail:
          `${registro.verificacoes} ${registro.verificacoes === 1 ? "verificação" : "verificações"}` +
          ` · feito ${registro.vezes} ${registro.vezes === 1 ? "vez" : "vezes"}` +
          ` · ${new Date(registro.ultimaVez).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}`,
        codigo: registro.codigo,
      })),
      {
        title: "Histórico de desafios",
        placeHolder: "Escolha um desafio para refazer",
        matchOnDescription: true,
      },
    );
    if (escolhido) {
      await this.refazerDesafio(escolhido.codigo);
    }
  }

  public async copiarCodigo(): Promise<void> {
    const codigo = this.desafioAtual?.codigo;
    if (!codigo) {
      return;
    }
    await vscode.env.clipboard.writeText(codigo);
    vscode.window.setStatusBarMessage(`Código ${formatarCodigo(codigo)} copiado.`, 2500);
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

  /**
   * A página do aluno acompanha a digitação: várias teclas seguidas viram uma
   * só atualização, meio segundo depois da última.
   */
  public agendarAtualizacaoPreview(): void {
    clearTimeout(this.atualizacaoAgendada);
    this.atualizacaoAgendada = setTimeout(() => {
      this.atualizacaoAgendada = undefined;
      void this.atualizarPreviewWorkspace();
    }, ESPERA_DIGITACAO_MS);
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
          error: "Faltam index.html e style.css.",
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
          error: "O gabarito ainda está sendo desenhado. Tente de novo.",
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
              "É nela que o servidor guarda o seu gabarito para corrigir. " +
              "Só precisa criar uma vez.",
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
      if (resultadoServidor.source === "servidor") {
        this.historicoNotas = [
          ...this.historicoNotas,
          resultadoServidor.precision,
        ];
        this.registrarMelhorDaTentativa(resultadoServidor.precision);
        await this.registrarNoHistorico(resultadoServidor.precision);
      }

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

  /** O comando Testar Servidor: o resultado vem numa notificação. */
  public async testarServidorPeloComando(): Promise<void> {
    if (!this.authService.isAutenticado()) {
      void vscode.window.showWarningMessage("Entre antes de testar o servidor.");
      return;
    }

    const status = await this.testarConexaoServidor(true);
    if (status.ok) {
      void vscode.window.showInformationMessage(status.mensagem);
    } else {
      void vscode.window.showErrorMessage(`Servidor: ${status.mensagem}`);
    }
  }

  // Cada desafio novo testa a sessão; a barra lateral só fala se der erro.
  private async testarConexaoServidor(
    peloComando = false,
  ): Promise<StatusConexaoServidor> {
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

    if (!peloComando && !status.ok) {
      void this.visualizacaoWebview?.webview.postMessage({
        type: "statusServidor",
        payload: status,
      });
    }
    return status;
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
    // A barra de status e o guia valem mesmo com a barra lateral fechada.
    this.barraDeStatus?.atualizar(this.estadoBarraDeStatus());
    this.progressoMudou.fire(this.progressoGuia());

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
          doDia: this.desafioAtual.codigo === codigoDoDia(),
        },
      });
    }

    this.visualizacaoWebview.webview.postMessage({
      type: "dadosWorkspace",
      payload: this.resumoWorkspaceAtual,
    });

    this.visualizacaoWebview.webview.postMessage({
      type: "historicoNotas",
      payload: this.historicoNotas,
    });

    const registros = this.registrosDoAluno();
    this.visualizacaoWebview.webview.postMessage({
      type: "historicoDesafios",
      payload: {
        registros: registros.slice(0, HISTORICO_NA_BARRA),
        total: registros.length,
        recorde: this.recordeDoDesafio() ?? null,
        sequencia: this.sequenciaDoAluno() ?? null,
        evolucao: this.evolucaoDoAluno(),
      },
    });

    if (this.avaliacaoAtual) {
      this.visualizacaoWebview.webview.postMessage({
        type: "resultadoAvaliacao",
        payload: this.avaliacaoAtual,
      });
    }
  }

  // Escondida, a barra não mede a página: o pedido espera ela aparecer.
  private enviarVerificacaoPendente(): void {
    if (
      !this.verificarQuandoPronta ||
      !this.barraPronta ||
      !this.visualizacaoWebview?.visible
    ) {
      return;
    }
    this.verificarQuandoPronta = false;
    void this.visualizacaoWebview.webview.postMessage({ type: "verificar" });
  }

  // Com a mesma nota, vale a que saiu mais rápido.
  private registrarMelhorDaTentativa(precisao: number): void {
    const tempoMs = (this.fimTentativaMs ?? Date.now()) - this.inicioTentativaMs;
    const melhor = this.melhorDaTentativa;
    if (
      !melhor ||
      precisao > melhor.precisao ||
      (precisao === melhor.precisao && tempoMs < melhor.tempoMs)
    ) {
      this.melhorDaTentativa = { precisao, tempoMs };
    }
  }

  // A nota entra no histórico do aluno com o tempo em que foi alcançada.
  private async registrarNoHistorico(precisao: number): Promise<void> {
    const desafio = this.desafioAtual;
    if (!desafio?.codigo) {
      return;
    }

    const instante = Date.now();
    const email = this.authService.getSessaoAtual()?.email;
    await this.historico.registrarNota(email, {
      codigo: desafio.codigo,
      tentativa: desafio.challengeId,
      precisao,
      tempoMs: (this.fimTentativaMs ?? instante) - this.inicioTentativaMs,
      instante,
    });

    // O desafio do dia de hoje, ou o de ontem terminado depois da meia-noite.
    const agora = new Date(instante);
    const ontem = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      agora.getDate() - 1,
    );
    const dia = [agora, ontem].find(
      (data) => codigoDoDia(data) === desafio.codigo,
    );
    if (dia) {
      await this.historico.registrarDesafioDoDia(email, diaLocal(dia));
    }
  }

  private registrosDoAluno(): RegistroHistorico[] {
    return this.authService.isAutenticado()
      ? this.historico.listar(this.authService.getSessaoAtual()?.email)
      : [];
  }

  private evolucaoDoAluno(): NotaDoDia[] {
    return this.authService.isAutenticado()
      ? this.historico
          .evolucao(this.authService.getSessaoAtual()?.email)
          .slice(-DIAS_NO_GRAFICO)
      : [];
  }

  private sequenciaDoAluno(): SequenciaDoDia | undefined {
    return this.authService.isAutenticado()
      ? this.historico.sequenciaDoDia(
          this.authService.getSessaoAtual()?.email,
          diaLocal(new Date(Date.now())),
        )
      : undefined;
  }

  // O melhor que o aluno já fez neste código antes: aparece quando ele refaz
  // um desafio, como a nota a bater.
  private recordeDoDesafio(): number | undefined {
    const desafio = this.desafioAtual;
    const registro = desafio?.codigo
      ? this.registrosDoAluno().find((item) => item.codigo === desafio.codigo)
      : undefined;
    if (!registro || !desafio) {
      return undefined;
    }
    const deOutraVez =
      registro.ultimaTentativa !== desafio.challengeId || registro.vezes > 1;
    return deOutraVez ? registro.melhor : undefined;
  }

  private progressoGuia(): ProgressoGuia {
    const autenticado = this.authService.isAutenticado();
    return {
      autenticado,
      pastaAberta: (vscode.workspace.workspaceFolders?.length ?? 0) > 0,
      semExtensoesIa: this.detectarExtensoesIa().length === 0,
      temDesafio: autenticado && Boolean(this.desafioAtual),
      verificou:
        this.historicoNotas.length > 0 || this.registrosDoAluno().length > 0,
    };
  }

  private estadoBarraDeStatus(): EstadoBarraDeStatus | undefined {
    if (!this.authService.isAutenticado() || !this.desafioAtual) {
      return undefined;
    }

    return {
      inicioMs: this.inicioTentativaMs,
      fimMs: this.fimTentativaMs,
      precisao: this.historicoNotas[this.historicoNotas.length - 1],
      invalidado: Boolean(this.motivoInvalidacao),
    };
  }

  private renderizarWebviewAtual(): void {
    if (!this.visualizacaoWebview) {
      return;
    }

    // HTML novo recarrega o script da barra; ele avisa de novo quando carregar.
    this.barraPronta = false;

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
  void vscode.window.showErrorMessage(`Erro no login: ${mensagem}`);
}

function formatarPorcentagem(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
