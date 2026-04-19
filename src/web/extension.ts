import * as vscode from "vscode";

// Bloco visual desenhado no canvas do desafio alvo.
type Bloco = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

// Desafio completo enviado para a sidebar.
type Desafio = {
  challengeId: string;
  seed: number;
  titulo: string;
  width: number;
  height: number;
  blocks: Bloco[];
};

// Resultado final da tentativa (mock local ou API real).
type ResultadoAvaliacao = {
  precision: number;
  score: number;
  source: "mock-local" | "api" | "api-error" | "missing-files";
  error?: string;
};

// Snapshot dos arquivos do aluno detectados na workspace.
type ResumoWorkspace = {
  caminhoHtml: string;
  caminhoCss: string;
  textoHtml: string;
  textoCss: string;
  htmlPreview: string;
  temArquivoHtml: boolean;
  temArquivoCss: boolean;
};

// Mensagens que o Webview pode enviar para a extensão.
type MensagemRecebidaBarraLateral =
  | { type: "pronto" }
  | { type: "novoDesafio" }
  | { type: "atualizarPreview" }
  | { type: "solicitarVerificacao" };

export function activate(context: vscode.ExtensionContext) {
  // Este método roda quando a extensão é ativada pelo VS Code.

  // Estrutura principal: provider da barra lateral.
  const provedor = new ProvedorBarraLateralFlexBox();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ProvedorBarraLateralFlexBox.viewType,
      provedor,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    ),
  );

  // Atualiza preview ao salvar index.html/style.css.
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (ehDocumentoDeTreino(document)) {
        void provedor.atualizarPreviewWorkspace();
      }
    }),
  );

  // Comando de entrada da extensão.
  context.subscriptions.push(
    vscode.commands.registerCommand("flexbox-trainer.iniciar", async () => {
      provedor.iniciarNovoDesafio();
      await provedor.atualizarPreviewWorkspace();
      await vscode.commands.executeCommand(
        "workbench.view.extension.flexboxTrainer",
      );
      vscode.window.showInformationMessage(
        "FlexBox Trainer aberto na barra lateral.",
      );
    }),
  );
}

class ProvedorBarraLateralFlexBox implements vscode.WebviewViewProvider {
  // ID da view lateral definida no package.json.
  public static readonly viewType = "flexbox-trainer.sidebar";

  // Referência para a webview ativa (quando aberta na lateral).
  private visualizacaoWebview?: vscode.WebviewView;

  // Estado principal da sessão atual de treino.
  private desafioAtual: Desafio = criarDesafioBase();

  // Estado atual dos arquivos HTML/CSS que o aluno está editando.
  private resumoWorkspaceAtual: ResumoWorkspace = criarResumoWorkspaceVazio();

  // Último resultado de avaliação calculado.
  private avaliacaoAtual?: ResultadoAvaliacao;

  // Marca o início da tentativa para cálculo de tempo/score.
  private inicioTentativaMs = Date.now();

  public resolveWebviewView(
    visualizacaoWebview: vscode.WebviewView,
  ): void | Thenable<void> {
    // Este método é chamado quando o painel lateral é aberto/carregado.
    this.visualizacaoWebview = visualizacaoWebview;
    visualizacaoWebview.webview.options = { enableScripts: true };

    // Injeta HTML/CSS/JS da sidebar.
    visualizacaoWebview.webview.html = this.obterHtmlWebview(
      visualizacaoWebview.webview,
    );

    // Canal de entrada: recebe comandos do JavaScript da sidebar.
    visualizacaoWebview.webview.onDidReceiveMessage(
      (mensagem: MensagemRecebidaBarraLateral) => {
        if (mensagem.type === "pronto") {
          // Webview sinaliza que carregou e pode receber dados iniciais.
          void this.atualizarPreviewWorkspace();
          this.enviarEstado();
          return;
        }

        if (mensagem.type === "novoDesafio") {
          // Reinicia o treino com novo desafio e timer zerado.
          this.iniciarNovoDesafio();
          void this.atualizarPreviewWorkspace();
          return;
        }

        if (mensagem.type === "atualizarPreview") {
          // Releitura manual dos arquivos do aluno.
          void this.atualizarPreviewWorkspace();
          return;
        }

        if (mensagem.type === "solicitarVerificacao") {
          // Dispara o fluxo de avaliação da tentativa.
          void this.avaliarWorkspaceAtual();
        }
      },
      undefined,
    );

    void this.atualizarPreviewWorkspace();
  }

