import * as assert from "assert";
import * as vscode from "vscode";
import { ProgressoGuia } from "../../../provider/provedorBarraLateral";
import { formatoDoCodigo } from "../../../formatos";
import { valorDoCodigo } from "../../../niveis";
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
    assert.strictEqual(interno.tentativa.desafio!.nivel, "facil");
    assert.strictEqual(valorDoCodigo(interno.tentativa.desafio!.codigo!) % 3, 0);

    // Um nível que não existe é ignorado.
    barra.receber({ type: "definirNivel", nivel: "impossivel" });
    await new Promise((pronto) => setTimeout(pronto, 0));
    assert.strictEqual(provedor.nivelEscolhido(), "facil");
  });

  test("guarda o formato escolhido e gera os desafios novos nele", async () => {
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste([], { registro });
    const interno = provedor as unknown as ProvedorInterno;
    interno.testarConexaoServidor = async () => undefined;
    const barra = criarBarraFalsa();
    provedor.resolveWebviewView(barra.vista);
    barra.receber({ type: "pronto" });

    // Sem escolha, o quadrado de sempre.
    assert.strictEqual(provedor.formatoEscolhido(), "quadrado");
    assert.strictEqual(ultimaMensagem(barra.enviadas, "formato")?.payload, "quadrado");

    barra.receber({ type: "definirFormato", formato: "paisagem" });
    await new Promise((pronto) => setTimeout(pronto, 0));
    assert.strictEqual(provedor.formatoEscolhido(), "paisagem");
    assert.strictEqual(registro.get("flexboxTrainer.formato"), "paisagem");
    assert.strictEqual(ultimaMensagem(barra.enviadas, "formato")?.payload, "paisagem");

    await provedor.iniciarNovoDesafio();
    const desafio = interno.tentativa.desafio!;
    assert.deepStrictEqual([desafio.width, desafio.height], [1280, 720]);
    assert.strictEqual(formatoDoCodigo(desafio.codigo!), "paisagem");
    // O nível continua o escolhido (o médio, por padrão).
    assert.strictEqual(desafio.nivel, "medio");

    // Um formato que não existe é ignorado.
    barra.receber({ type: "definirFormato", formato: "panorama" });
    await new Promise((pronto) => setTimeout(pronto, 0));
    assert.strictEqual(provedor.formatoEscolhido(), "paisagem");
  });

  test("copia o que a barra pede e puxa pelo código do histórico", async () => {
    const copiados: string[] = [];
    const clipboardOriginal = Object.getOwnPropertyDescriptor(vscode.env, "clipboard");
    Object.defineProperty(vscode.env, "clipboard", {
      configurable: true,
      value: {
        readText: async () => "",
        writeText: async (texto: string) => {
          copiados.push(texto);
        },
      },
    });
    const provedor = criarProvedorParaTeste([]);
    const puxados: Array<string | undefined> = [];
    provedor.puxarProgresso = async (codigo?: string) => {
      puxados.push(codigo);
    };
    const barra = criarBarraFalsa();
    provedor.resolveWebviewView(barra.vista);

    try {
      barra.receber({ type: "copiar", texto: "#1f6feb" });
      barra.receber({ type: "copiar", texto: "" });
      barra.receber({ type: "copiar", texto: 42 });
      barra.receber({ type: "copiar", texto: "x".repeat(65) });
      barra.receber({ type: "puxarProgresso", codigo: "mesa" });
      barra.receber({ type: "puxarProgresso", codigo: "nada disso" });
      barra.receber({ type: "puxarProgresso" });
      await new Promise((pronto) => setTimeout(pronto, 0));

      assert.deepStrictEqual(copiados, ["#1f6feb"]);
      // Um código inválido é ignorado; sem código, a extensão pergunta qual.
      assert.deepStrictEqual(puxados, ["MESA", undefined]);
    } finally {
      if (clipboardOriginal) {
        Object.defineProperty(vscode.env, "clipboard", clipboardOriginal);
      }
    }
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
    interno.tentativa.desafio = criarDesafioPorCodigo("MESA");
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
    await provedor.iniciarNovoDesafio("MESA");
    barra.mudarVisibilidade(true);
    assert.strictEqual(barra.enviadas.filter((m) => m.type === "verificar").length, 3);
  });

  test("o Verificar da aba e do atalho continua valendo depois de a barra ser redesenhada igual", async () => {
    vscode.commands.executeCommand = (async () => undefined) as typeof vscode.commands.executeCommand;
    const provedor = criarProvedorParaTeste([]);
    const interno = provedor as unknown as ProvedorInterno & {
      renderizarWebviewAtual(): void;
    };
    interno.testarConexaoServidor = async () => undefined;
    interno.tentativa.desafio = criarDesafioPorCodigo("MESA");
    const barra = criarBarraFalsa();
    provedor.resolveWebviewView(barra.vista);
    barra.receber({ type: "pronto" });

    // A sessão revalidada ao abrir o VS Code redesenha a barra com o mesmo
    // HTML; o VS Code não recarrega a página, e o script não avisa de novo.
    interno.renderizarWebviewAtual();
    await provedor.pedirVerificacao();

    assert.strictEqual(barra.enviadas.filter((m) => m.type === "verificar").length, 1);
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

    await prepararCodigo(provedor, registro, "MESA");
    await interno.verificarTentativaAtual(interno.tentativa.desafio!.challengeId, FORMAS);

    assert.deepStrictEqual(progressos[progressos.length - 1], {
      autenticado: true,
      pastaAberta,
      semExtensoesIa: true,
      temDesafio: true,
      verificou: true,
    });
  });
});
