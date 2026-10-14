import * as assert from "assert";
import * as vscode from "vscode";
import { obterHtmlWebview } from "../../webview/html";
import { lerTemaCores, NomeTema, TEMAS } from "../../webview/temas";

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const canal = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(a: string, b: string): number {
  const [maior, menor] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (maior + 0.05) / (menor + 0.05);
}

suite("Cores da extensão", () => {
  const getConfigurationOriginal = vscode.workspace.getConfiguration;

  teardown(() => {
    vscode.workspace.getConfiguration = getConfigurationOriginal;
  });

  function configurarTema(valor: unknown): void {
    vscode.workspace.getConfiguration = (() => ({
      get: (chave: string, padrao?: unknown) => (chave === "temaCores" ? valor : padrao),
    })) as unknown as typeof vscode.workspace.getConfiguration;
  }

  test("cada conjunto deixa o texto do botão e os destaques legíveis", () => {
    for (const [nome, tema] of Object.entries(TEMAS)) {
      if (nome === "vscode") {
        continue; // As cores vêm do tema do VS Code.
      }
      for (const cor of tema.degradeBotao.match(/#[0-9a-f]{6}/gi) ?? []) {
        assert.ok(contraste("#ffffff", cor) >= 4.5, `${nome}: texto branco sobre ${cor}`);
      }
      // Contra o fundo escuro e o claro da barra lateral do VS Code.
      for (const fundo of ["#181818", "#f8f8f8"]) {
        assert.ok(contraste(tema.acento, fundo) >= 3, `${nome}: destaque ${tema.acento} sobre ${fundo}`);
      }
    }
  });

  test("usa o conjunto escolhido e volta ao padrão com um valor desconhecido", () => {
    configurarTema("oceano");
    assert.strictEqual(lerTemaCores(), "oceano");

    configurarTema("arco-íris");
    assert.strictEqual(lerTemaCores(), "magenta");
  });

  test("as telas trazem as cores do conjunto escolhido", () => {
    const webview = {
      cspSource: "vscode-webview://teste",
      asWebviewUri: (uri: vscode.Uri) => uri,
    } as unknown as vscode.Webview;
    const html = (tema: NomeTema) =>
      obterHtmlWebview(webview, vscode.Uri.parse("file:///extensao"), "Aluno", tema);

    assert.ok(html("oceano").includes(`--acento: ${TEMAS.oceano.acento};`));
    assert.ok(!html("oceano").includes(TEMAS.magenta.acento));
    assert.ok(html("magenta").includes(`--degrade-botao: ${TEMAS.magenta.degradeBotao};`));
  });
});
