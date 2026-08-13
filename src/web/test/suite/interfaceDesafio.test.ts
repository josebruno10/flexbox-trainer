import * as assert from "assert";
import * as vscode from "vscode";
import { obterHtmlAutenticacao, obterHtmlWebview } from "../../webview/html";

suite("Interface do desafio", () => {
  test("mantém uma camada transparente para clicar no gabarito limpo", () => {
    const webview = {
      cspSource: "vscode-webview://teste",
      asWebviewUri: (uri: vscode.Uri) => uri,
    } as unknown as vscode.Webview;
    const html = obterHtmlWebview(
      webview,
      vscode.Uri.parse("file:///extensao"),
      "Aluno",
    );
    const alvo = '<canvas id="canvasAlvo" width="960" height="540"></canvas>';
    const camadaInteracao =
      '<canvas id="canvasAnotacoes" class="canvas-anotacoes" width="960" height="540"></canvas>';

    assert.ok(html.includes(alvo), "O canvas limpo do gabarito não foi encontrado.");
    assert.ok(
      html.includes(camadaInteracao),
      "A camada transparente de interação não foi encontrada.",
    );
    assert.ok(
      html.indexOf(alvo) < html.indexOf(camadaInteracao),
      "A camada de clique deve ficar sobre o alvo sem alterar sua imagem.",
    );
    assert.match(
      html,
      /\.canvas-anotacoes\s*\{[^}]*position:\s*absolute;[^}]*background:\s*transparent;/s,
    );
  });

  test("oferece a ação para encerrar o desafio", () => {
    const webview = {
      cspSource: "vscode-webview://teste",
      asWebviewUri: (uri: vscode.Uri) => uri,
    } as unknown as vscode.Webview;
    const html = obterHtmlWebview(
      webview,
      vscode.Uri.parse("file:///extensao"),
      "Aluno",
    );

    assert.ok(html.includes('id="botaoEncerrarDesafio"'));
    assert.ok(html.includes("Encerrar desafio"));
  });

  test("gera desafios aleatórios sem seletor de dificuldade", () => {
    const webview = {
      cspSource: "vscode-webview://teste",
      asWebviewUri: (uri: vscode.Uri) => uri,
    } as unknown as vscode.Webview;
    const html = obterHtmlWebview(
      webview,
      vscode.Uri.parse("file:///extensao"),
      "Aluno",
    );

    assert.ok(html.includes("Gerar novo desafio"));
    assert.ok(!html.includes("seletorDificuldade"));
    assert.ok(!html.includes("Nível do desafio"));
  });

  test("não exibe um título para o desafio gerado", () => {
    const webview = {
      cspSource: "vscode-webview://teste",
      asWebviewUri: (uri: vscode.Uri) => uri,
    } as unknown as vscode.Webview;
    const html = obterHtmlWebview(
      webview,
      vscode.Uri.parse("file:///extensao"),
      "Aluno",
    );

    assert.ok(!html.includes('<h2 class="titulo">Desafio alvo</h2>'));
  });

  test("mantém o preview apenas para acompanhamento visual", () => {
    const webview = {
      cspSource: "vscode-webview://teste",
      asWebviewUri: (uri: vscode.Uri) => uri,
    } as unknown as vscode.Webview;
    const html = obterHtmlWebview(
      webview,
      vscode.Uri.parse("file:///extensao"),
      "Aluno",
    );

    assert.ok(
      html.includes(
        '<canvas id="canvasPreviewAluno" class="preview" width="960" height="540"></canvas>',
      ),
    );
    assert.ok(!html.includes('id="quadroPreview"'));
  });

  test("oferece somente autenticação pelo Google", () => {
    const webview = {
      cspSource: "vscode-webview://teste",
      asWebviewUri: (uri: vscode.Uri) => uri,
    } as unknown as vscode.Webview;
    const html = obterHtmlAutenticacao(
      webview,
      vscode.Uri.parse("file:///extensao"),
    );

    assert.ok(html.includes('id="botaoGoogle"'));
    assert.ok(!html.includes("botaoGitHub"));
    assert.ok(!html.includes("botaoMicrosoft"));
  });
});
