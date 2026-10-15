import * as vscode from "vscode";
import { NomeTema, variaveisDoTema } from "../../temas";
import { ESTILOS_BOTOES } from "./botoes";
import { ESTILOS_DADOS } from "./dados";
import { ESTILOS_ELEMENTOS } from "./elementos";

// Identidade comum às três telas. As cores vêm do tema do VS Code, para
// combinar com o claro e o escuro; as de destaque vêm do conjunto escolhido
// (o padrão é o verde, a cor do projeto), e as fontes (Space Grotesk e DM Mono,
// licença OFL) ficam em media/fontes.
export function estilosBase(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  tema: NomeTema,
): string {
  const fonte = (arquivo: string) =>
    webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "media", "fontes", arquivo),
    );
  return `
    @font-face {
      font-family: "Space Grotesk";
      font-weight: 300 700;
      font-display: swap;
      src: url("${fonte("space-grotesk.woff2")}") format("woff2");
    }

    @font-face {
      font-family: "DM Mono";
      font-weight: 400;
      font-display: swap;
      src: url("${fonte("dm-mono-400.woff2")}") format("woff2");
    }

    @font-face {
      font-family: "DM Mono";
      font-weight: 500;
      font-display: swap;
      src: url("${fonte("dm-mono-500.woff2")}") format("woff2");
    }

    :root {
      --fundo: var(--vscode-sideBar-background, var(--vscode-editor-background));
      --texto: var(--vscode-foreground);
      --texto-suave: var(--vscode-descriptionForeground);
      --linha: var(--vscode-widget-border, var(--vscode-panel-border, rgba(128, 128, 128, 0.35)));
      --linha-forte: color-mix(in srgb, var(--texto) 45%, transparent);
      --linha-tracejada: color-mix(in srgb, var(--texto) 22%, transparent);
      --superficie: color-mix(in srgb, var(--texto) 6%, transparent);
      /* O botão principal tem a cor do texto: escuro no tema claro e o contrário. */
      --tinta: var(--texto);
      --sobre-tinta: var(--fundo);
${variaveisDoTema(tema)}
      --aviso: var(--vscode-editorWarning-foreground, #cca700);
      --erro: var(--vscode-errorForeground, #f14c4c);
      --foco: var(--vscode-focusBorder, var(--acento));
      --fonte-texto: var(--vscode-font-family, system-ui, sans-serif);
      --fonte-mono: "DM Mono", var(--vscode-editor-font-family, monospace);
      --fonte-titulo: "Space Grotesk", var(--vscode-font-family, sans-serif);
    }
${ESTILOS_ELEMENTOS}${ESTILOS_BOTOES}${ESTILOS_DADOS}`;
}
