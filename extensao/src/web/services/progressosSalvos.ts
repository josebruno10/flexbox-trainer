import * as vscode from "vscode";
import { normalizarCodigo } from "./codigoDesafio";

// Os desafios em que o aluno salvou o progresso, do mais recente ao mais
// antigo. Cada um tem a própria dinâmica no servidor, com o código do
// desafio, criada pela extensão no primeiro salvamento. A lista serve para
// o aluno escolher o que puxar e para a extensão só gravar nas dinâmicas que
// ela mesma criou para ele: uma dinâmica com o mesmo código, criada por
// outra pessoa, pode ser do torneio. Com a Sincronização de Configurações,
// vai junto para os outros computadores (ver sincronizacao.ts).

export class ProgressosSalvos {
  public constructor(private readonly armazenamento: vscode.Memento) {}

  public listar(dono: string | undefined): string[] {
    if (!dono) {
      return [];
    }
    const codigos = this.armazenamento.get<unknown>(chaveDosProgressos(dono));
    return Array.isArray(codigos)
      ? codigos.filter(
          (codigo): codigo is string =>
            typeof codigo === "string" && normalizarCodigo(codigo) === codigo,
        )
      : [];
  }

  public criouADinamica(dono: string | undefined, codigo: string): boolean {
    return this.listar(dono).includes(codigo);
  }

  /** O desafio vai para o topo da lista. */
  public async registrar(dono: string | undefined, codigo: string): Promise<void> {
    if (!dono) {
      return;
    }
    await this.armazenamento.update(chaveDosProgressos(dono), [
      codigo,
      ...this.listar(dono).filter((salvo) => salvo !== codigo),
    ]);
  }
}

export function chaveDosProgressos(dono: string): string {
  return `flexboxTrainer.progressos|${dono.trim().toLowerCase()}`;
}

/** O código da dinâmica do desafio no servidor: as 4 letras, minúsculas. */
export function dinamicaDoDesafio(codigo: string): string {
  return codigo.toLowerCase();
}
