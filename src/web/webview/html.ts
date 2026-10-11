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
      display: flex;
      align-items: center;
      gap: 9px;
    }

    .status-auth-texto {
      min-width: 0;
    }

    .aviso-cadastro {
      display: block;
      color: #f5c26b;
    }

    .aviso-ia {
      margin-bottom: 10px;
      padding: 10px;
      border: 1px solid #f5c26b;
      border-radius: 8px;
      background: rgba(245, 194, 107, 0.1);
      font-size: 12px;
      line-height: 1.4;
      color: #f5c26b;
    }

    .aviso-ia .acoes {
      margin-top: 6px;
    }

    .avatar-usuario,
    .avatar-fallback {
      width: 34px;
      height: 34px;
      flex: 0 0 34px;
      border-radius: 50%;
      border: 1px solid #40506a;
      object-fit: cover;
    }

    .avatar-fallback {
      display: grid;
      place-items: center;
      color: #07150c;
      background: #4cba72;
      font-size: 14px;
      font-weight: 800;
    }

    [hidden] {
      display: none !important;
    }

    .status-auth strong {
      display: block;
      color: #e8edf5;
      margin-bottom: 2px;
    }

    canvas {
      width: 100%;
      height: auto;
      aspect-ratio: 16 / 9;
      display: block;
      background: #fff;
      border-radius: 6px;
      border: 1px solid #2a3140;
    }

    .canvas-desafio {
      position: relative;
      width: 100%;
      aspect-ratio: var(--proporcao-desafio, 16 / 9);
      overflow: hidden;
      border: 1px solid #2a3140;
      border-radius: 6px;
      background: #fff;
    }

    .canvas-desafio canvas {
      width: 100%;
      height: 100%;
      border: 0;
      border-radius: 0;
    }

    .canvas-anotacoes {
      position: absolute;
      inset: 0;
      background: transparent;
      cursor: pointer;
    }

    .preview {
      width: 100%;
      height: auto;
      aspect-ratio: var(--proporcao-desafio, 16 / 9);
      display: block;
      border: 1px solid #2a3140;
      border-radius: 6px;
      background: #fff;
    }

    .preview-avaliacao {
      position: fixed;
      left: -10000px;
      top: 0;
      width: 960px;
      height: 540px;
      border: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: -1;
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

    button.perigo {
      background: #ef4444;
      color: #fff;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
  </style>
</head>
<body>
  <div class="aviso-ia" id="avisoIa" role="alert" hidden>
    <span id="textoAvisoIa"></span>
    <div class="acoes">
      <button id="botaoVerExtensoesIa" class="secundario">Ver extensões</button>
    </div>
  </div>

  <section class="bloco">
    <div class="cabecalho">
      <h2 class="titulo">FlexBox Trainer</h2>
      <button id="botaoSair" class="secundario">Sair</button>
    </div>
    <div class="status-auth">
      <img id="avatarUsuario" class="avatar-usuario" alt="Foto do usuário" hidden>
      <div id="avatarFallback" class="avatar-fallback">${escapeHtml((nomeUsuario || "U").trim().charAt(0).toUpperCase() || "U")}</div>
      <div class="status-auth-texto" id="statusAutenticacao">${nomeUsuario ? `Conectado como <strong>${escapeHtml(nomeUsuario)}</strong>` : "Sessão autenticada"}</div>
    </div>
    <div class="acoes">
      <button id="botaoNovoDesafio">Gerar novo desafio</button>
      <button id="botaoEncerrarDesafio" class="perigo" disabled>Encerrar desafio</button>
      <button id="botaoTestarConexao" class="secundario">Testar servidor</button>
    </div>
  </section>

  <section class="bloco" aria-label="Desafio alvo">
    <div class="canvas-desafio">
      <canvas id="canvasAlvo" width="960" height="540"></canvas>
      <canvas id="canvasAnotacoes" class="canvas-anotacoes" width="960" height="540"></canvas>
    </div>
    <div class="linha" id="metaDesafio"></div>
    <div class="linha" id="detalheComponente">Clique em um componente para ver suas medidas e sua cor.</div>
    <div class="acoes">
      <button id="botaoAbrirAba" class="secundario" title="Abre o gabarito e as medidas de todos os componentes em uma aba do editor">Abrir em uma aba</button>
    </div>
  </section>

  <section class="bloco">
    <h2 class="titulo">Arquivos detectados</h2>
    <div class="linha" id="listaWorkspace">Aguardando arquivos...</div>
    <div class="acoes">
      <button id="botaoAtualizarPreview" class="secundario">Atualizar preview</button>
      <button id="botaoCriarArquivos" class="secundario" hidden>Criar index.html e style.css</button>
    </div>
  </section>

  <section class="bloco">
    <h2 class="titulo">Preview do aluno</h2>
    <canvas id="canvasPreviewAluno" class="preview" width="960" height="540"></canvas>
    <div
      id="quadroAvaliacao"
      class="preview-avaliacao"
      aria-hidden="true"
    ></div>
    <div class="acoes">
      <button id="botaoVerificar" disabled>Verificar</button>
    </div>
  </section>

  <section class="bloco">
    <h2 class="titulo">Resultado</h2>
    <div class="linha" id="caixaResultado">Nenhuma verificação ainda.</div>
  </section>

  <script src="${scriptUri}"></script>
</body>
</html>`;
}

// Aba do editor com o gabarito grande, as medidas de todos os componentes e a
// comparação com a página do aluno. Usa as cores do tema do VS Code para
// parecer parte do editor.
export function obterHtmlPainelGabarito(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "web", "webview", "painelGabarito.js"),
  );
  // A página do aluno usa as mesmas permissões da barra lateral, onde a
  // correção a mede.
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: http: data: blob:; font-src https: data:; style-src 'unsafe-inline' https: http:; script-src ${webview.cspSource};">
  <title>Gabarito</title>
  <style>
    [hidden] {
      display: none !important;
    }

    body {
      margin: 0;
      padding: 16px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }

    .conteudo {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .imagem {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .resumo,
    .barra {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 14px;
    }

    .resumo strong {
      font-size: 15px;
    }

    .fundo,
    .contagem,
    .opacidade {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--vscode-descriptionForeground);
    }

    .modos {
      display: inline-flex;
    }

    .modo {
      font: inherit;
      padding: 4px 10px;
      border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
      cursor: pointer;
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }

    .modo + .modo {
      border-left: 0;
    }

    .modo:first-child {
      border-radius: 4px 0 0 4px;
    }

    .modo:last-child {
      border-radius: 0 4px 4px 0;
    }

    .modo[aria-pressed="true"] {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }

    .palco {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .palco[data-modo="gabarito"] #quadroAluno {
      display: none;
    }

    /* Sobreposto: os dois quadros na mesma célula, o gabarito por cima. */
    .palco[data-modo="sobreposto"] {
      display: grid;
    }

    .palco[data-modo="sobreposto"] .quadro {
      grid-area: 1 / 1;
    }

    .palco[data-modo="sobreposto"] #quadroGabarito {
      position: relative;
      z-index: 1;
    }

    .palco[data-modo="sobreposto"] #telaGabarito {
      background: transparent;
    }

    .palco[data-modo="sobreposto"] #canvasGabarito {
      opacity: var(--opacidade-gabarito, 0.5);
    }

    .quadro {
      margin: 0;
    }

    .quadro figcaption {
      display: none;
      margin-bottom: 4px;
      color: var(--vscode-descriptionForeground);
    }

    .palco[data-modo="lado"] figcaption {
      display: block;
    }

    .tela {
      position: relative;
      overflow: hidden;
      background: #fff;
      outline: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
    }

    .tela canvas {
      display: block;
      width: 100%;
      height: 100%;
    }

    #canvasDestaque {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    #superficieAluno {
      position: absolute;
      left: 0;
      top: 0;
      transform-origin: 0 0;
    }

    .sem-pagina {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      text-align: center;
      color: #52606d;
      background: #fff;
    }

    .ajuda {
      max-width: 640px;
      color: var(--vscode-descriptionForeground);
    }

    .lista {
      flex: 1 1 300px;
      min-width: 250px;
      max-width: 340px;
      max-height: calc(100vh - 32px);
      list-style: none;
      margin: 0;
      padding: 0 4px 0 0;
      overflow-y: auto;
    }

    .componente {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 8px;
      border: 1px solid transparent;
      border-radius: 6px;
      cursor: pointer;
    }

    .componente:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .componente.selecionado {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-inactiveSelectionBackground);
    }

    .amostra {
      flex: 0 0 auto;
      width: 22px;
      height: 22px;
      border-radius: 4px;
      border: 1px solid rgba(128, 128, 128, 0.5);
    }

    .fundo .amostra {
      width: 14px;
      height: 14px;
    }

    .info {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }

    .valores {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .valor {
      font: inherit;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      padding: 1px 6px;
      border: 0;
      border-radius: 4px;
      cursor: copy;
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }

    .valor:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .valor.copiado {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }

    .vazio {
      color: var(--vscode-descriptionForeground);
    }

    /* Em uma aba estreita, a lista vai para baixo da imagem. */
    @media (max-width: 680px) {
      .conteudo {
        flex-direction: column;
      }

      .lista {
        max-width: none;
        max-height: none;
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="vazio" id="vazio">Gere um desafio na barra lateral do FlexBox Trainer para ver o gabarito aqui.</div>
  <div class="conteudo" id="conteudo" hidden>
    <section class="imagem">
      <div class="resumo" id="resumo"></div>
      <div class="barra">
        <div class="modos" role="group" aria-label="Modo de exibição">
          <button type="button" class="modo" data-modo="gabarito" aria-pressed="true">Gabarito</button>
          <button type="button" class="modo" data-modo="sobreposto" aria-pressed="false">Sobrepor à sua página</button>
          <button type="button" class="modo" data-modo="lado" aria-pressed="false">Lado a lado</button>
        </div>
        <div class="opacidade" id="controleOpacidade" hidden>
          <span>Sua página</span>
          <input type="range" id="opacidade" min="0" max="100" step="1" value="50" aria-label="Opacidade do gabarito">
          <span>Gabarito</span>
          <strong id="valorOpacidade">50%</strong>
        </div>
      </div>
      <div class="palco" id="palco" data-modo="gabarito">
        <figure class="quadro" id="quadroGabarito">
          <figcaption>Gabarito</figcaption>
          <div class="tela" id="telaGabarito">
            <canvas id="canvasGabarito"></canvas>
            <canvas id="canvasDestaque"></canvas>
          </div>
        </figure>
        <figure class="quadro" id="quadroAluno">
          <figcaption>Sua página</figcaption>
          <div class="tela" id="telaAluno">
            <div id="superficieAluno"></div>
            <div class="sem-pagina" id="semPagina" hidden>Crie index.html e style.css na pasta do projeto para comparar com o gabarito.</div>
          </div>
        </figure>
      </div>
      <div class="ajuda" id="ajuda"></div>
    </section>
    <ul class="lista" id="listaComponentes" aria-label="Componentes do gabarito"></ul>
  </div>
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
      border-radius: 8px;
      padding: 12px 16px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: transform 120ms ease, opacity 120ms ease, background 120ms ease;
    }

    button:hover {
      transform: translateY(-1px);
      filter: brightness(1.1);
    }

    .btn-github {
      background: #24292e;
      color: white;
      border: 1px solid #444d56;
    }

    .btn-microsoft {
      background: #00a4ef;
      color: white;
      border: 1px solid #0078d4;
    }

    .btn-google {
      background: white;
      color: #444;
      border: 1px solid #ddd;
    }

    button.terciario {
      background: transparent;
      color: #7f93ab;
      border: 1px solid transparent;
      padding: 8px 16px;
      border-radius: 999px;
      font-weight: 500;
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
  </style>
</head>
<body>
  <main class="cartao">
    <p class="eyebrow">FlexBox Trainer</p>
    <h1>Acesse sua conta 🚀</h1>
    <p class="descricao">Escolha um provedor para conectar à sua conta do IFMS.</p>
    <div class="status" id="statusAutenticacao">Selecione uma opção para entrar.</div>
    <div class="acoes">
      <button id="botaoGoogle" class="btn-google">Entrar com Google</button>
      <button id="botaoGitHub" class="btn-github">Entrar com GitHub</button>
      <button id="botaoMicrosoft" class="btn-microsoft">Entrar com Microsoft</button>
      <button id="botaoSair" class="terciario">Desconectar</button>
    </div>
    <div class="meta">A validação é feita com a API configurada e a sessão fica salva de forma segura no SecretStorage do VS Code.</div>
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
