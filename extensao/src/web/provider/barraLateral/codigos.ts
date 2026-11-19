import * as vscode from "vscode";
import { normalizarCodigo } from "../../services/codigoDesafio";

/** Pede o código de 4 letras que o professor ou um colega passou. */
export async function pedirCodigo(): Promise<string | undefined> {
  const texto = await vscode.window.showInputBox({
    title: "Abrir desafio por código",
    prompt: "O código de 4 letras que o professor ou um colega passou.",
    placeHolder: "MESA",
    ignoreFocusOut: true,
    validateInput: (valor) =>
      !valor.trim() || normalizarCodigo(valor)
        ? undefined
        : "Digite as 4 letras do código.",
  });
  return texto ? normalizarCodigo(texto) : undefined;
}
