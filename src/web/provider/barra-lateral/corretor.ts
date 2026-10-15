import * as vscode from "vscode";
import { avaliarTentativa } from "../../services/avaliacao";
import {
  ConfiguracaoServidor,
  FormaMedida,
  GabaritoGerado,
  ResultadoAvaliacao,
} from "../../types";

const CRIAR_DINAMICA = "Criar dinâmica de treino";

export type TentativaParaCorrigir = {
  challengeId: string;
  formas: FormaMedida[];
  gabarito: GabaritoGerado;
};

/**
 * Manda a página do aluno para o servidor corrigir. Uma página igual à da
 * última correção não é reenviada: a nota se repete.
 */
export class Corretor {
  // Última correção com nota.
  private ultima?: {
    challengeId: string;
    assinatura: string;
    resultado: ResultadoAvaliacao;
  };

  public constructor(
    private readonly lerConfiguracao: () => ConfiguracaoServidor,
    // Guarda qual gabarito do evento de treino esta instalação criou.
    private readonly registroGabaritos: vscode.Memento,
  ) {}

  /**
   * A nota da tentativa, ou nada se o desafio mudou no meio do caminho. Sem
   * dinâmica de treino, oferece criar uma antes.
   */
  public async corrigir(
    tentativa: TentativaParaCorrigir,
    aoProgredir: (mensagem: string) => void,
    aindaValida: () => boolean,
  ): Promise<ResultadoAvaliacao | undefined> {
    if (!this.lerConfiguracao().eventoTreino) {
      await oferecerDinamicaDeTreino();
      if (!aindaValida()) {
        return undefined;
      }
    }

    const configuracao = this.lerConfiguracao();
    // As formas medidas são o que o servidor compara: se não mudaram, a nota
    // também não mudaria.
    const assinatura = JSON.stringify([configuracao.eventoTreino, tentativa.formas]);
    if (
      this.ultima?.challengeId === tentativa.challengeId &&
      this.ultima.assinatura === assinatura
    ) {
      return { ...this.ultima.resultado, repetida: true };
    }

    const resultado = await avaliarTentativa(
      tentativa,
      configuracao,
      this.registroGabaritos,
      aoProgredir,
    );
    if (!aindaValida()) {
      return undefined;
    }

    this.ultima =
      resultado.source === "servidor"
        ? { challengeId: tentativa.challengeId, assinatura, resultado }
        : undefined;
    return resultado;
  }

  /** Ao sair, nenhuma nota passa para a próxima sessão. */
  public esquecer(): void {
    this.ultima = undefined;
  }
}

// Primeiro uso: oferece criar a dinâmica aqui mesmo, sem a paleta de
// comandos; sem ela, avaliarTentativa explica como configurar.
async function oferecerDinamicaDeTreino(): Promise<void> {
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
    await vscode.commands.executeCommand("flexbox-trainer.criarDinamicaTreino");
  }
}
