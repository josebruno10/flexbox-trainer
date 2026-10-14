import * as vscode from "vscode";

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
  // O challengeId: muda a cada vez que o desafio é feito.
  tentativa: string;
  precisao: number;
  tempoMs: number;
  instante: number;
};

// Cabe o treino de um semestre sem pesar nas configurações do VS Code.
const LIMITE_REGISTROS = 30;

export class HistoricoDesafios {
  public constructor(private readonly armazenamento: vscode.Memento) {}

  /** Do mais recente ao mais antigo. */
  public listar(dono: string | undefined): RegistroHistorico[] {
    if (!dono) {
      return [];
    }
    const registros = this.armazenamento.get<unknown>(chave(dono));
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
      chave(dono),
      [atualizado, ...registros.filter((registro) => registro !== anterior)].slice(
        0,
        LIMITE_REGISTROS,
      ),
    );
  }
}

function chave(dono: string): string {
  return `flexboxTrainer.historico|${dono.trim().toLowerCase()}`;
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
