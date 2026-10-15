import * as vscode from "vscode";
import { ehNivel } from "../niveis";
import { Nivel } from "../types";
import { diaLocal } from "./codigoDesafio";

// Os desafios que o aluno já verificou, com a melhor nota de cada um. Ficam
// só neste computador, separados por e-mail: num laboratório, cada aluno vê
// os próprios. Um desafio refeito (pelo código) continua na mesma linha.
export type RegistroHistorico = {
  codigo: string;
  // Melhor precisão em todas as vezes que o desafio foi feito.
  melhor: number;
  // Tempo do desafio quando ele chegou à melhor precisão.
  tempoMelhorMs: number;
  // Verificações com nota, somando todas as vezes.
  verificacoes: number;
  // Quantas vezes o desafio foi feito até ter nota.
  vezes: number;
  ultimaVez: number;
  ultimaTentativa: string;
};

export type NotaDoDesafio = {
  codigo: string;
  nivel: Nivel;
  // O challengeId: muda a cada vez que o desafio é feito.
  tentativa: string;
  precisao: number;
  tempoMs: number;
  instante: number;
};

// Quantos dias seguidos o aluno verificou o desafio do dia. Vale até o dia
// seguinte ao último: quem fez o de ontem ainda pode fazer o de hoje.
export type SequenciaDoDia = {
  dias: number;
  feitoHoje: boolean;
};

// A melhor nota de um dia de treino num nível, para o gráfico da evolução.
export type NotaDoDia = {
  // "2026-10-14"
  dia: string;
  nivel: Nivel;
  melhor: number;
};

type RegistroSequencia = {
  // "2026-10-14"
  ultimoDia: string;
  dias: number;
};

// Cabe o treino de um semestre sem pesar nas configurações do VS Code.
const LIMITE_REGISTROS = 30;
const LIMITE_DIAS = 60;

export class HistoricoDesafios {
  public constructor(private readonly armazenamento: vscode.Memento) {}

  /** Do mais recente ao mais antigo. */
  public listar(dono: string | undefined): RegistroHistorico[] {
    if (!dono) {
      return [];
    }
    const registros = this.armazenamento.get<unknown>(
      chave(dono, "historico2"),
    );
    return Array.isArray(registros) ? registros.filter(ehRegistro) : [];
  }

  public buscar(
    dono: string | undefined,
    codigo: string,
  ): RegistroHistorico | undefined {
    return this.listar(dono).find((registro) => registro.codigo === codigo);
  }

  public async registrarNota(
    dono: string | undefined,
    nota: NotaDoDesafio,
  ): Promise<void> {
    if (!dono) {
      return;
    }

    const registros = this.listar(dono);
    const anterior = registros.find((registro) => registro.codigo === nota.codigo);
    const melhorou =
      !anterior ||
      nota.precisao > anterior.melhor ||
      (nota.precisao === anterior.melhor && nota.tempoMs < anterior.tempoMelhorMs);
    const atualizado: RegistroHistorico = {
      codigo: nota.codigo,
      melhor: melhorou ? nota.precisao : anterior.melhor,
      tempoMelhorMs: melhorou ? nota.tempoMs : anterior.tempoMelhorMs,
      verificacoes: (anterior?.verificacoes ?? 0) + 1,
      vezes:
        (anterior?.vezes ?? 0) +
        (anterior?.ultimaTentativa === nota.tentativa ? 0 : 1),
      ultimaVez: nota.instante,
      ultimaTentativa: nota.tentativa,
    };

    await this.armazenamento.update(
      chave(dono, "historico2"),
      [atualizado, ...registros.filter((registro) => registro !== anterior)].slice(
        0,
        LIMITE_REGISTROS,
      ),
    );
    await this.registrarNoDia(dono, {
      dia: diaLocal(new Date(nota.instante)),
      nivel: nota.nivel,
      melhor: nota.precisao,
    });
  }

  /**
   * A melhor nota de cada dia de treino, do mais antigo ao mais recente; com
   * o nível, só os dias em que ele foi treinado.
   */
  public evolucao(dono: string | undefined, nivel?: Nivel): NotaDoDia[] {
    if (!dono) {
      return [];
    }
    const dias = this.armazenamento.get<unknown>(chave(dono, "evolucao"));
    return (Array.isArray(dias) ? dias.filter(ehNotaDoDia) : []).filter(
      (dia) => !nivel || dia.nivel === nivel,
    );
  }

