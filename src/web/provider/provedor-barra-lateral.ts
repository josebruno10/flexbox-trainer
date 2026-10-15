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
  Nivel,
  ResumoWorkspace,
  ResultadoAvaliacao,
  StatusConexaoServidor,
} from "../types";
import {
  codigoDoDia,
  formatarCodigo,
  normalizarCodigo,
  sortearCodigo,
} from "../services/codigoDesafio";
import { ehNivel } from "../niveis";
import { criarDesafioPorCodigo } from "../services/desafio";
import {
  lerResumoWorkspace,
  limparArquivosDeTreino,
  temTrabalhoDoAluno,
} from "../services/workspace";
import { AlteracaoExterna } from "../services/alteracoesExternas";
import { log } from "../services/logger";
import {
  abrirExtensoesIa,
  encontrarExtensoesIa,
  ExtensaoIa,
} from "../services/extensoesIa";
import { lerConfiguracaoServidor } from "../services/servidor/configuracao";
import { obterHtmlWebview } from "../webview/telas/barraLateral";
import { obterHtmlAutenticacao } from "../webview/telas/entrada";
import {
  BarraDeStatus,
  COMANDO_ABRIR_BARRA,
  EstadoBarraDeStatus,
} from "./barra-de-status";
import {
  confirmarLimpeza,
  criarArquivosComAviso,
} from "./barra-lateral/arquivosDeTreino";
import { cadastrarNoTorneio } from "./barra-lateral/cadastro";
import { pedirCodigo } from "./barra-lateral/codigos";
import { sessaoRecusada, testarConexao } from "./barra-lateral/conexao";
import { Corretor } from "./barra-lateral/corretor";
import { mensagensDaBarra, ProgressoGuia } from "./barra-lateral/estado";
import { HistoricoDoAluno } from "./barra-lateral/historicoDoAluno";
import { CHAVE_NIVEL } from "../sincronizacao";
import { PaginaDoAluno } from "./barra-lateral/paginaDoAluno";
import { ControladorDaBarra, rotearMensagem } from "./barra-lateral/mensagens";
import {
  avisarExtensoesIa,
  ehArquivoDeTreino,
  motivoExtensoesIa,
  resultadoInvalidado,
} from "./barra-lateral/regras";
import { TentativaEmCurso, verificarTentativa } from "./barra-lateral/verificacao";
import {
  melhorEntre,
  MelhorDaTentativa,
  textoDoResultado,
} from "./barra-lateral/resultado";

export type { ProgressoGuia } from "./barra-lateral/estado";

// Tamanho dos arquivos criados antes do primeiro desafio (o do gerador).
const LARGURA_PADRAO = 800;
const ALTURA_PADRAO = 800;

/**
 * A barra lateral: guarda o desafio em andamento e coordena as partes que
 * ficam em barra-lateral/ (mensagens, correção, histórico, arquivos).
 */
export class ProvedorBarraLateralFlexBox implements vscode.WebviewViewProvider {
  public static readonly viewType = "flexbox-trainer.sidebar";

  private readonly loginProvider: LoginProvider;

  private visualizacaoWebview?: vscode.WebviewView;

  private desafioAtual?: Desafio;

  private gabaritoAtual?: GabaritoGerado;

  private avaliacaoAtual?: ResultadoAvaliacao;

  private inicioTentativaMs = Date.now();

  private fimTentativaMs?: number;

  // Por que o desafio atual não pode mais ser corrigido. Fica só na memória,
  // como o desafio: a extensão de IA que estava rodando só sai da lista
  // depois de "Reiniciar Extensões", que reinicia esta extensão também.
  private motivoInvalidacao?: string;

  private estadoAutenticacao: EstadoAutenticacao;

  private readonly pagina: PaginaDoAluno;

  // Enquanto a extensão pergunta se pode limpar os arquivos, outro clique não
  // gera um segundo desafio.
  private gerandoDesafio = false;

  // Precisões das correções do desafio atual, da primeira à última.
  private historicoNotas: number[] = [];

  // A melhor nota desta vez que o desafio é feito, para Copiar resultado.
  private melhorDaTentativa?: MelhorDaTentativa;

  // A verificação mede a página dentro da barra lateral: o atalho só a pede
  // quando o script da barra já carregou.
  private barraPronta = false;
  private verificarQuandoPronta = false;

  private readonly historico: HistoricoDoAluno;

  private readonly corretor: Corretor;

  // O resumo dos arquivos fica na página do aluno; os testes o trocam aqui.
  private get resumoWorkspaceAtual(): ResumoWorkspace {
    return this.pagina.resumo;
  }

  private set resumoWorkspaceAtual(resumo: ResumoWorkspace) {
    this.pagina.resumo = resumo;
  }

  private readonly progressoMudou = new vscode.EventEmitter<ProgressoGuia>();

