import * as vscode from "vscode";
import { AuthService } from "../auth/authService";
import { LoginProvider } from "../auth/loginProvider";
import {
  ConfiguracaoServidor,
  Desafio,
  EstadoAutenticacao,
  FormaMedida,
  Formato,
  MensagemRecebidaBarraLateral,
  Nivel,
  ResumoWorkspace,
  StatusConexaoServidor,
  Tamanho,
} from "../types";
import {
  escreverArquivosDeTreino,
  lerResumoWorkspace,
  limparArquivosDeTreino,
} from "../services/workspace";
import { ConteudoDoAluno } from "../services/servidor/conteudo";
import { CopiasDeSeguranca } from "../services/copiasDeSeguranca";
import { ProgressosSalvos } from "../services/progressosSalvos";
import { AlteracaoExterna } from "../services/alteracoesExternas";
import {
  abrirExtensoesIa,
  encontrarExtensoesIa,
  ExtensaoIa,
} from "../services/extensoesIa";
import { obterHtmlWebview } from "../telas/barraLateral";
import { obterHtmlAutenticacao } from "../telas/entrada";
import { BarraDeStatus, COMANDO_ABRIR_BARRA } from "./barraDeStatus";
import { criarArquivosComAviso } from "./barraLateral/arquivosDeTreino";
import * as porCodigo from "./barraLateral/codigos";
import * as conexao from "./barraLateral/conexao";
import { Corretor } from "./barraLateral/corretor";
import {
  estadoDaBarraDeStatus,
  mensagensDaBarra,
  progressoDoGuia,
  ProgressoGuia,
  resultadoDaAba,
} from "./barraLateral/estado";
import { HistoricoDoAluno } from "./barraLateral/historicoDoAluno";
import { PaginaDoAluno } from "./barraLateral/paginaDoAluno";
import { PreferenciasDoDesafio } from "./barraLateral/preferencias";
import { ContextoDaEscolha } from "./barraLateral/tamanhoLivre";
import { comecarDesafio, ContextoDoInicio, restaurarCopia } from "./barraLateral/inicioDoDesafio";
import { SalvamentoNoServidor } from "./barraLateral/salvamentoAutomatico";
import { TamanhosLivres } from "../services/tamanhosLivres";
import {
  ContextoDoProgresso,
  estaNoTorneio,
  puxarProgresso,
  ResultadoDoSalvamento,
} from "./barraLateral/progresso";
import { ControladorDaBarra, rotearMensagem } from "./barraLateral/mensagens";
import {
  avisarExtensoesIa,
  motivoDaAlteracaoExterna,
  motivoExtensoesIa,
} from "./barraLateral/regras";
import { tentativaDaBarra, verificarTentativa } from "./barraLateral/verificacao";
import { Tentativa } from "./barraLateral/tentativa";
import { criarControlador } from "./barraLateral/controlador";
import { VistaDaBarra } from "./barraLateral/vista";

export type { ProgressoGuia } from "./barraLateral/estado";

/**
 * A barra lateral: coordena o desafio em andamento e as partes que ficam em
 * barraLateral/ (tentativa, mensagens, correção, histórico, arquivos).
 */
export class ProvedorBarraLateralFlexBox implements vscode.WebviewViewProvider {
  public static readonly viewType = "flexbox-trainer.sidebar";

  private readonly loginProvider: LoginProvider;

  private readonly vista = new VistaDaBarra();

  // O desafio em andamento (veja barraLateral/tentativa.ts).
  private readonly tentativa = new Tentativa();

  private estadoAutenticacao: EstadoAutenticacao;

  private readonly pagina: PaginaDoAluno;

  // Enquanto a extensão pergunta se pode limpar os arquivos, outro clique não
  // gera um segundo desafio.
  private gerandoDesafio = false;

  private readonly historico: HistoricoDoAluno;

  private readonly corretor: Corretor;

  private readonly progressos: ProgressosSalvos;
  private readonly copias: CopiasDeSeguranca;
  private readonly preferencias: PreferenciasDoDesafio;
  private readonly tamanhosLivres: TamanhosLivres;

