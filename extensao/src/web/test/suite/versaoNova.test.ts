import * as assert from "assert";
import * as vscode from "vscode";
import {
  ArquivosLocais,
  avisarAtualizacao,
  avisarVersaoNova,
  buscarUltimaVersao,
  ehMaisNova,
  pastaDeDownload,
} from "../../services/versaoNova";

const DOWNLOADS = "https://github.com/josebruno10/flexbox-trainer/releases/download";
const PASTA = vscode.Uri.parse("file:///tmp/flexbox-trainer-teste");

function armazenamentoFalso(inicial: Record<string, unknown> = {}): vscode.Memento {
  const valores = new Map(Object.entries(inicial));
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

// O GitHub com uma versão publicada e o .vsix dela.
function github(
  etiqueta: string,
  vsix: { endereco?: string; status?: number; conteudo?: number[] } = {},
) {
  const endereco =
    vsix.endereco ??
    `${DOWNLOADS}/${etiqueta}/flexbox-trainer-${etiqueta.replace(/^v/, "")}.vsix`;
  const pedidos: string[] = [];
  const buscar = (async (url: string) => {
    pedidos.push(url);
    if (url.startsWith("https://api.github.com/")) {
      return respostaJson({
        tag_name: etiqueta,
        assets: [{ name: "flexbox-trainer.vsix", browser_download_url: endereco }],
      });
    }
    // Um .vsix de verdade começa com "PK", como todo zip.
    return new Response(new Uint8Array(vsix.conteudo ?? [0x50, 0x4b, 3, 4]).buffer, {
      status: vsix.status ?? 200,
    });
  }) as typeof fetch;
  return { buscar, pedidos };
}

function arquivosFalsos() {
  const gravados: string[] = [];
  const apagados: string[] = [];
  const arquivos: ArquivosLocais = {
    createDirectory: async () => undefined,
    writeFile: async (uri) => {
      gravados.push(uri.toString());
    },
    delete: async (uri) => {
      apagados.push(uri.toString());
    },
  };
  return { arquivos, gravados, apagados };
}

suite("Aviso de versão nova", () => {
  const showInformationMessageOriginal = vscode.window.showInformationMessage;
  const showWarningMessageOriginal = vscode.window.showWarningMessage;
  const openExternalOriginal = vscode.env.openExternal;
  const executeCommandOriginal = vscode.commands.executeCommand;
  const dateNowOriginal = Date.now;
  let avisos: { mensagem: string; botoes: string[] }[];
  let alertas: string[];
  let abertos: string[];
  let comandos: unknown[][];
  // Com true, o aluno clica no botão de cada aviso.
  let aceitar: boolean;

  setup(() => {
    avisos = [];
    alertas = [];
    abertos = [];
    comandos = [];
    aceitar = false;
    vscode.window.showInformationMessage = (async (
      mensagem: string,
      ...botoes: string[]
    ) => {
      avisos.push({ mensagem, botoes });
      return aceitar ? botoes[0] : undefined;
    }) as unknown as typeof vscode.window.showInformationMessage;
    vscode.window.showWarningMessage = (async (
      mensagem: string,
      ...botoes: string[]
    ) => {
      alertas.push(mensagem);
      return aceitar ? botoes[0] : undefined;
    }) as unknown as typeof vscode.window.showWarningMessage;
    vscode.env.openExternal = async (uri) => {
      abertos.push(uri.toString());
      return true;
    };
    vscode.commands.executeCommand = (async (...argumentos: unknown[]) => {
      comandos.push(argumentos);
      return undefined;
    }) as typeof vscode.commands.executeCommand;
  });

  teardown(() => {
    vscode.window.showInformationMessage = showInformationMessageOriginal;
    vscode.window.showWarningMessage = showWarningMessageOriginal;
    vscode.env.openExternal = openExternalOriginal;
    vscode.commands.executeCommand = executeCommandOriginal;
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

  test("só o desktop baixa o .vsix, e como arquivo do disco", () => {
    // É assim que o VS Code desktop entrega a pasta da extensão.
    const pasta = vscode.Uri.parse(
      "vscode-userdata:/home/ana/.config/Code/User/globalStorage/josebruno10.flexbox-trainer",
    );
    assert.strictEqual(
      pastaDeDownload(pasta, vscode.UIKind.Desktop)?.toString(),
      "file:///home/ana/.config/Code/User/globalStorage/josebruno10.flexbox-trainer",
    );
    const arquivo = vscode.Uri.file("/home/ana/pasta");
    assert.strictEqual(pastaDeDownload(arquivo, vscode.UIKind.Desktop), arquivo);
    assert.strictEqual(pastaDeDownload(pasta, vscode.UIKind.Web), undefined);
    assert.strictEqual(
      pastaDeDownload(
        vscode.Uri.parse("vscode-remote://ssh-remote+lab/home/ana"),
        vscode.UIKind.Desktop,
      ),
      undefined,
    );
  });

  test("lê a versão e o .vsix da última versão no GitHub", async () => {
    const { buscar, pedidos } = github("v0.4.1");

    assert.deepStrictEqual(await buscarUltimaVersao(buscar), {
      versao: "0.4.1",
      vsix: `${DOWNLOADS}/v0.4.1/flexbox-trainer-0.4.1.vsix`,
    });
    assert.deepStrictEqual(pedidos, [
      "https://api.github.com/repos/josebruno10/flexbox-trainer/releases/latest",
    ]);
    // Um .vsix de outro lugar não serve para instalar.
    assert.deepStrictEqual(
      await buscarUltimaVersao(
        github("v0.4.1", { endereco: "https://exemplo.com/flexbox-trainer.vsix" })
          .buscar,
      ),
      { versao: "0.4.1", vsix: undefined },
    );
    // Sem versão publicada, ou com uma etiqueta que não é versão, não há o que
    // comparar.
    assert.strictEqual(
      await buscarUltimaVersao(
        (async () => respostaJson({ message: "Not Found" }, 404)) as typeof fetch,
      ),
      undefined,
    );
    assert.strictEqual(await buscarUltimaVersao(github("teste").buscar), undefined);
  });

  test("no navegador, o aviso abre a página da versão", async () => {
    aceitar = true;

    await avisarVersaoNova({
      armazenamento: armazenamentoFalso(),
      versaoAtual: "0.4.0",
      buscar: github("v0.4.1").buscar,
    });

    assert.deepStrictEqual(avisos, [
      {
        mensagem: "Versão nova do FlexBox Trainer: 0.4.1. Você está na 0.4.0.",
        botoes: ["Baixar"],
      },
    ]);
    assert.deepStrictEqual(abertos, [
      "https://github.com/josebruno10/flexbox-trainer/releases/latest",
    ]);
  });

  test("no desktop, Atualizar baixa o .vsix, instala e oferece recarregar", async () => {
    aceitar = true;
    const { buscar, pedidos } = github("v0.4.1");
    const { arquivos, gravados, apagados } = arquivosFalsos();

    await avisarVersaoNova({
      armazenamento: armazenamentoFalso(),
      versaoAtual: "0.4.0",
      pastaDownload: PASTA,
      buscar,
      arquivos,
    });

    const arquivo = `${PASTA.toString()}/flexbox-trainer-0.4.1.vsix`;
    assert.strictEqual(pedidos[1], `${DOWNLOADS}/v0.4.1/flexbox-trainer-0.4.1.vsix`);
    assert.deepStrictEqual(gravados, [arquivo]);
    assert.deepStrictEqual(
      comandos.map(([comando, uri]) => [comando, String(uri ?? "")]),
      [
        ["workbench.extensions.installExtension", arquivo],
        ["workbench.action.reloadWindow", ""],
      ],
    );
    // Instalado, o .vsix baixado é apagado.
    assert.deepStrictEqual(apagados, [arquivo]);
    assert.deepStrictEqual(
      avisos.map(({ botoes }) => botoes),
      [["Atualizar"], ["Recarregar"]],
    );
    assert.strictEqual(
      avisos[1].mensagem,
      "FlexBox Trainer 0.4.1 instalado. Recarregue a janela para usar a versão nova.",
    );
  });

  test("se o download falha, não instala e oferece a página da versão", async () => {
    aceitar = true;

    for (const vsix of [{ status: 404 }, { conteudo: [1, 2, 3] }]) {
      const { arquivos, gravados } = arquivosFalsos();
      await avisarVersaoNova({
        armazenamento: armazenamentoFalso(),
        versaoAtual: "0.4.0",
        pastaDownload: PASTA,
        buscar: github("v0.4.1", vsix).buscar,
        arquivos,
      });
      assert.deepStrictEqual(gravados, []);
    }

    assert.deepStrictEqual(comandos, []);
    assert.deepStrictEqual(alertas, [
      "Não deu para atualizar sozinho. Baixe a versão nova pela página dela.",
      "Não deu para atualizar sozinho. Baixe a versão nova pela página dela.",
    ]);
    assert.strictEqual(abertos.length, 2);
  });

  test("não avisa quando a versão instalada é a mais nova", async () => {
    await avisarVersaoNova({
      armazenamento: armazenamentoFalso(),
      versaoAtual: "0.4.0",
      buscar: github("v0.4.0").buscar,
    });
    await avisarVersaoNova({
      armazenamento: armazenamentoFalso(),
      versaoAtual: "0.5.0",
      buscar: github("v0.4.0").buscar,
    });

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
    const consultar = (buscar: typeof fetch) =>
      avisarVersaoNova({ armazenamento, versaoAtual: "0.4.0", buscar });
    const inicio = new Date(2026, 9, 14, 8, 0).getTime();

    Date.now = () => inicio;
    await consultar(semConexao);
    await consultar(comVersao);
    assert.strictEqual(consultas, 2);

    Date.now = () => inicio + 23 * 60 * 60 * 1000;
    await consultar(comVersao);
    assert.strictEqual(consultas, 2);

    Date.now = () => inicio + 24 * 60 * 60 * 1000;
    await consultar(comVersao);
    assert.strictEqual(consultas, 3);
  });

  test("depois de atualizar, avisa uma vez com o link do que mudou", async () => {
    aceitar = true;
    const armazenamento = armazenamentoFalso({
      "flexboxTrainer.versaoAberta": "0.4.0",
    });

    await avisarAtualizacao(armazenamento, "0.5.0", true);
    await avisarAtualizacao(armazenamento, "0.5.0", true);

    assert.deepStrictEqual(avisos, [
      {
        mensagem: "O FlexBox Trainer foi atualizado para a versão 0.5.0.",
        botoes: ["O que mudou"],
      },
    ]);
    assert.deepStrictEqual(abertos, [
      "https://github.com/josebruno10/flexbox-trainer/releases/tag/v0.5.0",
    ]);
  });

  test("numa instalação nova não avisa; vindo da 0.4.0, avisa", async () => {
    // A primeira vez da extensão: o guia de primeiros passos se apresenta.
    const nova = armazenamentoFalso();
    await avisarAtualizacao(nova, "0.5.0", false);
    assert.deepStrictEqual(avisos, []);
    assert.strictEqual(nova.get("flexboxTrainer.versaoAberta"), "0.5.0");

    // Uma versão mais velha, instalada por cima, também não.
    await avisarAtualizacao(nova, "0.4.0", true);
    assert.deepStrictEqual(avisos, []);

    // A 0.4.0 não guardava a versão, mas já tinha aberto o guia.
    await avisarAtualizacao(armazenamentoFalso(), "0.5.0", true);
    assert.strictEqual(avisos.length, 1);
  });
});
