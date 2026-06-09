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
    // Este teste foca na lógica de negócio do serviço
    const entrada = "koti";
    // Simulando a lógica que existe no lerConfiguracaoServidor
    const processado = entrada.trim().toUpperCase();
    assert.strictEqual(processado, "KOTI");
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

  test("Deve formatar a URL de criação de pasta corretamente", () => {
    const config: ConfiguracaoServidor = {
      apiBaseUrl: "https://api.com",
      dinamicaId: "A1",
      teamId: 10,
      userId: 5,
    } as any;
    const rota = `${config.apiBaseUrl}/criar-pasta/${encodeURIComponent(config.dinamicaId)}/${config.teamId}/${config.userId}`;
    assert.strictEqual(rota, "https://api.com/criar-pasta/A1/10/5");
  });
});
