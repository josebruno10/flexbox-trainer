import * as vscode from "vscode";
import { normalizarCodigo } from "./codigoDesafio";

// Antes de a extensão apagar ou substituir o index.html e o style.css (num
// desafio novo, ao continuar um desafio salvo ou ao restaurar uma cópia), o
// que o aluno tinha escrito fica guardado aqui, como no "Restaurar Backup
// Local Seguro" da extensão oficial. Fica só neste computador (não vai na
// Sincronização de Configurações) e separado por aluno, porque nos
// laboratórios várias pessoas usam o mesmo VS Code.

export const MAXIMO_DE_COPIAS = 10;

export type CopiaDeSeguranca = {
  /** O desafio que estava aberto, se havia um. */
  codigo?: string;
  html: string;
  css: string;
  quando: number;
};

export class CopiasDeSeguranca {
  public constructor(private readonly armazenamento: vscode.Memento) {}

  /** Da mais recente para a mais antiga. */
  public listar(dono: string | undefined): CopiaDeSeguranca[] {
    if (!dono) {
      return [];
    }
    const copias = this.armazenamento.get<unknown>(chaveDasCopias(dono));
    return Array.isArray(copias) ? copias.filter(ehCopia) : [];
  }

  /** Guarda no topo; uma cópia igual à mais recente não se repete. */
  public async guardar(
    dono: string | undefined,
    copia: CopiaDeSeguranca,
  ): Promise<void> {
    if (!dono) {
      return;
    }
    const copias = this.listar(dono);
    const ultima = copias[0];
    if (ultima && ultima.html === copia.html && ultima.css === copia.css) {
      return;
    }
    await this.armazenamento.update(
      chaveDasCopias(dono),
      [copia, ...copias].slice(0, MAXIMO_DE_COPIAS),
    );
  }
}

function chaveDasCopias(dono: string): string {
  return `flexboxTrainer.copiasDeSeguranca|${dono.trim().toLowerCase()}`;
}

function ehCopia(valor: unknown): valor is CopiaDeSeguranca {
  const copia = valor as Partial<CopiaDeSeguranca> | null;
  return (
    typeof copia?.html === "string" &&
    typeof copia.css === "string" &&
    typeof copia.quando === "number" &&
    (copia.codigo === undefined ||
      (typeof copia.codigo === "string" &&
        normalizarCodigo(copia.codigo) === copia.codigo))
  );
}
