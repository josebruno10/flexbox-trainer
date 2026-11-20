import * as assert from "assert";
import * as vscode from "vscode";
import { BarraDeStatus, EstadoBarraDeStatus } from "../../../provider/barraDeStatus";
import {
  CHAVE_REGISTRO,
  criarProvedorParaTeste,
  criarRegistroFalso,
  FORMAS,
  json,
  MensagemWebview,
  mockarConfiguracaoServidorValida,
  mockarServidor,
  NOME_GABARITO,
  prepararVerificacao,
  restaurarAoFim,
  ultimaMensagem,
} from "./auxiliares";

// Verificar: a página medida vai ao servidor e a nota volta à barra lateral.
suite("Barra lateral: verificação", () => {
  restaurarAoFim();

  test("oferece criar a dinâmica no primeiro Verificar e segue com a correção", async () => {
    mockarConfiguracaoServidorValida({ eventoTreino: "" });
    vscode.window.showInformationMessage = (async () =>
      "Criar dinâmica de treino") as unknown as typeof vscode.window.showInformationMessage;
    const comandos: string[] = [];
    vscode.commands.executeCommand = (async (comando: string) => {
      comandos.push(comando);
      // O comando real grava o código criado em flexboxTrainer.eventoTreino.
      mockarConfiguracaoServidorValida();
      return undefined;
    }) as typeof vscode.commands.executeCommand;
    mockarServidor({
      "POST /tipo-dinamica/treino/corrigir-formas": () => json({ pontuacao: 64 }),
    });
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste([], { registro });
    const interno = prepararVerificacao(provedor, 213);
    await registro.update(CHAVE_REGISTRO, {
      cod: 91,
      challengeId: interno.tentativa.desafio!.challengeId,
    });

    await interno.verificarTentativaAtual(
      interno.tentativa.desafio!.challengeId,
      FORMAS,
    );

    assert.deepStrictEqual(comandos, ["flexbox-trainer.criarDinamicaTreino"]);
    assert.strictEqual(interno.tentativa.avaliacao?.precision, 64);
  });

  test("não envia uma página sem formas medidas", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes = mockarServidor({});
    const provedor = criarProvedorParaTeste([]);
    const interno = prepararVerificacao(provedor, 214);

    await interno.verificarTentativaAtual(interno.tentativa.desafio!.challengeId, []);

    assert.strictEqual(interno.tentativa.avaliacao?.source, "sem-formas");
    assert.strictEqual(requisicoes.length, 0);
  });

  test("não reenvia uma página igual à da última correção e repete a nota", async () => {
    mockarConfiguracaoServidorValida();
    let correcoes = 0;
    mockarServidor({
      "POST /tipo-dinamica/treino/corrigir-formas": () => {
        correcoes++;
        return json({ pontuacao: 42.5 });
      },
    });
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste([], { registro });
    const interno = prepararVerificacao(provedor, 230);
    await registro.update(CHAVE_REGISTRO, {
      cod: 91,
      challengeId: interno.tentativa.desafio!.challengeId,
    });

    await interno.verificarTentativaAtual(interno.tentativa.desafio!.challengeId, FORMAS);
    await interno.verificarTentativaAtual(interno.tentativa.desafio!.challengeId, FORMAS);

    assert.strictEqual(correcoes, 1);
    assert.deepStrictEqual(interno.tentativa.avaliacao, {
      precision: 42.5,
      score: 42.5,
      source: "servidor",
      repetida: true,
    });

    // Uma forma diferente é outra página: volta ao servidor.
    await interno.verificarTentativaAtual(interno.tentativa.desafio!.challengeId, [
      { ...FORMAS[0], cor: "#123456" },
      FORMAS[1],
    ]);
    assert.strictEqual(correcoes, 2);
    assert.strictEqual(interno.tentativa.avaliacao?.repetida, undefined);
  });

  test("guarda as precisões do desafio para o histórico e a barra de status", async () => {
    mockarConfiguracaoServidorValida();
    const notas = [42.5, 80];
    mockarServidor({
      "POST /tipo-dinamica/treino/corrigir-formas": () =>
        json({ pontuacao: notas.shift() }),
    });
    const estadosBarra: (EstadoBarraDeStatus | undefined)[] = [];
    const barraDeStatus = {
      atualizar: (estado: EstadoBarraDeStatus | undefined) => estadosBarra.push(estado),
    } as unknown as BarraDeStatus;
    const registro = criarRegistroFalso();
    const mensagens: MensagemWebview[] = [];
    const provedor = criarProvedorParaTeste(mensagens, { registro, barraDeStatus });
    const interno = prepararVerificacao(provedor, 232);
    const id = interno.tentativa.desafio!.challengeId;
    await registro.update(CHAVE_REGISTRO, { cod: 91, challengeId: id });

    await interno.verificarTentativaAtual(id, FORMAS);
    // A mesma página não volta ao servidor nem conta como outra tentativa.
    await interno.verificarTentativaAtual(id, FORMAS);
    await interno.verificarTentativaAtual(id, [
      { ...FORMAS[0], cor: "#123456" },
      FORMAS[1],
    ]);

    assert.deepStrictEqual(ultimaMensagem(mensagens, "historicoNotas")?.payload, [42.5, 80]);
    assert.strictEqual(estadosBarra[estadosBarra.length - 1]?.precisao, 80);
    assert.strictEqual(estadosBarra[estadosBarra.length - 1]?.invalidado, false);

    interno.testarConexaoServidor = async () => undefined;
    await provedor.iniciarNovoDesafio();

    assert.deepStrictEqual(ultimaMensagem(mensagens, "historicoNotas")?.payload, []);
    assert.strictEqual(estadosBarra[estadosBarra.length - 1]?.precisao, undefined);
  });

  test("manda à barra e à aba o que corrigir em cada componente, junto com a nota", async () => {
    mockarConfiguracaoServidorValida();
    const registro = criarRegistroFalso();
    const mensagens: MensagemWebview[] = [];
    const provedor = criarProvedorParaTeste(mensagens, { registro });
    const interno = prepararVerificacao(provedor, 233);
    const desafio = interno.tentativa.desafio!;
    const { width, height, backgroundColor } = desafio;
    mockarServidor({
      "POST /tipo-dinamica/treino/corrigir-formas": () =>
        json({
          pontuacao: 30,
          detalhes: [
            {
              pares: [
                {
                  pontos: 0.8,
                  status: "0.80 pts (tam:1.00, dist:1.00, cor:0.00)",
                  forma_correta: true,
                  gabarito_forma: { x: width / 2, y: height / 2, width, height, cor: backgroundColor },
                  cliente_forma: { x: width / 2, y: height / 2, width, height, cor: "#ffffff" },
                },
              ],
              extras: [],
              nao_encontradas: desafio.blocks.map((_, indice) => indice + 1),
            },
          ],
        }),
    });
    await registro.update(CHAVE_REGISTRO, { cod: 91, challengeId: desafio.challengeId });

    await interno.verificarTentativaAtual(desafio.challengeId, FORMAS);

    const resultado = ultimaMensagem(mensagens, "resultadoAvaliacao")?.payload as {
      detalhes?: { componentes: { componente: unknown; problemas: unknown[] }[] };
      detalhesDoServidor?: unknown;
    };
    assert.strictEqual(resultado.detalhesDoServidor, undefined);
    assert.strictEqual(resultado.detalhes?.componentes.length, desafio.blocks.length + 1);
    assert.deepStrictEqual(resultado.detalhes?.componentes[0], {
      componente: "fundo",
      pontos: 0.8,
      problemas: [{ tipo: "cor", sua: "#ffffff", esperada: backgroundColor }],
    });
    assert.ok(
      resultado.detalhes?.componentes
        .slice(1)
        .every((item) => JSON.stringify(item.problemas) === '[{"tipo":"faltando"}]'),
    );
  });

  test("junta as teclas seguidas numa só atualização da página do aluno", async () => {
    const provedor = criarProvedorParaTeste([]);
    let atualizacoes = 0;
    provedor.atualizarPreviewWorkspace = async () => {
      atualizacoes++;
    };

    provedor.agendarAtualizacaoPreview();
    provedor.agendarAtualizacaoPreview();
    provedor.agendarAtualizacaoPreview();
    assert.strictEqual(atualizacoes, 0, "Não atualiza a cada tecla.");
    await new Promise((resolver) => setTimeout(resolver, 700));

    assert.strictEqual(atualizacoes, 1);
  });

  test("reenvia a mesma página depois de uma correção que falhou", async () => {
    mockarConfiguracaoServidorValida();
    let correcoes = 0;
    mockarServidor({
      "POST /tipo-dinamica/treino/corrigir-formas": () => {
        correcoes++;
        return correcoes === 1
          ? json({ detail: "Instável" }, 502)
          : json({ pontuacao: 80 });
      },
    });
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste([], { registro });
    const interno = prepararVerificacao(provedor, 231);
    await registro.update(CHAVE_REGISTRO, {
      cod: 91,
      challengeId: interno.tentativa.desafio!.challengeId,
    });

    await interno.verificarTentativaAtual(interno.tentativa.desafio!.challengeId, FORMAS);
    assert.strictEqual(interno.tentativa.avaliacao?.source, "api-error");
    await interno.verificarTentativaAtual(interno.tentativa.desafio!.challengeId, FORMAS);

    assert.strictEqual(correcoes, 2);
    assert.strictEqual(interno.tentativa.avaliacao?.precision, 80);
  });

  test("mostra as etapas e avisa a conclusão com o número da verificação", async () => {
    mockarConfiguracaoServidorValida();
    mockarServidor({
      "GET /tipo-dinamica/treino/gabaritos": () => json([]),
      "POST /tipo-dinamica/treino/gabarito": () => json({ cod: 91 }),
      [`GET /medidas-gabarito?gabarito=${NOME_GABARITO}`]: () => json({}),
      "POST /tipo-dinamica/treino/corrigir-formas": () => json({ pontuacao: 10 }),
    });
    const mensagens: MensagemWebview[] = [];
    const provedor = criarProvedorParaTeste(mensagens);
    const interno = prepararVerificacao(provedor, 232);

    await interno.verificarTentativaAtual(
      interno.tentativa.desafio!.challengeId,
      FORMAS,
      7,
    );

    const verificacao = mensagens.filter((mensagem) =>
      ["progressoVerificacao", "resultadoAvaliacao", "verificacaoConcluida"].includes(
        mensagem.type,
      ),
    );
    assert.deepStrictEqual(
      verificacao.map((mensagem) => mensagem.type),
      [
        "progressoVerificacao",
        "progressoVerificacao",
        "resultadoAvaliacao",
        "verificacaoConcluida",
      ],
    );
    assert.deepStrictEqual(verificacao[0].payload, {
      id: 7,
      mensagem: "Enviando o gabarito…",
    });
    assert.deepStrictEqual(verificacao[1].payload, {
      id: 7,
      mensagem: "Corrigindo no servidor…",
    });
    assert.deepStrictEqual(verificacao[3].payload, { id: 7, mensagem: undefined });
  });

  test("avisa a conclusão mesmo quando a verificação para no meio", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes = mockarServidor({});
    const mensagens: MensagemWebview[] = [];
    const provedor = criarProvedorParaTeste(mensagens);
    const interno = prepararVerificacao(provedor, 233);
    // Desafio de outra geração: a verificação nem começa.
    await interno.verificarTentativaAtual("desafio-antigo", FORMAS, 9);

    assert.strictEqual(requisicoes.length, 0);
    assert.deepStrictEqual(ultimaMensagem(mensagens, "verificacaoConcluida")?.payload, {
      id: 9,
      mensagem: undefined,
    });
  });

  test("não cria nota local quando corrigir-formas responde sem precisão", async () => {
    mockarConfiguracaoServidorValida();
    mockarServidor({
      "POST /tipo-dinamica/treino/corrigir-formas": () =>
        json({ message: "Correção registrada." }),
    });
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste([], { registro });
    const interno = prepararVerificacao(provedor, 216);
    await registro.update(CHAVE_REGISTRO, {
      cod: 91,
      challengeId: interno.tentativa.desafio!.challengeId,
    });

    await interno.verificarTentativaAtual(
      interno.tentativa.desafio!.challengeId,
      FORMAS,
    );

    assert.deepStrictEqual(interno.tentativa.avaliacao, {
      precision: 0,
      score: 0,
      source: "servidor-sem-nota",
      error: "Correção registrada.",
    });
  });

  test("descarta a resposta de uma verificação pertencente ao desafio anterior", async () => {
    mockarConfiguracaoServidorValida();

    let liberarResposta!: (resposta: Response) => void;
    let sinalizarFetchIniciado!: () => void;
    const respostaPendente = new Promise<Response>((resolver) => {
      liberarResposta = resolver;
    });
    const fetchIniciado = new Promise<void>((resolver) => {
      sinalizarFetchIniciado = resolver;
    });
    globalThis.fetch = async () => {
      sinalizarFetchIniciado();
      return respostaPendente;
    };

    const mensagens: MensagemWebview[] = [];
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste(mensagens, { registro });
    const interno = prepararVerificacao(provedor, 303);
    const challengeIdAnterior = interno.tentativa.desafio!.challengeId;
    await registro.update(CHAVE_REGISTRO, {
      cod: 91,
      challengeId: challengeIdAnterior,
    });

    const verificacaoPendente = interno.verificarTentativaAtual(
      challengeIdAnterior,
      FORMAS,
    );
    await fetchIniciado;

    interno.testarConexaoServidor = async () => undefined;
    await provedor.iniciarNovoDesafio();
    assert.notStrictEqual(
      interno.tentativa.desafio?.challengeId,
      challengeIdAnterior,
    );

    liberarResposta(
      new Response(JSON.stringify({ pontuacao: 42 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await verificacaoPendente;

    assert.strictEqual(
      interno.tentativa.avaliacao,
      undefined,
      "Uma resposta atrasada não deve avaliar o novo desafio.",
    );
    assert.strictEqual(
      mensagens.filter((mensagem) => mensagem.type === "resultadoAvaliacao")
        .length,
      0,
      "A resposta atrasada não deve ser enviada à webview.",
    );
  });
});
