import * as assert from "assert";
import * as vscode from "vscode";
import {
  obterHtmlAutenticacao,
  obterHtmlPainelGabarito,
  obterHtmlWebview,
} from "../../webview/html";

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

  test("oferece os três níveis logo acima de Gerar novo desafio", () => {
    const webview = {
      cspSource: "vscode-webview://teste",
      asWebviewUri: (uri: vscode.Uri) => uri,
    } as unknown as vscode.Webview;
    const html = obterHtmlWebview(webview, vscode.Uri.parse("file:///extensao"), "Aluno");

    assert.deepStrictEqual(
      [...html.matchAll(/data-nivel="(\w+)"/g)].map((achado) => achado[1]),
      ["facil", "medio", "dificil"],
    );
    assert.ok(html.indexOf('id="niveis"') < html.indexOf('id="botaoNovoDesafio"'));
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

  test("traz os créditos no pé da barra lateral e da tela de entrada", () => {
    const webview = {
      cspSource: "vscode-webview://teste",
      asWebviewUri: (uri: vscode.Uri) => uri,
    } as unknown as vscode.Webview;
    const extensao = vscode.Uri.parse("file:///extensao");
    const creditos =
      '<p class="creditos">Desenvolvido por José Bruno, Kevyn Willian e Vitor Costa</p>';

    for (const html of [
      obterHtmlWebview(webview, extensao, "Aluno"),
      obterHtmlAutenticacao(webview, extensao),
    ]) {
      assert.ok(html.includes(creditos));
      // Depois de todo o conteúdo, logo antes do script.
      assert.ok(html.indexOf(creditos) > html.lastIndexOf("</section>"));
      assert.ok(html.indexOf(creditos) < html.indexOf("<script"));
    }
  });

  test("mostra o login pelo Google antes do GitHub e da Microsoft", () => {
    const webview = {
      cspSource: "vscode-webview://teste",
      asWebviewUri: (uri: vscode.Uri) => uri,
    } as unknown as vscode.Webview;
    const html = obterHtmlAutenticacao(
      webview,
      vscode.Uri.parse("file:///extensao"),
    );
    const posicoes = ["botaoGoogle", "botaoGitHub", "botaoMicrosoft"].map(
      (id) => html.indexOf(`id="${id}"`),
    );

    assert.ok(posicoes.every((posicao) => posicao >= 0));
    assert.deepStrictEqual([...posicoes].sort((a, b) => a - b), posicoes);
  });

  test("oferece abrir o gabarito em uma aba do editor", () => {
    const webview = {
      cspSource: "vscode-webview://teste",
      asWebviewUri: (uri: vscode.Uri) => uri,
    } as unknown as vscode.Webview;
    const html = obterHtmlWebview(
      webview,
      vscode.Uri.parse("file:///extensao"),
      "Aluno",
    );

    assert.ok(html.includes('id="botaoAbrirAba"'));
    assert.ok(html.includes("Abrir em uma aba"));
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

  test("carrega as fontes do projeto de dentro da extensão em todas as telas", () => {
    const webview = {
      cspSource: "vscode-webview://teste",
      asWebviewUri: (uri: vscode.Uri) => uri,
    } as unknown as vscode.Webview;
    const raiz = vscode.Uri.parse("file:///extensao");
    const telas = [
      obterHtmlWebview(webview, raiz, "Aluno"),
      obterHtmlAutenticacao(webview, raiz),
      obterHtmlPainelGabarito(webview, raiz),
    ];

    for (const html of telas) {
      assert.match(html, /font-src vscode-webview:\/\/teste[ ;]/);
      for (const arquivo of ["space-grotesk", "dm-mono-400", "dm-mono-500"]) {
        assert.ok(html.includes(`/extensao/media/fontes/${arquivo}.woff2`), arquivo);
      }
    }
  });

  test("mostra o gabarito e a sua página no mesmo quadro, alternando", () => {
    const webview = {
      cspSource: "vscode-webview://teste",
      asWebviewUri: (uri: vscode.Uri) => uri,
    } as unknown as vscode.Webview;
    const html = obterHtmlWebview(webview, vscode.Uri.parse("file:///extensao"), "Aluno");
    const quadro = html.indexOf('id="quadroDesafio"');
    const fimQuadro = html.indexOf("</div>", quadro);

    assert.ok(quadro >= 0);
    for (const id of ["canvasAlvo", "canvasPreviewAluno"]) {
      const posicao = html.indexOf(`id="${id}"`);
      assert.ok(posicao > quadro && posicao < fimQuadro, `${id} fora do quadro`);
    }
    assert.ok(html.includes('data-vista="gabarito" aria-pressed="true"'));
    assert.ok(html.includes('data-vista="pagina" aria-pressed="false"'));
  });

  test("os atalhos só valem quando fazem sentido", () => {
    const pacote = vscode.extensions.getExtension("josebruno10.flexbox-trainer")?.packageJSON;
    const atalhos = pacote?.contributes.keybindings as { command: string; key: string; when: string }[];

    assert.deepStrictEqual(
      atalhos.map(({ command, key, when }) => [command, key, when]),
      [
        ["flexbox-trainer.verificar", "ctrl+alt+v", "flexboxTrainer.temDesafio"],
        ["flexbox-trainer.novoDesafio", "ctrl+alt+d", "flexboxTrainer.autenticado"],
      ],
    );
  });
});
