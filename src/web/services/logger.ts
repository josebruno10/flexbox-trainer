import * as vscode from "vscode";

let canal: vscode.OutputChannel | undefined;

function obterCanal(): vscode.OutputChannel {
  if (!canal) {
    canal = vscode.window.createOutputChannel("FlexBox Trainer Logs");
  }
  return canal;
}

export function initializeLogger(context: vscode.ExtensionContext) {
  const c = obterCanal();
  context.subscriptions.push(c);
}

export const log = {
  info: (mensagem: string, dados?: any) => {
    const c = obterCanal();
    const timestamp = new Date().toLocaleTimeString();
    const corpo = dados ? ` ${JSON.stringify(dados)}` : "";
    c.appendLine(`[${timestamp}] [INFO] ${mensagem}${corpo}`);
  },
  error: (mensagem: string, erro?: any) => {
    const c = obterCanal();
    c.show(true); // Força a aba de Saída a aparecer em caso de erro
    const timestamp = new Date().toLocaleTimeString();
    const detalhe = erro instanceof Error ? erro.message : JSON.stringify(erro);
    c.appendLine(`[${timestamp}] [ERRO] ${mensagem} -> ${detalhe}`);
  },
};
