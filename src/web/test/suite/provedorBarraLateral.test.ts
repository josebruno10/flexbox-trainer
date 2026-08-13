import * as assert from "assert";
import * as vscode from "vscode";
import { AuthService } from "../../auth/authService";
import { ProvedorBarraLateralFlexBox } from "../../provider/provedor-barra-lateral";
import { criarDesafioGerado } from "../../services/desafio";
import {
  Desafio,
  EstadoAutenticacao,
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
  codigoPastaAluno?: string;
  preparandoPasta: Promise<void>;
  enviarEstado(): void;
  encerrarDesafioAtual(): void;
  verificarTentativaAtual(challengeId: string): Promise<void>;
  prepararPastaDoAluno(): Promise<void>;
  testarConexaoServidor(): Promise<void>;
};

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

    interno.prepararPastaDoAluno = async () => undefined;
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

  test("usa exclusivamente a nota retornada por salvar-conteudo", async () => {
    mockarConfiguracaoServidorValida();
    globalThis.fetch = async (input, init) => {
      assert.strictEqual(
        String(input),
        "https://api.teste.com/api/salvar-conteudo",
      );
      assert.strictEqual(
        (init?.headers as Record<string, string>).Authorization,
        "Bearer token-servidor",
      );
      return new Response(JSON.stringify({ nota: 73.25 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const mensagens: MensagemWebview[] = [];
    const provedor = criarProvedorParaTeste(mensagens);
    const interno = provedor as unknown as ProvedorInterno;
    interno.desafioAtual = criarDesafioGerado({
      aleatorio: criarAleatorioTeste(202),
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
    interno.codigoPastaAluno = "gref_2/46_74";
    interno.preparandoPasta = Promise.resolve();

    await interno.verificarTentativaAtual(interno.desafioAtual.challengeId);

    assert.deepStrictEqual(interno.avaliacaoAtual, {
      precision: 73.25,
      score: 73.25,
      source: "servidor",
    });
    assert.deepStrictEqual(
      ultimaMensagem(mensagens, "resultadoAvaliacao")?.payload,
      interno.avaliacaoAtual,
    );
  });

  test("não cria nota local quando salvar-conteudo responde sem precisão", async () => {
    mockarConfiguracaoServidorValida();
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: "Conteúdo salvo com sucesso." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const mensagens: MensagemWebview[] = [];
    const provedor = criarProvedorParaTeste(mensagens);
    const interno = provedor as unknown as ProvedorInterno;
    interno.desafioAtual = criarDesafioGerado({
      aleatorio: criarAleatorioTeste(212),
    });
    interno.resumoWorkspaceAtual = {
      caminhoHtml: "/projeto/index.html",
      caminhoCss: "/projeto/style.css",
      textoHtml: "<main></main>",
      textoCss: "main { display: flex; }",
      htmlPreview: "<main></main>",
      temArquivoHtml: true,
      temArquivoCss: true,
    };
    interno.codigoPastaAluno = "gref_2/46_74";
    interno.preparandoPasta = Promise.resolve();

    await interno.verificarTentativaAtual(interno.desafioAtual.challengeId);

    assert.deepStrictEqual(interno.avaliacaoAtual, {
      precision: 0,
      score: 0,
      source: "servidor-sem-nota",
      error: "Conteúdo salvo com sucesso.",
    });
  });

  test("invalida a sessão quando salvar-conteudo retorna 401", async () => {
    mockarConfiguracaoServidorValida();
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ detail: "Token expirado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });

    const mensagens: MensagemWebview[] = [];
    const invalidacoes: string[] = [];
    const provedor = criarProvedorParaTeste(mensagens, (mensagem) => {
      invalidacoes.push(mensagem);
    });
    const interno = provedor as unknown as ProvedorInterno;
    interno.desafioAtual = criarDesafioGerado({
      aleatorio: criarAleatorioTeste(222),
    });
    interno.resumoWorkspaceAtual = {
      caminhoHtml: "/projeto/index.html",
      caminhoCss: "/projeto/style.css",
      textoHtml: "<main></main>",
      textoCss: "main { display: flex; }",
      htmlPreview: "<main></main>",
      temArquivoHtml: true,
      temArquivoCss: true,
    };
    interno.codigoPastaAluno = "gref_2/46_74";
    interno.preparandoPasta = Promise.resolve();

    await interno.verificarTentativaAtual(interno.desafioAtual.challengeId);

    assert.strictEqual(interno.avaliacaoAtual?.source, "authentication-error");
    assert.strictEqual(interno.avaliacaoAtual?.httpStatus, 401);
    assert.deepStrictEqual(invalidacoes, [
      "O servidor recusou a sessão. Entre novamente com o Google.",
    ]);
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
    const provedor = criarProvedorParaTeste(mensagens);
    const interno = provedor as unknown as ProvedorInterno;
    interno.desafioAtual = criarDesafioGerado({
      aleatorio: criarAleatorioTeste(303),
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
    interno.codigoPastaAluno = "gref_2/46_74";
    interno.preparandoPasta = Promise.resolve();
    const challengeIdAnterior = interno.desafioAtual.challengeId;

    const verificacaoPendente =
      interno.verificarTentativaAtual(challengeIdAnterior);
    await fetchIniciado;

    interno.prepararPastaDoAluno = async () => undefined;
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
  aoInvalidarSessao: (mensagem: string) => void = () => undefined,
): ProvedorBarraLateralFlexBox {
  const estado: EstadoAutenticacao = {
    status: "authenticated",
    displayName: "Aluno de teste",
  };
  const authService = {
    getEstadoAtual: () => estado,
    onDidChangeEstado: () => ({ dispose: () => undefined }),
    isAutenticado: () => true,
    getAccessToken: () => "token-servidor",
    getSessaoAtual: () => ({
      accessToken: "token-servidor",
      displayName: "Aluno de teste",
      userId: 74,
      teamId: 46,
    }),
    invalidarSessao: async (mensagem: string) => {
      aoInvalidarSessao(mensagem);
    },
  } as unknown as AuthService;
  const provedor = new ProvedorBarraLateralFlexBox(
    vscode.Uri.parse("file:///extensao"),
    authService,
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

function mockarConfiguracaoServidorValida(): void {
  vscode.workspace.getConfiguration = ((section: string) => ({
    get: <T>(key: string, defaultValue?: T): T => {
      if (section !== "flexboxTrainer") {
        return defaultValue as T;
      }

      const valores: Record<string, unknown> = {
        apiBaseUrl: "https://api.teste.com/api",
        dinamicaId: "gref",
        userId: 74,
        teamId: 46,
        captureWidth: 960,
        captureHeight: 540,
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
