import * as assert from "assert";
import * as vscode from "vscode";
import {
  lerMarcaDoDesafio,
  marcarDesafio,
} from "../../../provider/barraLateral/progresso";
import { criarDesafioPorCodigo } from "../../../services/desafio";
import { ResumoWorkspace } from "../../../types";
import {
  criarProvedorParaTeste,
  json,
  mockarConfiguracaoServidorValida,
  mockarServidor,
  ProvedorInterno,
  restaurarAoFim,
} from "./auxiliares";

const PASTA = "treino_2/46_74";
const CRIAR_PASTA = "POST /criar-pasta/treino/46/74";
const OBTER_CONTEUDO = `GET /obter-conteudo?code_pasta=${encodeURIComponent(PASTA)}&tipo=ambos`;

function arquivos(textoHtml: string, textoCss: string): ResumoWorkspace {
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

// Salvar e puxar o progresso pelas rotas criar-pasta, salvar-conteudo e
// obter-conteudo, como a extensão oficial.
suite("Barra lateral: progresso no servidor", () => {
  restaurarAoFim();
  const showErrorMessageOriginal = vscode.window.showErrorMessage;
  let informacoes: string[];
  let avisos: string[];
  let erros: string[];
  let respostaDoAviso: string | undefined;

  setup(() => {
    informacoes = [];
    avisos = [];
    erros = [];
    respostaDoAviso = undefined;
    vscode.window.showInformationMessage = (async (mensagem: string) => {
      informacoes.push(mensagem);
      return undefined;
    }) as typeof vscode.window.showInformationMessage;
    vscode.window.showWarningMessage = (async (mensagem: string) => {
      avisos.push(mensagem);
      return respostaDoAviso;
    }) as typeof vscode.window.showWarningMessage;
    vscode.window.showErrorMessage = (async (mensagem: string) => {
      erros.push(mensagem);
      return undefined;
    }) as typeof vscode.window.showErrorMessage;
  });

  teardown(() => {
    vscode.window.showErrorMessage = showErrorMessageOriginal;
  });

  function provedorComArquivos(
    resumo: ResumoWorkspace,
    opcoes: { teamId?: number } = {},
  ) {
    const provedor = criarProvedorParaTeste([], opcoes);
    const interno = provedor as unknown as ProvedorInterno;
    const gravados: { html: string; css: string }[] = [];
    interno.testarConexaoServidor = async () => undefined;
    interno.lerArquivosDoAluno = async () => resumo;
    interno.limparArquivosDoAluno = async () => {
      throw new Error("Puxar o progresso não deve limpar os arquivos.");
    };
    interno.escreverArquivosDoAluno = async (conteudo) => {
      gravados.push(conteudo);
    };
    return { provedor, interno, gravados };
  }

  test("o código do desafio vai na primeira linha do HTML e sai ao puxar", () => {
    const marcado = marcarDesafio("<main></main>", "MESA");
    assert.strictEqual(marcado, "<!-- FlexBox Trainer: desafio MESA -->\n<main></main>");
    assert.deepStrictEqual(lerMarcaDoDesafio(marcado), {
      codigo: "MESA",
      html: "<main></main>",
    });
    // Salvar de novo não acumula marcas.
    assert.strictEqual(marcarDesafio(marcado, "MESC"), marcarDesafio("<main></main>", "MESC"));
    assert.deepStrictEqual(lerMarcaDoDesafio("<main></main>"), { html: "<main></main>" });
    assert.deepStrictEqual(
      lerMarcaDoDesafio("<!-- FlexBox Trainer: desafio ??? -->\n<p></p>"),
      { codigo: undefined, html: "<p></p>" },
    );
  });

  test("salva o index.html e o style.css na pasta do aluno, com o código do desafio", async () => {
    mockarConfiguracaoServidorValida();
    let formulario: URLSearchParams | undefined;
    const requisicoes = mockarServidor({
      [CRIAR_PASTA]: () => json({ code_pasta: PASTA }),
      "POST /salvar-conteudo": (init) => {
        formulario = init?.body as URLSearchParams;
        return json({ mensagem: "Conteúdo salvo" });
      },
    });
    const { provedor, interno } = provedorComArquivos(
      arquivos("<main></main>", "main { display: flex; }"),
    );
    interno.desafioAtual = criarDesafioPorCodigo("MESA");

    assert.strictEqual(await provedor.salvarProgresso(), true);

    assert.deepStrictEqual(
      requisicoes.map(({ metodo, caminho }) => `${metodo} ${caminho}`),
      [CRIAR_PASTA, "POST /salvar-conteudo"],
    );
    assert.deepStrictEqual(Object.fromEntries(formulario!), {
      code_pasta: PASTA,
      tipo: "ambos",
      index_conteudo: "<!-- FlexBox Trainer: desafio MESA -->\n<main></main>",
      style_conteudo: "main { display: flex; }",
    });
    assert.match(informacoes[0], /desafio MESA salvo no servidor/);
    assert.deepStrictEqual(erros, []);
  });

  test("não salva sem desafio, fora do torneio ou sem dinâmica de treino", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes = mockarServidor({});

    const semDesafio = provedorComArquivos(arquivos("<main></main>", ""));
    assert.strictEqual(await semDesafio.provedor.salvarProgresso(), false);
    assert.match(informacoes.pop() ?? "", /Gere ou abra um desafio/);

    const foraDoTorneio = provedorComArquivos(arquivos("<main></main>", ""), { teamId: 0 });
    foraDoTorneio.interno.desafioAtual = criarDesafioPorCodigo("MESA");
    assert.strictEqual(await foraDoTorneio.provedor.salvarProgresso(), false);
    assert.match(avisos.pop() ?? "", /Só quem está no torneio/);

    mockarConfiguracaoServidorValida({ eventoTreino: "" });
    const semDinamica = provedorComArquivos(arquivos("<main></main>", ""));
    semDinamica.interno.desafioAtual = criarDesafioPorCodigo("MESA");
    assert.strictEqual(await semDinamica.provedor.salvarProgresso(), false);
    // Oferece criar a dinâmica ou usar a do outro computador.
    assert.match(informacoes.pop() ?? "", /use a sua dinâmica de treino/);

    assert.deepStrictEqual(requisicoes, []);
  });

  test("puxa o progresso: abre o mesmo desafio com os arquivos salvos", async () => {
    mockarConfiguracaoServidorValida();
    mockarServidor({
      [CRIAR_PASTA]: () => json({ code_pasta: PASTA }),
      [OBTER_CONTEUDO]: () =>
        json({
          "index.html": { conteudo: "<!-- FlexBox Trainer: desafio MESA -->\n<main></main>" },
          "style.css": { conteudo: "main { display: grid; }" },
        }),
    });
    respostaDoAviso = "Puxar";
    const { provedor, interno, gravados } = provedorComArquivos(
      arquivos("<p>outro trabalho</p>", ""),
    );

    await provedor.puxarProgresso();

    // O aluno tinha outro trabalho na pasta: confirmou antes da troca.
    assert.deepStrictEqual(avisos, ["Puxar o progresso salvo no servidor?"]);
    assert.strictEqual(interno.desafioAtual?.codigo, "MESA");
    assert.deepStrictEqual(
      interno.desafioAtual?.blocks,
      criarDesafioPorCodigo("MESA").blocks,
    );
    assert.deepStrictEqual(gravados, [
      { html: "<main></main>", css: "main { display: grid; }" },
    ]);
    assert.deepStrictEqual(erros, []);
  });

  test("sem confirmar, nada muda; sem nada salvo, só avisa", async () => {
    mockarConfiguracaoServidorValida();
    let salvo: unknown = {
      "index.html": { conteudo: "<!-- FlexBox Trainer: desafio MESA -->\n<main></main>" },
      "style.css": { conteudo: "" },
    };
    mockarServidor({
      [CRIAR_PASTA]: () => json({ code_pasta: PASTA }),
      [OBTER_CONTEUDO]: () => json(salvo),
    });
    const { provedor, interno, gravados } = provedorComArquivos(
      arquivos("<p>outro trabalho</p>", ""),
    );

    await provedor.puxarProgresso();
    assert.strictEqual(interno.desafioAtual, undefined);

    salvo = { "index.html": { conteudo: "" }, "style.css": { conteudo: "  " } };
    await provedor.puxarProgresso();
    assert.match(informacoes.pop() ?? "", /Ainda não há progresso salvo/);

    assert.strictEqual(interno.desafioAtual, undefined);
    assert.deepStrictEqual(gravados, []);
  });

  test("sem o código do desafio no arquivo, só grava os arquivos", async () => {
    mockarConfiguracaoServidorValida();
    mockarServidor({
      [CRIAR_PASTA]: () => json({ code_pasta: PASTA }),
      [OBTER_CONTEUDO]: () =>
        json({
          "index.html": { conteudo: "<main></main>" },
          "style.css": { conteudo: "main {}" },
        }),
    });
    // A pasta só tem a base: nada a perder, nada a confirmar.
    const { provedor, interno, gravados } = provedorComArquivos(arquivos("", ""));

    await provedor.puxarProgresso();

    assert.deepStrictEqual(avisos, []);
    assert.strictEqual(interno.desafioAtual, undefined);
    assert.deepStrictEqual(gravados, [{ html: "<main></main>", css: "main {}" }]);
    assert.match(informacoes.pop() ?? "", /Abra o desafio pelo código/);
  });

  test("uma falha do servidor aparece como erro e não troca os arquivos", async () => {
    mockarConfiguracaoServidorValida();
    mockarServidor({
      [CRIAR_PASTA]: () => json({ detail: "Permission denied" }, 500),
    });
    const { provedor, gravados } = provedorComArquivos(arquivos("", ""));

    await provedor.puxarProgresso();

    assert.strictEqual(erros.length, 1);
    assert.match(erros[0], /^Não foi possível puxar o progresso: .*Permission denied/);
    assert.deepStrictEqual(gravados, []);
  });
});
