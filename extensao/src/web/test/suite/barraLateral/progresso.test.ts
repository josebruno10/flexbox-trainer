import * as assert from "assert";
import * as vscode from "vscode";
import {
  lerMarcaDoDesafio,
  marcarDesafio,
} from "../../../provider/barraLateral/progresso";
import { criarDesafioPorCodigo } from "../../../services/desafio";
import {
  chaveDosProgressos,
  ProgressosSalvos,
} from "../../../services/progressosSalvos";
import { ResumoWorkspace } from "../../../types";
import {
  criarProvedorParaTeste,
  criarRegistroFalso,
  json,
  mockarConfiguracaoServidorValida,
  mockarServidor,
  ProvedorInterno,
  restaurarAoFim,
} from "./auxiliares";

const ALUNO = "aluno@teste.com";
const PASTA = "mesa_2/46_74";
const BUSCAR = "GET /tipoDinamica/mesa";
const CRIAR_PASTA = "POST /criar-pasta/mesa/46/74";
const GABARITOS = "GET /tipo-dinamica/mesa/gabaritos";
const CADASTRAR_GABARITO = "POST /tipo-dinamica/mesa/gabarito";
const SEM_GABARITO = () => json({ detail: "Nenhum gabarito encontrado" }, 404);
const COM_GABARITO = () => json([[310, "/gabaritos/gab_mesa_tam_800x800.png"]]);
const OBTER_CONTEUDO = `GET /obter-conteudo?code_pasta=${encodeURIComponent(PASTA)}&tipo=ambos`;
const NAO_EXISTE = () =>
  json({ detail: "Erro ao obter tipo de dinâmica: 404: Evento não encontrado." }, 500);
const EXISTE = () => json({ evento: "mesa", tipo: 2 });
const SALVO_PELA_EXTENSAO = {
  "index.html": { conteudo: "<!-- FlexBox Trainer: desafio MESA -->\n<main></main>" },
  "style.css": { conteudo: "main { display: grid; }" },
};

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

// O desafio aberto, com a imagem que a barra lateral gerou para ele.
function abrirDesafio(interno: ProvedorInterno, codigo: string): void {
  const desafio = criarDesafioPorCodigo(codigo);
  interno.tentativa.desafio = desafio;
  interno.tentativa.gabarito = {
    challengeId: desafio.challengeId,
    imagemDataUrl: "data:image/png;base64,iVBORw0KGgo=",
    width: desafio.width,
    height: desafio.height,
  };
}

function rotas(requisicoes: { metodo: string; caminho: string }[]): string[] {
  return requisicoes.map(({ metodo, caminho }) => `${metodo} ${caminho}`);
}