  // O progresso no servidor (veja barraLateral/salvamentoAutomatico.ts).
  private readonly salvamento: SalvamentoNoServidor;

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
    registroGabaritos: vscode.Memento,
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
    this.progressos = new ProgressosSalvos(registroGabaritos);
    this.copias = new CopiasDeSeguranca(registroGabaritos);
    this.preferencias = new PreferenciasDoDesafio(registroGabaritos);
    this.tamanhosLivres = new TamanhosLivres(registroGabaritos);
    this.salvamento = new SalvamentoNoServidor(
      () => this.contextoDoProgresso(),
      () => this.tentativa.desafio?.codigo,
      () => this.lerConfiguracaoServidorAtual(),
      () => this.enviarEstado(),
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
    this.vista.conectar(visualizacaoWebview);
    this.renderizarWebviewAtual();

    const controlador = this.controladorDaBarra();
    visualizacaoWebview.webview.onDidReceiveMessage(
      (mensagem: MensagemRecebidaBarraLateral) =>
        rotearMensagem(mensagem, controlador),
    );

    if (this.authService.isAutenticado()) {
      void this.atualizarPreviewWorkspace();
    }
  }

  /**
   * Sem código, sorteia um desafio; com código, abre exatamente aquele. Com
   * o progresso puxado do servidor, o desafio começa com ele nos arquivos.
   */
  public async iniciarNovoDesafio(
    codigo?: string,
    retomado?: ConteudoDoAluno,
  ): Promise<void> {
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
      // O começo fica em barraLateral/inicioDoDesafio.ts.
      if (await comecarDesafio(this.contextoDoInicio(), codigo, retomado)) {
        this.enviarEstado();
        void this.testarConexaoServidor();
        // Sem esperar: numa pasta nova, cria index.html e style.css para o aluno.
        void this.criarArquivosSeFaltarem();
      }
    } finally {
      this.gerandoDesafio = false;
    }
  }

  /**
   * Volta uma cópia de segurança para index.html e style.css, com o desafio
   * dela (veja barraLateral/inicioDoDesafio.ts).
   */
  public async restaurarCopiaDeSeguranca(): Promise<void> {
    if (!this.authService.isAutenticado()) {
      void vscode.window.showInformationMessage(
        "Entre na sua conta para restaurar uma cópia de segurança.",
      );
      return;
    }
    await restaurarCopia(
      this.contextoDoInicio(),
      this.copias.listar(this.authService.getSessaoAtual()?.email),
      (codigo, conteudo) => this.iniciarNovoDesafio(codigo, conteudo),
    );
  }

  private contextoDoInicio(): ContextoDoInicio {
    return {
      escolha: this.contextoDaEscolha(),
      lerArquivos: () => this.lerArquivosDoAluno(),
      limparArquivos: () => this.limparArquivosDoAluno(),
      escreverArquivos: (conteudo) => this.escreverArquivosDoAluno(conteudo),
      guardarCopia: (arquivos) =>
        this.copias.guardar(this.authService.getSessaoAtual()?.email, {
          codigo: this.tentativa.desafio?.codigo,
          html: arquivos.textoHtml,
          css: arquivos.textoCss,
          quando: Date.now(),
        }),
      mostrar: (desafio) => {
        this.tentativa.comecar(desafio);
        this.pagina.mostrarDesafio(desafio);
        this.vista.esquecerVerificacao();
      },
      iniciarRelogio: () => this.tentativa.iniciarRelogio(),
    };
  }

  // Separados para os testes trocarem a leitura e a escrita dos arquivos.
  private lerArquivosDoAluno(): Promise<ResumoWorkspace> {
    return lerResumoWorkspace();
  }

  private limparArquivosDoAluno(): Promise<void> {
    return limparArquivosDeTreino();
  }

  private escreverArquivosDoAluno(conteudo: ConteudoDoAluno): Promise<void> {
    return escreverArquivosDeTreino(conteudo.html, conteudo.css);
  }

  /** Cria os arquivos de treino que faltarem e avisa o que aconteceu. */
  public async criarArquivosDeTreino(avisarSeExistirem = true): Promise<void> {
    const criados = await criarArquivosComAviso(avisarSeExistirem);
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
    return this.tentativa.desafio;
  }

  /**
   * As extensões habilitadas mudaram. Uma de IA habilitada durante o desafio
   * o invalida, mesmo que seja desabilitada depois.
   */
  public atualizarExtensoesIa(): void {
    const extensoesIa = this.detectarExtensoesIa();
    if (extensoesIa.length > 0) {
      this.tentativa.invalidar(motivoExtensoesIa(extensoesIa));
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
    const motivo = motivoDaAlteracaoExterna(
      alteracao,
      this.tentativa,
      this.resumoWorkspaceAtual,
    );
    if (motivo) {
      this.tentativa.invalidar(motivo);
      this.enviarEstado();
    }
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
    return this.preferencias.nivel();
  }

  /** O formato dos desafios novos; o quadrado, se o aluno ainda não escolheu. */
  public formatoEscolhido(): Formato {
    return this.preferencias.formato();
  }

  public async definirNivel(nivel: Nivel): Promise<void> {
    await this.preferencias.definirNivel(nivel);
    this.enviarEstado();
  }

  public async definirFormato(formato: Formato): Promise<void> {
    await this.preferencias.definirFormato(formato);
    this.enviarEstado();
  }

  /** A largura e a altura dos desafios livres novos. */
  public tamanhoLivreEscolhido(): Tamanho {
    return this.preferencias.tamanhoLivre();
  }

  public async definirTamanhoLivre(tamanho: Tamanho): Promise<void> {
    await this.preferencias.definirTamanhoLivre(tamanho);
    this.enviarEstado();
  }

  private contextoDaEscolha(): ContextoDaEscolha {
    return {
      nivel: () => this.nivelEscolhido(),
      formato: () => this.formatoEscolhido(),
      tamanhoLivre: () => this.tamanhoLivreEscolhido(),
      dono: () => this.authService.getSessaoAtual()?.email,
      tamanhos: this.tamanhosLivres,
      desafioAtual: () => this.tentativa.desafio,
      configuracao: () => this.lerConfiguracaoServidorAtual(),
    };
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
    if (!this.tentativa.desafio) {
      void vscode.window.showInformationMessage("Gere um desafio antes de verificar.");
      return;
    }

    this.vista.guardarVerificacao();
    await vscode.commands.executeCommand(COMANDO_ABRIR_BARRA);
    this.vista.enviarVerificacaoPendente();
  }

  // Abrir, refazer e copiar pelo código ficam em barraLateral/codigos.ts.
  public abrirDesafioPorCodigo(): Promise<void> {
    return porCodigo.abrirDesafioPorCodigo(this.contextoDosCodigos());
  }

  public refazerDesafio(codigo?: string): Promise<void> {
    return porCodigo.refazerDesafio(this.contextoDosCodigos(), codigo);
  }

  public verHistorico(): Promise<void> {
    return porCodigo.verHistorico(this.contextoDosCodigos());
  }

  public copiarCodigo(): Promise<void> {
    return porCodigo.copiarCodigo(this.contextoDosCodigos());
  }

  public textoDoResultado(): string | undefined {
    return porCodigo.textoDoResultadoAtual(this.contextoDosCodigos());
  }

  public copiarResultado(): Promise<void> {
    return porCodigo.copiarResultado(this.contextoDosCodigos());
  }

  private contextoDosCodigos(): porCodigo.ContextoDosCodigos {
    return {
      autenticado: () => this.authService.isAutenticado(),
      codigoAtual: () => this.tentativa.desafio?.codigo,
      melhorDaTentativa: () => this.tentativa.melhor,
      historico: this.historico,
      abrir: (codigo) => this.iniciarNovoDesafio(codigo),
    };
  }

  /** Guarda no servidor o index.html e o style.css do desafio atual. */
  public salvarProgresso(): Promise<boolean> {
    return this.salvamento.salvarPeloMenu();
  }

  /**
   * Traz o que foi salvo no desafio do código; sem o código, pergunta qual
   * (veja barraLateral/progresso.ts).
   */
  public puxarProgresso(codigo?: string): Promise<void> {
    return puxarProgresso(this.contextoDoProgresso(), codigo);
  }

  /**
   * Depois de cada nota, quem está no torneio já fica com o progresso salvo
   * no servidor, sem clicar em nada. Devolve o que aconteceu (para os testes).
   */
  public salvarSozinho(): Promise<ResultadoDoSalvamento> {
    return this.salvamento.salvarSozinho();
  }

  private contextoDoProgresso(): ContextoDoProgresso {
    return {
      autenticado: () => this.authService.isAutenticado(),
      dono: () => this.authService.getSessaoAtual()?.email,
      progressos: this.progressos,
      configuracao: () => this.lerConfiguracaoServidorAtual(),
      desafio: () => this.tentativa.desafio,
      gabarito: () => this.tentativa.gabarito,
      lerArquivos: () => this.lerArquivosDoAluno(),
      abrirDesafio: (codigo, conteudo) => this.iniciarNovoDesafio(codigo, conteudo),
      recusarSessaoSePreciso: (httpStatus) =>
        this.invalidarSessaoSeRecusada(httpStatus),
    };
  }

  /** Abre a página das extensões de IA habilitadas, para desabilitá-las. */
  public async verExtensoesIa(): Promise<ExtensaoIa[]> {
    const lista = this.detectarExtensoesIa();
    await abrirExtensoesIa(lista);
    return lista;
  }

  /** Com a sessão aberta e um desafio em andamento. */
  public temDesafio(): boolean {
    return this.authService.isAutenticado() && Boolean(this.tentativa.desafio);
  }

  public abrirPainelGabarito(): void {
    this.pagina.abrirAba(this.tentativa.desafio);
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
    if (this.tentativa.encerrar()) {
      this.enviarEstado();
    }
  }

  // Ao sair, nada do desafio passa para a próxima sessão.
  private esquecerDesafio(): void {
    this.tentativa.esquecer();
    this.pagina.esquecer();
    this.corretor.esquecer();
    this.vista.esquecerVerificacao();
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

  // O que a verificação (barraLateral/verificacao.ts) lê e muda aqui.
  private tentativaEmCurso() {
    return tentativaDaBarra({
      tentativa: this.tentativa,
      pagina: this.pagina,
      postarNaBarra: (mensagem) => this.vista.postar(mensagem),
      viewId: ProvedorBarraLateralFlexBox.viewType,
      autenticado: () => this.authService.isAutenticado(),
      extensoesIa: () => this.detectarExtensoesIa(),
      resumo: () => this.resumoWorkspaceAtual,
      registrarNota: (precisao) => this.registrarNota(precisao),
      enviarEstado: () => this.enviarEstado(),
      criarArquivosQueFaltam: () => void this.criarArquivosDeTreino(false),
      recusarSessaoSePreciso: (httpStatus) =>
        this.invalidarSessaoSeRecusada(httpStatus),
    });
  }

  // Uma nota nova: entra nas tentativas, na melhor da vez e no histórico.
  private async registrarNota(precisao: number): Promise<void> {
    const desafio = this.tentativa.desafio;
    if (!desafio) {
      return;
    }
    this.tentativa.registrarNota(precisao);
    await this.historico.registrarNota(desafio, precisao, (instante) =>
      this.tentativa.tempoAte(instante),
    );
    // Sem esperar: a nota aparece já, o salvamento vem depois.
    void this.salvarSozinho();
  }

  /** O comando Testar Servidor (veja barraLateral/conexao.ts). */
  public testarServidorPeloComando(): Promise<void> {
    return conexao.testarServidorPeloComando(this.authService.isAutenticado(), () =>
      this.testarConexaoServidor(true),
    );
  }

  // Cada desafio novo testa a sessão; a barra lateral só fala se der erro.
  private async testarConexaoServidor(
    peloComando = false,
  ): Promise<StatusConexaoServidor> {
    const { status, httpStatus } = await conexao.testarConexao(
      this.lerConfiguracaoServidorAtual(),
    );
    await this.invalidarSessaoSeRecusada(httpStatus, true);

    if (!peloComando && !status.ok) {
      this.vista.postar({ type: "statusServidor", payload: status });
    }
    return status;
  }

  private lerConfiguracaoServidorAtual(): ConfiguracaoServidor {
    return conexao.configuracaoDaSessao(this.authService);
  }

  private invalidarSessaoSeRecusada(
    httpStatus?: number,
    incluirAcessoNegado = false,
  ): Promise<void> {
    return conexao.encerrarSessaoSeRecusada(
      this.authService,
      httpStatus,
      incluirAcessoNegado,
    );
  }

  private enviarEstado(): void {
    // A barra de status e o guia valem mesmo com a barra lateral fechada.
    const tentativa = this.tentativa.resumo(
      this.authService.isAutenticado(),
      this.detectarExtensoesIa(),
      this.historico.registros().length > 0,
    );
    this.barraDeStatus?.atualizar(estadoDaBarraDeStatus(tentativa));
    this.pagina.mostrarResultado(
      tentativa.autenticado && tentativa.desafio
        ? resultadoDaAba(tentativa, this.tentativa.avaliacao)
        : undefined,
    );
    this.progressoMudou.fire(
      progressoDoGuia(tentativa, (vscode.workspace.workspaceFolders?.length ?? 0) > 0),
    );

    if (!this.vista.webview) {
      return;
    }

    this.vista.postar({ type: "estadoAutenticacao", payload: this.estadoAutenticacao });
    if (!this.authService.isAutenticado()) {
      return;
    }

    const nivel = this.nivelEscolhido();
    for (const mensagem of mensagensDaBarra({
      extensoesIa: this.detectarExtensoesIa(),
      nivel,
      formato: this.formatoEscolhido(),
      tamanhoLivre: this.tamanhoLivreEscolhido(),
      desafio: this.tentativa.desafio,
      inicioMs: this.tentativa.inicioMs,
      fimMs: this.tentativa.fimMs,
      resumoWorkspace: this.resumoWorkspaceAtual,
      historicoNotas: this.tentativa.notas,
      salvamento: this.salvamento.estado(),
      historico: this.historico.naBarra(this.tentativa.desafio, nivel, {
        salvos: this.progressos.listar(this.authService.getSessaoAtual()?.email),
        torneio: estaNoTorneio(this.lerConfiguracaoServidorAtual()),
      }),
      avaliacao: this.tentativa.avaliacao,
    })) {
      this.vista.postar(mensagem);
    }
  }

  private renderizarWebviewAtual(): void {
    this.vista.renderizar((webview) =>
      this.authService.isAutenticado()
        ? obterHtmlWebview(
            webview,
            this.extensionUri,
            this.authService.getSessaoAtual()?.displayName,
          )
        : obterHtmlAutenticacao(webview, this.extensionUri),
    );
  }

  // O que cada pedido da barra lateral faz (veja barraLateral/controlador.ts).
  private controladorDaBarra(): ControladorDaBarra {
    return criarControlador({
      provedor: this,
      authService: this.authService,
      loginProvider: this.loginProvider,
      desafioAtual: () => this.tentativa.desafio,
      aoCarregar: () => {
        this.vista.marcarPronta();
        this.enviarEstado();
        if (this.authService.isAutenticado()) {
          void this.atualizarPreviewWorkspace();
        }
        // O atalho de Verificar abriu a barra: agora ela já pode medir.
        this.vista.enviarVerificacaoPendente();
      },
      receberGabarito: (gabarito) => {
        this.tentativa.gabarito = gabarito;
      },
      encerrarDesafio: () => this.encerrarDesafioAtual(),
      verificar: (challengeId, formas, verificacaoId) =>
        void this.verificarTentativaAtual(challengeId, formas, verificacaoId),
    });
  }
}