  public iniciarNovoDesafio(): void {
    // TODO: aqui entra o gerador procedural completo.
    this.desafioAtual = criarDesafioBase();
    this.avaliacaoAtual = undefined;
    this.inicioTentativaMs = Date.now();
    this.enviarEstado();
  }

  public async atualizarPreviewWorkspace(): Promise<void> {
    // TODO: aqui pode evoluir para múltiplos arquivos e projetos por nível.
    this.resumoWorkspaceAtual = await lerResumoWorkspace();
    this.enviarEstado();
  }

  private async avaliarWorkspaceAtual(): Promise<void> {
    // Guard clause: sem index.html e style.css não há como avaliar.
    if (
      !this.resumoWorkspaceAtual.temArquivoHtml ||
      !this.resumoWorkspaceAtual.temArquivoCss
    ) {
      this.avaliacaoAtual = {
        precision: 0,
        score: 0,
        source: "missing-files",
        error: "Abra ou crie index.html e style.css na pasta do projeto.",
      };
      this.enviarEstado();
      return;
    }

    this.avaliacaoAtual = await avaliarTentativa({
      // O conteúdo é lido diretamente dos arquivos da workspace.
      html: this.resumoWorkspaceAtual.textoHtml,
      css: this.resumoWorkspaceAtual.textoCss,
      elapsedMs: Date.now() - this.inicioTentativaMs,
      challengeId: this.desafioAtual.challengeId,
      seed: this.desafioAtual.seed,
    });

    this.enviarEstado();
  }

  private enviarEstado(): void {
    // Ponto único de sincronização de estado extensão -> webview.
    if (!this.visualizacaoWebview) {
      return;
    }

    this.visualizacaoWebview.webview.postMessage({
      type: "dadosDesafio",
      payload: {
        ...this.desafioAtual,
        tempoAtualMs: Date.now() - this.inicioTentativaMs,
      },
    });

    this.visualizacaoWebview.webview.postMessage({
      type: "dadosWorkspace",
      payload: this.resumoWorkspaceAtual,
    });

    if (this.avaliacaoAtual) {
      this.visualizacaoWebview.webview.postMessage({
        type: "resultadoAvaliacao",
        payload: this.avaliacaoAtual,
      });
    }
  }

