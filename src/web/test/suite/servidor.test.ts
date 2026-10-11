import * as assert from "assert";
import * as vscode from "vscode";
import { ConfiguracaoServidor } from "../../types";
import {
  extrairCodGabarito,
  extrairPercentualCorrecao,
  lerConfiguracaoServidor,
  resumirCabecalhosParaLog,
  verificarConexaoServidor,
} from "../../services/servidor";

function criarConfiguracao(
  overrides: Partial<ConfiguracaoServidor> = {},
): ConfiguracaoServidor {
  return {
    apiBaseUrl: "https://api.teste.com/api",
    apiToken: "token-servidor",
    eventoTreino: "",
    userId: 1,
    teamId: 10,
    ...overrides,
  };
}

suite("Servidor Service Test Suite", () => {
  test("Deve priorizar o token autenticado sobre o token das configurações", () => {
    const getConfigurationOriginal = vscode.workspace.getConfiguration;

    vscode.workspace.getConfiguration = (() => ({
      get: <T>(key: string, defaultValue?: T): T => {
        const valores: Record<string, unknown> = {
          apiBaseUrl: "https://api.teste.com/api",
          apiToken: "token-das-configuracoes",
        };

        return (valores[key] ?? defaultValue) as T;
      },
    })) as typeof vscode.workspace.getConfiguration;

    try {
      const configuracao = lerConfiguracaoServidor(" token-da-sessao ");

      assert.strictEqual(configuracao.apiToken, "token-da-sessao");
    } finally {
      vscode.workspace.getConfiguration = getConfigurationOriginal;
    }
  });

  test("Deve ocultar o token ao resumir cabeçalhos para o log", () => {
    const resumo = resumirCabecalhosParaLog({
      Accept: "application/json",
      Authorization: "Bearer token-secreto",
    });
    const textoLog = JSON.stringify(resumo);

    assert.ok(textoLog.includes("Bearer [PROTEGIDO]"));
    assert.ok(!textoLog.includes("token-secreto"));
  });

  test("Deve ler o código do gabarito nos formatos da listagem oficial", () => {
    const caminho = "gabaritos/gab_treino_tam_800x800.png";

    assert.strictEqual(extrairCodGabarito([91, caminho]), 91);
    assert.strictEqual(extrairCodGabarito([caminho, 91]), 91);
    assert.strictEqual(extrairCodGabarito({ cod: 91, caminho }), 91);
    assert.strictEqual(extrairCodGabarito({ codigo: "91", url: caminho }), 91);
    assert.strictEqual(extrairCodGabarito({ gabarito: { id: 91 } }), 91);
    assert.strictEqual(extrairCodGabarito([caminho]), undefined);
    assert.strictEqual(extrairCodGabarito([0, caminho]), undefined);
  });

  test("Deve ler a nota de corrigir-formas como a extensão oficial", () => {
    assert.strictEqual(
      extrairPercentualCorrecao({ pontuacao: 61.5, pontuacao_total: 4.3 }),
      61.5,
    );
    assert.strictEqual(extrairPercentualCorrecao({ percentual: "0" }), 0);
    // Pontuação por gabarito: vale a porcentagem informada ou total/máxima.
    assert.strictEqual(
      extrairPercentualCorrecao({
        pontuacao: { "91_800x800": { pontuacao_total: 3.5, pontuacao_maxima: 7 } },
      }),
      50,
    );
    assert.strictEqual(
      extrairPercentualCorrecao({
        por_gabarito: {
          "91": { percentual: 80 },
          "92": { pontuacao_total: 1, pontuacao_maxima: 4 },
        },
      }),
      52.5,
    );
    assert.strictEqual(extrairPercentualCorrecao({ message: "ok" }), undefined);
    assert.strictEqual(extrairPercentualCorrecao({ pontuacao_total: 2.37 }), undefined);
    // Não confunde a nota com campos de outras rotas.
    assert.strictEqual(extrairPercentualCorrecao({ nota: 88 }), undefined);
  });

  test("Deve validar a sessão sem exigir IDs do torneio", async () => {
    const config = criarConfiguracao({
      apiBaseUrl: "https://api.teste.com/api/",
      eventoTreino: "",
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

      assert.strictEqual(urlRecebida, "https://api.teste.com/api/auth/me");
      assert.strictEqual(opcoesRecebidas?.method, "GET");
      assert.strictEqual(opcoesRecebidas?.mode, "cors");
      assert.strictEqual(
        (opcoesRecebidas?.headers as Record<string, string>).Authorization,
        "Bearer token-servidor",
      );
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
      eventoTreino: "",
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
      assert.strictEqual(urlRecebida, "https://ifms.pro.br:6005/auth/me");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Deve recusar teste de conexão sem token da API", async () => {
    await assert.rejects(
      verificarConexaoServidor(criarConfiguracao({ apiToken: "" })),
      /Configure o token da API/,
    );
  });

});
