import * as vscode from "vscode";

// gera html da sidebar com interface mínima para estudo.
export function obterHtmlWebview(webview: vscode.Webview): string {
  const codigoNonce = criarNonce();

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src 'unsafe-inline'; script-src 'nonce-${codigoNonce}';">
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
    <iframe id="quadroPreview" class="preview" sandbox></iframe>
    <div class="acoes">
      <button id="botaoVerificar">Verificar</button>
    </div>
  </section>

  <section class="bloco">
    <h2 class="titulo">Resultado</h2>
    <div class="linha" id="caixaResultado">Nenhuma verificacao ainda.</div>
  </section>

  <script nonce="${codigoNonce}">
    const vscode = acquireVsCodeApi();

    const canvasAlvo = document.getElementById('canvasAlvo');
    const metaDesafio = document.getElementById('metaDesafio');
    const listaWorkspace = document.getElementById('listaWorkspace');
    const quadroPreview = document.getElementById('quadroPreview');
    const caixaResultado = document.getElementById('caixaResultado');

    document.getElementById('botaoNovoDesafio').addEventListener('click', () => {
      vscode.postMessage({ type: 'novoDesafio' });
    });

    document.getElementById('botaoAtualizarPreview').addEventListener('click', () => {
      vscode.postMessage({ type: 'atualizarPreview' });
    });

    document.getElementById('botaoVerificar').addEventListener('click', () => {
      vscode.postMessage({ type: 'solicitarVerificacao' });
    });

    function desenharDesafio(desafio) {
      canvasAlvo.width = desafio.width;
      canvasAlvo.height = desafio.height;

      const contexto = canvasAlvo.getContext('2d');
      contexto.clearRect(0, 0, canvasAlvo.width, canvasAlvo.height);
      contexto.fillStyle = '#f2f2f2';
      contexto.fillRect(0, 0, canvasAlvo.width, canvasAlvo.height);

      desafio.blocks.forEach((bloco) => {
        contexto.fillStyle = bloco.color;
        contexto.fillRect(bloco.x, bloco.y, bloco.width, bloco.height);
      });

      metaDesafio.textContent = 'Titulo: ' + desafio.titulo + ' | Seed: ' + desafio.seed + ' | Tempo: ' + Math.floor((desafio.tempoAtualMs || 0) / 1000) + 's';
    }

    function renderizarWorkspace(resumoWorkspace) {
      const htmlInfo = resumoWorkspace.temArquivoHtml
        ? resumoWorkspace.caminhoHtml
        : 'index.html nao encontrado';
      const cssInfo = resumoWorkspace.temArquivoCss
        ? resumoWorkspace.caminhoCss
        : 'style.css nao encontrado';

      listaWorkspace.textContent = 'HTML: ' + htmlInfo + ' | CSS: ' + cssInfo;
      quadroPreview.srcdoc = resumoWorkspace.htmlPreview;
    }

    function renderizarResultado(resultado) {
      if (!resultado) {
        caixaResultado.textContent = 'Nenhuma verificacao ainda.';
        return;
      }

      if (resultado.source === 'missing-files') {
        caixaResultado.textContent = resultado.error || 'Arquivos ausentes.';
        return;
      }

      if (resultado.source === 'api-error') {
        caixaResultado.textContent = 'Erro na API: ' + (resultado.error || 'erro desconhecido');
        return;
      }

      caixaResultado.textContent = 'Precisao: ' + resultado.precision.toFixed(2) + '% | Score: ' + resultado.score + ' | Fonte: ' + resultado.source;
    }

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

    vscode.postMessage({ type: 'pronto' });
  </script>
</body>
</html>`;
}

// gera token aleatório para csp do script injetado na webview.
function criarNonce(): string {
  const caracteres =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let texto = "";

  for (let i = 0; i < 32; i += 1) {
    texto += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }

  return texto;
}
