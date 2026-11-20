import { log } from "../../services/logger";
import { ExtensaoIa } from "../../services/extensoesIa";
import { Desafio, GabaritoGerado, ResultadoAvaliacao } from "../../types";
import { ResumoDaTentativa } from "./estado";
import { resultadoInvalidado } from "./regras";
import { melhorEntre, MelhorDaTentativa } from "./resultado";

/**
 * O desafio em andamento: o gabarito, o tempo, as notas e se ainda pode ser
 * corrigido. Fica só na memória; ao sair, nada passa para a próxima sessão.
 */
export class Tentativa {
  public desafio?: Desafio;

  public gabarito?: GabaritoGerado;

  public avaliacao?: ResultadoAvaliacao;

  public inicioMs = Date.now();

  public fimMs?: number;

  // Por que o desafio não pode mais ser corrigido. A extensão de IA que
  // estava rodando só sai da lista depois de "Reiniciar Extensões", que
  // reinicia esta extensão também.
  public motivoInvalidacao?: string;

  // Precisões das correções do desafio, da primeira à última.
  public notas: number[] = [];

  // A melhor nota desta vez que o desafio é feito, para Copiar resultado.
  public melhor?: MelhorDaTentativa;

  /** Um desafio novo; o tempo só começa em iniciarRelogio. */
  public comecar(desafio: Desafio): void {
    this.limpar();
    this.desafio = desafio;
  }

  public iniciarRelogio(agora = Date.now()): void {
    this.inicioMs = agora;
    this.fimMs = undefined;
  }

  public esquecer(): void {
    this.limpar();
    this.desafio = undefined;
    this.fimMs = undefined;
  }

  private limpar(): void {
    this.motivoInvalidacao = undefined;
    this.gabarito = undefined;
    this.avaliacao = undefined;
    this.notas = [];
    this.melhor = undefined;
  }

  /** Para o tempo. Devolve se parou agora (e não já estava parado). */
  public encerrar(agora = Date.now()): boolean {
    if (!this.desafio || this.fimMs !== undefined) {
      return false;
    }
    this.fimMs = agora;
    return true;
  }

  /** O desafio não pode mais ser corrigido; o primeiro motivo é o que vale. */
  public invalidar(motivo: string): void {
    if (!this.desafio || this.motivoInvalidacao) {
      return;
    }
    this.motivoInvalidacao = motivo;
    this.avaliacao = resultadoInvalidado(motivo);
    log.info(`Desafio ${this.desafio.challengeId} invalidado: ${motivo}`);
  }

  /** O tempo do desafio até o instante, ou até o fim, se já parou. */
  public tempoAte(instante: number): number {
    return (this.fimMs ?? instante) - this.inicioMs;
  }

  /** Uma nota nova: entra nas tentativas e na melhor da vez. */
  public registrarNota(precisao: number, agora = Date.now()): void {
    this.notas = [...this.notas, precisao];
    this.melhor = melhorEntre(this.melhor, {
      precisao,
      tempoMs: this.tempoAte(agora),
    });
  }

  public resumo(
    autenticado: boolean,
    extensoesIa: ExtensaoIa[],
    jaVerificouAntes: boolean,
  ): ResumoDaTentativa {
    return {
      autenticado,
      extensoesIa,
      desafio: this.desafio,
      inicioMs: this.inicioMs,
      fimMs: this.fimMs,
      historicoNotas: this.notas,
      jaVerificouAntes,
      invalidado: Boolean(this.motivoInvalidacao),
    };
  }
}
