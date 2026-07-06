import * as vscode from "vscode";

// gera html da sidebar com interface mínima para estudo.
export function obterHtmlWebview(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "web", "webview", "app.js"),
  );

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    img-src ${webview.cspSource} https: http: data: blob:;
    script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval';
    style-src ${webview.cspSource} 'unsafe-inline' https: http:;
    connect-src ${webview.cspSource} https: http: ws: wss:;
    frame-src 'self' https: http: data:;
  ">
  <title>FlexBox Trainer</title>
  <style>
    body {
      margin: 0;
      padding: 12px;
      font-family: "JetBrains Mono", monospace;
      background: #0b0d12;
      color: #e8edf5;
    }

    .bloco {
      border: 1px solid #2a3140;
      background: #111723;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 10px;
    }

    .titulo {
      margin: 0 0 8px;
      font-size: 13px;
      color: #9fb4d1;
      text-transform: uppercase;
    }

    canvas {
      width: 100%;
      background: #fff;
      border-radius: 6px;
      border: 1px solid #2a3140;
    }

    .preview {
      width: 100%;
      height: 220px;
      border: 1px solid #2a3140;
      border-radius: 6px;
      background: #fff;
    }

    .linha {
      font-size: 12px;
      color: #c6d2e4;
      margin-top: 6px;
      line-height: 1.4;
    }

    .acoes {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
    }

    button {
      border: 0;
      border-radius: 999px;
      padding: 6px 10px;
      background: #4cba72;
      color: #05120a;
      font-weight: 700;
      cursor: pointer;
      font-size: 12px;
    }

    button.secundario {
      background: #2a3140;
      color: #e8edf5;
    }
  </style>
</head>
<body>
  <section class="bloco">
    <h2 class="titulo">FlexBox Trainer</h2>
    <div class="acoes">
      <button id="botaoNovoDesafio">Novo desafio</button>
      <button id="botaoTestarConexao" class="secundario">Testar servidor</button>
    </div>
  </section>

  <section class="bloco">
    <h2 class="titulo">Desafio alvo</h2>
    <canvas id="canvasAlvo" width="640" height="360"></canvas>
    <div class="linha" id="metaDesafio"></div>
  </section>

  <section class="bloco">
    <h2 class="titulo">Arquivos detectados</h2>
    <div class="linha" id="listaWorkspace">Aguardando arquivos...</div>
    <div class="acoes">
      <button id="botaoAtualizarPreview" class="secundario">Atualizar preview</button>
    </div>
  </section>

  <section class="bloco">
    <h2 class="titulo">Preview do aluno</h2>
    <iframe id="quadroPreview" class="preview" sandbox="allow-scripts allow-same-origin"></iframe>
    <div class="acoes">
      <button id="botaoVerificar">Verificar</button>
    </div>
  </section>

  <section class="bloco">
    <h2 class="titulo">Resultado</h2>
    <div class="linha" id="caixaResultado">Nenhuma verificacao ainda.</div>
  </section>

  <script src="${scriptUri}"></script>
</body>
</html>`;
}
