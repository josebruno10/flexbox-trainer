import * as assert from "assert";
import * as vscode from "vscode";
import { AuthService } from "../../auth/authService";
import { SessaoAutenticacao } from "../../auth/tokenManager";

type MockStorage = {
  valores: Map<string, string>;
};

function criarContextoFalso(
  storage: MockStorage = { valores: new Map() },
): vscode.ExtensionContext {
  const secretos = {
    get: async (chave: string) => storage.valores.get(chave),
    store: async (chave: string, valor: string) => {
      storage.valores.set(chave, valor);
    },
    delete: async (chave: string) => {
      storage.valores.delete(chave);
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

suite("AuthService", () => {
  const originalFetch = globalThis.fetch;
  const originalShowErrorMessage = vscode.window.showErrorMessage;
  const originalOpenExternal = vscode.env.openExternal;
  const originalAsExternalUri = vscode.env.asExternalUri;
  const originalGetConfiguration = vscode.workspace.getConfiguration;

  teardown(() => {
    globalThis.fetch = originalFetch;
    vscode.window.showErrorMessage = originalShowErrorMessage;
    vscode.env.openExternal = originalOpenExternal;
    vscode.env.asExternalUri = originalAsExternalUri;
    vscode.workspace.getConfiguration = originalGetConfiguration;
  });

  test("troca a credencial Google pelo access_token do servidor", async () => {
    const storage: MockStorage = { valores: new Map() };
    const authService = new AuthService(criarContextoFalso(storage));
    const urlLogin = await prepararAberturaLogin();
    let chamadasLogin = 0;
    let chamadasPerfil = 0;
    let chamadasTime = 0;

    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname.endsWith("/auth-flow.json")) {
        return respostaManifestoAutenticacao();
      }

      if (url.pathname === "/api/login") {
        chamadasLogin++;
        assert.strictEqual(init?.method, "POST");
        assert.deepStrictEqual(init?.headers, {
          Accept: "application/json",
          "Content-Type": "application/json",
        });
        assert.deepStrictEqual(JSON.parse(String(init?.body)), {
          provider: "gmail",
          token: "google-id-token",
        });
        return respostaJson({
          access_token: "token-proprio-do-servidor",
          expires_in: 3600,
        });
      }

      if (url.pathname === "/api/auth/me") {
        chamadasPerfil++;
        assert.strictEqual(
          (init?.headers as Record<string, string>).Authorization,
          "Bearer token-proprio-do-servidor",
        );
        return respostaJson({
          usuario: {
            id: 74,
            nome: "José Bruno",
            email: "jose@example.com",
            url_image_perfil: "https://example.com/avatar.jpg",
          },
        });
      }

      if (url.pathname === "/api/usuarios/74/time") {
        chamadasTime++;
        assert.strictEqual(
          (init?.headers as Record<string, string>).Authorization,
          "Bearer token-proprio-do-servidor",
        );
        return respostaJson({ id: 46, nome_time: "Equipe de teste" });
      }

      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.abrirLoginGoogle();
    const estado = new URL(urlLogin.valor).searchParams.get("state");
    assert.ok(estado, `URL de login sem state: ${urlLogin.valor}`);

    await authService.processarCallback(
      criarUriCallback({
        state: estado || "",
        google_token: "google-id-token",
        remember: "1",
      }),
    );

    assert.strictEqual(chamadasLogin, 1);
    assert.strictEqual(chamadasPerfil, 1);
    assert.strictEqual(chamadasTime, 1);
    assert.strictEqual(authService.isAutenticado(), true);
    assert.strictEqual(
      authService.getAccessToken(),
      "token-proprio-do-servidor",
    );
    assert.deepStrictEqual(
      {
        email: authService.getSessaoAtual()?.email,
        displayName: authService.getSessaoAtual()?.displayName,
        avatarUrl: authService.getSessaoAtual()?.avatarUrl,
        userId: authService.getSessaoAtual()?.userId,
        teamId: authService.getSessaoAtual()?.teamId,
      },
      {
        email: "jose@example.com",
        displayName: "José Bruno",
        avatarUrl: "https://example.com/avatar.jpg",
        userId: 74,
        teamId: 46,
      },
    );

    const sessaoPersistida = [
      ...storage.valores.values(),
    ].join("\n");
    assert.ok(sessaoPersistida.includes("token-proprio-do-servidor"));
    assert.ok(!sessaoPersistida.includes("google-id-token"));
    assert.ok(!sessaoPersistida.includes("tokenGmail"));
    assert.strictEqual(
      "accessToken" in (authService.getSessaoAtual() ?? {}),
      false,
    );
  });

  test("envia callback, state e Client ID ao site auxiliar", async () => {
    const authService = new AuthService(criarContextoFalso());
    const urlLogin = await prepararAberturaLogin();

    await authService.abrirLoginGoogle();

    const url = new URL(urlLogin.valor);
    assert.strictEqual(
      `${url.origin}${url.pathname}`,
      "https://auth.example.com/login/",
    );
    assert.ok(
      url.searchParams.get("callback")?.includes("/auth/callback"),
      `URL de login sem callback: ${urlLogin.valor}`,
    );
    assert.ok((url.searchParams.get("state") || "").length >= 32);
    assert.strictEqual(url.searchParams.get("clientId"), "client-id-google");
    assert.strictEqual(url.searchParams.get("flowVersion"), "2");
  });

  test("impede login quando a página publicada usa o fluxo antigo", async () => {
    const authService = new AuthService(criarContextoFalso());
    const urlLogin = await prepararAberturaLogin();
    globalThis.fetch = async () => respostaJson({}, 404);

    await assert.rejects(
      authService.abrirLoginGoogle(),
      /página de login publicada está desatualizada.*HTTP 404.*auth-site/,
    );

    assert.strictEqual(urlLogin.valor, "");
    assert.strictEqual(authService.getEstadoAtual().status, "error");
  });

  test("recusa callback com state diferente antes de chamar a API", async () => {
    const authService = new AuthService(criarContextoFalso());
    await prepararAberturaLogin();
    await authService.abrirLoginGoogle();
    let chamouApi = false;
    globalThis.fetch = async () => {
      chamouApi = true;
      return respostaJson({});
    };

    await assert.rejects(
      authService.processarCallback(
        criarUriCallback({
          state: "state-forjado",
          google_token: "google-id-token",
        }),
      ),
      /Retorno de autenticação inválido/,
    );

    assert.strictEqual(chamouApi, false);
    assert.strictEqual(authService.isAutenticado(), false);
  });

  test("não cria sessão quando o servidor rejeita o token Google", async () => {
    const storage: MockStorage = { valores: new Map() };
    const authService = new AuthService(criarContextoFalso(storage));
    const urlLogin = await prepararAberturaLogin();
    await authService.abrirLoginGoogle();
    const estado = new URL(urlLogin.valor).searchParams.get("state") || "";

    globalThis.fetch = async () =>
      respostaJson(
        { detail: "Token do provedor inválido ou expirado." },
        401,
      );

    await assert.rejects(
      authService.processarCallback(
        criarUriCallback({
          state: estado,
          google_token: "token-invalido",
        }),
      ),
      /HTTP 401.*Token do provedor inválido ou expirado/,
    );

    assert.strictEqual(authService.isAutenticado(), false);
    assert.strictEqual(storage.valores.size, 0);
  });

  test("não autentica quando o servidor omite access_token", async () => {
    const storage: MockStorage = { valores: new Map() };
    const authService = new AuthService(criarContextoFalso(storage));
    const urlLogin = await prepararAberturaLogin();
    await authService.abrirLoginGoogle();
    const estado = new URL(urlLogin.valor).searchParams.get("state") || "";
    let chamouPerfil = false;

    globalThis.fetch = async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/api/login") {
        return respostaJson({ message: "Token validado" });
      }

      chamouPerfil = true;
      return respostaJson({});
    };

    await assert.rejects(
      authService.processarCallback(
        criarUriCallback({
          state: estado,
          google_token: "google-id-token",
        }),
      ),
      /não retornou access_token/,
    );

    assert.strictEqual(chamouPerfil, false);
    assert.strictEqual(authService.isAutenticado(), false);
    assert.strictEqual(storage.valores.size, 0);
  });

  test("restaura sessão usando auth/me com Bearer", async () => {
    const storage = criarStorageComSessao({
      displayName: "Nome antigo",
      email: "antigo@example.com",
    });
    const authService = new AuthService(criarContextoFalso(storage));

    globalThis.fetch = async (input, init) => {
      assert.strictEqual(new URL(String(input)).pathname, "/api/auth/me");
      assert.strictEqual(
        (init?.headers as Record<string, string>).Authorization,
        "Bearer token-salvo",
      );
      return respostaJson({
        user: {
          id: 9,
          name: "Nome atualizado",
          email: "novo@example.com",
          time_id: 3,
        },
      });
    };

    await authService.inicializar();

    assert.strictEqual(authService.isAutenticado(), true);
    assert.strictEqual(authService.getSessaoAtual()?.displayName, "Nome atualizado");
    assert.strictEqual(authService.getSessaoAtual()?.email, "novo@example.com");
  });

  test("apaga sessão quando auth/me retorna 401", async () => {
    const storage = criarStorageComSessao();
    const authService = new AuthService(criarContextoFalso(storage));
    globalThis.fetch = async () =>
      respostaJson({ detail: "Token expirado" }, 401);

    await authService.inicializar();

    assert.strictEqual(authService.isAutenticado(), false);
    assert.strictEqual(authService.getEstadoAtual().status, "unauthenticated");
    assert.strictEqual(storage.valores.size, 0);
  });

  test("chama logout protegido e sempre limpa a sessão local", async () => {
    const storage = criarStorageComSessao();
    const authService = new AuthService(criarContextoFalso(storage));
    let chamouLogout = false;

    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/api/auth/me") {
        return respostaJson({
          usuario: {
            id: 9,
            nome: "Aluno",
            email: "aluno@example.com",
            time_id: 3,
          },
        });
      }

      assert.strictEqual(url.pathname, "/api/logout");
      assert.strictEqual(init?.method, "POST");
      assert.strictEqual(
        (init?.headers as Record<string, string>).Authorization,
        "Bearer token-salvo",
      );
      chamouLogout = true;
      return respostaJson({ message: "Logout realizado" });
    };

    await authService.inicializar();
    await authService.logout();

    assert.strictEqual(chamouLogout, true);
    assert.strictEqual(authService.isAutenticado(), false);
    assert.strictEqual(storage.valores.size, 0);
  });

  test("não impede a extensão de abrir quando o armazenamento seguro falha", async () => {
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
});

