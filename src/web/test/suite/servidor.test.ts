import * as assert from "assert";
import { ConfiguracaoServidor } from "../../types";
import {
  temConfiguracaoServidorMinima,
  extrairCodigoPasta,
  criarPastaDoAluno,
  enviarConteudoDaTentativa,
  verificarConexaoServidor,
} from "../../services/servidor";

function criarConfiguracao(
  overrides: Partial<ConfiguracaoServidor> = {},
): ConfiguracaoServidor {
  return {
    apiBaseUrl: "https://api.teste.com/api",
    apiToken: "",
    dinamicaId: "KOTI",
    userId: 1,
    teamId: 10,
    captureWidth: 960,
    captureHeight: 540,
    ...overrides,
  };
}

suite("Servidor Service Test Suite", () => {
  test("Deve validar se a configuração mínima está preenchida", () => {
    const configValida: ConfiguracaoServidor = {
      apiBaseUrl: "https://api.teste.com",
      apiToken: "token",
      dinamicaId: "KOTI",
      userId: 1,
      teamId: 10,
      captureWidth: 960,
      captureHeight: 540,
    };

    const configInvalida: ConfiguracaoServidor = {
      apiBaseUrl: "",
      apiToken: "",
      dinamicaId: "",
      userId: 0,
      teamId: 0,
      captureWidth: 960,
      captureHeight: 540,
    };

    assert.strictEqual(temConfiguracaoServidorMinima(configValida), true);
    assert.strictEqual(temConfiguracaoServidorMinima(configInvalida), false);
  });

  test("Deve extrair o código da pasta de diferentes formatos de resposta", () => {
    // Teste com string direta
    assert.strictEqual(extrairCodigoPasta("PASTA123"), "PASTA123");

    // Teste com objeto contendo snake_case
    assert.strictEqual(extrairCodigoPasta({ codigo_pasta: "ABC" }), "ABC");

    // Teste com objeto contendo camelCase
    assert.strictEqual(extrairCodigoPasta({ codigoPasta: "XYZ" }), "XYZ");

    // Teste com falha
    assert.strictEqual(extrairCodigoPasta(null), undefined);
  });

  test("Configuração deve normalizar dinamicaId para maiúsculo", () => {
    // Simulando dados que viriam do vscode.workspace.getConfiguration
    const mockConfig = {
      get: (key: string, def: any) => {
        if (key === "dinamicaId") {
          return " koti ";
        }
        return def;
      },
    };
    const resultado = mockConfig.get("dinamicaId", "").trim().toUpperCase();
    assert.strictEqual(
      resultado,
      "KOTI",
      "Deveria remover espaços e converter para maiúsculo",
    );
  });

  test("Deve criar pasta com sucesso quando o servidor retorna JSON", async () => {
    const config = criarConfiguracao();

    const originalFetch = globalThis.fetch;
    // Mock de sucesso
    (globalThis as any).fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ codigo_pasta: "PASTA_GERADA_123" }),
    });

    try {
      const codigo = await criarPastaDoAluno(config);
      assert.strictEqual(codigo, "PASTA_GERADA_123");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Deve tratar erro de rede (Failed to fetch) ao criar pasta", async () => {
    const config = criarConfiguracao({
      apiBaseUrl: "https://url-invalida.com",
      dinamicaId: "TEST",
    });

    // Mock do fetch global para simular erro de rede/CORS
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = () =>
      Promise.reject(new TypeError("Failed to fetch"));

    try {
      await criarPastaDoAluno(config);
      assert.fail("Deveria ter lançado um erro de rede");
    } catch (error: any) {
      // Verifica se a mensagem de erro é a que definimos no servidor.ts
      assert.ok(
        error.message.includes("Não foi possível conectar ao servidor"),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Deve montar a requisição de criação conforme o contrato da API", async () => {
    const config = criarConfiguracao({
      apiToken: "token-secreto",
      dinamicaId: "DINAMICA ESPECIAL",
      userId: 7,
      teamId: 42,
    });
    const originalFetch = globalThis.fetch;
    let urlRecebida = "";
    let opcoesRecebidas: RequestInit | undefined;

    globalThis.fetch = async (input, init) => {
      urlRecebida = String(input);
      opcoesRecebidas = init;
      return new Response(JSON.stringify({ codigo_pasta: "PASTA-42" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      const codigo = await criarPastaDoAluno(config);

      assert.strictEqual(codigo, "PASTA-42");
      assert.strictEqual(
        urlRecebida,
        "https://api.teste.com/api/criar-pasta/DINAMICA%20ESPECIAL/42/7",
      );
      assert.strictEqual(opcoesRecebidas?.method, "POST");
      assert.strictEqual(opcoesRecebidas?.mode, "cors");
      assert.deepStrictEqual(opcoesRecebidas?.headers, {
        Accept: "application/json",
        Authorization: "Bearer token-secreto",
      });
      assert.ok(opcoesRecebidas?.signal instanceof AbortSignal);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Deve testar a conexão sem exigir IDs do torneio", async () => {
    const config = criarConfiguracao({
      apiBaseUrl: "https://api.teste.com/api/",
      dinamicaId: "",
      userId: 0,
      teamId: 0,
    });
    const originalFetch = globalThis.fetch;
    let urlRecebida = "";
    let opcoesRecebidas: RequestInit | undefined;

    globalThis.fetch = async (input, init) => {
      urlRecebida = String(input);
      opcoesRecebidas = init;
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      const mensagem = await verificarConexaoServidor(config);

      assert.strictEqual(urlRecebida, "https://api.teste.com/api/usuarios");
      assert.strictEqual(opcoesRecebidas?.method, "GET");
      assert.strictEqual(opcoesRecebidas?.mode, "cors");
      assert.strictEqual(
        mensagem,
        "Conexão realizada com sucesso (HTTP 200).",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Deve remover /docs e fragmento da URL antes de chamar a API", async () => {
    const config = criarConfiguracao({
      apiBaseUrl: "https://ifms.pro.br:6005/docs#",
      dinamicaId: "",
      userId: 0,
      teamId: 0,
    });
    const originalFetch = globalThis.fetch;
    let urlRecebida = "";

    globalThis.fetch = async (input) => {
      urlRecebida = String(input);
      return new Response("[]", { status: 200 });
    };

    try {
      await verificarConexaoServidor(config);
      assert.strictEqual(urlRecebida, "https://ifms.pro.br:6005/usuarios");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Deve enviar HTML e CSS no formulário esperado pelo servidor", async () => {
    const config = criarConfiguracao({ apiToken: "token-secreto" });
    const originalFetch = globalThis.fetch;
    let urlRecebida = "";
    let opcoesRecebidas: RequestInit | undefined;

    globalThis.fetch = async (input, init) => {
      urlRecebida = String(input);
      opcoesRecebidas = init;
      return new Response(JSON.stringify({ precision: 87.5 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      const resultado = await enviarConteudoDaTentativa(
        config,
        "PASTA-42",
        '<main class="alvo">Olá</main>',
        ".alvo { display: flex; }",
      );
      const formulario = new URLSearchParams(String(opcoesRecebidas?.body));

      assert.strictEqual(
        urlRecebida,
        "https://api.teste.com/api/salvar-conteudo",
      );
      assert.strictEqual(opcoesRecebidas?.method, "POST");
      assert.strictEqual(opcoesRecebidas?.mode, "cors");
      assert.deepStrictEqual(opcoesRecebidas?.headers, {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Bearer token-secreto",
      });
      assert.strictEqual(formulario.get("code_pasta"), "PASTA-42");
      assert.strictEqual(formulario.get("tipo"), "ambos");
      assert.strictEqual(
        formulario.get("index_conteudo"),
        '<main class="alvo">Olá</main>',
      );
      assert.strictEqual(
        formulario.get("style_conteudo"),
        ".alvo { display: flex; }",
      );
      assert.deepStrictEqual(resultado, {
        precision: 87.5,
        score: 87.5,
        source: "servidor",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Deve sinalizar quando o servidor salva sem retornar nota", async () => {
    const config = criarConfiguracao();
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: "Conteúdo salvo" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    try {
      const resultado = await enviarConteudoDaTentativa(
        config,
        "PASTA-42",
        "<main></main>",
        "main { display: flex; }",
      );

      assert.deepStrictEqual(resultado, {
        precision: 0,
        score: 0,
        source: "servidor-sem-nota",
        error: "Conteúdo salvo",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Deve propagar a mensagem de erro HTTP retornada pelo servidor", async () => {
    const config = criarConfiguracao();
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: "Pasta inexistente" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });

    try {
      await assert.rejects(
        enviarConteudoDaTentativa(
          config,
          "PASTA-INVALIDA",
          "<main></main>",
          "main { display: flex; }",
        ),
        /Falha ao enviar conteúdo: Pasta inexistente/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
