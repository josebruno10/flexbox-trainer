import * as vscode from "vscode";

type Block = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

type Challenge = {
  challengeId: string;
  seed: number;
  width: number;
  height: number;
  blocks: Block[];
};

type VerifyAttemptMessage = {
  type: "verifyAttempt";
  payload: {
    html: string;
    css: string;
    elapsedMs: number;
    challengeId: string;
    seed: number;
  };
};

type ReadyMessage = {
  type: "ready";
};

type WebviewMessage = VerifyAttemptMessage | ReadyMessage;

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new FlexBoxTrainerSidebarProvider();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      FlexBoxTrainerSidebarProvider.viewType,
      sidebarProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    ),
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isRelevantTrainingDocument(document)) {
        void sidebarProvider.refreshWorkspacePreview();
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("flexbox-trainer.iniciar", async () => {
      sidebarProvider.startNewChallenge();
      await sidebarProvider.refreshWorkspacePreview();
      await vscode.commands.executeCommand(
        "workbench.view.extension.flexboxTrainer",
      );
      vscode.window.showInformationMessage(
        "FlexBox Trainer aberto na barra lateral.",
      );
    }),
  );
}

async function evaluateAttempt(payload: VerifyAttemptMessage["payload"]) {
  const config = vscode.workspace.getConfiguration("flexboxTrainer");
  const apiBaseUrl = config.get<string>("apiBaseUrl", "").trim();

  if (!apiBaseUrl) {
    const precision = createDeterministicMockPrecision(
      payload.html,
      payload.css,
    );
    return {
      precision,
      score: Math.round(precision * timeFactor(payload.elapsedMs)),
      source: "mock-local",
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        challengeId: payload.challengeId,
        seed: payload.seed,
        html: payload.html,
        css: payload.css,
        elapsedMs: payload.elapsedMs,
        algorithmVersion: "v1",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      precision: number;
      score: number;
    };

    return {
      precision: data.precision,
      score: data.score,
      source: "api",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return {
      precision: 0,
      score: 0,
      source: "api-error",
      error: message,
    };
  }
}

function createChallenge(): Challenge {
  const seed = Math.floor(Math.random() * 1000000);
  const random = mulberry32(seed);
  const width = 640;
  const height = 360;
  const colors = ["#0d3b66", "#f4d35e", "#ee964b", "#f95738", "#1b998b"];

  const blocks: Block[] = [];
  const count = 4;

  for (let i = 0; i < count; i += 1) {
    const blockWidth = 90 + Math.floor(random() * 160);
    const blockHeight = 50 + Math.floor(random() * 140);
    const x = Math.floor(random() * (width - blockWidth));
    const y = Math.floor(random() * (height - blockHeight));

    blocks.push({
      id: i + 1,
      x,
      y,
      width: blockWidth,
      height: blockHeight,
      color: colors[i % colors.length],
    });
  }

  return {
    challengeId: `challenge-${seed}`,
    seed,
    width,
    height,
    blocks,
  };
}

function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function createDeterministicMockPrecision(html: string, css: string): number {
  const normalized = `${html.trim()}|${css.trim()}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }

  return 40 + (hash % 6000) / 100;
}

function timeFactor(elapsedMs: number): number {
  const elapsedSeconds = elapsedMs / 1000;
  const limitSeconds = 300;
  return Math.max(0.5, 1 - elapsedSeconds / limitSeconds);
}

function getWebviewHtml(webview: vscode.Webview, challenge: Challenge): string {
  const nonce = createNonce();

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>FlexBox Trainer</title>
  <style>
    :root {
      --bg: #f8f7f3;
      --panel: #fffdf8;
      --line: #d6d2c6;
      --ink: #1f2933;
      --muted: #52606d;
      --accent: #127681;
      --ok: #207561;
      --danger: #b42318;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: "Segoe UI", sans-serif;
      color: var(--ink);
      background: radial-gradient(circle at top right, #efece0 0%, var(--bg) 45%);
      min-height: 100vh;
    }

    .app {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 12px;
      padding: 12px;
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px;
    }

    h2 {
      margin: 0 0 10px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }

    .preview-wrap {
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      background: #ffffff;
    }

    canvas {
      width: 100%;
      display: block;
      background: #ffffff;
    }

    .meta {
      margin-top: 10px;
      max-height: 180px;
      overflow: auto;
      font-size: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px;
      background: #fff;
    }

    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 8px;
    }

    textarea {
      width: 100%;
      min-height: 150px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px;
      font-family: Consolas, monospace;
      font-size: 12px;
      resize: vertical;
      background: #fff;
      color: var(--ink);
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    button {
      border: 0;
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
      color: #fff;
      background: var(--accent);
      font-weight: 600;
    }

    button.secondary {
      background: #6b7280;
    }

    .status {
      margin-top: 8px;
      font-size: 12px;
      color: var(--muted);
      min-height: 18px;
    }

    .ok { color: var(--ok); }
    .danger { color: var(--danger); }

    iframe {
      width: 100%;
      height: 360px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
    }

    @media (max-width: 980px) {
      .app { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="app">
    <section class="panel">
      <h2>Desafio Alvo</h2>
      <div class="preview-wrap">
        <canvas id="targetCanvas" width="${challenge.width}" height="${challenge.height}"></canvas>
      </div>
      <div class="meta" id="metaList"></div>
    </section>

    <section class="panel">
      <h2>Solução do Usuário</h2>
      <div class="row">
        <textarea id="htmlInput"><div class="container"><div class="item a"></div><div class="item b"></div><div class="item c"></div></div></textarea>
        <textarea id="cssInput">* { box-sizing: border-box; margin: 0; }
.container { display: flex; gap: 12px; width: 100%; height: 100%; padding: 16px; }
.item { flex: 1; min-height: 120px; }
.a { background: #0d3b66; }
.b { background: #f4d35e; }
.c { background: #ee964b; }</textarea>
      </div>
      <iframe id="previewFrame" sandbox="allow-scripts"></iframe>
      <div class="actions">
        <button id="renderBtn" class="secondary">Renderizar</button>
        <button id="verifyBtn">Verificar</button>
      </div>
      <div class="status" id="status"></div>
    </section>
  </main>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const targetCanvas = document.getElementById('targetCanvas');
    const metaList = document.getElementById('metaList');
    const htmlInput = document.getElementById('htmlInput');
    const cssInput = document.getElementById('cssInput');
    const previewFrame = document.getElementById('previewFrame');
    const renderBtn = document.getElementById('renderBtn');
    const verifyBtn = document.getElementById('verifyBtn');
    const status = document.getElementById('status');

    let currentChallenge = null;
    const startedAt = Date.now();

    function setStatus(message, mode) {
      status.textContent = message;
      status.className = 'status';
      if (mode) {
        status.classList.add(mode);
      }
    }

    function drawChallenge(challenge) {
      currentChallenge = challenge;
      const ctx = targetCanvas.getContext('2d');
      ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

      for (const block of challenge.blocks) {
        ctx.fillStyle = block.color;
        ctx.fillRect(block.x, block.y, block.width, block.height);
      }

      metaList.innerHTML = challenge.blocks.map((block) => {
        return '<div>#' + block.id + ' | cor: ' + block.color + ' | w: ' + block.width + ' | h: ' + block.height + '</div>';
      }).join('');
    }

    function renderUserSolution() {
      const html = htmlInput.value;
      const css = cssInput.value;
      const src = '<!doctype html><html><head><style>html, body { width: 100%; height: 100%; margin: 0; }' + css + '</style></head><body>' + html + '</body></html>';
      previewFrame.srcdoc = src;
      setStatus('Preview atualizado.', '');
    }

    renderBtn.addEventListener('click', renderUserSolution);

    verifyBtn.addEventListener('click', () => {
      if (!currentChallenge) {
        setStatus('Desafio ainda nao carregado.', 'danger');
        return;
      }

      setStatus('Enviando tentativa para avaliacao...', '');

      vscode.postMessage({
        type: 'verifyAttempt',
        payload: {
          challengeId: currentChallenge.challengeId,
          seed: currentChallenge.seed,
          html: htmlInput.value,
          css: cssInput.value,
          elapsedMs: Date.now() - startedAt
        }
      });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;

      if (message.type === 'challengeData') {
        drawChallenge(message.payload);
        renderUserSolution();
        setStatus('Desafio carregado. Monte seu layout e clique em Verificar.', '');
      }

      if (message.type === 'evaluationResult') {
        const result = message.payload;
        if (result.source === 'api-error') {
          setStatus('Falha na API: ' + (result.error || 'erro desconhecido'), 'danger');
          return;
        }

        setStatus('Precisao: ' + result.precision.toFixed(2) + '% | Score: ' + result.score + ' | Fonte: ' + result.source, 'ok');
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}

function createNonce(): string {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

type WorkspaceSnapshot = {
  htmlPath: string;
  cssPath: string;
  htmlText: string;
  cssText: string;
  previewHtml: string;
  hasHtmlFile: boolean;
  hasCssFile: boolean;
};

type SidebarReadyMessage = {
  type: "ready";
};

type SidebarRefreshMessage = {
  type: "refreshPreview";
};

type SidebarNewChallengeMessage = {
  type: "newChallenge";
};

type SidebarVerifyMessage = {
  type: "verifyRequest";
};

type SidebarIncomingMessage =
  | SidebarReadyMessage
  | SidebarRefreshMessage
  | SidebarNewChallengeMessage
  | SidebarVerifyMessage;

class FlexBoxTrainerSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "flexbox-trainer.sidebar";

  private webviewView?: vscode.WebviewView;

  private currentChallenge: Challenge = createChallenge();

  private currentWorkspace: WorkspaceSnapshot = createEmptyWorkspaceSnapshot();

  private currentEvaluation:
    | {
        precision: number;
        score: number;
        source: string;
        error?: string;
      }
    | undefined;

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
  ): void | Thenable<void> {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };
    webviewView.webview.html = this.getWebviewHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (message: SidebarIncomingMessage) => {
        if (message.type === "ready") {
          void this.refreshWorkspacePreview();
          this.pushState();
          return;
        }

        if (message.type === "newChallenge") {
          this.startNewChallenge();
          void this.refreshWorkspacePreview();
          return;
        }

        if (message.type === "refreshPreview") {
          void this.refreshWorkspacePreview();
          return;
        }

        if (message.type === "verifyRequest") {
          void this.evaluateCurrentWorkspace();
        }
      },
      undefined,
    );

    void this.refreshWorkspacePreview();
  }

  public startNewChallenge(): void {
    this.currentChallenge = createChallenge();
    this.currentEvaluation = undefined;
    this.pushState();
  }

  public async refreshWorkspacePreview(): Promise<void> {
    this.currentWorkspace = await readWorkspaceSnapshot();
    this.pushState();
  }

  private async evaluateCurrentWorkspace(): Promise<void> {
    if (
      !this.currentWorkspace.hasHtmlFile ||
      !this.currentWorkspace.hasCssFile
    ) {
      this.currentEvaluation = {
        precision: 0,
        score: 0,
        source: "missing-files",
        error: "Abra ou crie index.html e style.css na pasta do projeto.",
      };
      this.pushState();
      return;
    }

    this.currentEvaluation = await evaluateAttempt({
      html: this.currentWorkspace.htmlText,
      css: this.currentWorkspace.cssText,
      elapsedMs: 0,
      challengeId: this.currentChallenge.challengeId,
      seed: this.currentChallenge.seed,
    });

    this.pushState();
  }

  private pushState(): void {
    if (!this.webviewView) {
      return;
    }

    this.webviewView.webview.postMessage({
      type: "challengeData",
      payload: this.currentChallenge,
    });

    this.webviewView.webview.postMessage({
      type: "workspacePreview",
      payload: this.currentWorkspace,
    });

    if (this.currentEvaluation) {
      this.webviewView.webview.postMessage({
        type: "evaluationResult",
        payload: this.currentEvaluation,
      });
    }
  }

  private getWebviewHtml(webview: vscode.Webview): string {
    const nonce = createNonce();

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>FlexBox Trainer</title>
  <style>
    :root {
      --bg: #f5f4ef;
      --panel: #fffdf8;
      --panel-strong: #ffffff;
      --line: #dad5c8;
      --ink: #1f2933;
      --muted: #5d6975;
      --accent: #127681;
      --accent-soft: #d7f1ef;
      --ok: #1f7a58;
      --danger: #b42318;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: "Segoe UI", sans-serif;
      color: var(--ink);
      background: linear-gradient(180deg, #f8f7f3 0%, var(--bg) 100%);
    }

    .app {
      display: grid;
      gap: 10px;
      padding: 12px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .eyebrow {
      margin: 0;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--accent);
      font-weight: 700;
    }

    h1 {
      margin: 4px 0 0;
      font-size: 18px;
    }

    .subtitle {
      margin: 4px 0 0;
      font-size: 12px;
      color: var(--muted);
      line-height: 1.4;
    }

    .stack {
      display: grid;
      gap: 10px;
    }

    .card {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--panel);
      padding: 10px;
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);
    }

    .card-title {
      margin: 0 0 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }

    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    button {
      border: 0;
      border-radius: 999px;
      padding: 8px 12px;
      cursor: pointer;
      color: #fff;
      background: var(--accent);
      font-weight: 700;
      font-size: 12px;
    }

    button.secondary {
      color: var(--ink);
      background: var(--accent-soft);
    }

    canvas {
      width: 100%;
      display: block;
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 10px;
    }

    .list,
    .status {
      font-size: 12px;
      line-height: 1.45;
      color: var(--muted);
    }

    .status strong {
      color: var(--ink);
    }

    .preview {
      width: 100%;
      height: 240px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #fff;
    }

    .result {
      padding: 10px;
      border-radius: 10px;
      background: #fff;
      border: 1px solid var(--line);
      font-size: 12px;
      color: var(--muted);
      min-height: 56px;
    }

    .result.ok { color: var(--ok); }
    .result.danger { color: var(--danger); }
  </style>
</head>
<body>
  <main class="app">
    <header class="header">
      <div>
        <p class="eyebrow">FlexBox Trainer</p>
        <h1>Treino lateral de layout</h1>
        <p class="subtitle">Abra <strong>index.html</strong> e <strong>style.css</strong> no seu projeto. A extensão lê esses arquivos e mostra o preview aqui.</p>
      </div>
      <div class="actions">
        <button id="newChallengeBtn">Novo desafio</button>
      </div>
    </header>

    <section class="card">
      <p class="card-title">Desafio alvo</p>
      <canvas id="targetCanvas" width="640" height="360"></canvas>
      <div class="list" id="blocksList" style="margin-top: 10px;"></div>
    </section>

    <section class="card">
      <p class="card-title">Arquivos detectados</p>
      <div class="list" id="workspaceList">Aguardando arquivos do projeto...</div>
    </section>

    <section class="card">
      <p class="card-title">Preview do aluno</p>
      <iframe id="previewFrame" class="preview" sandbox></iframe>
      <div class="actions" style="margin-top: 10px;">
        <button id="refreshPreviewBtn" class="secondary">Atualizar preview</button>
        <button id="verifyBtn">Verificar</button>
      </div>
    </section>

    <section class="card">
      <p class="card-title">Resultado</p>
      <div class="result" id="resultBox">Nenhuma verificação ainda.</div>
    </section>
  </main>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const targetCanvas = document.getElementById('targetCanvas');
    const blocksList = document.getElementById('blocksList');
    const workspaceList = document.getElementById('workspaceList');
    const previewFrame = document.getElementById('previewFrame');
    const resultBox = document.getElementById('resultBox');
    const newChallengeBtn = document.getElementById('newChallengeBtn');
    const refreshPreviewBtn = document.getElementById('refreshPreviewBtn');
    const verifyBtn = document.getElementById('verifyBtn');

    let currentChallenge = null;
    let currentWorkspace = null;

    function drawChallenge(challenge) {
      currentChallenge = challenge;
      const ctx = targetCanvas.getContext('2d');
      ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

      challenge.blocks.forEach((block) => {
        ctx.fillStyle = block.color;
        ctx.fillRect(block.x, block.y, block.width, block.height);
      });

      blocksList.innerHTML = challenge.blocks
        .map((block) => '<div>#' + block.id + ' | cor ' + block.color + ' | ' + block.width + 'x' + block.height + '</div>')
        .join('');
    }

    function renderWorkspace(snapshot) {
      currentWorkspace = snapshot;
      const htmlInfo = snapshot.hasHtmlFile
        ? '<strong>' + snapshot.htmlPath + '</strong>'
        : 'Nenhum <strong>index.html</strong> encontrado';
      const cssInfo = snapshot.hasCssFile
        ? '<strong>' + snapshot.cssPath + '</strong>'
        : 'Nenhum <strong>style.css</strong> encontrado';

      workspaceList.innerHTML = '<div>' + htmlInfo + '</div><div>' + cssInfo + '</div>';
      previewFrame.srcdoc = snapshot.previewHtml;
    }

    function renderResult(result) {
      if (!result) {
        resultBox.textContent = 'Nenhuma verificação ainda.';
        resultBox.className = 'result';
        return;
      }

      if (result.source === 'missing-files') {
        resultBox.textContent = result.error || 'Crie index.html e style.css para verificar.';
        resultBox.className = 'result danger';
        return;
      }

      if (result.source === 'api-error') {
        resultBox.textContent = 'Erro na API: ' + (result.error || 'erro desconhecido');
        resultBox.className = 'result danger';
        return;
      }

      resultBox.textContent = 'Precisao: ' + result.precision.toFixed(2) + '% | Score: ' + result.score + ' | Fonte: ' + result.source;
      resultBox.className = 'result ok';
    }

    newChallengeBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'newChallenge' });
    });

    refreshPreviewBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'refreshPreview' });
    });

    verifyBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'verifyRequest' });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;

      if (message.type === 'challengeData') {
        drawChallenge(message.payload);
      }

      if (message.type === 'workspacePreview') {
        renderWorkspace(message.payload);
      }

      if (message.type === 'evaluationResult') {
        renderResult(message.payload);
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}

function createEmptyWorkspaceSnapshot(): WorkspaceSnapshot {
  return {
    htmlPath: "index.html",
    cssPath: "style.css",
    htmlText: "",
    cssText: "",
    previewHtml: buildPreviewDocument("", ""),
    hasHtmlFile: false,
    hasCssFile: false,
  };
}

async function readWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const htmlDocument = await readTrainingDocument("index.html");
  const cssDocument = await readTrainingDocument("style.css");

  const htmlText = htmlDocument?.getText() ?? "";
  const cssText = cssDocument?.getText() ?? "";

  return {
    htmlPath: htmlDocument?.uri.fsPath ?? "index.html",
    cssPath: cssDocument?.uri.fsPath ?? "style.css",
    htmlText,
    cssText,
    previewHtml: buildPreviewDocument(htmlText, cssText),
    hasHtmlFile: Boolean(htmlDocument),
    hasCssFile: Boolean(cssDocument),
  };
}

async function readTrainingDocument(
  fileName: "index.html" | "style.css",
): Promise<vscode.TextDocument | undefined> {
  const openDocument = vscode.workspace.textDocuments.find((document) =>
    isTrainingFile(document, fileName),
  );

  if (openDocument) {
    return openDocument;
  }

  const foundFiles = await vscode.workspace.findFiles(
    `**/${fileName}`,
    "**/node_modules/**",
    1,
  );

  if (foundFiles.length === 0) {
    return undefined;
  }

  return vscode.workspace.openTextDocument(foundFiles[0]);
}

function isTrainingFile(
  document: vscode.TextDocument,
  fileName: "index.html" | "style.css",
): boolean {
  const normalizedPath = document.uri.fsPath.replace(/\\/g, "/").toLowerCase();
  return normalizedPath.endsWith(`/${fileName}`);
}

function isRelevantTrainingDocument(document: vscode.TextDocument): boolean {
  return (
    isTrainingFile(document, "index.html") ||
    isTrainingFile(document, "style.css")
  );
}

function buildPreviewDocument(htmlText: string, cssText: string): string {
  if (!htmlText.trim() && !cssText.trim()) {
    return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0; display:grid; place-items:center; height:100vh; font-family:Segoe UI, sans-serif; color:#52606d; background:#fff;">
  Crie os arquivos index.html e style.css para ver o preview.
</body>
</html>`;
  }

  const sanitizedHtml =
    htmlText.trim() || '<div class="empty">Sem HTML detectado</div>';
  const styleTag = `<style>html, body { width: 100%; height: 100%; margin: 0; } ${cssText}</style>`;

  if (sanitizedHtml.toLowerCase().includes("<html")) {
    if (sanitizedHtml.toLowerCase().includes("</head>")) {
      return sanitizedHtml.replace("</head>", `${styleTag}</head>`);
    }

    if (sanitizedHtml.toLowerCase().includes("<body")) {
      return sanitizedHtml.replace("<body", `<body>${styleTag}`);
    }

    return sanitizedHtml;
  }

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${styleTag}
</head>
<body>
  ${sanitizedHtml}
</body>
</html>`;
}

export function deactivate() {}
