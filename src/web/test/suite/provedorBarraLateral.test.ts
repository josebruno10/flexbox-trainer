import * as assert from "assert";
import * as vscode from "vscode";
import { AuthService } from "../../auth/authService";
import {
  BarraDeStatus,
  EstadoBarraDeStatus,
} from "../../provider/barra-de-status";
import { ProvedorBarraLateralFlexBox } from "../../provider/provedor-barra-lateral";
import { criarDesafioGerado } from "../../services/desafio";
import { modeloCss, modeloHtml } from "../../services/workspace";
import {
  ConfiguracaoServidor,
  Desafio,
  EstadoAutenticacao,
  FormaMedida,
  GabaritoGerado,
  ResultadoAvaliacao,
  ResumoWorkspace,
} from "../../types";

type MensagemWebview = {
  type: string;
  payload?: unknown;
};

type ProvedorInterno = {
  visualizacaoWebview?: vscode.WebviewView;
  desafioAtual?: Desafio;
  resumoWorkspaceAtual: ResumoWorkspace;
  avaliacaoAtual?: ResultadoAvaliacao;
  inicioTentativaMs: number;
  fimTentativaMs?: number;
  gabaritoAtual?: GabaritoGerado;
  enviarEstado(): void;
  encerrarDesafioAtual(): void;
  verificarTentativaAtual(
    challengeId: string,
    formas: FormaMedida[],
    verificacaoId?: number,
  ): Promise<void>;
  testarConexaoServidor(): Promise<unknown>;
  lerArquivosDoAluno(): Promise<ResumoWorkspace>;
  limparArquivosDoAluno(largura: number, altura: number): Promise<void>;
  lerConfiguracaoServidorAtual(): ConfiguracaoServidor;
};

type OpcoesProvedorTeste = {
  invalidacoes?: string[];
  serverToken?: string;
  userId?: number;
  teamId?: number;
  registro?: vscode.Memento;
  extensoesIa?: { id: string; nome: string }[];
  barraDeStatus?: BarraDeStatus;
};

type Requisicao = {
  metodo: string;
  caminho: string;
  corpo?: BodyInit | null;
};

const BASE_API = "https://api.teste.com/api";
const CHAVE_REGISTRO = `flexboxTrainer.gabaritoTreino|${BASE_API}|treino|800x800`;
const NOME_GABARITO = "gab_treino_tam_800x800.png";
const FORMAS: FormaMedida[] = [
  {
    id: "forma_1",
    tipo: "retangulo_deitado",
    x: 400,
    y: 100,
    width: 800,
    height: 200,
    area: 160000,
    cor: "#ff0000",
  },
  {
    id: "forma_2",
    tipo: "circulo",
    x: 120,
    y: 100,
    width: 160,
    height: 160,
    area: 20106,
    cor: "#00ff00",
  },
];

