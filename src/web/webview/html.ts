import * as vscode from "vscode";

// Identidade comum às três telas. As cores vêm do tema do VS Code, para
// combinar com o claro e o escuro; o degradê e as fontes (Space Grotesk e
// DM Mono, licença OFL, em media/fontes) são os do projeto na FECITEL.
function estilosBase(webview: vscode.Webview, extensionUri: vscode.Uri): string {
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
      --rosa: #f32f67;
      --degrade: linear-gradient(100deg, #df18b1, #ec3370 45%, #f95720);
      /* Mais escuro que o da marca: o texto branco fica legível (contraste
         acima de 4,5 em toda a faixa). */
      --degrade-botao: linear-gradient(100deg, #b5179e, #d6245e 50%, #c94010);
      --aviso: var(--vscode-editorWarning-foreground, #cca700);
      --erro: var(--vscode-errorForeground, #f14c4c);
      --foco: var(--vscode-focusBorder, #f32f67);
      --fonte-texto: var(--vscode-font-family, system-ui, sans-serif);
      --fonte-mono: "DM Mono", var(--vscode-editor-font-family, monospace);
      --fonte-titulo: "Space Grotesk", var(--vscode-font-family, sans-serif);
    }

    [hidden] {
      display: none !important;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: var(--fonte-texto);
      font-size: 13px;
      line-height: 1.45;
      color: var(--texto);
      background: var(--fundo);
    }

    .faixa {
      height: 3px;
      background: var(--degrade);
      background-size: 200% 100%;
      animation: correr 9s ease-in-out infinite alternate;
    }

    @keyframes correr {
      to {
        background-position: 100% 0;
      }
    }

    /* As partes da tela surgem uma depois da outra ao abrir. */
    .surge {
      animation: surgir 420ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
      animation-delay: calc(var(--ordem, 0) * 60ms);
    }

    @keyframes surgir {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
      }
    }

    .rotulo {
      margin: 0;
      font-family: var(--fonte-mono);
      font-size: 10.5px;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--texto-suave);
    }

    .rotulo .numero {
      color: var(--texto);
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 30px;
      padding: 6px 10px;
      border: 1px solid var(--tinta);
      border-radius: 2px;
      font-family: var(--fonte-mono);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.04em;
      line-height: 1.25;
      text-transform: uppercase;
      color: var(--sobre-tinta);
      background: var(--tinta);
      cursor: pointer;
      transition: box-shadow 120ms ease, transform 120ms ease, background 120ms ease, border-color 120ms ease;
    }

    /* A sombra rosa desloca o botão como uma impressão fora de registro. */
    button:hover:not(:disabled) {
      box-shadow: 3px 3px 0 var(--rosa);
      transform: translate(-1px, -1px);
    }

    button:active:not(:disabled) {
      box-shadow: 1px 1px 0 var(--rosa);
      transform: none;
    }

    button.secundario {
      color: var(--texto);
      background: transparent;
      border-color: var(--linha-forte);
    }

    button.discreto {
      min-height: 0;
      padding: 3px 6px;
      color: var(--texto-suave);
      background: transparent;
      border-color: transparent;
    }

    button.secundario:hover:not(:disabled),
    button.discreto:hover:not(:disabled) {
      box-shadow: none;
      transform: none;
      border-color: currentColor;
      background: var(--superficie);
    }

    /* A ação principal de cada momento: gerar o primeiro desafio, depois
       verificar. */
    button.principal {
      color: #fff;
      background: var(--degrade-botao);
      border-color: transparent;
    }

    button.principal:hover:not(:disabled) {
      box-shadow: 3px 3px 0 var(--tinta);
    }

    button.principal:active:not(:disabled) {
      box-shadow: 1px 1px 0 var(--tinta);
    }

    /* Desligado, o botão principal fica neutro: só uma ação chama atenção. */
    button.principal:disabled {
      color: var(--texto-suave);
      background: transparent;
      border-color: var(--linha);
      opacity: 1;
    }

    button.encerrar {
      color: var(--texto-suave);
      background: transparent;
      border-color: transparent;
    }

    button.encerrar:hover:not(:disabled) {
      box-shadow: none;
      transform: none;
      color: var(--erro);
      background: var(--superficie);
    }

    /* Botões de alternar, um ao lado do outro. */
    .modos {
      display: inline-flex;
    }

    .modo {
      color: var(--texto);
      background: transparent;
      border-color: var(--linha-forte);
    }

    .modo + .modo {
      border-left: 0;
    }

    .modo[aria-pressed="true"] {
      color: var(--sobre-tinta);
      background: var(--tinta);
      border-color: var(--tinta);
    }

    .modo:hover:not(:disabled) {
      box-shadow: none;
      transform: none;
      background: var(--superficie);
    }

    .modo[aria-pressed="true"]:hover:not(:disabled) {
      background: var(--tinta);
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }

    button:focus-visible,
    input:focus-visible {
      outline: 1px solid var(--foco);
      outline-offset: 2px;
    }

    .dados {
      margin: 0;
    }

    .dados > div {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 0;
      border-bottom: 1px dashed var(--linha-tracejada);
    }

    .dados dt {
      flex: 0 0 auto;
      font-family: var(--fonte-mono);
      font-size: 10.5px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--texto-suave);
    }

    .dados dd {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      min-width: 0;
      margin: 0;
      font-family: var(--fonte-mono);
      font-size: 12px;
    }

    .amostra {
      flex: 0 0 auto;
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 1px solid var(--linha-forte);
    }
  `;
}

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
    font-src ${webview.cspSource};
    script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval';
    style-src ${webview.cspSource} 'unsafe-inline' https: http:;
    connect-src ${webview.cspSource} https: http: ws: wss:;
    frame-src 'self' https: http: data:;
  ">
  <title>FlexBox Trainer</title>
  <style>${estilosBase(webview, extensionUri)}
    body {
      padding: 0 14px 18px;
    }

    .faixa {
      margin: 0 -14px;
    }

    .conta {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 0;
      border-bottom: 1px solid var(--linha);
    }

    .status-auth-texto {
      flex: 1 1 auto;
      min-width: 0;
      font-size: 12px;
      color: var(--texto-suave);
    }

    .status-auth-texto strong {
      display: block;
      overflow: hidden;
      font-family: var(--fonte-titulo);
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.01em;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--texto);
    }

    .aviso-cadastro {
      display: block;
      color: var(--aviso);
    }

    .avatar-usuario,
    .avatar-fallback {
      flex: 0 0 32px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
    }

    .avatar-fallback {
      display: grid;
      place-items: center;
      font-family: var(--fonte-titulo);
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      background: var(--degrade);
    }

    .aviso-ia {
      margin-top: 12px;
      padding: 10px 10px 10px 12px;
      border: 1px solid var(--aviso);
      border-left-width: 3px;
      font-size: 12px;
      background: color-mix(in srgb, var(--aviso) 10%, transparent);
    }

    .aviso-ia .rotulo {
      margin-bottom: 4px;
      color: var(--aviso);
    }

    .bloco {
      padding: 16px 0;
      border-bottom: 1px solid var(--linha);
    }

    .bloco:last-of-type {
      border-bottom: 0;
    }

    .cabecalho {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-height: 22px;
      margin-bottom: 10px;
    }

    .selo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--fonte-mono);
      font-size: 10.5px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
      color: var(--texto-suave);
    }

    .selo::before {
      content: "";
      width: 7px;
      height: 7px;
      background: currentColor;
    }

    .selo[data-estado="andamento"] {
      color: var(--texto);
    }

    .selo[data-estado="andamento"]::before {
      background: var(--rosa);
      animation: piscar 1.6s ease-in-out infinite;
    }

    @keyframes piscar {
      50% {
        opacity: 0.25;
      }
    }

    .canvas-desafio {
      position: relative;
      width: 100%;
      aspect-ratio: var(--proporcao-desafio, 16 / 9);
      overflow: hidden;
      border: 1px solid var(--linha);
      background: #fff;
    }

    .canvas-desafio canvas {
      display: block;
      width: 100%;
      height: 100%;
    }

    .canvas-anotacoes {
      position: absolute;
      inset: 0;
      background: transparent;
    }

    .canvas-anotacoes[data-sobre-componente] {
      cursor: pointer;
    }

    /* Gabarito e página do aluno dividem o mesmo quadro: alternar entre os
       dois, no mesmo lugar, mostra onde eles diferem. */
    .vistas {
      display: flex;
      gap: 6px;
      margin-bottom: 8px;
    }

    .vistas .modos {
      flex: 1 1 auto;
      display: flex;
    }

    .vistas .modo {
      flex: 1 1 0;
    }

    /* A página já atualiza enquanto o aluno digita; o botão é para quando
       demorar. */
    button.atualizar {
      flex: 0 0 32px;
      padding: 0;
      font-size: 15px;
      letter-spacing: 0;
    }

    .canvas-desafio .preview {
      position: absolute;
      inset: 0;
      background: #fff;
      visibility: hidden;
    }

    .canvas-desafio[data-vista="pagina"] .preview {
      visibility: visible;
    }

    .canvas-desafio[data-vista="pagina"] .canvas-anotacoes {
      pointer-events: none;
    }

    .quadro-vazio {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      margin: 0;
      font-family: var(--fonte-mono);
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6c6066;
      pointer-events: none;
    }

    .dados-grade {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
      column-gap: 14px;
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

    .detalhe {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      min-height: 34px;
      margin: 8px 0 4px;
      padding: 7px 9px;
      font-size: 12px;
      color: var(--texto-suave);
      background: var(--superficie);
    }

    .detalhe strong {
      font-family: var(--fonte-titulo);
      font-weight: 600;
      color: var(--texto);
    }

    .detalhe .medida {
      font-family: var(--fonte-mono);
      color: var(--texto);
    }

    .falta {
      margin: 0 0 4px;
      font-size: 12px;
      color: var(--erro);
    }

    .acoes {
      display: grid;
      /* Dois botões por linha quando cabem sem quebrar o texto. */
      grid-template-columns: repeat(auto-fit, minmax(136px, 1fr));
      gap: 8px;
      margin-top: 12px;
    }

    .acoes > .largo {
      grid-column: 1 / -1;
    }

    .simbolo {
      display: inline-block;
      font-size: 14px;
      line-height: 1;
      transition: transform 250ms cubic-bezier(0.2, 0.7, 0.2, 1);
    }

    button:hover:not(:disabled) .simbolo.mais {
      transform: rotate(90deg);
    }

    /* O ✓ de Verificar pula quando a nota chega. */
    .simbolo.pulo {
      animation: pular 520ms cubic-bezier(0.2, 0.7, 0.2, 1);
    }

    @keyframes pular {
      40% {
        transform: translateY(-4px) scale(1.35);
      }
    }

    button.arquivos {
      text-transform: none;
      letter-spacing: 0.02em;
    }

    .linha {
      font-size: 12px;
      line-height: 1.5;
    }

    .nota {
      margin-bottom: 10px;
    }

    .nota.resultado {
      margin-top: 16px;
    }

    .linha {
      margin-top: 12px;
    }

    .nota.resultado + .linha {
      margin-top: 0;
    }

    .valor-nota {
      display: block;
      font-family: var(--fonte-titulo);
      font-size: 42px;
      font-weight: 700;
      letter-spacing: -0.045em;
      line-height: 1;
    }

    .valor-nota small {
      margin-left: 2px;
      font-size: 20px;
      letter-spacing: 0;
      color: var(--texto-suave);
    }

    .barra-nota {
      height: 6px;
      margin-top: 10px;
      background: var(--superficie);
    }

    .barra-nota span {
      display: block;
      width: 0;
      height: 100%;
      background: var(--degrade);
      /* Mesma duração e curva da contagem da nota. */
      transition: width 700ms cubic-bezier(0.33, 1, 0.68, 1);
    }

    .historico {
      margin-top: 10px;
    }

    .historico .atual {
      font-weight: 500;
      color: var(--texto);
    }

    .historico .anterior {
      color: var(--texto-suave);
    }
  </style>
</head>
<body>
  <div class="faixa" aria-hidden="true"></div>
  <header class="conta surge" style="--ordem: 0">
    <img id="avatarUsuario" class="avatar-usuario" alt="Foto do usuário" hidden>
    <div id="avatarFallback" class="avatar-fallback">${escapeHtml((nomeUsuario || "U").trim().charAt(0).toUpperCase() || "U")}</div>
    <div class="status-auth-texto" id="statusAutenticacao"><strong>${escapeHtml(nomeUsuario || "Conectado")}</strong></div>
    <button id="botaoSair" class="discreto">Sair</button>
  </header>

  <div class="acoes" id="cadastroTorneio" hidden>
    <button id="botaoCadastrar" class="largo secundario">Cadastrar no torneio</button>
  </div>

  <div class="aviso-ia" id="avisoIa" role="alert" hidden>
    <p class="rotulo">IA habilitada</p>
    <span id="textoAvisoIa"></span>
    <div class="acoes">
      <button id="botaoVerExtensoesIa" class="secundario">Ver extensões</button>
    </div>
  </div>

  <section class="bloco surge" style="--ordem: 1" aria-label="Desafio">
    <div class="cabecalho">
      <h2 class="rotulo"><span class="numero">01</span> / Desafio</h2>
      <span class="selo" id="seloDesafio" data-estado="vazio">Sem desafio</span>
    </div>
    <div class="vistas" id="vistas" hidden>
      <div class="modos" role="group" aria-label="O que mostrar no quadro">
        <button type="button" class="modo" data-vista="gabarito" aria-pressed="true">Gabarito</button>
        <button type="button" class="modo" id="botaoVistaPagina" data-vista="pagina" aria-pressed="false">Sua página</button>
      </div>
      <button type="button" id="botaoAtualizarPreview" class="secundario atualizar" title="Atualizar a sua página agora. Ela já atualiza sozinha enquanto você digita." aria-label="Atualizar a sua página">↻</button>
    </div>
    <div class="canvas-desafio" id="quadroDesafio" data-vista="gabarito">
      <canvas id="canvasAlvo" width="960" height="540"></canvas>
      <canvas id="canvasAnotacoes" class="canvas-anotacoes" width="960" height="540"></canvas>
      <canvas id="canvasPreviewAluno" class="preview" width="960" height="540"></canvas>
      <p class="quadro-vazio" id="quadroVazio">Gere um desafio para começar</p>
    </div>
    <div class="detalhe" id="detalheComponente" hidden></div>
    <dl class="dados dados-grade" id="metaDesafio" hidden>
      <div><dt>Tempo</dt><dd id="valorTempo">--:--</dd></div>
      <div><dt>Formato</dt><dd id="valorFormato">--</dd></div>
      <div><dt>Fundo</dt><dd id="valorFundo">--</dd></div>
      <div><dt>Componentes</dt><dd id="valorComponentes">--</dd></div>
    </dl>
    <div class="acoes">
      <button id="botaoNovoDesafio" class="largo principal"><span class="simbolo mais" aria-hidden="true">+</span>Gerar novo desafio</button>
      <button id="botaoAbrirAba" class="secundario" title="Gabarito e medidas numa aba do editor" hidden>Abrir em uma aba</button>
      <button id="botaoEncerrarDesafio" class="encerrar" title="Para o cronômetro" disabled hidden>Encerrar desafio</button>
    </div>
  </section>

  <section class="bloco surge" style="--ordem: 2" aria-label="Resultado">
    <div class="cabecalho">
      <h2 class="rotulo"><span class="numero">02</span> / Resultado</h2>
      <button id="botaoTestarConexao" class="discreto" title="Confere a sessão no servidor">Testar servidor</button>
    </div>
    <div id="avisoArquivos" hidden>
      <p class="falta" id="textoArquivos"></p>
      <div class="acoes">
        <button id="botaoCriarArquivos" class="largo secundario arquivos">Criar index.html e style.css</button>
      </div>
    </div>
    <div
      id="quadroAvaliacao"
      class="preview-avaliacao"
      aria-hidden="true"
    ></div>
    <div class="acoes">
      <button id="botaoVerificar" class="largo principal" disabled><span class="simbolo" id="simboloVerificar" aria-hidden="true">✓</span>Verificar</button>
    </div>
    <div class="nota resultado" id="notaResultado" hidden>
      <strong class="valor-nota" id="valorNota"></strong>
      <div class="barra-nota" aria-hidden="true"><span id="barraNota"></span></div>
    </div>
    <div class="linha" id="caixaResultado" role="status">Nenhuma verificação.</div>
    <dl class="dados historico" id="historicoNotas" hidden>
      <div><dt>Tentativas</dt><dd id="valorTentativas"></dd></div>
      <div><dt>Melhor</dt><dd id="valorMelhor"></dd></div>
    </dl>
  </section>

  <script src="${scriptUri}"></script>
</body>
</html>`;
}

// Aba do editor com o gabarito grande, as medidas de todos os componentes e a
// comparação com a página do aluno.
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: http: data: blob:; font-src ${webview.cspSource} https: data:; style-src 'unsafe-inline' https: http:; script-src ${webview.cspSource};">
  <title>Gabarito</title>
  <style>${estilosBase(webview, extensionUri)}
    :root {
      --fundo: var(--vscode-editor-background);
    }

    body {
      padding: 0 16px 16px;
    }

    .faixa {
      margin: 0 -16px 16px;
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
      gap: 12px;
    }

    .resumo {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 8px 22px;
    }

    .titulo-tela {
      display: block;
      margin-top: 2px;
      font-family: var(--fonte-titulo);
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.1;
    }

    .resumo .dados {
      display: flex;
      gap: 18px;
    }

    .resumo .dados > div {
      gap: 8px;
      padding: 0 0 2px;
      border-bottom: 0;
    }

    .barra {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 16px;
    }

    .opacidade {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: var(--fonte-mono);
      font-size: 11px;
      color: var(--texto-suave);
    }

    .opacidade strong {
      min-width: 4ch;
      font-weight: 500;
      color: var(--texto);
    }

    .opacidade input {
      accent-color: var(--rosa);
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
      margin-bottom: 6px;
    }

    .palco[data-modo="lado"] figcaption {
      display: block;
    }

    .tela {
      position: relative;
      overflow: hidden;
      background: #fff;
      outline: 1px solid var(--linha);
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
      font-size: 12px;
      color: var(--texto-suave);
    }

    .lista {
      flex: 1 1 300px;
      min-width: 250px;
      max-width: 340px;
      max-height: calc(100vh - 35px);
      list-style: none;
      margin: 0;
      padding: 0 4px 0 0;
      overflow-y: auto;
      border-top: 1px solid var(--linha);
    }

    .componente {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 8px 5px 10px;
      border-bottom: 1px dashed var(--linha-tracejada);
      border-left: 2px solid transparent;
      cursor: pointer;
    }

    .componente:hover {
      background: var(--superficie);
    }

    .componente.selecionado {
      border-left-color: var(--rosa);
      background: var(--superficie);
    }

    .componente .amostra {
      width: 16px;
      height: 16px;
    }

    /* A forma da amostra diz se o componente é um círculo. */
    .componente .amostra.circulo {
      border-radius: 50%;
    }

    .componente .numero-componente {
      min-width: 3.2ch;
      font-family: var(--fonte-mono);
      font-size: 11px;
      font-weight: 500;
      color: var(--texto-suave);
    }

    .valores {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    /* Só para leitores de tela. */
    .so-leitor {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    .valor {
      min-height: 0;
      padding: 1px 5px;
      font-size: 11px;
      letter-spacing: 0;
      text-transform: none;
      color: var(--texto);
      background: transparent;
      border-color: var(--linha);
      cursor: copy;
    }

    .valor:hover:not(:disabled) {
      box-shadow: none;
      transform: none;
      border-color: var(--texto);
    }

    .valor.copiado {
      color: var(--sobre-tinta);
      background: var(--tinta);
      border-color: var(--tinta);
    }

    .vazio {
      color: var(--texto-suave);
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
  <div class="faixa" aria-hidden="true"></div>
  <div class="vazio" id="vazio">Nenhum desafio. Gere um na barra lateral.</div>
  <div class="conteudo" id="conteudo" hidden>
    <section class="imagem">
      <div class="resumo" id="resumo"></div>
      <div class="barra">
        <div class="modos" role="group" aria-label="Modo de exibição">
          <button type="button" class="modo" data-modo="gabarito" aria-pressed="true">Gabarito</button>
          <button type="button" class="modo" data-modo="sobreposto" aria-pressed="false">Sobrepor à sua página</button>
          <button type="button" class="modo" data-modo="lado" aria-pressed="false">Lado a lado</button>
        </div>
        <button type="button" class="modo" id="botaoLista" aria-pressed="true" aria-controls="listaComponentes" title="Mostrar ou esconder a lista de componentes">Componentes</button>
        <div class="opacidade" id="controleOpacidade" hidden>
          <span>Sua página</span>
          <input type="range" id="opacidade" min="0" max="100" step="1" value="50" aria-label="Opacidade do gabarito">
          <span>Gabarito</span>
          <strong id="valorOpacidade">50%</strong>
        </div>
      </div>
      <div class="palco" id="palco" data-modo="gabarito">
        <figure class="quadro" id="quadroGabarito">
          <figcaption class="rotulo">Gabarito</figcaption>
          <div class="tela" id="telaGabarito">
            <canvas id="canvasGabarito"></canvas>
            <canvas id="canvasDestaque"></canvas>
          </div>
        </figure>
        <figure class="quadro" id="quadroAluno">
          <figcaption class="rotulo">Sua página</figcaption>
          <div class="tela" id="telaAluno">
            <div id="superficieAluno"></div>
            <div class="sem-pagina" id="semPagina" hidden>Sem index.html e style.css.</div>
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

// Marcas dos provedores, como nos botões oficiais de login.
const ICONE_GOOGLE = `<svg viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.87 2.69-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A8.65 8.65 0 0 0 9 0 9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/></svg>`;
const ICONE_GITHUB = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`;
const ICONE_MICROSOFT = `<svg viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>`;

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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; style-src 'unsafe-inline'; script-src ${webview.cspSource};">
  <title>FlexBox Trainer - Autenticação</title>
  <style>${estilosBase(webview, extensionUri)}
    body {
      padding: 0 14px 18px;
    }

    .faixa {
      margin: 0 -14px;
    }

    .entrada {
      max-width: 360px;
      padding-top: 22px;
    }

    h1 {
      margin: 10px 0 0;
      font-family: var(--fonte-titulo);
      font-size: 38px;
      font-weight: 700;
      letter-spacing: -0.05em;
      line-height: 0.92;
    }

    h1 span {
      display: block;
      width: fit-content;
      color: transparent;
      background: var(--degrade);
      -webkit-background-clip: text;
      background-clip: text;
    }

    .descricao {
      margin: 14px 0 18px;
      color: var(--texto-suave);
    }

    .status {
      margin-bottom: 16px;
      padding: 9px 10px;
      border-left: 2px solid var(--rosa);
      font-size: 12px;
      background: var(--superficie);
    }

    .acoes {
      display: grid;
      gap: 8px;
    }

    .provedor {
      justify-content: flex-start;
      gap: 10px;
      min-height: 38px;
      padding: 8px 12px;
      font-size: 11.5px;
    }

    .provedor svg {
      flex: 0 0 18px;
      width: 18px;
      height: 18px;
    }

    /* O G colorido precisa de fundo branco sobre o botão escuro. */
    .provedor .marca {
      display: grid;
      place-items: center;
      flex: 0 0 22px;
      width: 22px;
      height: 22px;
      margin: -2px 0 -2px -4px;
      background: #fff;
    }

    .provedor .marca svg {
      width: 15px;
      height: 15px;
    }

    #botaoSair {
      justify-self: start;
      margin-top: 2px;
    }

    .meta {
      margin: 18px 0 0;
      padding-top: 12px;
      border-top: 1px dashed var(--linha-tracejada);
      font-size: 11.5px;
      color: var(--texto-suave);
    }
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
