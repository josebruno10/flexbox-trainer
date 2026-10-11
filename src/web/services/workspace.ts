import * as vscode from "vscode";
import { ResumoWorkspace } from "../types";
import { registrarGravacaoPropria } from "./alteracoesExternas";

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

// substitui o conteúdo dos arquivos de treino e salva; sem eles, cria na raiz.
export type ResultadoCriacao =
  | { status: "sem-pasta" }
  | { status: "ja-existiam" }
  | { status: "criados"; arquivos: vscode.Uri[] };

/**
 * Cria na raiz da pasta aberta o index.html e o style.css que faltarem, com
 * uma base mínima, sem pistas do desafio. Nunca sobrescreve um arquivo.
 */
export async function criarArquivosDeTreino(
  largura: number,
  altura: number,
): Promise<ResultadoCriacao> {
  const raiz = vscode.workspace.workspaceFolders?.[0]?.uri;

  if (!raiz) {
    return { status: "sem-pasta" };
  }

  const arquivos = [
    [
      "index.html",
      `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <!-- Recrie aqui o gabarito mostrado na barra lateral do FlexBox Trainer. -->
</body>
</html>
`,
    ],
    [
      "style.css",
      `/* A página tem o tamanho do gabarito: ${largura} × ${altura} px. */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
`,
    ],
  ] as const;
  const criados: vscode.Uri[] = [];

  for (const [nomeArquivo, conteudo] of arquivos) {
    const destino = vscode.Uri.joinPath(raiz, nomeArquivo);

    // A busca ignora pastas de build; o disco confirma antes de gravar.
    if ((await lerDocumentoDeTreino(nomeArquivo)) || (await existe(destino))) {
      continue;
    }

    registrarGravacaoPropria(destino, conteudo);
    await vscode.workspace.fs.writeFile(
      destino,
      new TextEncoder().encode(conteudo),
    );
    criados.push(destino);
  }

  return criados.length > 0
    ? { status: "criados", arquivos: criados }
    : { status: "ja-existiam" };
}

async function existe(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

export async function escreverArquivosDeTreino(
  html: string,
  css: string,
): Promise<void> {
  const arquivos = [
    ["index.html", html],
    ["style.css", css],
  ] as const;

  for (const [nomeArquivo, conteudo] of arquivos) {
    const documento = await lerDocumentoDeTreino(nomeArquivo);

    if (documento) {
      const edicao = new vscode.WorkspaceEdit();
      edicao.replace(
        documento.uri,
        new vscode.Range(
          documento.positionAt(0),
          documento.positionAt(documento.getText().length),
        ),
        conteudo,
      );
      await vscode.workspace.applyEdit(edicao);
      await documento.save();
      continue;
    }

    const raiz = vscode.workspace.workspaceFolders?.[0]?.uri;

    if (!raiz) {
      throw new Error(
        "Abra uma pasta no VS Code para gravar index.html e style.css.",
      );
    }

    const destino = vscode.Uri.joinPath(raiz, nomeArquivo);
    registrarGravacaoPropria(destino, conteudo);
    await vscode.workspace.fs.writeFile(
      destino,
      new TextEncoder().encode(conteudo),
    );
  }
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

  // Pastas de build e de teste contêm index.html internos do VS Code; sem
  // excluí-las, o preview pode capturar um arquivo que não é do aluno.
  const IGNORAR =
    "**/{node_modules,.vscode-test-web,.git,dist,out,build}/**";

  // A raiz da workspace tem prioridade sobre qualquer cópia aninhada.
  const naRaiz = await vscode.workspace.findFiles(nomeArquivo, IGNORAR, 1);

  if (naRaiz.length > 0) {
    return vscode.workspace.openTextDocument(naRaiz[0]);
  }

  const arquivosEncontrados = await vscode.workspace.findFiles(
    `**/${nomeArquivo}`,
    IGNORAR,
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