suite("Provedor da barra lateral", () => {
  const dateNowOriginal = Date.now;
  const fetchOriginal = globalThis.fetch;
  const getConfigurationOriginal = vscode.workspace.getConfiguration;

  const showInformationMessageOriginal = vscode.window.showInformationMessage;
  const showWarningMessageOriginal = vscode.window.showWarningMessage;
  const executeCommandOriginal = vscode.commands.executeCommand;

  teardown(() => {
    Date.now = dateNowOriginal;
    globalThis.fetch = fetchOriginal;
    vscode.workspace.getConfiguration = getConfigurationOriginal;
    vscode.window.showInformationMessage = showInformationMessageOriginal;
    vscode.window.showWarningMessage = showWarningMessageOriginal;
    vscode.commands.executeCommand = executeCommandOriginal;
  });

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
      challengeId: interno.desafioAtual!.challengeId,
    });

    await interno.verificarTentativaAtual(
      interno.desafioAtual!.challengeId,
      FORMAS,
    );

    assert.deepStrictEqual(comandos, ["flexbox-trainer.criarDinamicaTreino"]);
    assert.strictEqual(interno.avaliacaoAtual?.precision, 64);
  });

  test("não envia uma página sem formas medidas", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes = mockarServidor({});
    const provedor = criarProvedorParaTeste([]);
    const interno = prepararVerificacao(provedor, 214);

    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, []);

    assert.strictEqual(interno.avaliacaoAtual?.source, "sem-formas");
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
      challengeId: interno.desafioAtual!.challengeId,
    });

    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, FORMAS);
    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, FORMAS);

    assert.strictEqual(correcoes, 1);
    assert.deepStrictEqual(interno.avaliacaoAtual, {
      precision: 42.5,
      score: 42.5,
      source: "servidor",
      repetida: true,
    });

    // Uma forma diferente é outra página: volta ao servidor.
    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, [
      { ...FORMAS[0], cor: "#123456" },
      FORMAS[1],
    ]);
    assert.strictEqual(correcoes, 2);
    assert.strictEqual(interno.avaliacaoAtual?.repetida, undefined);
  });

  suite("Arquivos do desafio anterior", () => {
    const comTrabalho: ResumoWorkspace = {
      caminhoHtml: "/projeto/index.html",
      caminhoCss: "/projeto/style.css",
      textoHtml: modeloHtml().replace("<body>", "<body><main></main>"),
      textoCss: `${modeloCss(800, 800)}\nmain { display: flex; }`,
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
      const limpezas: { largura: number; altura: number; instante: number }[] = [];
      interno.lerArquivosDoAluno = async () => arquivos;
      interno.limparArquivosDoAluno = async (largura, altura) => {
        limpezas.push({ largura, altura, instante: Date.now() });
      };
      interno.testarConexaoServidor = async () => undefined;
      return { provedor, interno, perguntas, limpezas };
    }

    test("pede confirmação, limpa os arquivos e só então começa a contar o tempo", async () => {
      const { provedor, interno, perguntas, limpezas } = preparar(comTrabalho, "Limpar e gerar");

      await provedor.iniciarNovoDesafio();

      assert.strictEqual(perguntas.length, 1);
      assert.match(perguntas[0], /apaga o que você escreveu/);
      assert.deepStrictEqual(
        limpezas.map(({ largura, altura }) => [largura, altura]),
        [[interno.desafioAtual!.width, interno.desafioAtual!.height]],
      );
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
        textoCss: modeloCss(800, 800),
      };
      const { provedor, interno, perguntas, limpezas } = preparar(base, undefined);

      await provedor.iniciarNovoDesafio();

      assert.deepStrictEqual(perguntas, []);
      assert.deepStrictEqual(limpezas, []);
      assert.ok(interno.desafioAtual);
    });
  });

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
    const id = interno.desafioAtual!.challengeId;
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
      challengeId: interno.desafioAtual!.challengeId,
    });

    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, FORMAS);
    assert.strictEqual(interno.avaliacaoAtual?.source, "api-error");
    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, FORMAS);

    assert.strictEqual(correcoes, 2);
    assert.strictEqual(interno.avaliacaoAtual?.precision, 80);
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
      interno.desafioAtual!.challengeId,
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

  test("invalida o desafio quando há extensões de IA habilitadas na hora de verificar", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes = mockarServidor({});
    const mensagens: MensagemWebview[] = [];
    const provedor = criarProvedorParaTeste(mensagens, {
      extensoesIa: [
        { id: "anthropic.claude-code", nome: "Claude Code" },
        { id: "openai.chatgpt", nome: "Codex" },
      ],
    });
    const interno = prepararVerificacao(provedor, 240);

    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, FORMAS);

    assert.strictEqual(requisicoes.length, 0);
    assert.strictEqual(interno.avaliacaoAtual?.source, "desafio-invalidado");
    assert.match(
      interno.avaliacaoAtual?.error ?? "",
      /extensões de IA ficaram habilitadas durante ele \(Claude Code, Codex\)\./,
    );
    assert.deepStrictEqual(ultimaMensagem(mensagens, "extensoesIa")?.payload, [
      { id: "anthropic.claude-code", nome: "Claude Code" },
      { id: "openai.chatgpt", nome: "Codex" },
    ]);
  });

  test("não começa um desafio com extensões de IA habilitadas", async () => {
    const avisos: string[] = [];
    vscode.window.showWarningMessage = (async (mensagem: string) => {
      avisos.push(mensagem);
      return undefined;
    }) as unknown as typeof vscode.window.showWarningMessage;
    const mensagens: MensagemWebview[] = [];
    const provedor = criarProvedorParaTeste(mensagens, {
      extensoesIa: [{ id: "github.copilot-chat", nome: "GitHub Copilot" }],
    });
    const interno = provedor as unknown as ProvedorInterno;

    await provedor.iniciarNovoDesafio();

    assert.strictEqual(interno.desafioAtual, undefined);
    assert.strictEqual(ultimaMensagem(mensagens, "dadosDesafio"), undefined);
    assert.match(
      avisos[0] ?? "",
      /Desabilite as extensões de IA para começar: GitHub Copilot\./,
    );
  });

  test("continua invalidado o desafio em que a IA foi habilitada, mesmo depois de desabilitá-la", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes = mockarServidor({});
    const opcoes: OpcoesProvedorTeste = { extensoesIa: [] };
    const provedor = criarProvedorParaTeste([], opcoes);
    const interno = prepararVerificacao(provedor, 241);

    opcoes.extensoesIa = [{ id: "anthropic.claude-code", nome: "Claude Code" }];
    provedor.atualizarExtensoesIa();
    opcoes.extensoesIa = [];
    provedor.atualizarExtensoesIa();
    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, FORMAS);

    assert.strictEqual(requisicoes.length, 0);
    assert.strictEqual(interno.avaliacaoAtual?.source, "desafio-invalidado");
    assert.match(
      interno.avaliacaoAtual?.error ?? "",
      /uma extensão de IA ficou habilitada durante ele \(Claude Code\)\./,
    );
  });

  test("invalida o desafio quando um arquivo de treino muda fora do editor", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes = mockarServidor({});
    const provedor = criarProvedorParaTeste([]);
    const interno = prepararVerificacao(provedor, 242);
    // Sem pasta aberta nos testes: mantém os arquivos de treino preparados.
    provedor.atualizarPreviewWorkspace = async () => undefined;
    const agora = Date.now();

    // Outro arquivo com o mesmo nome e uma mudança de antes do desafio não contam.
    await provedor.registrarAlteracaoExterna({
      uri: vscode.Uri.file("/outro-projeto/style.css"),
      instante: agora,
    });
    await provedor.registrarAlteracaoExterna({
      uri: vscode.Uri.file("/projeto/style.css"),
      instante: interno.inicioTentativaMs - 1,
    });
    const avaliacaoAntes = interno.avaliacaoAtual;
    assert.strictEqual(avaliacaoAntes, undefined);

    await provedor.registrarAlteracaoExterna({
      uri: vscode.Uri.file("/projeto/style.css"),
      instante: agora,
    });
    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, FORMAS);

    assert.strictEqual(requisicoes.length, 0);
    assert.strictEqual(interno.avaliacaoAtual?.source, "desafio-invalidado");
    assert.match(
      interno.avaliacaoAtual?.error ?? "",
      /o style\.css foi alterado fora do editor\./,
    );
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
      challengeId: interno.desafioAtual!.challengeId,
    });

    await interno.verificarTentativaAtual(
      interno.desafioAtual!.challengeId,
      FORMAS,
    );

    assert.deepStrictEqual(interno.avaliacaoAtual, {
      precision: 0,
      score: 0,
      source: "servidor-sem-nota",
      error: "Correção registrada.",
    });
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
    const challengeIdAnterior = interno.desafioAtual!.challengeId;
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
      interno.desafioAtual?.challengeId,
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
      interno.avaliacaoAtual,
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

