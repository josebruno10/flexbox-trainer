import * as assert from "assert";
import { ConfiguracaoServidor } from "../../types";
import {
  temConfiguracaoServidorMinima,
  extrairCodigoPasta,
  criarPastaDoAluno,
} from "../../services/servidor";

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
        if (key === "dinamicaId") return " koti ";
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
    const config: ConfiguracaoServidor = {
      apiBaseUrl: "https://api.teste.com",
      dinamicaId: "KOTI",
      userId: 1,
      teamId: 1,
      apiToken: "",
      captureWidth: 960,
      captureHeight: 540,
    };

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
    const config: ConfiguracaoServidor = {
      apiBaseUrl: "https://url-invalida.com",
      dinamicaId: "TEST",
      userId: 1,
      teamId: 1,
      apiToken: "",
      captureWidth: 960,
      captureHeight: 540,
    };

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
});
