import * as assert from "assert";
import * as vscode from "vscode";
import { AuthService } from "../../auth/authService";

type MockStorage = {
  valor?: string;
  exclusoes?: number;
};

const getConfigurationOriginal = vscode.workspace.getConfiguration;

function mockarConfiguracaoAutenticacao(): void {
  vscode.workspace.getConfiguration = (section?: string) => {
    const configuracaoOriginal = getConfigurationOriginal.call(
      vscode.workspace,
      section,
    );

    return {
      ...configuracaoOriginal,
      get: <T>(chave: string, valorPadrao?: T): T => {
        if (section === "flexboxTrainer") {
          const valores: Record<string, string> = {
            authSiteUrl: "https://auth.example.com/login/",
            authApiBaseUrl: "https://frontendteamscup.com.br/api",
            googleClientId: "client-id-google",
          };
          if (chave in valores) {
            return valores[chave] as T;
          }
        }

        return configuracaoOriginal.get(chave, valorPadrao as T) as T;
      },
    } as vscode.WorkspaceConfiguration;
  };
}

function criarContextoFalso(storage: MockStorage = {}): vscode.ExtensionContext {
  const secretos = {
    get: async () => storage.valor,
    store: async (_chave: string, valor: string) => {
      storage.valor = valor;
    },
    delete: async () => {
      storage.valor = undefined;
      storage.exclusoes = (storage.exclusoes || 0) + 1;
    },
    onDidChange: undefined,
  } as unknown as vscode.SecretStorage;

  return {
    secrets: secretos,
    extension: {
      id: "flexbox-trainer.test",
    } as vscode.Extension<unknown>,
  } as vscode.ExtensionContext;
}

function respostaJson(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function assertBearer(init: RequestInit | undefined, token: string): void {
  const headers = init?.headers as Record<string, string> | undefined;
  assert.strictEqual(headers?.Authorization, `Bearer ${token}`);
}

function perfilServidor(
  sobrescritas: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 74,
    nome: "Aluno Servidor",
    email: "aluno@example.com",
    time_id: 46,
    url_image_perfil: "https://example.com/avatar.png",
    ...sobrescritas,
  };
}

let ultimosParametrosAbertos: URLSearchParams | undefined;

