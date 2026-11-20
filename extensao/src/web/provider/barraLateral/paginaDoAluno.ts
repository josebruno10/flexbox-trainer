import * as vscode from "vscode";
import { criarResumoWorkspaceVazio } from "../../services/workspace";
import { Desafio, ResultadoNaAba, ResumoWorkspace } from "../../types";
import { PainelGabarito, VerificacaoNaAba } from "../painelGabarito";

// Espera depois da última tecla antes de redesenhar a página do aluno.
const ESPERA_DIGITACAO_MS = 500;

/**
 * A página do aluno, lida do index.html e do style.css da pasta, e a aba do
 * gabarito, que a mostra ao lado do desafio.
 */
export class PaginaDoAluno {
  public resumo: ResumoWorkspace = criarResumoWorkspaceVazio();

  // Criada na primeira vez que o aluno abre o gabarito em uma aba.
  private painel?: PainelGabarito;

  private agendada?: ReturnType<typeof setTimeout>;

  // A nota mais recente, para a aba já abrir com ela.
  private resultado?: ResultadoNaAba;

  public constructor(private readonly extensionUri: vscode.Uri) {}

  public definir(resumo: ResumoWorkspace): void {
    this.resumo = resumo;
    this.painel?.atualizarPagina(this.html());
  }

  /** O HTML da página, se a pasta tem o index.html ou o style.css. */
  public html(): string | undefined {
    return this.resumo.temArquivoHtml || this.resumo.temArquivoCss
      ? this.resumo.htmlPreview
      : undefined;
  }

  public abrirAba(desafio: Desafio | undefined): void {
    this.painel ??= new PainelGabarito(this.extensionUri);
    this.painel.atualizarResultado(this.resultado);
    this.painel.mostrar(desafio, this.html());
  }

  public mostrarResultado(resultado: ResultadoNaAba | undefined): void {
    this.resultado = resultado;
    this.painel?.atualizarResultado(resultado);
  }

  public avisarVerificacao(verificacao: VerificacaoNaAba): void {
    this.painel?.avisarVerificacao(verificacao);
  }

  public mostrarDesafio(desafio: Desafio | undefined): void {
    this.painel?.atualizar(desafio);
  }

  /** Ao sair, a aba fica sem desafio e sem página. */
  public esquecer(): void {
    this.painel?.atualizar(undefined);
    this.painel?.atualizarPagina(undefined);
  }

  public aplicarCores(): void {
    this.painel?.aplicarCores();
  }

  /** Várias teclas seguidas viram uma só atualização, meio segundo depois da última. */
  public agendar(atualizar: () => void): void {
    clearTimeout(this.agendada);
    this.agendada = setTimeout(() => {
      this.agendada = undefined;
      atualizar();
    }, ESPERA_DIGITACAO_MS);
  }
}
