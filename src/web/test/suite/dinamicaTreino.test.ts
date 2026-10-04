import * as assert from "assert";
import * as vscode from "vscode";
import { AuthService } from "../../auth/authService";
import { criarDinamicaTreinoInterativa } from "../../services/dinamicaTreino";

type Requisicao = {
  metodo: string;
  caminho: string;
  corpo?: BodyInit | null;
  cabecalhos?: Record<string, string>;
};

type Atualizacao = {
  chave: string;
  valor: unknown;
  alvo: vscode.ConfigurationTarget | boolean | null | undefined;
};

const BASE_API = "https://api.teste.com/api";

suite("Criação da dinâmica de treino", () => {
  const fetchOriginal = globalThis.fetch;
  const getConfigurationOriginal = vscode.workspace.getConfiguration;
  const showInputBoxOriginal = vscode.window.showInputBox;
  const showWarningMessageOriginal = vscode.window.showWarningMessage;
  const showInformationMessageOriginal = vscode.window.showInformationMessage;
  const showErrorMessageOriginal = vscode.window.showErrorMessage;

  let valoresConfiguracao: Record<string, unknown>;
  let atualizacoes: Atualizacao[];
  let avisos: string[];
  let informacoes: string[];
  let erros: string[];
  let opcoesDoCampo: vscode.InputBoxOptions | undefined;

  setup(() => {
    valoresConfiguracao = { apiBaseUrl: BASE_API };
    atualizacoes = [];
    avisos = [];
    informacoes = [];
    erros = [];
    opcoesDoCampo = undefined;

    vscode.workspace.getConfiguration = ((section?: string) => ({
      get: <T>(chave: string, padrao?: T): T =>
        (section === "flexboxTrainer" && chave in valoresConfiguracao
          ? valoresConfiguracao[chave]
          : padrao) as T,
      update: async (
        chave: string,
        valor: unknown,
        alvo?: vscode.ConfigurationTarget | boolean | null,
      ) => {
        atualizacoes.push({ chave, valor, alvo });
      },
    })) as unknown as typeof vscode.workspace.getConfiguration;
    vscode.window.showInputBox = (async (opcoes?: vscode.InputBoxOptions) => {
      opcoesDoCampo = opcoes;
      return opcoes?.value;
    }) as typeof vscode.window.showInputBox;
    responderConfirmacao("Criar");
    vscode.window.showInformationMessage = (async (mensagem: string) => {
      informacoes.push(mensagem);
      return undefined;
    }) as typeof vscode.window.showInformationMessage;
    vscode.window.showErrorMessage = (async (mensagem: string) => {
      erros.push(mensagem);
      return undefined;
    }) as typeof vscode.window.showErrorMessage;
  });

  teardown(() => {
    globalThis.fetch = fetchOriginal;
    vscode.workspace.getConfiguration = getConfigurationOriginal;
    vscode.window.showInputBox = showInputBoxOriginal;
    vscode.window.showWarningMessage = showWarningMessageOriginal;
    vscode.window.showInformationMessage = showInformationMessageOriginal;
    vscode.window.showErrorMessage = showErrorMessageOriginal;
  });

  function responderConfirmacao(resposta: string | undefined): void {
    vscode.window.showWarningMessage = (async (
      mensagem: string,
      ...itens: unknown[]
    ) => {
      avisos.push(mensagem);
      return itens.includes("Criar") ? resposta : undefined;
    }) as typeof vscode.window.showWarningMessage;
  }

  test("cria, abre e grava o código da dinâmica na configuração", async () => {
    let formularioCriacao: URLSearchParams | undefined;
    let formularioStatus: URLSearchParams | undefined;
    const requisicoes = mockarServidor({
      // Resposta real do servidor para um código que não existe.
      "GET /tipoDinamica/fb74": () =>
        json(
          { detail: "Erro ao obter tipo de dinâmica: 404: Evento não encontrado." },
          500,
        ),
      "POST /tipoDinamica": (requisicao) => {
        formularioCriacao = new URLSearchParams(String(requisicao.corpo));
        return json({ message: "Dinâmica criada" });
      },
      "GET /tipo-dinamica/fb74/status": () => json({ status: false }),
      "PUT /tipo-dinamica/fb74/status": (requisicao) => {
        formularioStatus = new URLSearchParams(String(requisicao.corpo));
        return json({ status: true });
      },
    });

    await criarDinamicaTreinoInterativa(criarAuthService());

    assert.strictEqual(opcoesDoCampo?.value, "fb74");
    assert.ok(opcoesDoCampo?.validateInput?.("Treino_1"));
    // O banco aceita no máximo 4 caracteres no código do evento.
    assert.ok(opcoesDoCampo?.validateInput?.("fbtreino74"));
    assert.strictEqual(opcoesDoCampo?.validateInput?.("fb74"), undefined);
    assert.deepStrictEqual(Object.fromEntries(formularioCriacao ?? []), {
      evento: "fb74",
      tipo: "2",
      config_correcao: "1",
    });
    assert.strictEqual(formularioStatus?.get("status"), "true");
    const criacao = requisicoes.find((r) => r.metodo === "POST");
    assert.strictEqual(
      criacao?.cabecalhos?.["Content-Type"],
      "application/x-www-form-urlencoded",
    );
    assert.strictEqual(
      criacao?.cabecalhos?.Authorization,
      "Bearer token-da-sessao",
    );
    assert.deepStrictEqual(atualizacoes, [
      {
        chave: "eventoTreino",
        valor: "fb74",
        alvo: vscode.ConfigurationTarget.Global,
      },
    ]);
    assert.match(informacoes[0] ?? "", /fb74/);
    assert.deepStrictEqual(erros, []);
  });

  test("sugere o código com o ID das configurações quando o override está ligado", async () => {
    valoresConfiguracao.usarIdsDasConfiguracoes = true;
    valoresConfiguracao.userId = 74;
    vscode.window.showInputBox = (async (opcoes?: vscode.InputBoxOptions) => {
      opcoesDoCampo = opcoes;
      return undefined;
    }) as typeof vscode.window.showInputBox;
    const requisicoes = mockarServidor({});

    await criarDinamicaTreinoInterativa(criarAuthService(true, 176078921));

    assert.strictEqual(opcoesDoCampo?.value, "fb74");
    assert.strictEqual(requisicoes.length, 0);
  });

  test("sugere um código de até 4 caracteres para IDs longos", async () => {
    vscode.window.showInputBox = (async (opcoes?: vscode.InputBoxOptions) => {
      opcoesDoCampo = opcoes;
      return undefined;
    }) as typeof vscode.window.showInputBox;
    mockarServidor({});

    await criarDinamicaTreinoInterativa(criarAuthService(true, 176078921));

    assert.strictEqual(opcoesDoCampo?.value, "f921");
  });

  test("para quando a consulta falha por outro motivo", async () => {
    const requisicoes = mockarServidor({
      "GET /tipoDinamica/fb74": () => json({ detail: "Erro interno" }, 500),
    });

    await criarDinamicaTreinoInterativa(criarAuthService());

    assert.strictEqual(requisicoes.length, 1);
    assert.match(erros[0] ?? "", /HTTP 500/);
    assert.deepStrictEqual(atualizacoes, []);
  });

  test("não altera uma dinâmica que já existe", async () => {
    const requisicoes = mockarServidor({
      "GET /tipoDinamica/fb74": () => json({ evento: "fb74", tipo: 2 }),
    });

    await criarDinamicaTreinoInterativa(criarAuthService());

    assert.deepStrictEqual(
      requisicoes.map((r) => `${r.metodo} ${r.caminho}`),
      ["GET /tipoDinamica/fb74"],
    );
    assert.match(avisos[0] ?? "", /Já existe/);
    assert.deepStrictEqual(atualizacoes, []);
  });

  test("não cria nada quando a confirmação é cancelada", async () => {
    responderConfirmacao(undefined);
    const requisicoes = mockarServidor({
      "GET /tipoDinamica/fb74": () => json({ detail: "Não encontrado" }, 404),
    });

    await criarDinamicaTreinoInterativa(criarAuthService());

    assert.strictEqual(requisicoes.length, 1);
    assert.deepStrictEqual(atualizacoes, []);
  });

  test("não reabre uma dinâmica criada já aberta", async () => {
    const requisicoes = mockarServidor({
      "GET /tipoDinamica/fb74": () => json({ detail: "Não encontrado" }, 404),
      "POST /tipoDinamica": () => json({ message: "Dinâmica criada" }),
      "GET /tipo-dinamica/fb74/status": () => json({ status: true }),
    });

    await criarDinamicaTreinoInterativa(criarAuthService());

    assert.strictEqual(requisicoes.filter((r) => r.metodo === "PUT").length, 0);
    assert.strictEqual(atualizacoes.length, 1);
  });

  test("pede login antes de criar", async () => {
    const requisicoes = mockarServidor({});

    await criarDinamicaTreinoInterativa(criarAuthService(false));

    assert.strictEqual(opcoesDoCampo, undefined);
    assert.strictEqual(requisicoes.length, 0);
    assert.match(avisos[0] ?? "", /login/);
  });
});

function criarAuthService(autenticado = true, userId = 74): AuthService {
  return {
    isAutenticado: () => autenticado,
    getAccessToken: () => (autenticado ? "token-da-sessao" : undefined),
    getSessaoAtual: () => ({ userId }),
  } as unknown as AuthService;
}

function mockarServidor(
  rotas: Record<string, (requisicao: Requisicao) => Response>,
): Requisicao[] {
  const requisicoes: Requisicao[] = [];

  globalThis.fetch = async (input, init) => {
    const requisicao: Requisicao = {
      metodo: init?.method ?? "GET",
      caminho: String(input).replace(BASE_API, ""),
      corpo: init?.body,
      cabecalhos: init?.headers as Record<string, string> | undefined,
    };
    requisicoes.push(requisicao);
    const rota = rotas[`${requisicao.metodo} ${requisicao.caminho}`];

    if (!rota) {
      throw new Error(
        `Requisição inesperada: ${requisicao.metodo} ${requisicao.caminho}`,
      );
    }

    return rota(requisicao);
  };

  return requisicoes;
}

function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
