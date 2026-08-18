import * as assert from "assert";
import * as vscode from "vscode";
import { AuthService } from "../../auth/authService";

type MockStorage = {
  valor?: string;
};

function criarContextoFalso(storage: MockStorage = {}): vscode.ExtensionContext {
  const secretos = {
    get: async () => storage.valor,
    store: async (_chave: string, valor: string) => {
      storage.valor = valor;
    },
    delete: async () => {
      storage.valor = undefined;
    },
    onDidChange: undefined,
  } as unknown as vscode.SecretStorage;

  return {
    secrets: secretos,
    extension: {
      id: "flexbox-trainer.test",
    } as vscode.Extension<any>,
  } as vscode.ExtensionContext;
}

function mockarConfiguracao(chave: string, valor: string): void {
  const workspace = vscode.workspace as unknown as {
    getConfiguration: (section: string) => { get: <T>(key: string, defaultValue?: T) => T };
  };

  const original = workspace.getConfiguration;
  workspace.getConfiguration = (section: string) => {
    const configuracaoOriginal = original.call(vscode.workspace, section);
    return {
      ...configuracaoOriginal,
      get: <T>(key: string, defaultValue?: T) => {
        if (section === "flexboxTrainer" && key === chave) {
          return valor as unknown as T;
        }
        return configuracaoOriginal.get(key, defaultValue);
      },
    };
  };
}

