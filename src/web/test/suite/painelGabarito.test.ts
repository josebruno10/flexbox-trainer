import * as assert from "assert";
import * as vscode from "vscode";
import { PainelGabarito } from "../../provider/painel-gabarito";
import { criarDesafioGerado } from "../../services/desafio";
import { obterHtmlPainelGabarito } from "../../webview/html";

type PainelFalso = {
  html: string;
  mensagens: unknown[];
  revelacoes: number;
  receber(mensagem: unknown): void;
  fechar(): void;
};

suite("Aba do gabarito", () => {
  const createWebviewPanelOriginal = vscode.window.createWebviewPanel;
  const setStatusBarMessageOriginal = vscode.window.setStatusBarMessage;
  let paineis: PainelFalso[];
  let copiados: string[];

  setup(() => {
    paineis = [];
    copiados = [];
    vscode.window.createWebviewPanel = ((
      _tipo: string,
      _titulo: string,
      coluna: vscode.ViewColumn,
    ) => {
      assert.strictEqual(coluna, vscode.ViewColumn.Beside);
      let aoReceber: (mensagem: unknown) => void = () => undefined;
      let aoFechar: () => void = () => undefined;
      const falso: PainelFalso = {
        html: "",
        mensagens: [],
        revelacoes: 0,
        receber: (mensagem) => aoReceber(mensagem),
        fechar: () => aoFechar(),
      };
      paineis.push(falso);
      return {
        viewColumn: vscode.ViewColumn.Two,
        webview: {
          cspSource: "vscode-webview://teste",
          asWebviewUri: (uri: vscode.Uri) => uri,
          set html(valor: string) {
            falso.html = valor;
          },
          onDidReceiveMessage: (ouvinte: (mensagem: unknown) => void) => {
            aoReceber = ouvinte;
            return { dispose: () => undefined };
          },
          postMessage: async (mensagem: unknown) => {
            falso.mensagens.push(mensagem);
            return true;
          },
        },
        reveal: () => {
          falso.revelacoes++;
        },
        onDidDispose: (ouvinte: () => void) => {
          aoFechar = ouvinte;
          return { dispose: () => undefined };
        },
        dispose: () => aoFechar(),
      } as unknown as vscode.WebviewPanel;
    }) as typeof vscode.window.createWebviewPanel;
    vscode.window.setStatusBarMessage = (() => ({
      dispose: () => undefined,
    })) as unknown as typeof vscode.window.setStatusBarMessage;
  });

  teardown(() => {
    vscode.window.createWebviewPanel = createWebviewPanelOriginal;
    vscode.window.setStatusBarMessage = setStatusBarMessageOriginal;
  });

  test("mostra o desafio quando a aba fica pronta e acompanha os seguintes", () => {
    const painel = new PainelGabarito(vscode.Uri.parse("file:///extensao"));
    const primeiro = criarDesafioGerado();

    painel.mostrar(primeiro);
    paineis[0].receber({ type: "pronto" });

    assert.ok(paineis[0].html.includes("painelGabarito.js"));
    const enviado = ultimaMensagem(paineis[0], "desafio");
    assert.strictEqual(enviado.payload?.challengeId, primeiro.challengeId);
    assert.strictEqual(enviado.payload?.blocks.length, primeiro.blocks.length);

    const segundo = criarDesafioGerado();
    painel.atualizar(segundo);
    assert.strictEqual(
      ultimaMensagem(paineis[0], "desafio").payload?.challengeId,
      segundo.challengeId,
    );

    painel.atualizar(undefined);
    assert.strictEqual(ultimaMensagem(paineis[0], "desafio").payload, null);
  });

  test("envia a página do aluno para comparar e só reenvia quando ela muda", () => {
    const painel = new PainelGabarito(vscode.Uri.parse("file:///extensao"));

    painel.mostrar(criarDesafioGerado(), "<main>primeira</main>");
    paineis[0].receber({ type: "pronto" });
    assert.strictEqual(
      ultimaMensagem(paineis[0], "paginaAluno").payload,
      "<main>primeira</main>",
    );

    const enviadas = () =>
      paineis[0].mensagens.filter(
        (mensagem) => (mensagem as { type: string }).type === "paginaAluno",
      ).length;
    const antes = enviadas();
    painel.atualizarPagina("<main>primeira</main>");
    assert.strictEqual(enviadas(), antes);

    painel.atualizarPagina("<main>segunda</main>");
    assert.strictEqual(
      ultimaMensagem(paineis[0], "paginaAluno").payload,
      "<main>segunda</main>",
    );

    painel.atualizarPagina(undefined);
    assert.strictEqual(ultimaMensagem(paineis[0], "paginaAluno").payload, null);
  });

  test("reabrir traz a mesma aba para a frente, sem criar outra", () => {
    const painel = new PainelGabarito(vscode.Uri.parse("file:///extensao"));

    painel.mostrar(criarDesafioGerado());
    painel.mostrar(criarDesafioGerado());

    assert.strictEqual(paineis.length, 1);
    assert.strictEqual(paineis[0].revelacoes, 1);
  });

  test("depois de fechada, atualizar não reabre e mostrar cria outra aba", () => {
    const painel = new PainelGabarito(vscode.Uri.parse("file:///extensao"));

    painel.mostrar(criarDesafioGerado());
    paineis[0].fechar();
    painel.atualizar(criarDesafioGerado());
    assert.strictEqual(paineis.length, 1);

    painel.mostrar(criarDesafioGerado());
    assert.strictEqual(paineis.length, 2);
  });

  test("copia só valores curtos enviados pela aba", () => {
    const painel = new PainelGabarito(
      vscode.Uri.parse("file:///extensao"),
      async (texto) => {
        copiados.push(texto);
      },
    );
    painel.mostrar(criarDesafioGerado());

    paineis[0].receber({ type: "copiar", texto: "#17DAB2" });
    paineis[0].receber({ type: "copiar", texto: 120 });
    paineis[0].receber({ type: "copiar", texto: "x".repeat(200) });

    assert.deepStrictEqual(copiados, ["#17DAB2"]);
  });

  test("a aba só carrega o próprio script, sem script embutido", () => {
    const html = obterHtmlPainelGabarito(
      {
        cspSource: "vscode-webview://teste",
        asWebviewUri: (uri: vscode.Uri) => uri,
      } as unknown as vscode.Webview,
      vscode.Uri.parse("file:///extensao"),
    );

    assert.match(html, /script-src vscode-webview:\/\/teste;/);
    assert.strictEqual(html.match(/<script/g)?.length, 1);
    assert.match(html, /<script src="[^"]*painelGabarito\.js"><\/script>/);
  });
});

function ultimaMensagem(
  painel: PainelFalso,
  tipo: string,
): { type: string; payload: any } {
  const mensagens = painel.mensagens as { type: string; payload: unknown }[];
  const encontrada = [...mensagens]
    .reverse()
    .find((mensagem) => mensagem.type === tipo);
  assert.ok(encontrada, `Nenhuma mensagem "${tipo}" foi enviada à aba.`);
  return encontrada as { type: string; payload: never };
}
