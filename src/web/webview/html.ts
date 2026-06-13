import * as vscode from "vscode";

export function obterHtmlWebview(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  nomeUsuario?: string,
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "web", "webview", "app.js"),
  );

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src 'unsafe-inline'; script-src ${webview.cspSource};">
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

    .cabecalho {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }

    .titulo {
      margin: 0;
      font-size: 13px;
      color: #9fb4d1;
      text-transform: uppercase;
    }

    .status-auth {
      border: 1px solid #2a3140;
      border-radius: 8px;
      background: rgba(76, 186, 114, 0.08);
      padding: 8px 10px;
      color: #c6d2e4;
      font-size: 12px;
      line-height: 1.4;
      margin-bottom: 8px;
    }

    .status-auth strong {
      display: block;
      color: #e8edf5;
      margin-bottom: 2px;
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
    <div class="cabecalho">
      <h2 class="titulo">FlexBox Trainer</h2>
      <button id="botaoSair" class="secundario">Sair</button>
    </div>
    <div class="status-auth" id="statusAutenticacao">${nomeUsuario ? `Conectado como <strong>${escapeHtml(nomeUsuario)}</strong>` : "Sessão autenticada"}</div>
    <div class="acoes">
      <button id="botaoNovoDesafio">Novo desafio</button>
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

export function obterHtmlAutenticacao(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "web", "webview", "loginPage.js"),
  );

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src 'unsafe-inline'; script-src ${webview.cspSource};">
  <title>FlexBox Trainer - Autenticação</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 18px;
      background:
        radial-gradient(circle at top left, rgba(100, 181, 246, 0.22), transparent 28%),
        radial-gradient(circle at bottom right, rgba(76, 186, 114, 0.18), transparent 30%),
        #08111d;
      color: #e8edf5;
      font-family: "Segoe UI", Arial, sans-serif;
    }

    .cartao {
      width: min(100%, 360px);
      border: 1px solid rgba(159, 180, 209, 0.18);
      border-radius: 24px;
      background: rgba(10, 18, 29, 0.94);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
      padding: 24px;
      backdrop-filter: blur(10px);
    }

    .eyebrow {
      margin: 0 0 10px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: #7f93ab;
      font-size: 11px;
    }

    h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.15;
    }

    .descricao {
      margin: 12px 0 18px;
      color: #c2d0df;
      line-height: 1.6;
      font-size: 14px;
    }

    .status {
      min-height: 44px;
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(159, 180, 209, 0.14);
      color: #cfe3f2;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 16px;
    }

    .acoes {
      display: grid;
      gap: 10px;
    }

    button {
      appearance: none;
      border: 0;
      border-radius: 999px;
      padding: 12px 16px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      transition: transform 120ms ease, opacity 120ms ease, background 120ms ease;
    }

    button:hover {
      transform: translateY(-1px);
    }

    button.primario {
      background: linear-gradient(135deg, #4cba72, #7de2a4);
      color: #08111d;
    }

    button.secundario {
      background: rgba(255, 255, 255, 0.06);
      color: #e8edf5;
      border: 1px solid rgba(159, 180, 209, 0.18);
    }
    
    button.terciario {
      background: transparent;
      color: #7f93ab;
      border: 1px solid transparent;
      padding: 8px 16px;
    }
    
    button.terciario:hover {
      color: #e8edf5;
      background: rgba(255, 255, 255, 0.04);
    }

    .meta {
      margin-top: 16px;
      font-size: 12px;
      color: #8ea4bc;
      line-height: 1.5;
      text-align: center;
    }
    
    .divisor {
      display: flex;
      align-items: center;
      text-align: center;
      color: #7f93ab;
      font-size: 12px;
      margin: 16px 0;
    }
    
    .divisor::before,
    .divisor::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid rgba(159, 180, 209, 0.18);
    }
    
    .divisor:not(:empty)::before {
      margin-right: .5em;
    }
    
    .divisor:not(:empty)::after {
      margin-left: .5em;
    }
  </style>
</head>
<body>
  <main class="cartao">
    <p class="eyebrow">FlexBox Trainer</p>
    <h1>Acesse sua conta 🚀</h1>
    <p class="descricao">Conecte-se com sua conta para acessar os desafios.</p>
    <div class="status" id="statusAutenticacao">Você precisa criar uma conta ou fazer login para usar esta extensão.</div>
    <div class="acoes">
      <button id="botaoGitHub" class="secundario">Entrar com GitHub</button>
      <button id="botaoMicrosoft" class="secundario">Entrar com Microsoft</button>
      
      <div class="divisor">ou</div>
      
      <button id="botaoFazerLogin" class="primario">Fazer Login Manual</button>
      <button id="botaoCriarConta" class="terciario">Criar Conta no Site</button>
      <button id="botaoRevalidar" class="terciario">Tentar novamente</button>
      <button id="botaoSair" class="terciario">Sair</button>
    </div>
    <div class="meta">A validação é feita com a API do IFMS e a sessão fica salva de forma segura no SecretStorage do VS Code.</div>
  </main>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}