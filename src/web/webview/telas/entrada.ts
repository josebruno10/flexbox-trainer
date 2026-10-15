import * as vscode from "vscode";
import { lerTemaCores, NomeTema } from "../temas";
import { CREDITOS } from "./comum";
import { ESTILOS_ENTRADA } from "./estilos/entrada";
import { estilosBase } from "./estilos/base";

// Marcas dos provedores, como nos botões oficiais de login.
const ICONE_GOOGLE = `<svg viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.87 2.69-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A8.65 8.65 0 0 0 9 0 9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/></svg>`;
const ICONE_GITHUB = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`;
const ICONE_MICROSOFT = `<svg viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>`;

// A tela de entrada, antes do login.
export function obterHtmlAutenticacao(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  tema: NomeTema = lerTemaCores(),
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "web", "webview", "loginPage.js"),
  );

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; style-src 'unsafe-inline'; script-src ${webview.cspSource};">
  <title>FlexBox Trainer - Autenticação</title>
  <style>${estilosBase(webview, extensionUri, tema)}${ESTILOS_ENTRADA}
  </style>
</head>
<body>
  <div class="faixa" aria-hidden="true"></div>
  <main class="entrada">
    <p class="rotulo surge" style="--ordem: 0"><span class="numero">00</span> / Entrar</p>
    <h1 class="surge" style="--ordem: 1">FlexBox <span>Trainer</span></h1>
    <p class="descricao surge" style="--ordem: 2">Extensão para treinamento de recriação de layouts em HTML e CSS.</p>
    <div class="status" id="statusAutenticacao" role="status" hidden></div>
    <div class="acoes surge" style="--ordem: 3">
      <button id="botaoGoogle" class="provedor"><span class="marca">${ICONE_GOOGLE}</span>Entrar com Google</button>
      <button id="botaoGitHub" class="provedor secundario">${ICONE_GITHUB}Entrar com GitHub</button>
      <button id="botaoMicrosoft" class="provedor secundario">${ICONE_MICROSOFT}Entrar com Microsoft</button>
      <button id="botaoSair" class="discreto" hidden>Desconectar</button>
    </div>
    <p class="meta surge" style="--ordem: 4">Use a conta com o e-mail cadastrado no torneio.</p>
  </main>
  <p class="creditos">${CREDITOS}</p>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}