async function prepararAberturaLogin(): Promise<{ valor: string }> {
  const urlLogin = { valor: "" };
  mockarConfiguracao({
    authSiteUrl: "https://auth.example.com/login/",
    authApiBaseUrl: "https://api.example.com/api",
    googleClientId: "client-id-google",
  });
  vscode.env.asExternalUri = async (uri) => uri;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));

    if (url.pathname.endsWith("/auth-flow.json")) {
      return respostaManifestoAutenticacao();
    }

    throw new Error(`Fetch inesperado: ${url.toString()}`);
  };
  vscode.env.openExternal = async (uri) => {
    // openExternal recebe a URI estruturada. No mock, precisamos manter os
    // separadores da query para reproduzir a URL entregue ao navegador.
    urlLogin.valor = uri.toString(true);
    return true;
  };
  return urlLogin;
}

function mockarConfiguracao(valores: Record<string, unknown>): void {
  vscode.workspace.getConfiguration = ((section: string) => ({
    get: <T>(key: string, defaultValue?: T): T =>
      section === "flexboxTrainer" && key in valores
        ? (valores[key] as T)
        : (defaultValue as T),
  })) as typeof vscode.workspace.getConfiguration;
}

function criarUriCallback(parametros: Record<string, string>): vscode.Uri {
  return vscode.Uri.parse(
    `vscode://flexbox-trainer.test/auth/callback#${new URLSearchParams(
      parametros,
    ).toString()}`,
  );
}

function respostaJson(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function respostaManifestoAutenticacao(): Response {
  return respostaJson({ protocolVersion: 2, provider: "google" });
}

function criarStorageComSessao(
  overrides: Partial<SessaoAutenticacao> = {},
): MockStorage {
  const sessao: SessaoAutenticacao = {
    accessToken: "token-salvo",
    email: "aluno@example.com",
    displayName: "Aluno",
    remember: true,
    authenticatedAt: Date.now() - 1_000,
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
  return {
    valores: new Map([
      ["flexboxTrainer.auth.session", JSON.stringify(sessao)],
    ]),
  };
}
