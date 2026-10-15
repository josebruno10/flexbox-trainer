import * as assert from "assert";
import * as vscode from "vscode";
import {
  CHAVE_REGISTRO,
  criarProvedorParaTeste,
  criarRegistroFalso,
  FORMAS,
  json,
  MensagemWebview,
  mockarConfiguracaoServidorValida,
  mockarServidor,
  prepararVerificacao,
  ProvedorInterno,
  restaurarAoFim,
  ultimaMensagem,
} from "./auxiliares";

// A sessão do aluno nas rotas do servidor: token, IDs, recusas e o teste de conexão.
suite("Barra lateral: sessão no servidor", () => {
  restaurarAoFim();

  test("o teste automático do servidor só aparece na barra lateral se der erro", async () => {
    mockarConfiguracaoServidorValida();
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ id: 74, email: "aluno@teste.com" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const informacoes: string[] = [];
    vscode.window.showInformationMessage = (async (mensagem: string) => {
      informacoes.push(mensagem);
      return undefined;
    }) as unknown as typeof vscode.window.showInformationMessage;
    const mensagens: MensagemWebview[] = [];
    const provedor = criarProvedorParaTeste(mensagens);
    const interno = provedor as unknown as ProvedorInterno;

    await interno.testarConexaoServidor();
    assert.strictEqual(ultimaMensagem(mensagens, "statusServidor"), undefined);

    await provedor.testarServidorPeloComando();
    assert.deepStrictEqual(informacoes, ["Servidor OK, sessão válida (HTTP 200)."]);
    assert.strictEqual(ultimaMensagem(mensagens, "statusServidor"), undefined);
  });

  test("invalida a sessão quando corrigir-formas responde 401", async () => {
    mockarConfiguracaoServidorValida();
    mockarServidor({
      "POST /tipo-dinamica/treino/corrigir-formas": () =>
        json({ detail: "Token expirado" }, 401),
    });
    const invalidacoes: string[] = [];
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste([], { invalidacoes, registro });
    const interno = prepararVerificacao(provedor, 222);
    await registro.update(CHAVE_REGISTRO, {
      cod: 91,
      challengeId: interno.desafioAtual!.challengeId,
    });

    await interno.verificarTentativaAtual(
      interno.desafioAtual!.challengeId,
      FORMAS,
    );

    assert.strictEqual(interno.avaliacaoAtual?.source, "authentication-error");
    assert.strictEqual(interno.avaliacaoAtual?.httpStatus, 401);
    assert.deepStrictEqual(invalidacoes, [
      "O servidor recusou a sessão. Entre novamente.",
    ]);
  });

  test("usa token, usuário e equipe da sessão nas rotas do servidor", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes: Array<{
      url: string;
      authorization?: string;
    }> = [];

    globalThis.fetch = async (input, init) => {
      const url = String(input);
      requisicoes.push({
        url,
        authorization: (init?.headers as Record<string, string>)
          .Authorization,
      });

      return new Response(JSON.stringify({ id: 74 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const mensagens: MensagemWebview[] = [];
    const provedor = criarProvedorParaTeste(mensagens, {
      serverToken: "token-autenticado",
      userId: 74,
      teamId: 46,
    });
    const interno = provedor as unknown as ProvedorInterno;

    const configuracao = interno.lerConfiguracaoServidorAtual();
    assert.strictEqual(configuracao.apiToken, "token-autenticado");
    assert.strictEqual(configuracao.userId, 74);
    assert.strictEqual(configuracao.teamId, 46);

    await interno.testarConexaoServidor();

    assert.deepStrictEqual(requisicoes, [
      {
        url: "https://api.teste.com/api/auth/me",
        authorization: "Bearer token-autenticado",
      },
    ]);
  });

  test("usa só o aluno e o time da sessão, mesmo com IDs nas configurações", () => {
    // Configurações antigas não podem fazer alguém corrigir em nome de outro.
    mockarConfiguracaoServidorValida({
      usarIdsDasConfiguracoes: true,
      userId: 7,
      teamId: 42,
    });

    const provedor = criarProvedorParaTeste([], {
      serverToken: "token-autenticado",
      userId: 74,
      teamId: 81,
    });
    const interno = provedor as unknown as ProvedorInterno;
    const configuracao = interno.lerConfiguracaoServidorAtual();

    assert.strictEqual(configuracao.userId, 74);
    assert.strictEqual(configuracao.teamId, 81);
  });

  test("invalida a sessão quando auth/me responde 403", async () => {
    mockarConfiguracaoServidorValida();
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ detail: "Acesso negado" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });

    const mensagens: MensagemWebview[] = [];
    const invalidacoes: string[] = [];
    const provedor = criarProvedorParaTeste(mensagens, { invalidacoes });
    const interno = provedor as unknown as ProvedorInterno;

    await interno.testarConexaoServidor();

    assert.deepStrictEqual(invalidacoes, [
      "O servidor recusou a sessão. Entre novamente.",
    ]);
    assert.deepStrictEqual(
      ultimaMensagem(mensagens, "statusServidor")?.payload,
      {
        ok: false,
        mensagem:
          "Servidor respondeu com erro (HTTP 403): Acesso negado",
      },
    );
  });
});
