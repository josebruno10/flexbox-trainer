import * as vscode from "vscode";
import { ehTamanhoLivre } from "../formatos";
import { Tamanho } from "../types";
import { normalizarCodigo } from "./codigoDesafio";

// O tamanho de cada desafio de tamanho livre que o aluno gerou ou abriu. As
// 4 letras do código não guardam o tamanho: daqui saem o Refazer, o
// Histórico e o Continuar dele, mesmo antes de o desafio ir para o servidor.
// Com a Sincronização de Configurações, vai junto para os outros
// computadores (ver sincronizacao.ts).

// Cada desafio gerado entra aqui, inclusive os que o aluno pula até achar um
// interessante: só os mais recentes ficam.
const LIMITE = 200;

export class TamanhosLivres {
  public constructor(private readonly armazenamento: vscode.Memento) {}

  public tamanho(dono: string | undefined, codigo: string): Tamanho | undefined {
    return this.ler(dono).find(([salvo]) => salvo === codigo)?.[1];
  }

  /** O desafio vai para o topo da lista. */
  public async registrar(
    dono: string | undefined,
    codigo: string,
    tamanho: Tamanho,
  ): Promise<void> {
    if (!dono) {
      return;
    }
    await this.armazenamento.update(chaveDosTamanhosLivres(dono), [
      [codigo, tamanho],
      ...this.ler(dono).filter(([salvo]) => salvo !== codigo),
    ].slice(0, LIMITE));
  }

  private ler(dono: string | undefined): [string, Tamanho][] {
    if (!dono) {
      return [];
    }
    const lista = this.armazenamento.get<unknown>(chaveDosTamanhosLivres(dono));
    return Array.isArray(lista)
      ? lista.filter(
          (item): item is [string, Tamanho] =>
            Array.isArray(item) &&
            typeof item[0] === "string" &&
            normalizarCodigo(item[0]) === item[0] &&
            ehTamanhoLivre(item[1]),
        )
      : [];
  }
}

export function chaveDosTamanhosLivres(dono: string): string {
  return `flexboxTrainer.tamanhosLivres|${dono.trim().toLowerCase()}`;
}
