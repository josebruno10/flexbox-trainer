import * as vscode from "vscode";
import { normalizarCodigo } from "../../services/codigoDesafio";
import { HistoricoDoAluno } from "./historicoDoAluno";
import { MelhorDaTentativa, textoDoResultado } from "./resultado";

// Abrir, refazer e copiar desafios pelo código de 4 letras.

/** Pede o código de 4 letras que o professor ou um colega passou. */
export async function pedirCodigo(
  titulo = "Abrir desafio por código",
  explicacao = "O código de 4 letras que o professor ou um colega passou.",
): Promise<string | undefined> {
  const texto = await vscode.window.showInputBox({
    title: titulo,
    prompt: explicacao,
    placeHolder: "MESA",
    ignoreFocusOut: true,
    validateInput: (valor) =>
      !valor.trim() || normalizarCodigo(valor)
        ? undefined
        : "Digite as 4 letras do código.",
  });
  return texto ? normalizarCodigo(texto) : undefined;
}

/** O que os comandos de abrir e copiar por código leem da barra lateral. */
export type ContextoDosCodigos = {
  autenticado: () => boolean;
  codigoAtual: () => string | undefined;
  melhorDaTentativa: () => MelhorDaTentativa | undefined;
  historico: HistoricoDoAluno;
  abrir: (codigo: string) => Promise<void>;
};

/** Pede um código (o que o professor ou um colega passou) e abre o desafio. */
export async function abrirDesafioPorCodigo(contexto: ContextoDosCodigos): Promise<void> {
  if (!contexto.autenticado()) {
    void vscode.window.showWarningMessage("Entre antes de abrir um desafio.");
    return;
  }

  const codigo = await pedirCodigo();
  if (codigo) {
    await contexto.abrir(codigo);
  }
}

/** Começa de novo um desafio: o atual ou um do histórico. */
export async function refazerDesafio(
  contexto: ContextoDosCodigos,
  codigo = contexto.codigoAtual(),
): Promise<void> {
  const valido = codigo ? normalizarCodigo(codigo) : undefined;
  if (!valido) {
    void vscode.window.showInformationMessage("Gere um desafio antes de refazê-lo.");
    return;
  }
  await contexto.abrir(valido);
}

/** Todos os desafios do histórico; escolher um começa ele de novo. */
export async function verHistorico(contexto: ContextoDosCodigos): Promise<void> {
  const codigo = await contexto.historico.escolher();
  if (codigo) {
    await refazerDesafio(contexto, codigo);
  }
}

export async function copiarCodigo(contexto: ContextoDosCodigos): Promise<void> {
  const codigo = contexto.codigoAtual();
  if (!codigo) {
    return;
  }
  await vscode.env.clipboard.writeText(codigo);
  vscode.window.setStatusBarMessage(`Código ${codigo} copiado.`, 2500);
}

/** "Desafio médio MESA: 87,42% em 12:34", para colar no grupo da turma. */
export function textoDoResultadoAtual(
  contexto: ContextoDosCodigos,
): string | undefined {
  const codigo = contexto.codigoAtual();
  const melhor = contexto.melhorDaTentativa();
  return codigo && melhor ? textoDoResultado(codigo, melhor) : undefined;
}

export async function copiarResultado(contexto: ContextoDosCodigos): Promise<void> {
  const texto = textoDoResultadoAtual(contexto);
  if (!texto) {
    void vscode.window.showInformationMessage(
      "Verifique o desafio antes de copiar o resultado.",
    );
    return;
  }
  await vscode.env.clipboard.writeText(texto);
  vscode.window.setStatusBarMessage(`Copiado: ${texto}`, 3000);
}