function criarProvedorParaTeste(
  mensagens: MensagemWebview[],
  opcoes: OpcoesProvedorTeste = {},
): ProvedorBarraLateralFlexBox {
  const estado: EstadoAutenticacao = {
    status: "authenticated",
    displayName: "Aluno de teste",
  };
  const authService = {
    getEstadoAtual: () => estado,
    onDidChangeEstado: () => ({ dispose: () => undefined }),
    isAutenticado: () => true,
    getAccessToken: () => opcoes.serverToken ?? "token-da-sessao",
    getSessaoAtual: () => ({
      displayName: "Aluno de teste",
      email: "aluno@teste.com",
      tokenGmail: "token-google",
      userId: opcoes.userId ?? 74,
      teamId: opcoes.teamId ?? 46,
    }),
    invalidarSessao: async (mensagem: string) => {
      opcoes.invalidacoes?.push(mensagem);
    },
  } as unknown as AuthService;
  const provedor = new ProvedorBarraLateralFlexBox(
    vscode.Uri.parse("file:///extensao"),
    authService,
    opcoes.registro ?? criarRegistroFalso(),
    () => opcoes.extensoesIa ?? [],
    opcoes.barraDeStatus,
  );
  const interno = provedor as unknown as ProvedorInterno;

  interno.visualizacaoWebview = {
    webview: {
      postMessage: async (mensagem: MensagemWebview) => {
        mensagens.push(mensagem);
        return true;
      },
    },
  } as unknown as vscode.WebviewView;

  return provedor;
}

