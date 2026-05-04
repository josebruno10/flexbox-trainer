import * as vscode from "vscode";
import { ResumoWorkspace } from "../types";

// estado inicial usado antes de localizar arquivos reais.
export function criarResumoWorkspaceVazio(): ResumoWorkspace {
  return {
    caminhoHtml: "index.html",
    caminhoCss: "style.css",
    textoHtml: "",
    textoCss: "",
    htmlPreview: montarDocumentoPreview("", ""),
    temArquivoHtml: false,
    temArquivoCss: false,
  };
}

// lê os dois arquivos padrão de treino da workspace.
export async function lerResumoWorkspace(): Promise<ResumoWorkspace> {
  const documentoHtml = await lerDocumentoDeTreino("index.html");
  const documentoCss = await lerDocumentoDeTreino("style.css");

  const textoHtml = documentoHtml?.getText() ?? "";
  const textoCss = documentoCss?.getText() ?? "";

  return {
    caminhoHtml: documentoHtml?.uri.fsPath ?? "index.html",
    caminhoCss: documentoCss?.uri.fsPath ?? "style.css",
    textoHtml,
    textoCss,
    htmlPreview: montarDocumentoPreview(textoHtml, textoCss),
    temArquivoHtml: Boolean(documentoHtml),
    temArquivoCss: Boolean(documentoCss),
  };
}

// define se o documento salvo é relevante para atualizar a sidebar.
export function ehDocumentoDeTreino(document: vscode.TextDocument): boolean {
  return (
    ehArquivoDeTreino(document, "index.html") ||
    ehArquivoDeTreino(document, "style.css")
  );
}

// tenta achar primeiro entre os documentos abertos, depois no disco.
async function lerDocumentoDeTreino(
  nomeArquivo: "index.html" | "style.css",
): Promise<vscode.TextDocument | undefined> {
  const documentoAberto = vscode.workspace.textDocuments.find((document) =>
    ehArquivoDeTreino(document, nomeArquivo),
  );

  if (documentoAberto) {
    return documentoAberto;
  }

  const arquivosEncontrados = await vscode.workspace.findFiles(
    `**/${nomeArquivo}`,
    "**/node_modules/**",
    1,
  );

  if (arquivosEncontrados.length === 0) {
    return undefined;
  }

  return vscode.workspace.openTextDocument(arquivosEncontrados[0]);
}

// normaliza caminho para comparar com o nome esperado.
function ehArquivoDeTreino(
  document: vscode.TextDocument,
  nomeArquivo: "index.html" | "style.css",
): boolean {
  const caminhoNormalizado = document.uri.fsPath
    .replace(/\\/g, "/")
    .toLowerCase();

  return caminhoNormalizado.endsWith(`/${nomeArquivo}`);
}

// monta html final para exibir preview do aluno no iframe.
function montarDocumentoPreview(textoHtml: string, textoCss: string): string {
  if (!textoHtml.trim() && !textoCss.trim()) {
    return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0; display:grid; place-items:center; height:100vh; font-family:'JetBrains Mono', monospace; color:#52606d; background:#fff;">
  Crie os arquivos index.html e style.css para ver o preview.
</body>
</html>`;
  }

  const htmlSanitizado =
    textoHtml.trim() || '<div class="empty">Sem HTML detectado</div>';
  const tagEstilo = `<style>html, body { width: 100%; height: 100%; margin: 0; } ${textoCss}</style>`;

  if (htmlSanitizado.toLowerCase().includes("<html")) {
    if (htmlSanitizado.toLowerCase().includes("</head>")) {
      return htmlSanitizado.replace("</head>", `${tagEstilo}</head>`);
    }

    if (htmlSanitizado.toLowerCase().includes("<body")) {
      return htmlSanitizado.replace("<body", `<body>${tagEstilo}`);
    }

    return htmlSanitizado;
  }

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${tagEstilo}
</head>
<body>
  ${htmlSanitizado}
</body>
</html>`;
}