async function iniciarFluxoGoogle(
  authService: AuthService,
  callbackExterno?: string,
): Promise<string> {
  mockarConfiguracaoAutenticacao();
  let urlAberta: unknown;
  vscode.env.asExternalUri = async (uri) =>
    callbackExterno ? vscode.Uri.parse(callbackExterno) : uri;
  vscode.env.openExternal = async (uri) => {
    urlAberta = uri;
    return true;
  };

  await authService.abrirLoginGoogle();

  // Um Uri seria recodificado pelo VS Code antes de chegar ao navegador; só
  // uma string garante que o site lê exatamente estes parâmetros.
  assert.strictEqual(typeof urlAberta, "string");
  const parametros = new URL(urlAberta as string).searchParams;
  ultimosParametrosAbertos = parametros;
  const state = parametros.get("state") || "";
  assert.match(state, /^[a-f0-9]{48}$/);
  assert.ok(parametros.get("callback")?.includes("/auth/callback"));
  assert.strictEqual(parametros.get("mode"), "login");
  assert.strictEqual(
    parametros.get("apiBaseUrl"),
    "https://frontendteamscup.com.br/api",
  );
  assert.strictEqual(parametros.get("clientId"), "client-id-google");
  assert.strictEqual(
    parametros.get("googleClientId"),
    "client-id-google",
  );
  return state;
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
    vscode.workspace.getConfiguration = getConfigurationOriginal;
  });

  test("envia state seguro e configuração ao site de autenticação", async () => {
    const authService = new AuthService(criarContextoFalso());

    await iniciarFluxoGoogle(authService);

    assert.strictEqual(authService.getEstadoAtual().status, "checking");
    authService.dispose();
  });

  test("preserva o callback do vscode.dev, que contém ? e &", async () => {
    const authService = new AuthService(criarContextoFalso());
    await iniciarFluxoGoogle(
      authService,
      "https://vscode.dev/callback?vscode-reqid=7&vscode-scheme=vscode&vscode-path=%2Fauth%2Fcallback",
    );

    const callback = new URL(ultimosParametrosAbertos?.get("callback") || "");
    assert.strictEqual(callback.hostname, "vscode.dev");
    assert.strictEqual(callback.searchParams.get("vscode-reqid"), "7");
    assert.strictEqual(
      callback.searchParams.get("vscode-path"),
      "/auth/callback",
    );
    authService.dispose();
  });

  test("aceita server_token no fragmento, valida state e consulta auth/me", async () => {
    const storage: MockStorage = {};
    const authService = new AuthService(criarContextoFalso(storage));
    const state = await iniciarFluxoGoogle(authService);
    let loginChamado = false;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/login")) {
        loginChamado = true;
      }
      if (url.pathname.endsWith("/auth/me")) {
        assert.strictEqual(init?.method, "GET");
        assertBearer(init, "token-servidor");
        return respostaJson(perfilServidor());
      }
      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.processarCallback(
      vscode.Uri.parse(
        `vscode://flexbox-trainer.test/auth/callback#server_token=token-servidor&provider=gmail&remember=1&state=${state}`,
      ),
    );

    assert.strictEqual(loginChamado, false);
    assert.strictEqual(authService.isAutenticado(), true);
    assert.strictEqual(authService.getAccessToken(), "token-servidor");
    const sessao = authService.getSessaoAtual();
    assert.strictEqual(sessao?.email, "aluno@example.com");
    assert.strictEqual(sessao?.userId, 74);
    assert.strictEqual(sessao?.teamId, 46);
    assert.strictEqual(sessao?.avatarUrl, "https://example.com/avatar.png");
    assert.strictEqual("accessToken" in (sessao || {}), false);
    assert.strictEqual("serverToken" in (sessao || {}), false);
    assert.ok(storage.valor);
    const persistida = JSON.parse(storage.valor || "{}") as Record<string, unknown>;
    assert.strictEqual(persistida.accessToken, "token-servidor");
    assert.strictEqual(persistida.serverToken, "token-servidor");
  });

  test("troca token Gmail no POST /login e nunca persiste a credencial do provedor", async () => {
    const storage: MockStorage = {};
    const authService = new AuthService(criarContextoFalso(storage));
    const state = await iniciarFluxoGoogle(authService);

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/login")) {
        assert.strictEqual(init?.method, "POST");
        assert.deepStrictEqual(JSON.parse(String(init?.body)), {
          provider: "gmail",
          token: "credencial-google",
        });
        return respostaJson({ access_token: "token-api", expires_in: 3600 });
      }
      if (url.pathname.endsWith("/auth/me")) {
        assertBearer(init, "token-api");
        return respostaJson(perfilServidor());
      }
      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.processarCallback(
      vscode.Uri.parse(
        `vscode://flexbox-trainer.test/auth/callback?state=${state}#provider=google&credential=credencial-google`,
      ),
    );

    assert.strictEqual(authService.getAccessToken(), "token-api");
    assert.ok(storage.valor);
    assert.strictEqual(storage.valor?.includes("credencial-google"), false);
    assert.strictEqual(authService.getSessaoAtual()?.tokenGmail, "gmail");
  });

  test("rejeita state diferente antes de chamar o servidor", async () => {
    const authService = new AuthService(criarContextoFalso());
    await iniciarFluxoGoogle(authService);
    let fetchChamado = false;
    globalThis.fetch = async () => {
      fetchChamado = true;
      return respostaJson({});
    };

    await assert.rejects(
      authService.processarCallback(
        vscode.Uri.parse(
          "vscode://flexbox-trainer.test/auth/callback#server_token=x&state=incorreto",
        ),
      ),
      /não iniciado por esta extensão/i,
    );

    assert.strictEqual(fetchChamado, false);
    assert.strictEqual(authService.isAutenticado(), false);
  });

  test("rejeita token recebido na query para não expor credenciais na URL", async () => {
    const authService = new AuthService(criarContextoFalso());
    const state = await iniciarFluxoGoogle(authService);
    let fetchChamado = false;
    globalThis.fetch = async () => {
      fetchChamado = true;
      return respostaJson({});
    };

    await assert.rejects(
      authService.processarCallback(
        vscode.Uri.parse(
          `vscode://flexbox-trainer.test/auth/callback?server_token=exposto&state=${state}`,
        ),
      ),
      /não devolveu um token válido/i,
    );

    assert.strictEqual(fetchChamado, false);
    assert.strictEqual(authService.isAutenticado(), false);
  });

  test("não cria sessão quando /login omite o token do servidor", async () => {
    const storage: MockStorage = {};
    const authService = new AuthService(criarContextoFalso(storage));
    const state = await iniciarFluxoGoogle(authService);
    globalThis.fetch = async () => respostaJson({ usuario: perfilServidor() });

    await assert.rejects(
      authService.processarCallback(
        vscode.Uri.parse(
          `vscode://flexbox-trainer.test/auth/callback#provider=gmail&token=google&state=${state}`,
        ),
      ),
      /não retornou token de acesso/i,
    );

    assert.strictEqual(storage.valor, undefined);
    assert.strictEqual(authService.getAccessToken(), undefined);
  });

  test("remember=false mantém a sessão somente em memória", async () => {
    const storage: MockStorage = {};
    const authService = new AuthService(criarContextoFalso(storage));
    const state = await iniciarFluxoGoogle(authService);
    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      assertBearer(init, "token-temporario");
      return respostaJson(perfilServidor());
    };

    await authService.processarCallback(
      vscode.Uri.parse(
        `vscode://flexbox-trainer.test/auth/callback#server_token=token-temporario&remember=0&state=${state}`,
      ),
    );

    assert.strictEqual(storage.valor, undefined);
    assert.strictEqual(authService.getAccessToken(), "token-temporario");
    assert.strictEqual(authService.getSessaoAtual()?.remember, false);
  });

  test("inicializar restaura apenas sessão com token do servidor e valida auth/me", async () => {
    const sessao = {
      accessToken: "token-restaurado",
      serverToken: "token-restaurado",
      email: "antigo@example.com",
      displayName: "Nome antigo",
      avatarUrl: "https://example.com/antigo.png",
      tokenGmail: "gmail",
      userId: 1,
      remember: true,
      authenticatedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    };
    const storage: MockStorage = { valor: JSON.stringify(sessao) };
    const authService = new AuthService(criarContextoFalso(storage));
    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      assertBearer(init, "token-restaurado");
      return respostaJson(perfilServidor({ nome: "Nome atualizado" }));
    };

    await authService.inicializar();

    assert.strictEqual(authService.isAutenticado(), true);
    assert.strictEqual(authService.getAccessToken(), "token-restaurado");
    assert.strictEqual(
      authService.getSessaoAtual()?.displayName,
      "Nome atualizado",
    );
  });

  test("inicializar remove sessão legada sem serverToken", async () => {
    const storage: MockStorage = {
      valor: JSON.stringify({
        accessToken: "uuid-local-antigo",
        email: "aluno@example.com",
        displayName: "Aluno",
        tokenGmail: "credencial-antiga",
        remember: true,
        authenticatedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }),
    };
    const authService = new AuthService(criarContextoFalso(storage));

    await authService.inicializar();

    assert.strictEqual(storage.valor, undefined);
    assert.strictEqual(authService.getEstadoAtual().status, "unauthenticated");
  });

  test("inicializar apaga sessão quando auth/me responde 401", async () => {
    const storage: MockStorage = {
      valor: JSON.stringify({
        accessToken: "expirado",
        serverToken: "expirado",
        email: "aluno@example.com",
        displayName: "Aluno",
        tokenGmail: "gmail",
        remember: true,
        authenticatedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }),
    };
    const authService = new AuthService(criarContextoFalso(storage));
    globalThis.fetch = async () => respostaJson({ detail: "Inválido" }, 401);

    await authService.inicializar();

    assert.strictEqual(storage.valor, undefined);
    assert.strictEqual(authService.getEstadoAtual().status, "unauthenticated");
    assert.match(authService.getEstadoAtual().message || "", /expirou/i);
  });

  test("inicializar não impede a extensão de abrir quando SecretStorage falha", async () => {
    const contexto = criarContextoFalso();
    contexto.secrets.get = async () => {
      throw new Error("armazenamento indisponível");
    };
    const authService = new AuthService(contexto);

    await authService.inicializar();

    assert.strictEqual(authService.getEstadoAtual().status, "error");
    assert.match(
      authService.getEstadoAtual().message || "",
      /armazenamento indisponível/,
    );
  });

  test("GitHub troca a credencial no /login e preserva o avatar", async () => {
    const storage: MockStorage = {};
    const authService = new AuthService(criarContextoFalso(storage));
    vscode.authentication.getSession = async () =>
      ({
        accessToken: "oauth-github",
        account: { label: "Aluno GitHub" },
      }) as vscode.AuthenticationSession;
    vscode.window.showErrorMessage = async () => undefined;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.hostname === "api.github.com" && url.pathname === "/user") {
        assertBearer(init, "oauth-github");
        return respostaJson({
          login: "aluno",
          email: "aluno@example.com",
          avatar_url: "https://avatars.githubusercontent.com/u/123",
        });
      }
      if (url.hostname === "api.github.com" && url.pathname === "/user/emails") {
        return respostaJson([]);
      }
      if (url.pathname.endsWith("/login")) {
        assert.deepStrictEqual(JSON.parse(String(init?.body)), {
          provider: "github",
          token: "oauth-github",
        });
        return respostaJson({ access_token: "token-github-servidor" });
      }
      if (url.pathname.endsWith("/auth/me")) {
        assertBearer(init, "token-github-servidor");
        return respostaJson(
          perfilServidor({ url_image_perfil: undefined }),
        );
      }
      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.loginComProvedorVSCode("github");

    assert.strictEqual(authService.getAccessToken(), "token-github-servidor");
    assert.strictEqual(
      authService.getSessaoAtual()?.avatarUrl,
      "https://avatars.githubusercontent.com/u/123",
    );
    assert.strictEqual(storage.valor?.includes("oauth-github"), false);
  });

  test("tenta de novo quando o provedor do GitHub demora a registrar", async () => {
    const authService = new AuthService(criarContextoFalso());
    let pedidos = 0;
    vscode.authentication.getSession = (async () => {
      pedidos++;
      if (pedidos === 1) {
        throw new Error(
          "Timed out waiting for authentication provider 'github' to register.",
        );
      }
      return {
        accessToken: "oauth-github",
        account: { label: "Aluno GitHub" },
      } as vscode.AuthenticationSession;
    }) as typeof vscode.authentication.getSession;
    vscode.window.showErrorMessage = async () => undefined;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "api.github.com") {
        return respostaJson(url.pathname === "/user" ? { login: "aluno" } : []);
      }
      if (url.pathname.endsWith("/login")) {
        return respostaJson({ access_token: "token-github-servidor" });
      }
      return respostaJson(perfilServidor());
    };

    await authService.loginComProvedorVSCode("github");

    assert.strictEqual(pedidos, 2);
    assert.strictEqual(authService.getAccessToken(), "token-github-servidor");
  });

  test("explica a falha quando o provedor nunca registra", async () => {
    const authService = new AuthService(criarContextoFalso());
    let pedidos = 0;
    let mensagemExibida = "";
    vscode.authentication.getSession = (async () => {
      pedidos++;
      throw new Error(
        "Timed out waiting for authentication provider 'github' to register.",
      );
    }) as typeof vscode.authentication.getSession;
    vscode.window.showErrorMessage = (async (mensagem: string) => {
      mensagemExibida = mensagem;
      return undefined;
    }) as typeof vscode.window.showErrorMessage;

    await authService.loginComProvedorVSCode("github");

    assert.strictEqual(pedidos, 3);
    assert.strictEqual(authService.getEstadoAtual().status, "error");
    assert.match(mensagemExibida, /"GitHub Authentication" está habilitada/);
  });

  test("Microsoft troca a credencial no /login", async () => {
    const storage: MockStorage = {};
    const authService = new AuthService(criarContextoFalso(storage));
    let escoposSolicitados: readonly string[] = [];
    vscode.authentication.getSession = (async (
      _provedor: string,
      escopos: readonly string[],
    ) => {
      escoposSolicitados = escopos;
      return {
        accessToken: "oauth-microsoft",
        account: { label: "aluno.microsoft@example.com" },
      } as vscode.AuthenticationSession;
    }) as typeof vscode.authentication.getSession;
    vscode.window.showErrorMessage = async () => undefined;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.hostname === "graph.microsoft.com" && url.pathname === "/v1.0/me") {
        assertBearer(init, "oauth-microsoft");
        return respostaJson({
          displayName: "Aluno Microsoft",
          mail: "aluno.microsoft@example.com",
        });
      }
      if (url.hostname === "graph.microsoft.com" && url.pathname.endsWith("/photo/$value")) {
        return new Response(null, { status: 404 });
      }
      if (url.pathname.endsWith("/login")) {
        assert.deepStrictEqual(JSON.parse(String(init?.body)), {
          provider: "microsoft",
          token: "oauth-microsoft",
        });
        return respostaJson({ server_token: "token-ms-servidor" });
      }
      if (url.pathname.endsWith("/auth/me")) {
        assertBearer(init, "token-ms-servidor");
        return respostaJson(
          perfilServidor({
            nome: "Aluno Microsoft",
            email: "aluno.microsoft@example.com",
          }),
        );
      }
      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.loginComProvedorVSCode("microsoft");

    // Aceita contas pessoais e institucionais, não só "organizations".
    assert.ok(escoposSolicitados.includes("VSCODE_TENANT:common"));
    assert.strictEqual(authService.getAccessToken(), "token-ms-servidor");
    assert.strictEqual(authService.getSessaoAtual()?.tokenGmail, "microsoft");
    assert.strictEqual(storage.valor?.includes("oauth-microsoft"), false);
  });

  test("invalidarSessao remove token e metadados", async () => {
    const storage: MockStorage = {};
    const authService = new AuthService(criarContextoFalso(storage));
    const state = await iniciarFluxoGoogle(authService);
    globalThis.fetch = async () => respostaJson(perfilServidor());
    await authService.processarCallback(
      vscode.Uri.parse(
        `vscode://flexbox-trainer.test/auth/callback#server_token=token&state=${state}`,
      ),
    );

    await authService.invalidarSessao("Token recusado.");

    assert.strictEqual(storage.valor, undefined);
    assert.strictEqual(authService.getAccessToken(), undefined);
    assert.strictEqual(authService.getSessaoAtual(), undefined);
    assert.strictEqual(authService.getEstadoAtual().status, "unauthenticated");
  });
});
