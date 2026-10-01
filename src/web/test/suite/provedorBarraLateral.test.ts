import * as assert from "assert";
import * as vscode from "vscode";
import { AuthService } from "../../auth/authService";
import { ProvedorBarraLateralFlexBox } from "../../provider/provedor-barra-lateral";
import { criarDesafioGerado } from "../../services/desafio";
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
  ): Promise<void>;
  testarConexaoServidor(): Promise<void>;
  lerConfiguracaoServidorAtual(): ConfiguracaoServidor;
};

type OpcoesProvedorTeste = {
  invalidacoes?: string[];
  serverToken?: string;
  userId?: number;
  teamId?: number;
  registro?: vscode.Memento;
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
    id: "1",
    tipo: "retangulo",
    x: 0,
    y: 0,
    width: 800,
    height: 200,
    cor: "#ff0000",
  },
  {
    id: "2",
    tipo: "circulo",
    x: 40,
    y: 20,
    width: 160,
    height: 160,
    cor: "#00ff00",
  },
];

suite("Provedor da barra lateral", () => {
  const dateNowOriginal = Date.now;
  const fetchOriginal = globalThis.fetch;
  const getConfigurationOriginal = vscode.workspace.getConfiguration;

  teardown(() => {
    Date.now = dateNowOriginal;
    globalThis.fetch = fetchOriginal;
    vscode.workspace.getConfiguration = getConfigurationOriginal;
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
        return json({ resultado: { pontuacao: 73.25 } });
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
    assert.deepStrictEqual(corpoCorrecao, {
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
      "POST /tipo-dinamica/treino/corrigir-formas": () => json({ nota: 88 }),
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
      "POST /tipo-dinamica/treino/corrigir-formas": () => json({ nota: 50 }),
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

  test("permite forçar os IDs das configurações quando o override está ligado", () => {
    mockarConfiguracaoServidorValida({ usarIdsDasConfiguracoes: true });

    // Cenário real: /auth/me devolveu um id do provedor OAuth que não existe
    // na tabela `usuarios` do servidor.
    const provedor = criarProvedorParaTeste([], {
      serverToken: "token-autenticado",
      userId: 176078921,
      teamId: 46,
    });
    const interno = provedor as unknown as ProvedorInterno;
    const configuracao = interno.lerConfiguracaoServidorAtual();

    assert.strictEqual(configuracao.userId, 7);
    assert.strictEqual(configuracao.teamId, 42);
  });

  test("mantém os IDs da sessão quando o override está desligado", () => {
    mockarConfiguracaoServidorValida();

    const provedor = criarProvedorParaTeste([], {
      serverToken: "token-autenticado",
      userId: 176078921,
      teamId: 46,
    });
    const interno = provedor as unknown as ProvedorInterno;
    const configuracao = interno.lerConfiguracaoServidorAtual();

    assert.strictEqual(configuracao.userId, 176078921);
    assert.strictEqual(configuracao.teamId, 46);
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
      new Response(JSON.stringify({ nota: 42 }), {
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
        dinamicaId: "gref",
        eventoTreino: "treino",
        userId: 7,
        teamId: 42,
        captureWidth: 960,
        captureHeight: 540,
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
