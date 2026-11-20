import * as assert from "assert";
import * as vscode from "vscode";
import {
  CopiaDeSeguranca,
  CopiasDeSeguranca,
  MAXIMO_DE_COPIAS,
} from "../../../services/copiasDeSeguranca";
import { criarDesafioPorCodigo } from "../../../services/desafio";
import { modeloCss, modeloHtml } from "../../../services/workspace";
import { descreverQuando } from "../../../provider/barraLateral/copias";
import { ResumoWorkspace } from "../../../types";
import {
  criarProvedorParaTeste,
  criarRegistroFalso,
  ProvedorInterno,
  restaurarAoFim,
} from "./auxiliares";

function copia(html: string, quando = 1, codigo?: string): CopiaDeSeguranca {
  return { codigo, html, css: "main {}", quando };
}

function arquivosCom(textoHtml: string, textoCss: string): ResumoWorkspace {
  return {
    caminhoHtml: "/projeto/index.html",
    caminhoCss: "/projeto/style.css",
    textoHtml,
    textoCss,
    htmlPreview: "",
    temArquivoHtml: true,
    temArquivoCss: true,
  };
}

suite("Cópias de segurança", () => {
  restaurarAoFim();

  test("guardam a mais recente no topo, sem repetir a igual e até o máximo", async () => {
    const copias = new CopiasDeSeguranca(criarRegistroFalso());

    for (let i = 1; i <= MAXIMO_DE_COPIAS + 2; i++) {
      await copias.guardar("aluno@teste.com", copia(`<p>${i}</p>`, i));
    }
    await copias.guardar("aluno@teste.com", copia(`<p>${MAXIMO_DE_COPIAS + 2}</p>`, 99));

    const lista = copias.listar("aluno@teste.com");
    assert.strictEqual(lista.length, MAXIMO_DE_COPIAS);
    assert.strictEqual(lista[0].html, `<p>${MAXIMO_DE_COPIAS + 2}</p>`);
    assert.strictEqual(lista[0].quando, MAXIMO_DE_COPIAS + 2);
  });

  test("cada aluno vê as próprias cópias, e sem sessão não há cópias", async () => {
    const copias = new CopiasDeSeguranca(criarRegistroFalso());

    await copias.guardar("Aluno@Teste.com", copia("<p>meu</p>"));
    await copias.guardar(undefined, copia("<p>sem dono</p>"));

    assert.strictEqual(copias.listar("aluno@teste.com").length, 1);
    assert.deepStrictEqual(copias.listar("outra@teste.com"), []);
    assert.deepStrictEqual(copias.listar(undefined), []);
  });

  test("o desafio novo guarda o que vai apagar, com o código do desafio anterior", async () => {
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste([], { registro });
    const interno = provedor as unknown as ProvedorInterno;
    interno.tentativa.desafio = criarDesafioPorCodigo("MESA");
    const html = modeloHtml().replace("<body>", "<body><main></main>");
    const css = `${modeloCss()}\nmain { display: flex; }`;
    interno.lerArquivosDoAluno = async () => arquivosCom(html, css);
    interno.limparArquivosDoAluno = async () => undefined;
    interno.testarConexaoServidor = async () => undefined;
    vscode.window.showWarningMessage = (async () =>
      "Limpar e gerar") as unknown as typeof vscode.window.showWarningMessage;

    await provedor.iniciarNovoDesafio("BOLA");

    const lista = new CopiasDeSeguranca(registro).listar("aluno@teste.com");
    assert.strictEqual(lista.length, 1);
    assert.deepStrictEqual(
      { codigo: lista[0].codigo, html: lista[0].html, css: lista[0].css },
      { codigo: "MESA", html, css },
    );
  });

  test("restaurar abre o desafio da cópia com os arquivos dela e guarda os de agora", async () => {
    const registro = criarRegistroFalso();
    await new CopiasDeSeguranca(registro).guardar(
      "aluno@teste.com",
      { codigo: "MESA", html: "<p>antes</p>", css: "p {}", quando: 1 },
    );
    const provedor = criarProvedorParaTeste([], { registro });
    const interno = provedor as unknown as ProvedorInterno;
    interno.tentativa.desafio = criarDesafioPorCodigo("BOLA");
    interno.lerArquivosDoAluno = async () =>
      arquivosCom(modeloHtml().replace("<body>", "<body><b>agora</b>"), modeloCss());
    const escritos: { html: string; css: string }[] = [];
    interno.escreverArquivosDoAluno = async (conteudo) => {
      escritos.push(conteudo);
    };
    interno.testarConexaoServidor = async () => undefined;
    vscode.window.showQuickPick = (async (itens: readonly vscode.QuickPickItem[]) =>
      itens[0]) as unknown as typeof vscode.window.showQuickPick;

    await provedor.restaurarCopiaDeSeguranca();

    assert.deepStrictEqual(escritos, [{ html: "<p>antes</p>", css: "p {}" }]);
    assert.strictEqual(interno.tentativa.desafio?.codigo, "MESA");
    const lista = new CopiasDeSeguranca(registro).listar("aluno@teste.com");
    assert.strictEqual(lista.length, 2);
    assert.strictEqual(lista[0].codigo, "BOLA");
    assert.match(lista[0].html, /<b>agora<\/b>/);
  });

  test("a lista diz quando cada cópia foi feita", () => {
    const agora = new Date(2026, 10, 20, 16, 0);

    assert.strictEqual(descreverQuando(new Date(2026, 10, 20, 14, 32).getTime(), agora), "hoje às 14:32");
    assert.strictEqual(descreverQuando(new Date(2026, 10, 19, 9, 5).getTime(), agora), "ontem às 09:05");
    assert.strictEqual(descreverQuando(new Date(2026, 10, 18, 16, 40).getTime(), agora), "18/11 às 16:40");
  });
});
