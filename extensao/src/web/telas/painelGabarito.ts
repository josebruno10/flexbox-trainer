import * as vscode from "vscode";
import { lerTemaCores, NomeTema } from "./temas";
import { estilosBase } from "./estilos/base";
import { ESTILOS_PAINEL_COMPONENTES } from "./estilos/painelComponentes";
import { ESTILOS_PAINEL_GABARITO } from "./estilos/painelGabarito";

// Aba do editor com o gabarito grande, as medidas de todos os componentes e a
// comparação com a página do aluno.
export function obterHtmlPainelGabarito(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  tema: NomeTema = lerTemaCores(),
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
  <style>${estilosBase(webview, extensionUri, tema)}${ESTILOS_PAINEL_GABARITO}${ESTILOS_PAINEL_COMPONENTES}
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
        <button type="button" class="botao-lista" id="botaoLista" aria-expanded="true" aria-controls="listaComponentes"><span class="icone-lista" aria-hidden="true">☰</span><span id="textoBotaoLista">Esconder componentes</span></button>
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
