import * as vscode from "vscode";
import { ATALHOS_DO_EDITOR } from "../atalhos/editor";
import { EMMET_CSS, EMMET_HTML } from "../atalhos/emmet";
import { ATALHOS_DA_EXTENSAO } from "../atalhos/extensao";
import { Plataforma, plataformaAtual, teclasDaExtensao } from "../atalhos/plataforma";
import { escapeHtml } from "./comum";
import { ESTILOS_ATALHOS } from "./estilos/atalhos";
import { estilosBase } from "./estilos/base";
import { lerTemaCores, NomeTema } from "./temas";

// A aba Atalhos: os da extensão, os do editor e as abreviações Emmet, para
// digitar HTML e CSS mais rápido. Só sobre o editor, nada sobre o desafio.
// Sem script: é uma página para consultar.
export function obterHtmlAtalhos(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  tema: NomeTema = lerTemaCores(),
  plataforma: Plataforma = plataformaAtual(),
): string {
  const linha = (tecla: string, texto: string) =>
    `<tr><td><kbd>${escapeHtml(tecla)}</kbd></td><td>${escapeHtml(texto)}</td></tr>`;
  const extensao = ATALHOS_DA_EXTENSAO.map(({ teclas, acao }) =>
    linha(teclasDaExtensao(teclas, plataforma), acao),
  ).join("");
  const editor = ATALHOS_DO_EDITOR.map(({ teclas, acao }) =>
    linha(teclas[plataforma], primeiraMaiuscula(acao)),
  ).join("");
  const html = EMMET_HTML.map(
    ({ abreviacao, explicacao, resultado }) => `
      <div class="abreviacao">
        <div class="cabeca"><code>${escapeHtml(abreviacao)}</code><span>${escapeHtml(explicacao)}</span></div>
        <pre>${escapeHtml(resultado)}</pre>
      </div>`,
  ).join("");
  const css = EMMET_CSS.map(
    (grupo) => `
      <h3>${escapeHtml(grupo.nome)}</h3>
      <table class="css">${grupo.abreviacoes
        .map(
          ({ abreviacao, resultado }) =>
            `<tr><td><code>${escapeHtml(abreviacao)}</code></td><td><code>${escapeHtml(resultado)}</code></td></tr>`,
        )
        .join("")}</table>`,
  ).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src 'unsafe-inline';">
  <title>Atalhos</title>
  <style>${estilosBase(webview, extensionUri, tema)}${ESTILOS_ATALHOS}
  </style>
</head>
<body>
  <div class="faixa" aria-hidden="true"></div>
  <main class="atalhos">
    <header>
      <p class="rotulo">FlexBox Trainer</p>
      <h1>Atalhos e abreviações</h1>
      <p class="intro">Para escrever HTML e CSS mais rápido. Os atalhos do editor e as abreviações Emmet já vêm no VS Code, sem instalar nada.</p>
    </header>

    <section>
      <h2 class="rotulo"><span class="numero">01</span> / Na extensão</h2>
      <table>${extensao}</table>
      <h2 class="rotulo"><span class="numero">02</span> / No editor</h2>
      <table>${editor}</table>
    </section>

    <section>
      <h2 class="rotulo"><span class="numero">03</span> / HTML com Emmet</h2>
      <p class="nota">No <code>index.html</code>, digite a abreviação e aperte <kbd>Tab</kbd> (ou <kbd>Enter</kbd>) quando aparecer a sugestão “Emmet Abbreviation”.</p>
      ${html}
    </section>

    <section>
      <h2 class="rotulo"><span class="numero">04</span> / CSS com Emmet</h2>
      <p class="nota">No <code>style.css</code>, dentro de uma regra (entre <code>{</code> e <code>}</code>). Número sozinho vira <code>px</code>, e <code>p</code> no fim vira <code>%</code>.</p>
      ${css}
    </section>
  </main>
</body>
</html>`;
}

function primeiraMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