  /** Conta na sequência o desafio do dia de `dia` ("2026-10-14"), uma vez. */
  public async registrarDesafioDoDia(
    dono: string | undefined,
    dia: string,
  ): Promise<void> {
    if (!dono) {
      return;
    }

    const atual = this.lerSequencia(dono);
    // O dia já contou, ou contou um depois dele.
    if (atual && atual.ultimoDia >= dia) {
      return;
    }
    const sequencia: RegistroSequencia = {
      ultimoDia: dia,
      dias: atual?.ultimoDia === diaAnterior(dia) ? atual.dias + 1 : 1,
    };
    await this.armazenamento.update(chave(dono, "sequenciaDoDia"), sequencia);
  }

  /** A sequência que ainda vale em `hoje`; sem ela, não há o que mostrar. */
  public sequenciaDoDia(
    dono: string | undefined,
    hoje: string,
  ): SequenciaDoDia | undefined {
    const atual = dono ? this.lerSequencia(dono) : undefined;
    if (atual?.ultimoDia === hoje) {
      return { dias: atual.dias, feitoHoje: true };
    }
    if (atual?.ultimoDia === diaAnterior(hoje)) {
      return { dias: atual.dias, feitoHoje: false };
    }
    return undefined;
  }

  // Guarda os últimos LIMITE_DIAS dias de cada nível.
  private async registrarNoDia(dono: string, nota: NotaDoDia): Promise<void> {
    const dias = this.evolucao(dono);
    const doDia = dias.find(
      (item) => item.dia === nota.dia && item.nivel === nota.nivel,
    );
    if (doDia && doDia.melhor >= nota.melhor) {
      return;
    }
    const atualizados = [...dias.filter((item) => item !== doDia), nota].sort(
      (a, b) => a.dia.localeCompare(b.dia),
    );
    const doNivel = atualizados.filter((item) => item.nivel === nota.nivel);
    const antigos = new Set(doNivel.slice(0, -LIMITE_DIAS));
    await this.armazenamento.update(
      chave(dono, "evolucao"),
      atualizados.filter((item) => !antigos.has(item)),
    );
  }

  private lerSequencia(dono: string): RegistroSequencia | undefined {
    const valor = this.armazenamento.get<unknown>(chave(dono, "sequenciaDoDia"));
    return ehSequencia(valor) ? valor : undefined;
  }
}

// "historico2": a 0.5.0 trocou o gerador, e os códigos antigos passaram a dar
// outras imagens; o histórico recomeça, sem misturar notas de imagens
// diferentes no mesmo código.
function chave(dono: string, nome: string): string {
  return `flexboxTrainer.${nome}|${dono.trim().toLowerCase()}`;
}

// "2026-10-01" vira "2026-09-30", pelo calendário do computador.
function diaAnterior(dia: string): string {
  const [ano, mes, data] = dia.split("-").map(Number);
  return diaLocal(new Date(ano, mes - 1, data - 1));
}

function ehNotaDoDia(valor: unknown): valor is NotaDoDia {
  const nota = valor as Partial<NotaDoDia> | null;
  return (
    typeof nota === "object" &&
    nota !== null &&
    typeof nota.dia === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(nota.dia) &&
    ehNivel(nota.nivel) &&
    typeof nota.melhor === "number"
  );
}

function ehSequencia(valor: unknown): valor is RegistroSequencia {
  const sequencia = valor as Partial<RegistroSequencia> | null;
  return (
    typeof sequencia === "object" &&
    sequencia !== null &&
    typeof sequencia.ultimoDia === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(sequencia.ultimoDia) &&
    typeof sequencia.dias === "number" &&
    Number.isInteger(sequencia.dias) &&
    sequencia.dias > 0
  );
}

// O armazenamento pode ter dados de outra versão: só passam registros completos.
function ehRegistro(valor: unknown): valor is RegistroHistorico {
  const registro = valor as Partial<RegistroHistorico> | null;
  return (
    typeof registro === "object" &&
    registro !== null &&
    typeof registro.codigo === "string" &&
    typeof registro.melhor === "number" &&
    typeof registro.tempoMelhorMs === "number" &&
    typeof registro.verificacoes === "number" &&
    typeof registro.vezes === "number" &&
    typeof registro.ultimaVez === "number" &&
    typeof registro.ultimaTentativa === "string"
  );
}
