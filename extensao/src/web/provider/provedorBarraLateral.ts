import * as vscode from "vscode";
import { AuthService } from "../auth/authService";
import { LoginProvider } from "../auth/loginProvider";
import {
  ConfiguracaoServidor,
  Desafio,
  EstadoAutenticacao,
  FormaMedida,
  MensagemRecebidaBarraLateral,
  Nivel,
  ResumoWorkspace,
  StatusConexaoServidor,
} from "../types";
import { sortearCodigo } from "../services/codigoDesafio";
import { ehNivel } from "../niveis";
import { criarDesafioPorCodigo } from "../services/desafio";
import {
  escreverArquivosDeTreino,
  lerResumoWorkspace,
  limparArquivosDeTreino,
  temTrabalhoDoAluno,
} from "../services/workspace";
import { ConteudoDoAluno } from "../services/servidor/conteudo";
import { ProgressosSalvos } from "../services/progressosSalvos";
import { AlteracaoExterna } from "../services/alteracoesExternas";
import { log } from "../services/logger";
import {
  abrirExtensoesIa,
  encontrarExtensoesIa,
  ExtensaoIa,
} from "../services/extensoesIa";
import { obterHtmlWebview } from "../telas/barraLateral";
import { obterHtmlAutenticacao } from "../telas/entrada";
import { BarraDeStatus, COMANDO_ABRIR_BARRA } from "./barraDeStatus";
import {
  confirmarLimpeza,
  criarArquivosComAviso,
} from "./barraLateral/arquivosDeTreino";
import * as porCodigo from "./barraLateral/codigos";
import * as conexao from "./barraLateral/conexao";
import { Corretor } from "./barraLateral/corretor";
import {
  estadoDaBarraDeStatus,
  mensagensDaBarra,
  progressoDoGuia,
  ProgressoGuia,
} from "./barraLateral/estado";
import { HistoricoDoAluno } from "./barraLateral/historicoDoAluno";
import { CHAVE_NIVEL } from "../sincronizacao";
import { PaginaDoAluno } from "./barraLateral/paginaDoAluno";
import {
  ContextoDoProgresso,
  puxarProgresso,
  salvarProgresso,
} from "./barraLateral/progresso";
import { ControladorDaBarra, rotearMensagem } from "./barraLateral/mensagens";
import {
  avisarExtensoesIa,
  ehArquivoDeTreino,
  motivoExtensoesIa,
} from "./barraLateral/regras";
import { TentativaEmCurso, verificarTentativa } from "./barraLateral/verificacao";
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
    this.progressos = new ProgressosSalvos(registroGabaritos);
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
      // Como no torneio, cada desafio começa do zero: o que o aluno escreveu
      // no anterior não é reaproveitado nem fica fora do tempo.
      // Quem puxa o progresso já confirmou a troca dos arquivos.
      const temTrabalho = temTrabalhoDoAluno(await this.lerArquivosDoAluno());
      if (!retomado && temTrabalho && !(await confirmarLimpeza())) {
        return;
      }

      const desafio = criarDesafioPorCodigo(
        codigo ?? sortearCodigo(this.nivelEscolhido()),
      );
      log.info(`Novo desafio: código ${desafio.codigo} (${desafio.challengeId}).`);
      this.tentativa.comecar(desafio);
      this.pagina.mostrarDesafio(desafio);
      this.vista.esquecerVerificacao();

      if (retomado) {
        await this.gravarComAviso(() => this.escreverArquivosDoAluno(retomado));
      } else if (temTrabalho) {
        await this.gravarComAviso(() => this.limparArquivosDoAluno());
      }

      // O tempo começa com os arquivos já limpos.
      this.tentativa.iniciarRelogio();
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

  private limparArquivosDoAluno(): Promise<void> {
    return limparArquivosDeTreino();
  }

  private escreverArquivosDoAluno(conteudo: ConteudoDoAluno): Promise<void> {
    return escreverArquivosDeTreino(conteudo.html, conteudo.css);
  }

  private async gravarComAviso(gravar: () => Promise<void>): Promise<void> {
    try {
      await gravar();
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro desconhecido.";
      log.error("Não foi possível gravar os arquivos de treino", error);
      void vscode.window.showErrorMessage(
        `Não foi possível gravar index.html e style.css: ${mensagem}`,
      );
    }
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

    if (
      !this.tentativa.desafio ||
      this.tentativa.motivoInvalidacao ||
      alteracao.instante < this.tentativa.inicioMs
    ) {
      return;
    }

    if (!ehArquivoDeTreino(this.resumoWorkspaceAtual, alteracao.uri.fsPath)) {
      return;
    }

    const nome = alteracao.uri.path.split("/").pop() ?? "arquivo";
    this.tentativa.invalidar(`o ${nome} foi alterado fora do editor.`);
    this.enviarEstado();
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
  public abrirDesafioDoDia(): Promise<void> {
    return porCodigo.abrirDesafioDoDia(this.contextoDosCodigos());
  }

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

  public textoDoResultado(agora = new Date()): string | undefined {
    return porCodigo.textoDoResultadoAtual(this.contextoDosCodigos(), agora);
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
    return salvarProgresso(this.contextoDoProgresso());
  }

  /** Pede o código e traz o que foi salvo nele (veja barraLateral/progresso.ts). */
  public puxarProgresso(): Promise<void> {
    return puxarProgresso(this.contextoDoProgresso());
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
  private tentativaEmCurso(): TentativaEmCurso {
    return {
      autenticado: () => this.authService.isAutenticado(),
      desafio: () => this.tentativa.desafio,
      gabarito: () => this.tentativa.gabarito,
      extensoesIa: () => this.detectarExtensoesIa(),
      motivoInvalidacao: () => this.tentativa.motivoInvalidacao,
      invalidar: (motivo) => this.tentativa.invalidar(motivo),
      resumo: () => this.resumoWorkspaceAtual,
      definirResumo: (resumo) => this.pagina.definir(resumo),
      guardarResultado: (resultado) => {
        this.tentativa.avaliacao = resultado;
      },
      registrarNota: (precisao) => this.registrarNota(precisao),
      enviarEstado: () => this.enviarEstado(),
      criarArquivosQueFaltam: () => void this.criarArquivosDeTreino(false),
      recusarSessaoSePreciso: (httpStatus) =>
        this.invalidarSessaoSeRecusada(httpStatus),
      viewId: ProvedorBarraLateralFlexBox.viewType,
      postar: (mensagem) => this.vista.postar(mensagem),
    };
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
      desafio: this.tentativa.desafio,
      inicioMs: this.tentativa.inicioMs,
      fimMs: this.tentativa.fimMs,
      resumoWorkspace: this.resumoWorkspaceAtual,
      historicoNotas: this.tentativa.notas,
      historico: this.historico.naBarra(this.tentativa.desafio, nivel),
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
