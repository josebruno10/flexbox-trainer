import * as assert from "assert";
import * as vscode from "vscode";
import { dicasDeDigitacao } from "../../atalhos/dicas";
import { EMMET_CSS, EMMET_HTML } from "../../atalhos/emmet";
import { ATALHOS_DA_EXTENSAO } from "../../atalhos/extensao";
import { plataformaDe, teclasDaExtensao } from "../../atalhos/plataforma";
import { obterHtmlAtalhos } from "../../telas/atalhos";
import { obterHtmlWebview } from "../../telas/barraLateral";

const webview = {
  cspSource: "vscode-webview://teste",
  asWebviewUri: (uri: vscode.Uri) => uri,
} as unknown as vscode.Webview;
const raiz = vscode.Uri.parse("file:///extensao");

// O conteúdo de um botão da barra lateral, pelo id.
function botao(html: string, id: string): string {
  const inicio = html.indexOf(`id="${id}"`);
  assert.ok(inicio >= 0, `botão ${id} não encontrado`);
  return html.slice(inicio, html.indexOf("</button>", inicio));
}

suite("Atalhos e dicas de digitação", () => {
  test("os atalhos do package.json são os da lista da extensão", () => {
    const pacote = vscode.extensions.getExtension("josebruno10.flexbox-trainer")?.packageJSON;
    const atalhos = pacote?.contributes.keybindings as { command: string; key: string; when: string }[];

    assert.deepStrictEqual(
      atalhos.map(({ command, key, when }) => [command, key, when]),
      ATALHOS_DA_EXTENSAO.map(({ comando, teclas, quando }) => [comando, teclas, quando]),
    );
    const comandos = (pacote?.contributes.commands as { command: string }[]).map(
      (item) => item.command,
    );
    assert.ok(comandos.includes("flexbox-trainer.verAtalhos"));
  });

  test("as teclas aparecem como em cada sistema", () => {
    assert.strictEqual(teclasDaExtensao("ctrl+alt+d", "linux"), "Ctrl+Alt+D");
    assert.strictEqual(teclasDaExtensao("ctrl+alt+shift+v", "windows"), "Ctrl+Alt+Shift+V");
    assert.strictEqual(teclasDaExtensao("ctrl+alt+shift+v", "mac"), "⌃⌥⇧V");
    assert.strictEqual(plataformaDe("darwin"), "mac");
    assert.strictEqual(plataformaDe("win32"), "windows");
    assert.strictEqual(plataformaDe("linux"), "linux");
    assert.strictEqual(plataformaDe("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "windows");
    assert.strictEqual(plataformaDe("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)"), "mac");
    assert.strictEqual(plataformaDe("Mozilla/5.0 (X11; Linux x86_64)"), "linux");
  });

  test("cada botão com atalho o mostra embaixo do texto", () => {
    const html = obterHtmlWebview(webview, raiz, "Aluno", "floresta", "linux");
    const esperados: Record<string, string> = {
      botaoNovoDesafio: "Ctrl+Alt+D",
      botaoDesafioDia: "Ctrl+Alt+Shift+D",
      botaoAbrirAba: "Ctrl+Alt+A",
      botaoRefazer: "Ctrl+Alt+Shift+N",
      botaoVerificar: "Ctrl+Alt+V",
      botaoCopiarResultado: "Ctrl+Alt+Shift+V",
      botaoVerHistorico: "Ctrl+Alt+H",
    };
    for (const [id, teclas] of Object.entries(esperados)) {
      const conteudo = botao(html, id);
      assert.ok(conteudo.includes(`<small class="atalho">${teclas}</small>`), id);
      // O texto fica num span próprio, para o script trocá-lo sem apagar o atalho.
      assert.ok(conteudo.includes('class="texto-botao"'), id);
    }
    // À vista, o atalho não precisa se repetir na dica do mouse.
    assert.ok(!html.includes("(Ctrl+Alt"));

    const doMac = obterHtmlWebview(webview, raiz, "Aluno", "floresta", "mac");
    assert.ok(botao(doMac, "botaoNovoDesafio").includes('<small class="atalho">⌃⌥D</small>'));
  });

  test("a barra lateral recebe as dicas, com as teclas do sistema", () => {
    const html = obterHtmlWebview(webview, raiz, "Aluno", "floresta", "linux");
    const atributo = /id="dicaDigitacao" data-dicas="([^"]*)"/.exec(html)?.[1];
    assert.ok(atributo, "a dica não está na barra lateral");
    const dicas = JSON.parse(
      atributo.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
    ) as Array<Array<{ texto?: string; codigo?: string }>>;

    assert.deepStrictEqual(dicas as unknown, dicasDeDigitacao("linux"));
    assert.ok(dicas.length >= 20);
    // Toda dica mostra algo para digitar.
    assert.ok(dicas.every((dica) => dica.some((parte) => parte.codigo)));
    // No Linux, formatar o arquivo é Ctrl+Shift+I.
    assert.ok(dicas.some((dica) => dica.some((parte) => parte.codigo === "Ctrl+Shift+I")));
    // As três primeiras misturam CSS, HTML e editor.
    assert.match(dicas[0][0].texto ?? "", /style\.css/);
    assert.match(dicas[1][0].texto ?? "", /index\.html/);
  });

  test("as abreviações que não fazem o esperado ficam de fora", () => {
    const abreviacoes = [
      ...EMMET_CSS.flatMap((grupo) => grupo.abreviacoes.map((item) => item.abreviacao)),
      ...EMMET_HTML.map((item) => item.abreviacao),
    ];
    // Testadas no VS Code 1.142: fdc e fww não expandem, e jcsa vira
    // "justify-content: start", não space-around.
    for (const enganosa of ["fdc", "fww", "jcsa"]) {
      assert.ok(!abreviacoes.includes(enganosa), enganosa);
    }
    assert.strictEqual(new Set(abreviacoes).size, abreviacoes.length);
  });

  test("a aba Atalhos lista tudo, sem script", () => {
    const html = obterHtmlAtalhos(webview, raiz, "floresta", "linux");

    assert.ok(!/<script/i.test(html));
    assert.ok(!html.includes("script-src"));
    for (const { acao } of ATALHOS_DA_EXTENSAO) {
      assert.ok(html.includes(acao), acao);
    }
    for (const grupo of EMMET_CSS) {
      for (const { abreviacao } of grupo.abreviacoes) {
        assert.ok(html.includes(`<code>${abreviacao}</code>`), abreviacao);
      }
    }
    assert.ok(html.includes("<code>.linha&gt;.item*3</code>"));
    assert.ok(html.includes("<kbd>Ctrl+Shift+I</kbd>"));
    assert.ok(obterHtmlAtalhos(webview, raiz, "floresta", "mac").includes("<kbd>⇧⌥F</kbd>"));
    assert.ok(obterHtmlAtalhos(webview, raiz, "floresta", "windows").includes("<kbd>Shift+Alt+F</kbd>"));
  });
});