function responderTrocaDeToken(
  url: URL,
  init: RequestInit | undefined,
  provider: "gmail" | "github" | "microsoft",
  providerToken: string,
  serverToken: string,
  dadosUsuario?: Record<string, unknown>,
): Response | undefined {
  if (url.pathname !== "/api/login" && url.pathname !== "/login") {
    return undefined;
  }

  assert.strictEqual(init?.method, "POST");
  const headers = init?.headers as Record<string, string> | undefined;
  assert.strictEqual(headers?.Accept, "application/json");
  assert.strictEqual(headers?.["Content-Type"], "application/json");

  const corpo = JSON.parse(String(init?.body || "{}")) as {
    provider?: string;
    token?: string;
  };
  assert.deepStrictEqual(corpo, { provider, token: providerToken });

  return new Response(
    JSON.stringify({
      access_token: serverToken,
      ...dadosUsuario,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function assertBearerToken(
  init: RequestInit | undefined,
  serverToken: string,
): void {
  const headers = init?.headers as Record<string, string> | undefined;
  assert.strictEqual(headers?.Authorization, `Bearer ${serverToken}`);
}

suite("AuthService", () => {
  const originalFetch = globalThis.fetch;
  const originalGetSession = vscode.authentication.getSession;
  const originalShowErrorMessage = vscode.window.showErrorMessage;
  const originalOpenExternal = vscode.env.openExternal;
  const originalAsExternalUri = vscode.env.asExternalUri;

  teardown(() => {
    globalThis.fetch = originalFetch;
    vscode.authentication.getSession = originalGetSession;
    vscode.window.showErrorMessage = originalShowErrorMessage;
    vscode.env.openExternal = originalOpenExternal;
    vscode.env.asExternalUri = originalAsExternalUri;
  });

  test("loginComProvedorVSCode autentica via GitHub e persiste sessão", async () => {
    const contexto = criarContextoFalso();
    const authService = new AuthService(contexto);

    vscode.authentication.getSession = async () => ({
      accessToken: "token-vscode",
      account: { label: "Aluno GitHub" },
    } as vscode.AuthenticationSession);

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const respostaLogin = responderTrocaDeToken(
        url,
        init,
        "github",
        "token-vscode",
        "token-servidor-github",
      );
      if (respostaLogin) {
        return respostaLogin;
      }

      if (url.hostname === "api.github.com" && url.pathname === "/user") {
        assert.strictEqual(init?.headers && (init.headers as Record<string, string>).Authorization, "Bearer token-vscode");
        return new Response(
          JSON.stringify({
            login: "aluno-github",
            name: "Aluno GitHub",
            email: "aluno@example.com",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.hostname === "api.github.com" && url.pathname === "/user/emails") {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/api/usuarios/por-email" || url.pathname === "/usuarios/por-email") {
        assertBearerToken(init, "token-servidor-github");
        return new Response(
          JSON.stringify({
            id: 12,
            nome: "Aluno GitHub",
            email: "aluno@example.com",
            token_gmail: "github-token",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.loginComProvedorVSCode("github");

    assert.strictEqual(authService.isAutenticado(), true);
    const sessao = authService.getSessaoAtual();
    assert.ok(sessao);
    assert.strictEqual(sessao?.email, "aluno@example.com");
    assert.strictEqual(sessao?.displayName, "Aluno GitHub");
    assert.strictEqual(sessao?.tokenGmail, "github");
    assert.strictEqual(sessao?.serverToken, "token-servidor-github");
    assert.strictEqual(sessao?.accessToken, "token-servidor-github");
  });

  test("loginComProvedorVSCode cadastra automaticamente via GitHub quando não existe conta", async () => {
    const contexto = criarContextoFalso();
    const authService = new AuthService(contexto);

    vscode.authentication.getSession = async () => ({
      accessToken: "token-github-cadastro",
      account: { label: "Aluno GitHub" },
    } as vscode.AuthenticationSession);

    let cadastroEfetuado = false;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const respostaLogin = responderTrocaDeToken(
        url,
        init,
        "github",
        "token-github-cadastro",
        "token-servidor-github-cadastro",
      );
      if (respostaLogin) {
        return respostaLogin;
      }

      if (url.hostname === "api.github.com" && url.pathname === "/user") {
        return new Response(
          JSON.stringify({
            login: "aluno-github",
            name: "Aluno GitHub",
            email: "aluno@example.com",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.hostname === "api.github.com" && url.pathname === "/user/emails") {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/api/usuarios/por-email" || url.pathname === "/usuarios/por-email") {
        assertBearerToken(init, "token-servidor-github-cadastro");
        return new Response(JSON.stringify({ detail: "Não encontrado" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/api/usuarios" || url.pathname === "/usuarios") {
        cadastroEfetuado = true;
        assert.strictEqual(init?.method, "POST");
        assertBearerToken(init, "token-servidor-github-cadastro");

        const corpo = String(init?.body || "");
        assert.ok(corpo.includes("email=aluno%40example.com") || corpo.includes("email=aluno@example.com"));

        return new Response(
          JSON.stringify({
            id: 99,
            nome: "Aluno GitHub",
            email: "aluno@example.com",
            token_gmail: "github",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.loginComProvedorVSCode("github");

    assert.strictEqual(cadastroEfetuado, true);
    assert.strictEqual(authService.isAutenticado(), true);
    assert.strictEqual(authService.getSessaoAtual()?.email, "aluno@example.com");
    assert.strictEqual(
      authService.getSessaoAtual()?.serverToken,
      "token-servidor-github-cadastro",
    );
  });

  test("loginComProvedorVSCode tenta e-mails verificados do GitHub até achar cadastro", async () => {
    const contexto = criarContextoFalso();
    const authService = new AuthService(contexto);
    const emailsConsultados: string[] = [];

    vscode.authentication.getSession = async () => ({
      accessToken: "token-github-emails",
      account: { label: "Aluno GitHub" },
    } as vscode.AuthenticationSession);

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const respostaLogin = responderTrocaDeToken(
        url,
        init,
        "github",
        "token-github-emails",
        "token-servidor-github-emails",
      );
      if (respostaLogin) {
        return respostaLogin;
      }

      if (url.hostname === "api.github.com" && url.pathname === "/user") {
        return new Response(
          JSON.stringify({
            login: "aluno-github",
            name: "Aluno GitHub",
            email: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.hostname === "api.github.com" && url.pathname === "/user/emails") {
        return new Response(
          JSON.stringify([
            {
              email: "pessoal@example.com",
              primary: true,
              verified: true,
            },
            {
              email: "aluno.ifms@estudante.ifms.edu.br",
              primary: false,
              verified: true,
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.pathname === "/api/usuarios/por-email" || url.pathname === "/usuarios/por-email") {
        assertBearerToken(init, "token-servidor-github-emails");
        const email = url.searchParams.get("email") || "";
        emailsConsultados.push(email);

        if (email === "pessoal@example.com") {
          return new Response(JSON.stringify({ detail: "Não encontrado" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            id: 74,
            nome: "Aluno IFMS",
            email: "aluno.ifms@estudante.ifms.edu.br",
            token_gmail: "github-ifms-token",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.loginComProvedorVSCode("github");

    assert.deepStrictEqual(emailsConsultados, [
      "pessoal@example.com",
      "aluno.ifms@estudante.ifms.edu.br",
    ]);
    assert.strictEqual(authService.isAutenticado(), true);
    assert.strictEqual(
      authService.getSessaoAtual()?.email,
      "aluno.ifms@estudante.ifms.edu.br",
    );
  });

  test("loginComProvedorVSCode autentica via Microsoft e persiste sessão", async () => {
    const contexto = criarContextoFalso();
    const authService = new AuthService(contexto);

    vscode.authentication.getSession = async () => ({
      accessToken: "token-ms",
      account: { label: "Aluno Microsoft" },
    } as vscode.AuthenticationSession);

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const respostaLogin = responderTrocaDeToken(
        url,
        init,
        "microsoft",
        "token-ms",
        "token-servidor-microsoft",
      );
      if (respostaLogin) {
        return respostaLogin;
      }

      if (url.hostname === "graph.microsoft.com" && url.pathname === "/v1.0/me") {
        assert.strictEqual(init?.headers && (init.headers as Record<string, string>).Authorization, "Bearer token-ms");
        return new Response(
          JSON.stringify({
            displayName: "Aluno Microsoft",
            mail: "aluno.microsoft@example.com",
            userPrincipalName: "aluno.microsoft@example.com",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.pathname === "/api/usuarios/por-email" || url.pathname === "/usuarios/por-email") {
        assertBearerToken(init, "token-servidor-microsoft");
        return new Response(
          JSON.stringify({
            id: 34,
            nome: "Aluno Microsoft",
            email: "aluno.microsoft@example.com",
            token_gmail: "microsoft-token",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.loginComProvedorVSCode("microsoft");

    assert.strictEqual(authService.isAutenticado(), true);
    const sessao = authService.getSessaoAtual();
    assert.ok(sessao);
    assert.strictEqual(sessao?.email, "aluno.microsoft@example.com");
    assert.strictEqual(sessao?.displayName, "Aluno Microsoft");
    assert.strictEqual(sessao?.serverToken, "token-servidor-microsoft");
  });

  test("loginComProvedorVSCode cadastra automaticamente via Microsoft quando não existe conta", async () => {
    const contexto = criarContextoFalso();
    const authService = new AuthService(contexto);

    vscode.authentication.getSession = async () => ({
      accessToken: "token-ms-cadastro",
      account: { label: "Aluno Microsoft" },
    } as vscode.AuthenticationSession);

    let cadastroEfetuado = false;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const respostaLogin = responderTrocaDeToken(
        url,
        init,
        "microsoft",
        "token-ms-cadastro",
        "token-servidor-ms-cadastro",
      );
      if (respostaLogin) {
        return respostaLogin;
      }

      if (url.hostname === "graph.microsoft.com" && url.pathname === "/v1.0/me") {
        return new Response(
          JSON.stringify({
            displayName: "Aluno Microsoft",
            mail: "aluno.microsoft@example.com",
            userPrincipalName: "aluno.microsoft@example.com",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.pathname === "/api/usuarios/por-email" || url.pathname === "/usuarios/por-email") {
        assertBearerToken(init, "token-servidor-ms-cadastro");
        return new Response(JSON.stringify({ detail: "Não encontrado" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/api/usuarios" || url.pathname === "/usuarios") {
        cadastroEfetuado = true;
        assert.strictEqual(init?.method, "POST");
        assertBearerToken(init, "token-servidor-ms-cadastro");

        const corpo = String(init?.body || "");
        assert.ok(corpo.includes("email=aluno.microsoft%40example.com") || corpo.includes("email=aluno.microsoft@example.com"));

        return new Response(
          JSON.stringify({
            id: 100,
            nome: "Aluno Microsoft",
            email: "aluno.microsoft@example.com",
            token_gmail: "microsoft",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.loginComProvedorVSCode("microsoft");

    assert.strictEqual(cadastroEfetuado, true);
    assert.strictEqual(authService.isAutenticado(), true);
    assert.strictEqual(authService.getSessaoAtual()?.email, "aluno.microsoft@example.com");
  });

  test("loginComProvedorVSCode faz fallback quando Microsoft Graph retorna 400", async () => {
    const contexto = criarContextoFalso();
    const authService = new AuthService(contexto);

    vscode.authentication.getSession = async () => ({
      accessToken: "token-ms-erro",
      account: { label: "aluno.fallback@example.com" },
    } as vscode.AuthenticationSession);

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const respostaLogin = responderTrocaDeToken(
        url,
        init,
        "microsoft",
        "token-ms-erro",
        "token-servidor-ms-fallback",
      );
      if (respostaLogin) {
        return respostaLogin;
      }

      if (url.hostname === "graph.microsoft.com" && url.pathname === "/v1.0/me") {
        return new Response(
          JSON.stringify({ error: { message: "Bad Request" } }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.pathname === "/api/usuarios/por-email" || url.pathname === "/usuarios/por-email") {
        assertBearerToken(init, "token-servidor-ms-fallback");
        assert.strictEqual(url.searchParams.get("email"), "aluno.fallback@example.com");
        return new Response(
          JSON.stringify({
            id: 56,
            nome: "Aluno Fallback",
            email: "aluno.fallback@example.com",
            token_gmail: "microsoft-token",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.loginComProvedorVSCode("microsoft");

    assert.strictEqual(authService.isAutenticado(), true);
    const sessao = authService.getSessaoAtual();
    assert.ok(sessao);
    assert.strictEqual(sessao?.email, "aluno.fallback@example.com");
    assert.strictEqual(sessao?.displayName, "Aluno Fallback");
  });

  test("processarCallback rejeita callback sem token do provedor", async () => {
    const contexto = criarContextoFalso();
    const authService = new AuthService(contexto);

    await assert.rejects(
      authService.processarCallback(
        vscode.Uri.parse(
          "vscode://flexbox-trainer.test/auth/callback?email=aluno%40example.com&nome=Aluno%20Google&token_gmail=google-token&remember=1&userId=7",
        ),
      ),
      /token do provedor não informado/i,
    );

    assert.strictEqual(authService.isAutenticado(), false);
    assert.strictEqual(authService.getSessaoAtual(), undefined);
  });

  test("processarCallback rejeita provedor não suportado antes de chamar a API", async () => {
    const contexto = criarContextoFalso();
    const authService = new AuthService(contexto);
    let fetchChamado = false;

    globalThis.fetch = async () => {
      fetchChamado = true;
      throw new Error("Fetch não deveria ser chamado");
    };

    await assert.rejects(
      authService.processarCallback(
        vscode.Uri.parse(
          "vscode://flexbox-trainer.test/auth/callback?provider=desconhecido&token=token-invalido",
        ),
      ),
      /provedor de autenticação não suportado/i,
    );

    assert.strictEqual(fetchChamado, false);
  });

  test("processarCallback informa falha de rede no POST /login", async () => {
    const contexto = criarContextoFalso();
    const authService = new AuthService(contexto);

    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    await assert.rejects(
      authService.processarCallback(
        vscode.Uri.parse(
          "vscode://flexbox-trainer.test/auth/callback?provider=gmail&token=google-id-token",
        ),
      ),
      /Falha de rede ao chamar https:\/\/frontendteamscup\.com\.br\/api\/login: Failed to fetch/i,
    );
  });

  test("inicializar remove sessão legada sem token do sistema", async () => {
    const storage: MockStorage = {
      valor: JSON.stringify({
        accessToken: "token-local-antigo",
        email: "aluno@example.com",
        displayName: "Aluno",
        tokenGmail: "google",
        remember: true,
        authenticatedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }),
    };
    const authService = new AuthService(criarContextoFalso(storage));

    await authService.inicializar();

    assert.strictEqual(storage.valor, undefined);
    assert.strictEqual(authService.isAutenticado(), false);
    assert.strictEqual(authService.getEstadoAtual().status, "unauthenticated");
  });

  test("inicializar encerra sessão quando a API responde 401", async () => {
    const storage: MockStorage = {
      valor: JSON.stringify({
        accessToken: "token-servidor-expirado",
        serverToken: "token-servidor-expirado",
        email: "aluno@example.com",
        displayName: "Aluno",
        tokenGmail: "gmail",
        remember: true,
        authenticatedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }),
    };
    const authService = new AuthService(criarContextoFalso(storage));

    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      assertBearerToken(init, "token-servidor-expirado");
      return new Response(JSON.stringify({ detail: "Token inválido" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    };

    await authService.inicializar();

    assert.strictEqual(storage.valor, undefined);
    assert.strictEqual(authService.getEstadoAtual().status, "unauthenticated");
    assert.match(
      authService.getEstadoAtual().message || "",
      /sessão expirou/i,
    );
  });

  test("processarCallback aceita token do sistema no fragmento e valida em /auth/me", async () => {
    const contexto = criarContextoFalso();
    const authService = new AuthService(contexto);
    let loginChamado = false;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));

      if (url.pathname === "/api/login" || url.pathname === "/login") {
        loginChamado = true;
        throw new Error("O token Google não deve ser trocado novamente");
      }

      if (url.pathname === "/api/auth/me" || url.pathname === "/auth/me") {
        assert.strictEqual(init?.method, "GET");
        assertBearerToken(init, "token-do-sistema");
        return new Response(
          JSON.stringify({
            usuario: {
              id: 144,
              nome: "Aluno Autenticado",
              email: "aluno.sistema@example.com",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.processarCallback(
      vscode.Uri.parse(
        "vscode://flexbox-trainer.test/auth/callback?origem=site#server_token=token-do-sistema&provider=gmail&remember=1",
      ),
    );

    assert.strictEqual(loginChamado, false);
    assert.strictEqual(authService.isAutenticado(), true);
    assert.strictEqual(
      authService.getSessaoAtual()?.serverToken,
      "token-do-sistema",
    );
    assert.strictEqual(
      authService.getSessaoAtual()?.email,
      "aluno.sistema@example.com",
    );
    assert.strictEqual(authService.getSessaoAtual()?.userId, 144);
  });

  test("processarCallback troca token gmail no /login e salva token do servidor", async () => {
    const contexto = criarContextoFalso();
    const authService = new AuthService(contexto);

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));

      if (url.pathname === "/api/login" || url.pathname === "/login") {
        assert.strictEqual(init?.method, "POST");
        const headers = init?.headers as Record<string, string>;
        assert.strictEqual(headers.Accept, "application/json");
        assert.strictEqual(headers["Content-Type"], "application/json");
        const corpo = JSON.parse(String(init?.body || "{}")) as {
          provider?: string;
          token?: string;
        };
        assert.strictEqual(corpo.provider, "gmail");
        assert.strictEqual(corpo.token, "google-id-token");

        return new Response(
          JSON.stringify({
            access_token: "token-servidor-jwt",
            email: "aluno.oauth@example.com",
            nome: "Aluno OAuth",
            userId: 88,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.pathname === "/api/usuarios/por-email" || url.pathname === "/usuarios/por-email") {
        assertBearerToken(init, "token-servidor-jwt");
        assert.strictEqual(
          url.searchParams.get("email"),
          "aluno.oauth@example.com",
        );
        return new Response(
          JSON.stringify({
            id: 88,
            nome: "Aluno OAuth",
            email: "aluno.oauth@example.com",
            token_gmail: "gmail",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.processarCallback(
      vscode.Uri.parse(
        "vscode://flexbox-trainer.test/auth/callback?provider=gmail&token=google-id-token&remember=1",
      ),
    );

    assert.strictEqual(authService.isAutenticado(), true);
    const sessao = authService.getSessaoAtual();
    assert.ok(sessao);
    assert.strictEqual(sessao?.email, "aluno.oauth@example.com");
    assert.strictEqual(sessao?.displayName, "Aluno OAuth");
    assert.strictEqual(sessao?.serverToken, "token-servidor-jwt");
    assert.strictEqual(sessao?.accessToken, "token-servidor-jwt");
    assert.strictEqual(sessao?.tokenGmail, "gmail");
    assert.strictEqual(sessao?.userId, 88);
  });
});
