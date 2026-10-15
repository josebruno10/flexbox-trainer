import * as vscode from "vscode";
import { abrirExtensoesIa, ExtensaoIa } from "../../services/extensoesIa";
import { ResultadoAvaliacao, ResumoWorkspace } from "../../types";

// As regras do desafio, como no torneio: sem IA e sem alterar os arquivos
// fora do editor.

const VER_EXTENSOES = "Ver extensões";

/** Avisa que o desafio não começa com extensões de IA habilitadas. */
export function avisarExtensoesIa(extensoesIa: ExtensaoIa[]): void {
  const nomes = extensoesIa.map((extensao) => extensao.nome).join(", ");
  void vscode.window
    .showWarningMessage(
      `Desabilite as extensões de IA para começar: ${nomes}. Depois, ` +
        "reinicie as extensões.",
      VER_EXTENSOES,
    )
    .then((escolha) => {
      if (escolha === VER_EXTENSOES) {
        void abrirExtensoesIa(extensoesIa);
      }
    });
}

export function motivoExtensoesIa(extensoes: ExtensaoIa[]): string {
  const nomes = extensoes.map((extensao) => extensao.nome).join(", ");
  return extensoes.length === 1
    ? `uma extensão de IA ficou habilitada durante ele (${nomes}).`
    : `extensões de IA ficaram habilitadas durante ele (${nomes}).`;
}

export function resultadoInvalidado(motivo: string): ResultadoAvaliacao {
  return {
    precision: 0,
    score: 0,
    source: "desafio-invalidado",
    error: `Desafio invalidado: ${motivo} Gere outro e faça-o no editor, sem IA.`,
  };
}

/** Se o arquivo alterado é o index.html ou o style.css do treino. */
export function ehArquivoDeTreino(resumo: ResumoWorkspace, caminho: string): boolean {
  const alterado = normalizarCaminho(caminho);
  return [
    resumo.temArquivoHtml ? resumo.caminhoHtml : undefined,
    resumo.temArquivoCss ? resumo.caminhoCss : undefined,
  ].some((arquivo) => arquivo !== undefined && normalizarCaminho(arquivo) === alterado);
}

function normalizarCaminho(caminho: string): string {
  return caminho.replace(/\\/g, "/").toLowerCase();
}