// Salvar e puxar o progresso pelo código do desafio: cada desafio tem a
// própria dinâmica no servidor, com o mesmo código.
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
    mockarConfiguracaoServidorValida();
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
    opcoes: { teamId?: number; salvos?: string[] } = {},
  ) {
    const registro = criarRegistroFalso();
    const progressos = new ProgressosSalvos(registro);
    void registro.update(chaveDosProgressos(ALUNO), opcoes.salvos ?? []);
    const provedor = criarProvedorParaTeste([], { teamId: opcoes.teamId, registro });
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
    return { provedor, interno, gravados, progressos };
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
  });

  test("o primeiro salvamento cria a dinâmica do desafio, com o mesmo código", async () => {
    let criacao: URLSearchParams | undefined;
    let formulario: URLSearchParams | undefined;
    let imagem: unknown;
    const requisicoes = mockarServidor({
      [BUSCAR]: NAO_EXISTE,
      "POST /tipoDinamica": (init) => {
        criacao = init?.body as URLSearchParams;
        return json({ message: "Dinâmica criada" });
      },
      "GET /tipo-dinamica/mesa/status": () => json({ status: false }),
      "PUT /tipo-dinamica/mesa/status": () => json({ status: true }),
      [GABARITOS]: SEM_GABARITO,
      [CADASTRAR_GABARITO]: (init) => {
        imagem = (init?.body as FormData).get("arquivo");
        return json({ cod: 311 });
      },
      [CRIAR_PASTA]: () => json({ code_pasta: PASTA }),
      "POST /salvar-conteudo": (init) => {
        formulario = init?.body as URLSearchParams;
        return json({ mensagem: "Conteúdo salvo" });
      },
    });
    const { provedor, interno, progressos } = provedorComArquivos(
      arquivos("<main></main>", "main { display: flex; }"),
    );
    abrirDesafio(interno, "MESA");

    assert.strictEqual(await provedor.salvarProgresso(), true);

    assert.deepStrictEqual(rotas(requisicoes), [
      BUSCAR,
      "POST /tipoDinamica",
      "GET /tipo-dinamica/mesa/status",
      "PUT /tipo-dinamica/mesa/status",
      // Sem gabarito, o servidor não guardaria o conteúdo.
      GABARITOS,
      CADASTRAR_GABARITO,
      CRIAR_PASTA,
      "POST /salvar-conteudo",
    ]);
    assert.ok(imagem instanceof Blob, "a imagem do desafio vai como arquivo");
    assert.deepStrictEqual(Object.fromEntries(criacao!), {
      evento: "mesa",
      tipo: "2",
      config_correcao: "1",
    });
    assert.deepStrictEqual(Object.fromEntries(formulario!), {
      code_pasta: PASTA,
      tipo: "ambos",
      index_conteudo: "<!-- FlexBox Trainer: desafio MESA -->\n<main></main>",
      style_conteudo: "main { display: flex; }",
    });
    assert.deepStrictEqual(progressos.listar(ALUNO), ["MESA"]);
    assert.match(informacoes[0], /desafio MESA salvo no servidor/);
    assert.deepStrictEqual(erros, []);
  });

  test("salva de novo na dinâmica que criou, sem criar outra", async () => {
    const requisicoes = mockarServidor({
      [BUSCAR]: EXISTE,
      [GABARITOS]: COM_GABARITO,
      [CRIAR_PASTA]: () => json({ code_pasta: PASTA }),
      "POST /salvar-conteudo": () => json({}),
    });
    const { provedor, interno, progressos } = provedorComArquivos(
      arquivos("<main></main>", ""),
      { salvos: ["KTBW", "MESA"] },
    );
    abrirDesafio(interno, "MESA");

    assert.strictEqual(await provedor.salvarProgresso(), true);

    // A dinâmica já tem o gabarito: ele não é reenviado nem substituído.
    assert.deepStrictEqual(rotas(requisicoes), [
      BUSCAR,
      GABARITOS,
      CRIAR_PASTA,
      "POST /salvar-conteudo",
    ]);
    // O salvo mais recente vai para o topo da lista.
    assert.deepStrictEqual(progressos.listar(ALUNO), ["MESA", "KTBW"]);
  });

  test("numa dinâmica sua que ficou sem gabarito, envia a imagem e salva", async () => {
    // Como a mqbw e a qaef, criadas antes de a extensão mandar o gabarito.
    const requisicoes = mockarServidor({
      [BUSCAR]: EXISTE,
      [GABARITOS]: () => json([]),
      [CADASTRAR_GABARITO]: () => json({ cod: 312 }),
      [CRIAR_PASTA]: () => json({ code_pasta: PASTA }),
      "POST /salvar-conteudo": () => json({}),
    });
    const { provedor, interno } = provedorComArquivos(arquivos("<main></main>", ""), {
      salvos: ["MESA"],
    });
    abrirDesafio(interno, "MESA");

    assert.strictEqual(await provedor.salvarProgresso(), true);

    assert.deepStrictEqual(rotas(requisicoes), [
      BUSCAR,
      GABARITOS,
      CADASTRAR_GABARITO,
      CRIAR_PASTA,
      "POST /salvar-conteudo",
    ]);
    assert.deepStrictEqual(erros, []);
  });

  test("sem a imagem do desafio pronta, não salva nem chama o servidor", async () => {
    const requisicoes = mockarServidor({});
    const { provedor, interno } = provedorComArquivos(arquivos("<main></main>", ""));
    abrirDesafio(interno, "MESA");
    // A imagem que ficou era de outro desafio.
    interno.tentativa.gabarito = { ...interno.tentativa.gabarito!, challengeId: "outro" };

    assert.strictEqual(await provedor.salvarProgresso(), false);

    assert.match(informacoes[0], /A imagem do desafio ainda não ficou pronta/);
    assert.deepStrictEqual(requisicoes, []);
  });

  test("não grava numa dinâmica com o código que outra pessoa criou", async () => {
    const requisicoes = mockarServidor({ [BUSCAR]: EXISTE });
    const { provedor, interno, progressos } = provedorComArquivos(arquivos("<main></main>", ""));
    abrirDesafio(interno, "MESA");

    assert.strictEqual(await provedor.salvarProgresso(), false);

    assert.deepStrictEqual(rotas(requisicoes), [BUSCAR]);
    assert.match(avisos[0], /Já existe no servidor uma dinâmica "mesa".*pode ser do torneio/);
    assert.deepStrictEqual(progressos.listar(ALUNO), []);
  });

  test("não salva sem desafio nem fora do torneio", async () => {
    const requisicoes = mockarServidor({});

    const semDesafio = provedorComArquivos(arquivos("<main></main>", ""));
    assert.strictEqual(await semDesafio.provedor.salvarProgresso(), false);
    assert.match(informacoes.pop() ?? "", /Gere ou abra um desafio/);

    const foraDoTorneio = provedorComArquivos(arquivos("<main></main>", ""), { teamId: 0 });
    abrirDesafio(foraDoTorneio.interno, "MESA");
    assert.strictEqual(await foraDoTorneio.provedor.salvarProgresso(), false);
    assert.match(avisos.pop() ?? "", /Só quem está no torneio/);

    assert.deepStrictEqual(requisicoes, []);
  });

  test("puxa o desafio escolhido na lista: abre ele com os arquivos salvos", async () => {
    mockarServidor({
      [BUSCAR]: EXISTE,
      [CRIAR_PASTA]: () => json({ code_pasta: PASTA }),
      [OBTER_CONTEUDO]: () => json(SALVO_PELA_EXTENSAO),
    });
    let opcoesDaLista: string[] = [];
    vscode.window.showQuickPick = (async (itens: vscode.QuickPickItem[]) => {
      opcoesDaLista = itens.map((item) => item.label);
      return itens.find((item) => item.label === "MESA");
    }) as unknown as typeof vscode.window.showQuickPick;
    respostaDoAviso = "Puxar";
    const { provedor, interno, gravados } = provedorComArquivos(
      arquivos("<p>outro trabalho</p>", ""),
      { salvos: ["KTBW", "MESA"] },
    );

    await provedor.puxarProgresso();

    assert.deepStrictEqual(opcoesDaLista, ["KTBW", "MESA", "Digitar outro código…"]);
    // O aluno tinha outro trabalho na pasta: confirmou antes da troca.
    assert.deepStrictEqual(avisos, ["Puxar o progresso do desafio MESA?"]);
    assert.strictEqual(interno.tentativa.desafio?.codigo, "MESA");
    assert.deepStrictEqual(interno.tentativa.desafio?.blocks, criarDesafioPorCodigo("MESA").blocks);
    assert.deepStrictEqual(gravados, [
      { html: "<main></main>", css: "main { display: grid; }" },
    ]);
    assert.deepStrictEqual(erros, []);
  });

  test("num computador novo, puxa pelo código digitado e pode voltar a salvar", async () => {
    mockarServidor({
      [BUSCAR]: EXISTE,
      [CRIAR_PASTA]: () => json({ code_pasta: PASTA }),
      [OBTER_CONTEUDO]: () => json(SALVO_PELA_EXTENSAO),
    });
    // Sem a lista sincronizada, o código é digitado.
    vscode.window.showInputBox = (async () => " me-sa ") as typeof vscode.window.showInputBox;
    const { provedor, interno, gravados, progressos } = provedorComArquivos(arquivos("", ""));

    await provedor.puxarProgresso();

    assert.deepStrictEqual(avisos, []);
    assert.strictEqual(interno.tentativa.desafio?.codigo, "MESA");
    assert.strictEqual(gravados.length, 1);
    // A marca mostra que a pasta foi gravada pela extensão.
    assert.deepStrictEqual(progressos.listar(ALUNO), ["MESA"]);
  });

  test("sem confirmar, nada muda; sem nada salvo no código, só avisa", async () => {
    let existe = true;
    mockarServidor({
      [BUSCAR]: () => (existe ? EXISTE() : NAO_EXISTE()),
      [CRIAR_PASTA]: () => json({ code_pasta: PASTA }),
      [OBTER_CONTEUDO]: () => json(SALVO_PELA_EXTENSAO),
    });
    vscode.window.showInputBox = (async () => "MESA") as typeof vscode.window.showInputBox;
    const { provedor, interno, gravados } = provedorComArquivos(
      arquivos("<p>outro trabalho</p>", ""),
    );

    await provedor.puxarProgresso();
    assert.strictEqual(interno.tentativa.desafio, undefined);

    existe = false;
    await provedor.puxarProgresso();
    assert.match(informacoes.pop() ?? "", /Não há progresso seu salvo no servidor para o desafio MESA/);

    assert.strictEqual(interno.tentativa.desafio, undefined);
    assert.deepStrictEqual(gravados, []);
  });

  test("não pede o código fora do torneio, e um erro do servidor aparece", async () => {
    mockarServidor({
      [BUSCAR]: EXISTE,
      [CRIAR_PASTA]: () => json({ detail: "Permission denied" }, 500),
    });
    let pediu = false;
    vscode.window.showInputBox = (async () => {
      pediu = true;
      return "MESA";
    }) as typeof vscode.window.showInputBox;

    await provedorComArquivos(arquivos("", ""), { teamId: 0 }).provedor.puxarProgresso();
    assert.strictEqual(pediu, false);
    assert.match(avisos.pop() ?? "", /Só quem está no torneio/);

    const { provedor, gravados } = provedorComArquivos(arquivos("", ""));
    await provedor.puxarProgresso();
    assert.strictEqual(erros.length, 1);
    assert.match(erros[0], /^Não foi possível puxar o progresso: .*Permission denied/);
    assert.deepStrictEqual(gravados, []);
  });
});