function ultimoEstadoDesafio(
  mensagens: MensagemWebview[],
): { tempoAtualMs: number; encerrado: boolean } | undefined {
  const mensagem = ultimaMensagem(mensagens, "dadosDesafio");
  if (!mensagem?.payload || typeof mensagem.payload !== "object") {
    return undefined;
  }

  const payload = mensagem.payload as {
    tempoAtualMs: number;
    encerrado: boolean;
  };
  return {
    tempoAtualMs: payload.tempoAtualMs,
    encerrado: payload.encerrado,
  };
}

function ultimaMensagem(
  mensagens: MensagemWebview[],
  tipo: string,
): MensagemWebview | undefined {
  return [...mensagens].reverse().find((mensagem) => mensagem.type === tipo);
}

function mockarConfiguracaoServidorValida(
  extras: Record<string, unknown> = {},
): void {
  vscode.workspace.getConfiguration = ((section: string) => ({
    get: <T>(key: string, defaultValue?: T): T => {
      if (section !== "flexboxTrainer") {
        return defaultValue as T;
      }

      const valores: Record<string, unknown> = {
        apiBaseUrl: BASE_API,
        apiToken: "token-das-configuracoes",
        eventoTreino: "treino",
        ...extras,
      };
      return (valores[key] ?? defaultValue) as T;
    },
  })) as typeof vscode.workspace.getConfiguration;
}

function criarAleatorioTeste(caso: number): () => number {
  let estado = caso >>> 0;

  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let valor = estado;
    valor = Math.imul(valor ^ (valor >>> 15), valor | 1);
    valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61);
    return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296;
  };
}

// Desafio atual com arquivos e imagem do gabarito já prontos para verificar.
function prepararVerificacao(
  provedor: ProvedorBarraLateralFlexBox,
  semente: number,
): ProvedorInterno {
  const interno = provedor as unknown as ProvedorInterno;
  interno.desafioAtual = criarDesafioGerado({
    aleatorio: criarAleatorioTeste(semente),
  });
  interno.resumoWorkspaceAtual = {
    caminhoHtml: "/projeto/index.html",
    caminhoCss: "/projeto/style.css",
    textoHtml: "<main></main>",
    textoCss: "main { display: flex; }",
    htmlPreview: "<!doctype html><style>main { display: flex; }</style><main></main>",
    temArquivoHtml: true,
    temArquivoCss: true,
  };
  interno.gabaritoAtual = {
    challengeId: interno.desafioAtual.challengeId,
    // Assinatura PNG: basta para montar o arquivo do formulário.
    imagemDataUrl: "data:image/png;base64,iVBORw0KGgo=",
    width: interno.desafioAtual.width,
    height: interno.desafioAtual.height,
  };
  return interno;
}

function mockarServidor(
  rotas: Record<string, (init?: RequestInit) => Response>,
): Requisicao[] {
  const requisicoes: Requisicao[] = [];

  globalThis.fetch = async (input, init) => {
    const metodo = init?.method ?? "GET";
    const caminho = String(input).replace(BASE_API, "");
    requisicoes.push({ metodo, caminho, corpo: init?.body });
    const rota = rotas[`${metodo} ${caminho}`];

    if (!rota) {
      throw new Error(`Requisição inesperada: ${metodo} ${caminho}`);
    }

    return rota(init);
  };

  return requisicoes;
}

function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function criarRegistroFalso(): vscode.Memento {
  const valores = new Map<string, unknown>();

  return {
    keys: () => Array.from(valores.keys()),
    get: <T>(chave: string, padrao?: T) =>
      (valores.has(chave) ? valores.get(chave) : padrao) as T,
    update: async (chave: string, valor: unknown) => {
      valores.set(chave, valor);
    },
  } as vscode.Memento;
}
