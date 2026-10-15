import * as assert from "assert";
import * as vscode from "vscode";
import {
  CHAVE_REGISTRO,
  criarProvedorParaTeste,
  criarRegistroFalso,
  FORMAS,
  json,
  mockarConfiguracaoServidorValida,
  mockarServidor,
  NOME_GABARITO,
  prepararVerificacao,
  restaurarAoFim,
} from "./auxiliares";

// O gabarito do desafio no evento de treino: enviar, reaproveitar e substituir.
suite("Barra lateral: gabarito no servidor", () => {
  restaurarAoFim();

  test("cadastra o gabarito no evento de treino e usa a nota de corrigir-formas", async () => {
    mockarConfiguracaoServidorValida();
    let corpoCorrecao: unknown;
    const requisicoes = mockarServidor({
      "GET /tipo-dinamica/treino/gabaritos": () => json([]),
      "POST /tipo-dinamica/treino/gabarito": () => json({ cod: 91 }),
      [`GET /medidas-gabarito?gabarito=${NOME_GABARITO}`]: () =>
        json({ formas: [] }),
      "POST /tipo-dinamica/treino/corrigir-formas": (init) => {
        corpoCorrecao = JSON.parse(String(init?.body));
        return json({ pontuacao: 73.25, pontuacao_total: 2.1, pontuacao_maxima: 7 });
      },
    });
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste([], { registro });
    const interno = prepararVerificacao(provedor, 202);

    await interno.verificarTentativaAtual(
      interno.desafioAtual!.challengeId,
      FORMAS,
    );

    assert.deepStrictEqual(interno.avaliacaoAtual, {
      precision: 73.25,
      score: 73.25,
      source: "servidor",
    });
    const { submissao_id: submissaoId, ...corpoSemSubmissao } =
      corpoCorrecao as Record<string, unknown>;
    assert.match(String(submissaoId), /^flexbox-trainer-\d+$/);
    assert.deepStrictEqual(corpoSemSubmissao, {
      time_id: 46,
      integrante_id: 74,
      salvar_pontuacao: false,
      frames: [
        {
          gabarito_cod: 91,
          viewport: { width: 800, height: 800 },
          formas: FORMAS,
        },
      ],
    });
    const envio = requisicoes.find(
      (requisicao) => requisicao.metodo === "POST" && requisicao.caminho.endsWith("/gabarito"),
    );
    const arquivo = (envio?.corpo as FormData).get("arquivo") as Blob;
    assert.strictEqual(arquivo.type, "image/png");
    assert.deepStrictEqual(registro.get(CHAVE_REGISTRO), {
      cod: 91,
      challengeId: interno.desafioAtual!.challengeId,
    });
    assert.ok(
      requisicoes.every((requisicao) => !requisicao.caminho.includes("gref")),
      "O evento da competição nunca deve receber gabaritos.",
    );
  });

  test("reaproveita o gabarito já enviado para o mesmo desafio", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes = mockarServidor({
      "POST /tipo-dinamica/treino/corrigir-formas": () => json({ pontuacao: 88 }),
    });
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste([], { registro });
    const interno = prepararVerificacao(provedor, 204);
    await registro.update(CHAVE_REGISTRO, {
      cod: 91,
      challengeId: interno.desafioAtual!.challengeId,
    });

    await interno.verificarTentativaAtual(
      interno.desafioAtual!.challengeId,
      FORMAS,
    );

    assert.strictEqual(interno.avaliacaoAtual?.precision, 88);
    assert.deepStrictEqual(
      requisicoes.map((requisicao) => requisicao.caminho),
      ["/tipo-dinamica/treino/corrigir-formas"],
    );
  });

  test("substitui via PUT apenas o gabarito criado pela extensão", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes = mockarServidor({
      "GET /tipo-dinamica/treino/gabaritos": () =>
        json([{ cod: 91, url: `https://api.teste.com/gabaritos/${NOME_GABARITO}` }]),
      "PUT /tipo-dinamica/gabarito/91": () => json({ message: "Atualizado" }),
      [`GET /medidas-gabarito?gabarito=${NOME_GABARITO}`]: () => json({}),
      "POST /tipo-dinamica/treino/corrigir-formas": () => json({ pontuacao: 50 }),
    });
    const registro = criarRegistroFalso();
    await registro.update(CHAVE_REGISTRO, {
      cod: 91,
      challengeId: "desafio-anterior",
    });
    const provedor = criarProvedorParaTeste([], { registro });
    const interno = prepararVerificacao(provedor, 206);

    await interno.verificarTentativaAtual(
      interno.desafioAtual!.challengeId,
      FORMAS,
    );

    assert.strictEqual(interno.avaliacaoAtual?.precision, 50);
    assert.deepStrictEqual(
      requisicoes.map((requisicao) => `${requisicao.metodo} ${requisicao.caminho}`),
      [
        "GET /tipo-dinamica/treino/gabaritos",
        "PUT /tipo-dinamica/gabarito/91",
        `GET /medidas-gabarito?gabarito=${NOME_GABARITO}`,
        "POST /tipo-dinamica/treino/corrigir-formas",
      ],
    );
    assert.deepStrictEqual(registro.get(CHAVE_REGISTRO), {
      cod: 91,
      challengeId: interno.desafioAtual!.challengeId,
    });
  });

  test("trata como vazia a lista de uma dinâmica nova que responde 404 dentro de um 500", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes = mockarServidor({
      "GET /tipo-dinamica/treino/gabaritos": () =>
        json({ detail: "Erro ao buscar gabaritos: 404: Nenhum gabarito encontrado" }, 500),
      "POST /tipo-dinamica/treino/gabarito": () => json({ cod: 93 }),
      [`GET /medidas-gabarito?gabarito=${NOME_GABARITO}`]: () => json({}),
      "POST /tipo-dinamica/treino/corrigir-formas": () => json({ pontuacao: 55 }),
    });
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste([], { registro });
    const interno = prepararVerificacao(provedor, 205);

    await interno.verificarTentativaAtual(
      interno.desafioAtual!.challengeId,
      FORMAS,
    );

    assert.strictEqual(interno.avaliacaoAtual?.precision, 55);
    assert.deepStrictEqual(registro.get(CHAVE_REGISTRO), {
      cod: 93,
      challengeId: interno.desafioAtual!.challengeId,
    });
    assert.ok(
      requisicoes.some((requisicao) => requisicao.caminho.endsWith("/gabarito")),
    );
  });

  test("substitui via PUT quando a listagem de gabaritos vem em pares", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes = mockarServidor({
      "GET /tipo-dinamica/treino/gabaritos": () =>
        json([[91, `gabaritos/${NOME_GABARITO}`]]),
      "PUT /tipo-dinamica/gabarito/91": () => json({ message: "Atualizado" }),
      [`GET /medidas-gabarito?gabarito=${NOME_GABARITO}`]: () => json({}),
      "POST /tipo-dinamica/treino/corrigir-formas": () => json({ pontuacao: 61 }),
    });
    const registro = criarRegistroFalso();
    await registro.update(CHAVE_REGISTRO, {
      cod: 91,
      challengeId: "desafio-anterior",
    });
    const provedor = criarProvedorParaTeste([], { registro });
    const interno = prepararVerificacao(provedor, 207);

    await interno.verificarTentativaAtual(
      interno.desafioAtual!.challengeId,
      FORMAS,
    );

    assert.strictEqual(interno.avaliacaoAtual?.precision, 61);
    assert.ok(
      requisicoes.some(
        (requisicao) =>
          `${requisicao.metodo} ${requisicao.caminho}` ===
          "PUT /tipo-dinamica/gabarito/91",
      ),
    );
  });

  test("descobre pela listagem em pares o código que o upload não informou", async () => {
    mockarConfiguracaoServidorValida();
    let listagens = 0;
    const requisicoes = mockarServidor({
      "GET /tipo-dinamica/treino/gabaritos": () =>
        json(listagens++ === 0 ? [] : [[92, `gabaritos/${NOME_GABARITO}`]]),
      "POST /tipo-dinamica/treino/gabarito": () =>
        json({ message: "Gabarito salvo" }),
      [`GET /medidas-gabarito?gabarito=${NOME_GABARITO}`]: () => json({}),
      "POST /tipo-dinamica/treino/corrigir-formas": () => json({ pontuacao: 40 }),
    });
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste([], { registro });
    const interno = prepararVerificacao(provedor, 209);

    await interno.verificarTentativaAtual(
      interno.desafioAtual!.challengeId,
      FORMAS,
    );

    assert.strictEqual(interno.avaliacaoAtual?.precision, 40);
    assert.deepStrictEqual(registro.get(CHAVE_REGISTRO), {
      cod: 92,
      challengeId: interno.desafioAtual!.challengeId,
    });
    assert.strictEqual(
      requisicoes.filter((requisicao) => requisicao.metodo === "PUT").length,
      0,
    );
  });

  test("não envia nada quando o evento já tem um gabarito do mesmo tamanho de outra origem", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes = mockarServidor({
      "GET /tipo-dinamica/treino/gabaritos": () =>
        json([{ cod: 5, url: `https://api.teste.com/gabaritos/${NOME_GABARITO}` }]),
    });
    const provedor = criarProvedorParaTeste([]);
    const interno = prepararVerificacao(provedor, 208);

    await interno.verificarTentativaAtual(
      interno.desafioAtual!.challengeId,
      FORMAS,
    );

    assert.strictEqual(interno.avaliacaoAtual?.source, "gabarito-error");
    assert.match(
      interno.avaliacaoAtual?.error || "",
      /não foi criado por esta extensão/,
    );
    assert.deepStrictEqual(
      requisicoes.map((requisicao) => requisicao.metodo),
      ["GET"],
    );
  });

  test("recusa o envio quando não identifica o tamanho dos gabaritos do evento", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes = mockarServidor({
      "GET /tipo-dinamica/treino/gabaritos": () =>
        json([{ cod: 5, arquivo: "imagem-sem-padrao.png" }]),
    });
    const provedor = criarProvedorParaTeste([]);
    const interno = prepararVerificacao(provedor, 210);

    await interno.verificarTentativaAtual(
      interno.desafioAtual!.challengeId,
      FORMAS,
    );

    assert.strictEqual(interno.avaliacaoAtual?.source, "gabarito-error");
    assert.match(interno.avaliacaoAtual?.error || "", /identificar o tamanho/);
    assert.strictEqual(requisicoes.length, 1);
  });

  test("exige um evento de treino e não chama o servidor sem ele", async () => {
    mockarConfiguracaoServidorValida({ eventoTreino: "" });
    const perguntas: string[] = [];
    vscode.window.showInformationMessage = (async (mensagem: string) => {
      perguntas.push(mensagem);
      return undefined;
    }) as typeof vscode.window.showInformationMessage;
    const requisicoes = mockarServidor({});
    const provedor = criarProvedorParaTeste([]);
    const interno = prepararVerificacao(provedor, 212);

    await interno.verificarTentativaAtual(
      interno.desafioAtual!.challengeId,
      FORMAS,
    );

    assert.strictEqual(interno.avaliacaoAtual?.source, "config-missing");
    assert.match(interno.avaliacaoAtual?.error || "", /eventoTreino/);
    assert.strictEqual(requisicoes.length, 0);
    assert.deepStrictEqual(perguntas, ["Você ainda não tem uma dinâmica de treino."]);
  });
});
