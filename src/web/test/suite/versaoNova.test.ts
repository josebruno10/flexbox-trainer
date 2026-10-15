import * as assert from "assert";
import * as vscode from "vscode";
import {
  avisarVersaoNova,
  buscarUltimaVersao,
  ehMaisNova,
} from "../../services/versaoNova";

function armazenamentoFalso(): vscode.Memento {
  const valores = new Map<string, unknown>();
  return {
    keys: () => [...valores.keys()],
    get: <T>(chave: string, padrao?: T) =>
      (valores.has(chave) ? valores.get(chave) : padrao) as T,
    update: async (chave: string, valor: unknown) => {
      valores.set(chave, valor);
    },
  } as vscode.Memento;
}

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function githubCom(etiqueta: string): typeof fetch {
  return (async () => respostaJson({ tag_name: etiqueta })) as typeof fetch;
}

suite("Aviso de versão nova", () => {
  const showInformationMessageOriginal = vscode.window.showInformationMessage;
  const openExternalOriginal = vscode.env.openExternal;
  const dateNowOriginal = Date.now;
  let avisos: string[];
  let abertos: string[];
  let escolha: string | undefined;

  setup(() => {
    avisos = [];
    abertos = [];
    escolha = undefined;
    vscode.window.showInformationMessage = (async (mensagem: string) => {
      avisos.push(mensagem);
      return escolha;
    }) as typeof vscode.window.showInformationMessage;
    vscode.env.openExternal = async (uri) => {
      abertos.push(uri.toString());
      return true;
    };
  });

  teardown(() => {
    vscode.window.showInformationMessage = showInformationMessageOriginal;
    vscode.env.openExternal = openExternalOriginal;
    Date.now = dateNowOriginal;
  });

  test("compara as partes da versão como números", () => {
    assert.ok(ehMaisNova("0.4.1", "0.4.0"));
    assert.ok(ehMaisNova("0.10.0", "0.9.2"));
    assert.ok(ehMaisNova("1.0", "0.9.9"));
    assert.ok(!ehMaisNova("0.4.0", "0.4.0"));
    assert.ok(!ehMaisNova("0.4", "0.4.0"));
    assert.ok(!ehMaisNova("0.3.9", "0.4.0"));
  });

  test("lê a versão da etiqueta da última versão no GitHub", async () => {
    let pedido = "";
    const buscar = (async (url: string) => {
      pedido = url;
      return respostaJson({ tag_name: "v0.4.1" });
    }) as typeof fetch;

    assert.strictEqual(await buscarUltimaVersao(buscar), "0.4.1");
    assert.strictEqual(
      pedido,
      "https://api.github.com/repos/josebruno10/flexbox-trainer/releases/latest",
    );
    // Sem versão publicada, ou com uma etiqueta que não é versão, não há o que comparar.
    assert.strictEqual(
      await buscarUltimaVersao(
        (async () => respostaJson({ message: "Not Found" }, 404)) as typeof fetch,
      ),
      undefined,
    );
    assert.strictEqual(await buscarUltimaVersao(githubCom("teste")), undefined);
  });

  test("avisa da versão nova e abre a página dela", async () => {
    escolha = "Baixar";

    await avisarVersaoNova(armazenamentoFalso(), "0.4.0", githubCom("v0.4.1"));

    assert.deepStrictEqual(avisos, [
      "Versão nova do FlexBox Trainer: 0.4.1. Você está na 0.4.0.",
    ]);
    assert.deepStrictEqual(abertos, [
      "https://github.com/josebruno10/flexbox-trainer/releases/latest",
    ]);
  });

  test("não avisa quando a versão instalada é a mais nova", async () => {
    await avisarVersaoNova(armazenamentoFalso(), "0.4.0", githubCom("v0.4.0"));
    await avisarVersaoNova(armazenamentoFalso(), "0.5.0", githubCom("v0.4.0"));

    assert.deepStrictEqual(avisos, []);
  });

  test("consulta uma vez por dia, e de novo depois de uma falha de conexão", async () => {
    const armazenamento = armazenamentoFalso();
    let consultas = 0;
    const semConexao = (async () => {
      consultas++;
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    const comVersao = (async () => {
      consultas++;
      return respostaJson({ tag_name: "v0.4.0" });
    }) as typeof fetch;
    const inicio = new Date(2026, 9, 14, 8, 0).getTime();

    Date.now = () => inicio;
    await avisarVersaoNova(armazenamento, "0.4.0", semConexao);
    await avisarVersaoNova(armazenamento, "0.4.0", comVersao);
    assert.strictEqual(consultas, 2);

    Date.now = () => inicio + 23 * 60 * 60 * 1000;
    await avisarVersaoNova(armazenamento, "0.4.0", comVersao);
    assert.strictEqual(consultas, 2);

    Date.now = () => inicio + 24 * 60 * 60 * 1000;
    await avisarVersaoNova(armazenamento, "0.4.0", comVersao);
    assert.strictEqual(consultas, 3);
  });
});
