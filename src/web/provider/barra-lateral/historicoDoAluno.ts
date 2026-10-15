import * as vscode from "vscode";
import { NOME_DO_NIVEL, nivelDoCodigo } from "../../niveis";
import {
  codigoDoDia,
  diaLocal,
  formatarCodigo,
} from "../../services/codigoDesafio";
import {
  HistoricoDesafios,
  NotaDoDia,
  RegistroHistorico,
  SequenciaDoDia,
} from "../../services/historico";
import { Desafio, Nivel } from "../../types";
import { formatarTempo } from "../barra-de-status";
import { formatarPorcentagem } from "./resultado";

// Na barra lateral cabem os desafios mais recentes; o resto fica no comando
// Histórico de Desafios.
const HISTORICO_NA_BARRA = 5;
// O gráfico da evolução mostra os últimos 30 dias em que o aluno treinou.
const DIAS_NO_GRAFICO = 30;
// O pedido de opinião aparece uma vez, depois deste tanto de desafios.
const CHAVE_OPINIAO_PEDIDA = "flexboxTrainer.opiniaoPedida";
const DESAFIOS_ANTES_DA_OPINIAO = 3;
const RESPONDER = "Responder";
const AGORA_NAO = "Agora não";

/** O que a seção Histórico da barra lateral mostra. */
export type HistoricoNaBarra = {
  registros: RegistroHistorico[];
  total: number;
  recorde: number | null;
  sequencia: SequenciaDoDia | null;
  evolucao: NotaDoDia[];
};

/**
 * O histórico de quem está na sessão: os desafios verificados, a evolução e
 * a sequência do desafio do dia. Sem sessão, fica vazio.
 */
export class HistoricoDoAluno {
  private readonly historico: HistoricoDesafios;

  public constructor(
    private readonly armazenamento: vscode.Memento,
    private readonly emailDaSessao: () => string | undefined,
  ) {
    this.historico = new HistoricoDesafios(armazenamento);
  }

  public registros(): RegistroHistorico[] {
    return this.historico.listar(this.emailDaSessao());
  }

  /** A nota entra no histórico com o tempo em que foi alcançada. */
  public async registrarNota(
    desafio: Desafio,
    precisao: number,
    tempoMs: (instante: number) => number,
  ): Promise<void> {
    if (!desafio.codigo) {
      return;
    }

    const instante = Date.now();
    const email = this.emailDaSessao();
    await this.historico.registrarNota(email, {
      codigo: desafio.codigo,
      nivel: desafio.nivel ?? nivelDoCodigo(desafio.codigo),
      tentativa: desafio.challengeId,
      precisao,
      tempoMs: tempoMs(instante),
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

  /** O gráfico mostra o nível escolhido: misturar níveis esconderia o progresso. */
  public naBarra(desafio: Desafio | undefined, nivel: Nivel): HistoricoNaBarra {
    const email = this.emailDaSessao();
    const registros = this.registros();
    return {
      registros: registros.slice(0, HISTORICO_NA_BARRA),
      total: registros.length,
      recorde: recordeDoDesafio(registros, desafio) ?? null,
      sequencia:
        (email
          ? this.historico.sequenciaDoDia(email, diaLocal(new Date(Date.now())))
          : undefined) ?? null,
      evolucao: email
        ? this.historico.evolucao(email, nivel).slice(-DIAS_NO_GRAFICO)
        : [],
    };
  }

  /** Todos os desafios do histórico; devolve o código do escolhido. */
  public async escolher(): Promise<string | undefined> {
    const registros = this.registros();
    if (registros.length === 0) {
      void vscode.window.showInformationMessage(
        "Os desafios que você verificar aparecem no histórico.",
      );
      return undefined;
    }

    const escolhido = await vscode.window.showQuickPick(
      registros.map((registro) => ({
        label:
          `${formatarCodigo(registro.codigo)} · ` +
          NOME_DO_NIVEL[nivelDoCodigo(registro.codigo)],
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
    return escolhido?.codigo;
  }

  /**
   * Uma vez só, depois do terceiro desafio verificado: a opinião de quem já
   * usou a extensão de verdade.
   */
  public async pedirOpiniaoSeForAHora(): Promise<void> {
    if (
      this.armazenamento.get<boolean>(CHAVE_OPINIAO_PEDIDA) ||
      this.registros().length < DESAFIOS_ANTES_DA_OPINIAO
    ) {
      return;
    }
    await this.armazenamento.update(CHAVE_OPINIAO_PEDIDA, true);
    const escolha = await vscode.window.showInformationMessage(
      "Pode responder 10 perguntas rápidas sobre o FlexBox Trainer? " +
        "A sua opinião ajuda no nosso TCC.",
      RESPONDER,
      AGORA_NAO,
    );
    if (escolha === RESPONDER) {
      await vscode.commands.executeCommand("flexbox-trainer.darOpiniao");
    }
  }
}

// O melhor que o aluno já fez neste código antes: aparece quando ele refaz
// um desafio, como a nota a bater.
function recordeDoDesafio(
  registros: RegistroHistorico[],
  desafio: Desafio | undefined,
): number | undefined {
  const registro = desafio?.codigo
    ? registros.find((item) => item.codigo === desafio.codigo)
    : undefined;
  if (!registro || !desafio) {
    return undefined;
  }
  const deOutraVez =
    registro.ultimaTentativa !== desafio.challengeId || registro.vezes > 1;
  return deOutraVez ? registro.melhor : undefined;
}
