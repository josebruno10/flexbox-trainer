import * as assert from "assert";
import * as vscode from "vscode";
import {
  enderecoDaOpiniao,
  enderecoDoProblema,
  nomeDoSistema,
  sistemaOperacional,
  textoDoAmbiente,
} from "../../services/suporte";

const AMBIENTE = {
  versao: "0.5.0",
  vscode: "1.142.0",
  sistema: "Linux",
  desafio: { codigo: "482917", nivel: "medio" as const },
};

suite("Relatos de problema e opiniões", () => {
  test("o formulário de problema chega preenchido", () => {
    const endereco = new URL(enderecoDoProblema(AMBIENTE));

    assert.strictEqual(
      `${endereco.origin}${endereco.pathname}`,
      "https://github.com/josebruno10/flexbox-trainer/issues/new",
    );
    // Cada parâmetro é o id de um campo de .github/ISSUE_TEMPLATE/problema.yml.
    assert.deepStrictEqual(Object.fromEntries(endereco.searchParams), {
      template: "problema.yml",
      versao: "0.5.0",
      vscode: "1.142.0",
      sistema: "Linux",
      codigo: "482 917 (médio)",
    });
    assert.ok(enderecoDoProblema(AMBIENTE).includes("codigo=482%20917%20(m%C3%A9dio)"));
  });

  test("vindo de um erro, a mensagem dele vai junto, sem passar de 1000 caracteres", () => {
    const comErro = new URL(
      enderecoDoProblema({ ...AMBIENTE, mensagem: "Erro: o servidor respondeu 500." }),
    );
    assert.strictEqual(
      comErro.searchParams.get("mensagem"),
      "Erro: o servidor respondeu 500.",
    );

    const longo = new URL(enderecoDoProblema({ ...AMBIENTE, mensagem: "x".repeat(5000) }));
    assert.strictEqual(longo.searchParams.get("mensagem")?.length, 1000);

    assert.strictEqual(
      textoDoAmbiente({ ...AMBIENTE, mensagem: "Erro: o servidor respondeu 500." }),
      "FlexBox Trainer 0.5.0 · VS Code 1.142.0 · Linux · desafio 482 917 (médio)\n" +
        "Erro: o servidor respondeu 500.",
    );
    // Sem "Erro:" no começo, o texto ganha um.
    assert.ok(
      textoDoAmbiente({ ...AMBIENTE, mensagem: "O servidor não devolveu a nota." }).endsWith(
        "\nErro: O servidor não devolveu a nota.",
      ),
    );
  });

  test("sem desafio, o código fica em branco", () => {
    const endereco = new URL(enderecoDoProblema({ ...AMBIENTE, desafio: undefined }));

    assert.strictEqual(endereco.searchParams.has("codigo"), false);
  });

  test("o questionário de opinião leva a versão", () => {
    const endereco = new URL(enderecoDaOpiniao("0.5.0"));

    assert.deepStrictEqual(Object.fromEntries(endereco.searchParams), {
      template: "opiniao.yml",
      versao: "0.5.0",
    });
  });

  test("para quem não tem GitHub, as mesmas informações num texto", () => {
    assert.strictEqual(
      textoDoAmbiente(AMBIENTE),
      "FlexBox Trainer 0.5.0 · VS Code 1.142.0 · Linux · desafio 482 917 (médio)",
    );
    assert.strictEqual(
      textoDoAmbiente({ ...AMBIENTE, desafio: undefined }),
      "FlexBox Trainer 0.5.0 · VS Code 1.142.0 · Linux",
    );
  });

  test("o sistema aparece pelo nome", () => {
    assert.strictEqual(nomeDoSistema("linux"), "Linux");
    assert.strictEqual(nomeDoSistema("win32"), "Windows");
    assert.strictEqual(nomeDoSistema("darwin"), "macOS");
    assert.strictEqual(nomeDoSistema("freebsd"), "freebsd");
    assert.strictEqual(nomeDoSistema(undefined), "navegador");
    // No desktop, o sistema de verdade; no navegador, "navegador".
    assert.ok(["Linux", "Windows", "macOS", "navegador"].includes(sistemaOperacional()));
  });

  test("os dois comandos ficam no menu da barra lateral", () => {
    const pacote = vscode.extensions.getExtension("josebruno10.flexbox-trainer")
      ?.packageJSON as {
      contributes: { menus: { "view/title": { command: string; group: string }[] } };
    };
    const ajuda = pacote.contributes.menus["view/title"]
      .filter((item) => item.group.startsWith("2_ajuda"))
      .map((item) => item.command);

    assert.ok(ajuda.includes("flexbox-trainer.darOpiniao"));
    assert.ok(ajuda.includes("flexbox-trainer.relatarProblema"));
  });
});