  private obterHtmlWebview(webview: vscode.Webview): string {
    const codigoNonce = criarNonce();

    // HTML inline da sidebar (mantido em um único arquivo para facilitar estudo inicial).
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src 'unsafe-inline'; script-src 'nonce-${codigoNonce}';">
  <title>FlexBox Trainer</title>
  <style>
    :root {
      --bg: #06070a;
      --panel: #0f1218;
      --line: #252d3d;
      --ink: #ecf4ff;
      --muted: #97a7c2;
      --accent: #55c97a;
      --accent-soft: #1b3926;
      --ok: #31e89c;
      --danger: #ff5562;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: "JetBrains Mono", monospace;
      color: var(--ink);
      background: radial-gradient(circle at top right, #132033 0%, var(--bg) 52%);
    }

    .aplicacao { display: grid; gap: 10px; padding: 12px; }
    .cartao { border: 1px solid var(--line); border-radius: 12px; background: var(--panel); padding: 10px; }
    .titulo { margin: 0; font-size: 16px; }
    .subtitulo { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
    .titulo-cartao { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }

    canvas { width: 100%; display: block; background: #ffffff; border: 1px solid var(--line); border-radius: 10px; }
    .lista { font-size: 12px; line-height: 1.45; color: var(--muted); }
    .visualizacao { width: 100%; height: 240px; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
    .acoes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }

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

    button.secondary { color: var(--ink); background: var(--accent-soft); }

    .resultado { padding: 10px; border-radius: 10px; background: #121722; border: 1px solid var(--line); font-size: 12px; color: var(--muted); min-height: 56px; }
    .resultado.ok { color: var(--ok); }
    .resultado.danger { color: var(--danger); }
  </style>
</head>
<body>
  <main class="aplicacao">
    <section class="cartao">
      <h1 class="titulo">FlexBox Trainer</h1>
      <p class="subtitulo">Estrutura base para evoluir o projeto por etapas.</p>
      <div class="acoes">
        <button id="botaoNovoDesafio">Novo desafio</button>
      </div>
    </section>

    <section class="cartao">
      <p class="titulo-cartao">Desafio alvo</p>
      <canvas id="canvasAlvo" width="720" height="420"></canvas>
      <div class="lista" id="metaDesafio" style="margin-top: 8px;"></div>
      <div class="lista" id="listaBlocos" style="margin-top: 8px;"></div>
    </section>

    <section class="cartao">
      <p class="titulo-cartao">Arquivos detectados</p>
      <div class="lista" id="listaWorkspace">Aguardando arquivos do projeto...</div>
      <div class="acoes">
        <button id="botaoAtualizarPreview" class="secondary">Atualizar preview</button>
      </div>
    </section>

    <section class="cartao">
      <p class="titulo-cartao">Preview do aluno</p>
      <iframe id="quadroPreview" class="visualizacao" sandbox></iframe>
      <div class="acoes">
        <button id="botaoVerificar">Verificar</button>
      </div>
    </section>

    <section class="cartao">
      <p class="titulo-cartao">Resultado</p>
      <div class="resultado" id="caixaResultado">Nenhuma verificação ainda.</div>
    </section>
  </main>

  <script nonce="${codigoNonce}">
    // API do VS Code para comunicação com a extensão.
    const vscode = acquireVsCodeApi();

    // Referências dos elementos da interface.
    const canvasAlvo = document.getElementById('canvasAlvo');
    const listaBlocos = document.getElementById('listaBlocos');
    const metaDesafio = document.getElementById('metaDesafio');
    const listaWorkspace = document.getElementById('listaWorkspace');
    const quadroPreview = document.getElementById('quadroPreview');
    const caixaResultado = document.getElementById('caixaResultado');

    // Solicita novo desafio para a extensão.
    document.getElementById('botaoNovoDesafio').addEventListener('click', () => {
      vscode.postMessage({ type: 'novoDesafio' });
    });

    // Solicita releitura dos arquivos HTML/CSS do aluno.
    document.getElementById('botaoAtualizarPreview').addEventListener('click', () => {
      vscode.postMessage({ type: 'atualizarPreview' });
    });

    // Solicita avaliação da tentativa atual.
    document.getElementById('botaoVerificar').addEventListener('click', () => {
      vscode.postMessage({ type: 'solicitarVerificacao' });
    });

    function desenharDesafio(desafio) {
      // Ajusta o canvas para o tamanho real do desafio.
      canvasAlvo.width = desafio.width;
      canvasAlvo.height = desafio.height;

      const contexto = canvasAlvo.getContext('2d');
      contexto.clearRect(0, 0, canvasAlvo.width, canvasAlvo.height);

      // Desenha todos os blocos do desafio alvo.
      desafio.blocks.forEach((bloco) => {
        contexto.fillStyle = bloco.color;
        contexto.fillRect(bloco.x, bloco.y, bloco.width, bloco.height);
      });

      metaDesafio.innerHTML = '<div><strong>Titulo:</strong> ' + desafio.titulo + '</div>'
        + '<div><strong>Seed:</strong> ' + desafio.seed + '</div>'
        + '<div><strong>Tempo:</strong> ' + Math.floor((desafio.tempoAtualMs || 0) / 1000) + 's</div>';

      listaBlocos.innerHTML = desafio.blocks
        .map((bloco) => '<div>#' + bloco.id + ' | ' + bloco.width + 'x' + bloco.height + ' | ' + bloco.color + '</div>')
        .join('');
    }

    function renderizarWorkspace(resumoWorkspace) {
      // Mostra quais arquivos foram detectados na pasta do aluno.
      const htmlInfo = resumoWorkspace.temArquivoHtml
        ? '<strong>' + resumoWorkspace.caminhoHtml + '</strong>'
        : 'Nenhum <strong>index.html</strong> encontrado';
      const cssInfo = resumoWorkspace.temArquivoCss
        ? '<strong>' + resumoWorkspace.caminhoCss + '</strong>'
        : 'Nenhum <strong>style.css</strong> encontrado';

      listaWorkspace.innerHTML = '<div>' + htmlInfo + '</div><div>' + cssInfo + '</div>';
      // Renderiza o HTML/CSS do aluno em sandbox para preview.
      quadroPreview.srcdoc = resumoWorkspace.htmlPreview;
    }

    function renderizarResultado(resultado) {
      // Estado sem avaliação ainda.
      if (!resultado) {
        caixaResultado.textContent = 'Nenhuma verificação ainda.';
        caixaResultado.className = 'resultado';
        return;
      }

      // Falha por ausência dos arquivos de treino.
      if (resultado.source === 'missing-files') {
        caixaResultado.textContent = resultado.error || 'Crie index.html e style.css para verificar.';
        caixaResultado.className = 'resultado danger';
        return;
      }

      // Falha de comunicação/retorno da API.
      if (resultado.source === 'api-error') {
        caixaResultado.textContent = 'Erro na API: ' + (resultado.error || 'erro desconhecido');
        caixaResultado.className = 'resultado danger';
        return;
      }

      caixaResultado.textContent = 'Precisao: ' + resultado.precision.toFixed(2) + '% | Score: ' + resultado.score + ' | Fonte: ' + resultado.source;
      caixaResultado.className = 'resultado ok';
    }

    // Canal de saída da extensão -> webview.
    window.addEventListener('message', (event) => {
      const mensagem = event.data;

      if (mensagem.type === 'dadosDesafio') {
        desenharDesafio(mensagem.payload);
      }

      if (mensagem.type === 'dadosWorkspace') {
        renderizarWorkspace(mensagem.payload);
      }

      if (mensagem.type === 'resultadoAvaliacao') {
        renderizarResultado(mensagem.payload);
      }
    });

    // Handshake inicial para a extensão enviar estado.
    vscode.postMessage({ type: 'pronto' });
  </script>
</body>
</html>`;
  }
}

function criarDesafioBase(): Desafio {
  const seed = Math.floor(Math.random() * 1000000);

  // Estrutura essencial: fundo + algumas áreas para o aluno replicar com Flexbox.
  const blocks: Bloco[] = [
    { id: 1, x: 0, y: 0, width: 720, height: 420, color: "#e6e6e6" },
    { id: 2, x: 24, y: 24, width: 672, height: 36, color: "#0a0a0a" },
    { id: 3, x: 24, y: 86, width: 440, height: 210, color: "#f6851f" },
    { id: 4, x: 52, y: 118, width: 150, height: 146, color: "#b72a2a" },
    { id: 5, x: 496, y: 98, width: 176, height: 30, color: "#c42525" },
    { id: 6, x: 496, y: 148, width: 176, height: 30, color: "#c42525" },
    { id: 7, x: 496, y: 198, width: 176, height: 30, color: "#c42525" },
    { id: 8, x: 24, y: 330, width: 672, height: 66, color: "#55c97a" },
  ];

  return {
    // challengeId e seed serão úteis para torneio/ranking.
    challengeId: `challenge-${seed}`,
    seed,
    titulo: "Desafio base",
    width: 720,
    height: 420,
    blocks,
  };
}

type TentativaPayload = {
  // Conteúdo que representa a tentativa atual do aluno.
  html: string;
  css: string;
  elapsedMs: number;
  challengeId: string;
  seed: number;
};

async function avaliarTentativa(
  payload: TentativaPayload,
): Promise<ResultadoAvaliacao> {
  const config = vscode.workspace.getConfiguration("flexboxTrainer");
  const apiBaseUrl = config.get<string>("apiBaseUrl", "").trim();

  // Estrutura essencial: mock local até a API final ficar pronta.
  if (!apiBaseUrl) {
    // Modo desenvolvimento: retorna resultado determinístico sem backend.
    const precision = criarPrecisaoMockDeterministica(
      payload.html,
      payload.css,
    );
    const score = Math.round(precision * fatorTempo(payload.elapsedMs));
    return { precision, score, source: "mock-local" };
  }

  try {
    // Modo produção: envia tentativa para API do torneio.
    const response = await fetch(`${apiBaseUrl}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
    return { precision: 0, score: 0, source: "api-error", error: message };
  }
}

function criarResumoWorkspaceVazio(): ResumoWorkspace {
  // Estado inicial quando ainda não há arquivos detectados.
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

async function lerResumoWorkspace(): Promise<ResumoWorkspace> {
  // Lê os dois arquivos padrão do treino.
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

async function lerDocumentoDeTreino(
  nomeArquivo: "index.html" | "style.css",
): Promise<vscode.TextDocument | undefined> {
  // 1) prioriza arquivos já abertos no editor.
  const documentoAberto = vscode.workspace.textDocuments.find((document) =>
    ehArquivoDeTreino(document, nomeArquivo),
  );

  if (documentoAberto) {
    return documentoAberto;
  }

  // 2) se não estiver aberto, procura no projeto.
  const arquivosEncontrados = await vscode.workspace.findFiles(
    `**/${nomeArquivo}`,
    "**/node_modules/**",
    1,
  );

  if (arquivosEncontrados.length === 0) {
    return undefined;
  }

  // 3) abre em memória sem abrir aba visual para o usuário.
  return vscode.workspace.openTextDocument(arquivosEncontrados[0]);
}

function ehArquivoDeTreino(
  document: vscode.TextDocument,
  nomeArquivo: "index.html" | "style.css",
): boolean {
  const caminhoNormalizado = document.uri.fsPath
    .replace(/\\/g, "/")
    .toLowerCase();
  return caminhoNormalizado.endsWith(`/${nomeArquivo}`);
}

function ehDocumentoDeTreino(document: vscode.TextDocument): boolean {
  return (
    ehArquivoDeTreino(document, "index.html") ||
    ehArquivoDeTreino(document, "style.css")
  );
}

function montarDocumentoPreview(htmlText: string, cssText: string): string {
  // Mensagem padrão quando o aluno ainda não criou os arquivos de treino.
  if (!htmlText.trim() && !cssText.trim()) {
    return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0; display:grid; place-items:center; height:100vh; font-family:'JetBrains Mono', monospace; color:#52606d; background:#fff;">
  Crie os arquivos index.html e style.css para ver o preview.
</body>
</html>`;
  }

  const htmlSanitizado =
    htmlText.trim() || '<div class="empty">Sem HTML detectado</div>';
  const tagEstilo = `<style>html, body { width: 100%; height: 100%; margin: 0; } ${cssText}</style>`;

  // Se o HTML já é documento completo, injeta CSS nele.
  if (htmlSanitizado.toLowerCase().includes("<html")) {
    if (htmlSanitizado.toLowerCase().includes("</head>")) {
      return htmlSanitizado.replace("</head>", `${tagEstilo}</head>`);
    }

    if (htmlSanitizado.toLowerCase().includes("<body")) {
      return htmlSanitizado.replace("<body", `<body>${tagEstilo}`);
    }

    return htmlSanitizado;
  }

  // Se o HTML é parcial, monta documento mínimo completo.
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

function criarPrecisaoMockDeterministica(html: string, css: string): number {
  // Hash simples para gerar precisão estável (mesmo input -> mesmo resultado).
  const textoNormalizado = `${html.trim()}|${css.trim()}`;
  let hash = 0;
  for (let i = 0; i < textoNormalizado.length; i += 1) {
    hash = (hash * 31 + textoNormalizado.charCodeAt(i)) >>> 0;
  }

  return 40 + (hash % 6000) / 100;
}

function fatorTempo(elapsedMs: number): number {
  // Penalidade leve por tempo; nunca abaixo de 50% do fator.
  const elapsedSeconds = elapsedMs / 1000;
  const limiteSegundos = 300;
  return Math.max(0.5, 1 - elapsedSeconds / limiteSegundos);
}

function criarNonce(): string {
  // Nonce para Content Security Policy do script da webview.
  const caracteresPossiveis =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let texto = "";
  for (let i = 0; i < 32; i += 1) {
    texto += caracteresPossiveis.charAt(
      Math.floor(Math.random() * caracteresPossiveis.length),
    );
  }

  return texto;
}

export function deactivate() {}
