import * as assert from "assert";
import * as vscode from "vscode";
import { criarDesafioGerado, criarDesafioPorCodigo } from "../../../services/desafio";
import { modeloCss, modeloHtml } from "../../../services/workspace";
import { codigoDoDia } from "../../../services/codigoDesafio";
import { ResumoWorkspace } from "../../../types";
import {
  criarAleatorioTeste,
  criarProvedorParaTeste,
  MensagemWebview,
  ProvedorInterno,
  restaurarAoFim,
  ultimaMensagem,
  ultimoEstadoDesafio,
} from "./auxiliares";

// Começar um desafio: novo, por código, o do dia, e os arquivos de antes.
suite("Barra lateral: desafio novo", () => {
  restaurarAoFim();

  test("encerra, congela e reinicia o cronômetro em um novo desafio", async () => {
    let agora = 2_500;
    Date.now = () => agora;

    const mensagens: MensagemWebview[] = [];
    const provedor = criarProvedorParaTeste(mensagens);
    const interno = provedor as unknown as ProvedorInterno;
    interno.desafioAtual = criarDesafioGerado({
      aleatorio: criarAleatorioTeste(101),
    });
    interno.inicioTentativaMs = 1_000;

    interno.enviarEstado();
    assert.deepStrictEqual(ultimoEstadoDesafio(mensagens), {
      tempoAtualMs: 1_500,
      encerrado: false,
    });

    agora = 3_000;
    interno.encerrarDesafioAtual();
    assert.deepStrictEqual(ultimoEstadoDesafio(mensagens), {
      tempoAtualMs: 2_000,
      encerrado: true,
    });

    agora = 20_000;
    interno.enviarEstado();
    assert.deepStrictEqual(
      ultimoEstadoDesafio(mensagens),
      { tempoAtualMs: 2_000, encerrado: true },
      "O tempo não deve avançar depois que o desafio for encerrado.",
    );

    interno.testarConexaoServidor = async () => undefined;
    await provedor.iniciarNovoDesafio();

    assert.strictEqual(interno.fimTentativaMs, undefined);
    assert.strictEqual(interno.inicioTentativaMs, 20_000);
    assert.deepStrictEqual(
      ultimoEstadoDesafio(mensagens),
      { tempoAtualMs: 0, encerrado: false },
      "Um novo desafio deve reiniciar o cronômetro.",
    );
  });

  test("abre o desafio do código digitado e refaz o mesmo desafio", async () => {
    vscode.window.showInputBox = (async () => " 482 917 ") as typeof vscode.window.showInputBox;
    const provedor = criarProvedorParaTeste([]);
    const interno = provedor as unknown as ProvedorInterno;
    interno.testarConexaoServidor = async () => undefined;

    await provedor.abrirDesafioPorCodigo();

    const primeiro = interno.desafioAtual!;
    assert.strictEqual(primeiro.codigo, "482917");
    assert.deepStrictEqual(primeiro.blocks, criarDesafioPorCodigo("482917").blocks);

    await provedor.refazerDesafio();

    assert.strictEqual(interno.desafioAtual!.codigo, "482917");
    assert.deepStrictEqual(interno.desafioAtual!.blocks, primeiro.blocks);
    assert.notStrictEqual(interno.desafioAtual!.challengeId, primeiro.challengeId);
  });

  test("não abre nada com um código inválido ou cancelado", async () => {
    const provedor = criarProvedorParaTeste([]);
    const interno = provedor as unknown as ProvedorInterno;
    interno.testarConexaoServidor = async () => undefined;

    for (const resposta of [undefined, "", "12345"]) {
      vscode.window.showInputBox = (async () => resposta) as typeof vscode.window.showInputBox;
      await provedor.abrirDesafioPorCodigo();
    }
    await provedor.refazerDesafio("abc");

    assert.strictEqual(interno.desafioAtual, undefined);
  });

  test("abre o desafio do dia e avisa a barra lateral que ele é o do dia", async () => {
    const mensagens: MensagemWebview[] = [];
    const provedor = criarProvedorParaTeste(mensagens);
    const interno = provedor as unknown as ProvedorInterno;
    interno.testarConexaoServidor = async () => undefined;

    await provedor.abrirDesafioDoDia();

    assert.strictEqual(interno.desafioAtual!.codigo, codigoDoDia());
    const dados = ultimaMensagem(mensagens, "dadosDesafio")?.payload as { doDia: boolean };
    assert.strictEqual(dados.doDia, true);
  });

  test("oferece abrir uma pasta quando não há onde criar index.html e style.css", async function () {
    if (vscode.workspace.workspaceFolders?.length) {
      this.skip();
    }
    const mostradas: string[] = [];
    vscode.window.showInformationMessage = (async (
      mensagem: string,
      ...itens: string[]
    ) => {
      mostradas.push(`${mensagem} [${itens.join(", ")}]`);
      return undefined;
    }) as unknown as typeof vscode.window.showInformationMessage;
    const provedor = criarProvedorParaTeste([]);

    await provedor.criarArquivosDeTreino();

    assert.deepStrictEqual(mostradas, [
      "Abra uma pasta para criar index.html e style.css. [Abrir pasta]",
    ]);
  });

  suite("Arquivos do desafio anterior", () => {
    const comTrabalho: ResumoWorkspace = {
      caminhoHtml: "/projeto/index.html",
      caminhoCss: "/projeto/style.css",
      textoHtml: modeloHtml().replace("<body>", "<body><main></main>"),
      textoCss: `${modeloCss()}\nmain { display: flex; }`,
      htmlPreview: "",
      temArquivoHtml: true,
      temArquivoCss: true,
    };

    function preparar(arquivos: ResumoWorkspace, resposta: string | undefined) {
      const perguntas: string[] = [];
      vscode.window.showWarningMessage = (async (mensagem: string) => {
        perguntas.push(mensagem);
        return resposta;
      }) as unknown as typeof vscode.window.showWarningMessage;
      const provedor = criarProvedorParaTeste([]);
      const interno = provedor as unknown as ProvedorInterno;
      const limpezas: { instante: number }[] = [];
      interno.lerArquivosDoAluno = async () => arquivos;
      interno.limparArquivosDoAluno = async () => {
        limpezas.push({ instante: Date.now() });
      };
      interno.testarConexaoServidor = async () => undefined;
      return { provedor, interno, perguntas, limpezas };
    }

    test("pede confirmação, limpa os arquivos e só então começa a contar o tempo", async () => {
      const { provedor, interno, perguntas, limpezas } = preparar(comTrabalho, "Limpar e gerar");

      await provedor.iniciarNovoDesafio();

      assert.strictEqual(perguntas.length, 1);
      assert.match(perguntas[0], /apaga o que você escreveu/);
      assert.strictEqual(limpezas.length, 1);
      assert.ok(interno.inicioTentativaMs >= limpezas[0].instante);
    });

    test("não gera nem apaga nada quando o aluno cancela", async () => {
      const { provedor, interno, limpezas } = preparar(comTrabalho, undefined);
      const anterior = criarDesafioGerado({ aleatorio: criarAleatorioTeste(240) });
      interno.desafioAtual = anterior;

      await provedor.iniciarNovoDesafio();

      assert.strictEqual(interno.desafioAtual, anterior);
      assert.deepStrictEqual(limpezas, []);
    });

    test("não pergunta quando os arquivos ainda são a base", async () => {
      const base: ResumoWorkspace = {
        ...comTrabalho,
        textoHtml: modeloHtml(),
        textoCss: modeloCss(),
      };
      const { provedor, interno, perguntas, limpezas } = preparar(base, undefined);

      await provedor.iniciarNovoDesafio();

      assert.deepStrictEqual(perguntas, []);
      assert.deepStrictEqual(limpezas, []);
      assert.ok(interno.desafioAtual);
    });
  });
});
