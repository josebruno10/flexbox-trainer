import * as vscode from "vscode";
import { normalizarCodigo } from "../../services/codigoDesafio";

/** Pede o código de 6 dígitos que o professor ou um colega passou. */
export async function pedirCodigo(): Promise<string | undefined> {
  const texto = await vscode.window.showInputBox({
    title: "Abrir desafio por código",
    prompt: "O código de 6 dígitos que o professor ou um colega passou.",
    placeHolder: "482 917",
    ignoreFocusOut: true,
    validateInput: (valor) =>
      !valor.trim() || normalizarCodigo(valor)
        ? undefined
        : "Digite os 6 dígitos do código.",
  });
  return texto ? normalizarCodigo(texto) : undefined;
}
