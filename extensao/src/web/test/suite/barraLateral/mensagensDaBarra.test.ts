import * as assert from "assert";
import * as vscode from "vscode";
import { ProgressoGuia } from "../../../provider/provedorBarraLateral";
import { criarDesafioPorCodigo } from "../../../services/desafio";
import {
  criarBarraFalsa,
  criarProvedorParaTeste,
  criarRegistroFalso,
  FORMAS,
  json,
  mockarConfiguracaoServidorValida,
  mockarServidor,
  prepararCodigo,
  ProvedorInterno,
  restaurarAoFim,
  ultimaMensagem,
} from "./auxiliares";

// A conversa com o script da barra lateral e os comandos que chegam a ela.
suite("Barra lateral: mensagens e comandos", () => {
  restaurarAoFim();

  test("gera os desafios novos no nível escolhido e guarda a escolha", async () => {
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste([], { registro });
    const interno = provedor as unknown as ProvedorInterno;
    interno.testarConexaoServidor = async () => undefined;
    const barra = criarBarraFalsa();
    provedor.resolveWebviewView(barra.vista);
    barra.receber({ type: "pronto" });

    // Sem escolha, o médio.
    assert.strictEqual(provedor.nivelEscolhido(), "medio");
    assert.strictEqual(ultimaMensagem(barra.enviadas, "nivel")?.payload, "medio");

    barra.receber({ type: "definirNivel", nivel: "facil" });
    await new Promise((pronto) => setTimeout(pronto, 0));
    assert.strictEqual(provedor.nivelEscolhido(), "facil");
    assert.strictEqual(registro.get("flexboxTrainer.nivel"), "facil");
    assert.strictEqual(ultimaMensagem(barra.enviadas, "nivel")?.payload, "facil");

    await provedor.iniciarNovoDesafio();
    assert.strictEqual(interno.desafioAtual!.nivel, "facil");
    assert.strictEqual(Number(interno.desafioAtual!.codigo) % 3, 0);

    // Um nível que não existe é ignorado.
    barra.receber({ type: "definirNivel", nivel: "impossivel" });
    await new Promise((pronto) => setTimeout(pronto, 0));
    assert.strictEqual(provedor.nivelEscolhido(), "facil");
  });

  test("o link Ver atalhos da dica abre a aba Atalhos", async () => {
    const comandos: string[] = [];
    vscode.commands.executeCommand = (async (comando: string) => {
      comandos.push(comando);
      return undefined;
    }) as typeof vscode.commands.executeCommand;
    const provedor = criarProvedorParaTeste([]);
    const barra = criarBarraFalsa();
    provedor.resolveWebviewView(barra.vista);

    barra.receber({ type: "verAtalhos" });

    assert.ok(comandos.includes("flexbox-trainer.verAtalhos"));
  });

  test("o atalho de Verificar abre a barra e pede a verificação quando ela carrega", async () => {
    const comandos: string[] = [];
    vscode.commands.executeCommand = (async (comando: string) => {
      comandos.push(comando);
      return undefined;
    }) as typeof vscode.commands.executeCommand;
    const provedor = criarProvedorParaTeste([]);
    const interno = provedor as unknown as ProvedorInterno;
    interno.testarConexaoServidor = async () => undefined;
    interno.desafioAtual = criarDesafioPorCodigo("482917");
    const barra = criarBarraFalsa();
    provedor.resolveWebviewView(barra.vista);

    await provedor.pedirVerificacao();

    assert.deepStrictEqual(comandos, ["flexbox-trainer.sidebar.focus"]);
    assert.ok(!barra.enviadas.some((mensagem) => mensagem.type === "verificar"));

    barra.receber({ type: "pronto" });
    assert.strictEqual(barra.enviadas.filter((m) => m.type === "verificar").length, 1);

    // Com a barra já carregada, o pedido vai na hora.
    await provedor.pedirVerificacao();
    assert.strictEqual(barra.enviadas.filter((m) => m.type === "verificar").length, 2);

    // Carregada mas escondida, ela recebe o pedido quando aparecer.
    barra.mudarVisibilidade(false);
    await provedor.pedirVerificacao();
    assert.strictEqual(barra.enviadas.filter((m) => m.type === "verificar").length, 2);
    barra.mudarVisibilidade(true);
    assert.strictEqual(barra.enviadas.filter((m) => m.type === "verificar").length, 3);

    // Um desafio novo descarta o pedido que ainda esperava.
    barra.mudarVisibilidade(false);
    await provedor.pedirVerificacao();
    await provedor.iniciarNovoDesafio("482917");
    barra.mudarVisibilidade(true);
    assert.strictEqual(barra.enviadas.filter((m) => m.type === "verificar").length, 3);
  });

  test("avisa o guia do que o aluno já fez", async () => {
    mockarConfiguracaoServidorValida();
    mockarServidor({
      "POST /tipo-dinamica/treino/corrigir-formas": () => json({ pontuacao: 64 }),
    });
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste([], { registro });
    const progressos: ProgressoGuia[] = [];
    provedor.onDidMudarProgresso((progresso) => progressos.push(progresso));
    const interno = provedor as unknown as ProvedorInterno;

    const pastaAberta = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
    interno.enviarEstado();
    assert.deepStrictEqual(progressos[progressos.length - 1], {
      autenticado: true,
      pastaAberta,
      semExtensoesIa: true,
      temDesafio: false,
      verificou: false,
    });

    await prepararCodigo(provedor, registro, "482917");
    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, FORMAS);

    assert.deepStrictEqual(progressos[progressos.length - 1], {
      autenticado: true,
      pastaAberta,
      semExtensoesIa: true,
      temDesafio: true,
      verificou: true,
    });
  });
});