  /** Para o guia de primeiros passos marcar o que o aluno já fez. */
  public readonly onDidMudarProgresso = this.progressoMudou.event;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly authService: AuthService,
    // Guarda qual gabarito do evento de treino esta instalação criou, o
    // histórico e as escolhas do aluno.
    private readonly registroGabaritos: vscode.Memento,
    private readonly detectarExtensoesIa: () => ExtensaoIa[] = () =>
      encontrarExtensoesIa(),
    // Opcional para os testes não criarem itens na barra de status.
    private readonly barraDeStatus?: BarraDeStatus,
  ) {
    this.loginProvider = new LoginProvider(authService);
    this.pagina = new PaginaDoAluno(extensionUri);
    // O mesmo armazenamento global da extensão, com uma chave por aluno.
    this.historico = new HistoricoDoAluno(registroGabaritos, () =>
      authService.isAutenticado() ? authService.getSessaoAtual()?.email : undefined,
    );
    this.corretor = new Corretor(
      () => this.lerConfiguracaoServidorAtual(),
      registroGabaritos,
    );
    this.estadoAutenticacao = authService.getEstadoAtual();

    this.authService.onDidChangeEstado((estado) => {
      this.estadoAutenticacao = estado;
      this.renderizarWebviewAtual();

      if (estado.status === "authenticated") {
        void this.atualizarPreviewWorkspace();
      } else if (estado.status === "unauthenticated") {
        this.esquecerDesafio();
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

    const controlador = this.controladorDaBarra();
    visualizacaoWebview.webview.onDidReceiveMessage(
      (mensagem: MensagemRecebidaBarraLateral) =>
        rotearMensagem(mensagem, controlador),
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
      avisarExtensoesIa(extensoesIa);
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
      if (temTrabalho && !(await confirmarLimpeza())) {
        return;
      }

      this.desafioAtual = criarDesafioPorCodigo(
        codigo ?? sortearCodigo(this.nivelEscolhido()),
      );
      log.info(
        `Novo desafio: código ${this.desafioAtual.codigo} (${this.desafioAtual.challengeId}).`,
      );
      this.motivoInvalidacao = undefined;
      this.pagina.mostrarDesafio(this.desafioAtual);
      this.gabaritoAtual = undefined;
      this.avaliacaoAtual = undefined;
      this.historicoNotas = [];
      this.melhorDaTentativa = undefined;
      this.verificarQuandoPronta = false;

      if (temTrabalho) {
        await this.limparComAviso(this.desafioAtual);
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

  // Separados para os testes trocarem a leitura e a escrita dos arquivos.
  private lerArquivosDoAluno(): Promise<ResumoWorkspace> {
    return lerResumoWorkspace();
  }

  private limparArquivosDoAluno(largura: number, altura: number): Promise<void> {
    return limparArquivosDeTreino(largura, altura);
  }

  private async limparComAviso(desafio: Desafio): Promise<void> {
    try {
      await this.limparArquivosDoAluno(desafio.width, desafio.height);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro desconhecido.";
      log.error("Não foi possível limpar os arquivos de treino", error);
      void vscode.window.showErrorMessage(
        `Não foi possível limpar index.html e style.css: ${mensagem}`,
      );
    }
  }

  /** Cria os arquivos de treino que faltarem e avisa o que aconteceu. */
  public async criarArquivosDeTreino(avisarSeExistirem = true): Promise<void> {
    const criados = await criarArquivosComAviso(
      this.desafioAtual?.width ?? LARGURA_PADRAO,
      this.desafioAtual?.height ?? ALTURA_PADRAO,
      avisarSeExistirem,
    );
    if (criados) {
      await this.atualizarPreviewWorkspace();
    }
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

    if (!ehArquivoDeTreino(this.resumoWorkspaceAtual, alteracao.uri.fsPath)) {
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
    this.avaliacaoAtual = resultadoInvalidado(motivo);
    log.info(`Desafio ${this.desafioAtual.challengeId} invalidado: ${motivo}`);
  }

  public cadastrarNoTorneio(): Promise<void> {
    return cadastrarNoTorneio(this.authService);
  }

  /**
   * Redesenha a barra lateral e a aba com as cores escolhidas. As duas pedem
   * o estado de novo ao carregar, então nada se perde.
   */
  public aplicarCores(): void {
    this.renderizarWebviewAtual();
    this.pagina.aplicarCores();
  }

  /** O nível dos desafios novos; o médio, se o aluno ainda não escolheu. */
  public nivelEscolhido(): Nivel {
    const nivel = this.registroGabaritos.get<unknown>(CHAVE_NIVEL);
    return ehNivel(nivel) ? nivel : "medio";
  }

  public async definirNivel(nivel: Nivel): Promise<void> {
    await this.registroGabaritos.update(CHAVE_NIVEL, nivel);
    this.enviarEstado();
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

  /** "Desafio médio 482 917: 87,42% em 12:34", para colar no grupo da turma. */
  public textoDoResultado(agora = new Date()): string | undefined {
    const codigo = this.desafioAtual?.codigo;
    return codigo && this.melhorDaTentativa
      ? textoDoResultado(codigo, this.melhorDaTentativa, agora)
      : undefined;
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

    const codigo = await pedirCodigo();
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
    const codigo = await this.historico.escolher();
    if (codigo) {
      await this.refazerDesafio(codigo);
    }
  }

  /** O código e o nível do desafio em andamento, para os relatos de problema. */
  public desafioEmAndamento(): { codigo: string; nivel?: Nivel } | undefined {
    const desafio = this.desafioAtual;
    return desafio?.codigo
      ? { codigo: desafio.codigo, nivel: desafio.nivel }
      : undefined;
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
    this.pagina.abrirAba(this.desafioAtual);
  }

  /** A página do aluno acompanha a digitação. */
  public agendarAtualizacaoPreview(): void {
    this.pagina.agendar(() => void this.atualizarPreviewWorkspace());
  }

  public async atualizarPreviewWorkspace(): Promise<void> {
    if (!this.authService.isAutenticado()) {
      return;
    }

    this.pagina.definir(await lerResumoWorkspace());
    this.enviarEstado();
  }

  private encerrarDesafioAtual(): void {
    if (!this.desafioAtual || this.fimTentativaMs !== undefined) {
      return;
    }

    this.fimTentativaMs = Date.now();
    this.enviarEstado();
  }

  // Ao sair, nada do desafio passa para a próxima sessão.
  private esquecerDesafio(): void {
    this.desafioAtual = undefined;
    this.fimTentativaMs = undefined;
    this.motivoInvalidacao = undefined;
    this.gabaritoAtual = undefined;
    this.avaliacaoAtual = undefined;
    this.pagina.esquecer();
    this.corretor.esquecer();
    this.historicoNotas = [];
    this.melhorDaTentativa = undefined;
    this.verificarQuandoPronta = false;
  }

  private verificarTentativaAtual(
    challengeId: string,
    formas: FormaMedida[],
    verificacaoId?: number,
  ): Promise<void> {
    return verificarTentativa(
      this.tentativaEmCurso(),
      this.corretor,
      challengeId,
      formas,
      verificacaoId,
    );
  }

  // O que a verificação (barra-lateral/verificacao.ts) lê e muda aqui.
  private tentativaEmCurso(): TentativaEmCurso {
    return {
      autenticado: () => this.authService.isAutenticado(),
      desafio: () => this.desafioAtual,
      gabarito: () => this.gabaritoAtual,
      extensoesIa: () => this.detectarExtensoesIa(),
      motivoInvalidacao: () => this.motivoInvalidacao,
      invalidar: (motivo) => this.invalidarDesafio(motivo),
      resumo: () => this.resumoWorkspaceAtual,
      definirResumo: (resumo) => this.pagina.definir(resumo),
      guardarResultado: (resultado) => {
        this.avaliacaoAtual = resultado;
      },
      registrarNota: (precisao) => this.registrarNota(precisao),
      enviarEstado: () => this.enviarEstado(),
      criarArquivosQueFaltam: () => void this.criarArquivosDeTreino(false),
      recusarSessaoSePreciso: (httpStatus) =>
        this.invalidarSessaoSeRecusada(httpStatus),
      viewId: ProvedorBarraLateralFlexBox.viewType,
      postar: (mensagem) =>
        void this.visualizacaoWebview?.webview.postMessage(mensagem),
    };
  }

  // Uma nota nova: entra nas tentativas, na melhor da vez e no histórico.
  private async registrarNota(precisao: number): Promise<void> {
    const desafio = this.desafioAtual;
    if (!desafio) {
      return;
    }
    const tempoAte = (instante: number) =>
      (this.fimTentativaMs ?? instante) - this.inicioTentativaMs;

    this.historicoNotas = [...this.historicoNotas, precisao];
    this.melhorDaTentativa = melhorEntre(this.melhorDaTentativa, {
      precisao,
      tempoMs: tempoAte(Date.now()),
    });
    await this.historico.registrarNota(desafio, precisao, tempoAte);
    void this.historico.pedirOpiniaoSeForAHora();
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
    const { status, httpStatus } = await testarConexao(
      this.lerConfiguracaoServidorAtual(),
    );
    await this.invalidarSessaoSeRecusada(httpStatus, true);

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
    if (sessaoRecusada(httpStatus, incluirAcessoNegado)) {
      await this.authService.invalidarSessao(
        "O servidor recusou a sessão. Entre novamente.",
      );
    }
  }

  private enviarEstado(): void {
    // A barra de status e o guia valem mesmo com a barra lateral fechada.
    this.barraDeStatus?.atualizar(this.estadoBarraDeStatus());
    this.progressoMudou.fire(this.progressoGuia());

    const webview = this.visualizacaoWebview?.webview;
    if (!webview) {
      return;
    }

    void webview.postMessage({
      type: "estadoAutenticacao",
      payload: this.estadoAutenticacao,
    });
    if (!this.authService.isAutenticado()) {
      return;
    }

    const nivel = this.nivelEscolhido();
    for (const mensagem of mensagensDaBarra({
      extensoesIa: this.detectarExtensoesIa(),
      nivel,
      desafio: this.desafioAtual,
      inicioMs: this.inicioTentativaMs,
      fimMs: this.fimTentativaMs,
      resumoWorkspace: this.resumoWorkspaceAtual,
      historicoNotas: this.historicoNotas,
      historico: this.historico.naBarra(this.desafioAtual, nivel),
      avaliacao: this.avaliacaoAtual,
    })) {
      void webview.postMessage(mensagem);
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

  private progressoGuia(): ProgressoGuia {
    const autenticado = this.authService.isAutenticado();
    return {
      autenticado,
      pastaAberta: (vscode.workspace.workspaceFolders?.length ?? 0) > 0,
      semExtensoesIa: this.detectarExtensoesIa().length === 0,
      temDesafio: autenticado && Boolean(this.desafioAtual),
      verificou:
        this.historicoNotas.length > 0 || this.historico.registros().length > 0,
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
    const webview = this.visualizacaoWebview.webview;
    webview.html = this.authService.isAutenticado()
      ? obterHtmlWebview(
          webview,
          this.extensionUri,
          this.authService.getSessaoAtual()?.displayName,
        )
      : obterHtmlAutenticacao(webview, this.extensionUri);
  }

  // O que cada pedido da barra lateral faz (veja barra-lateral/mensagens.ts).
  private controladorDaBarra(): ControladorDaBarra {
    return {
      autenticado: () => this.authService.isAutenticado(),
      desafioAtual: () => this.desafioAtual,
      aoCarregar: () => {
        this.barraPronta = true;
        this.enviarEstado();
        if (this.authService.isAutenticado()) {
          void this.atualizarPreviewWorkspace();
        }
        // O atalho de Verificar abriu a barra: agora ela já pode medir.
        this.enviarVerificacaoPendente();
      },
      abrirLogin: () =>
        void this.loginProvider.abrirLogin().catch(mostrarFalhaAoAbrirLogin),
      entrarCom: (provedor) =>
        void this.authService.loginComProvedorVSCode(provedor),
      entrarComGoogle: () =>
        void this.authService.abrirLoginGoogle().catch(mostrarFalhaAoAbrirLogin),
      revalidarSessao: () => void this.loginProvider.revalidarSessao(),
      sair: () => void this.loginProvider.sair(),
      receberGabarito: (gabarito) => {
        this.gabaritoAtual = gabarito;
        log.info(
          `Gabarito PNG gerado: ${gabarito.challengeId} (${gabarito.width}x${gabarito.height})`,
        );
      },
      novoDesafio: () => {
        void this.iniciarNovoDesafio();
        void this.atualizarPreviewWorkspace();
      },
      desafioDoDia: () => void this.abrirDesafioDoDia(),
      definirNivel: (nivel) => void this.definirNivel(nivel),
      copiarResultado: () => void this.copiarResultado(),
      relatarProblema: (mensagem) =>
        void vscode.commands.executeCommand("flexbox-trainer.relatarProblema", mensagem),
      abrirPorCodigo: () => void this.abrirDesafioPorCodigo(),
      refazer: (codigo) => void this.refazerDesafio(codigo),
      verHistorico: () => void this.verHistorico(),
      copiarCodigo: () => void this.copiarCodigo(),
      abrirPainelGabarito: () => this.abrirPainelGabarito(),
      verExtensoesIa: () => void this.verExtensoesIa(),
      criarArquivos: () => void this.criarArquivosDeTreino(),
      cadastrarNoTorneio: () => void this.cadastrarNoTorneio(),
      encerrarDesafio: () => this.encerrarDesafioAtual(),
      atualizarPreview: () => void this.atualizarPreviewWorkspace(),
      verificar: (challengeId, formas, verificacaoId) =>
        void this.verificarTentativaAtual(challengeId, formas, verificacaoId),
    };
  }
}

function mostrarFalhaAoAbrirLogin(error: unknown): void {
  const mensagem =
    error instanceof Error ? error.message : "Não foi possível abrir o login.";
  void vscode.window.showErrorMessage(`Erro no login: ${mensagem}`);
}
