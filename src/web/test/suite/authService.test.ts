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

      if (url.pathname === "/api/usuarios/por-email" || url.pathname === "/usuarios/por-email") {
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
    assert.strictEqual(sessao?.tokenGmail, "github-token");
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
  });

  test("loginComProvedorVSCode faz fallback quando Microsoft Graph retorna 400", async () => {
    const contexto = criarContextoFalso();
    const authService = new AuthService(contexto);

    vscode.authentication.getSession = async () => ({
      accessToken: "token-ms-erro",
      account: { label: "aluno.fallback@example.com" },
    } as vscode.AuthenticationSession);

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.hostname === "graph.microsoft.com" && url.pathname === "/v1.0/me") {
        return new Response(
          JSON.stringify({ error: { message: "Bad Request" } }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.pathname === "/api/usuarios/por-email" || url.pathname === "/usuarios/por-email") {
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

  test("processarCallback usa dados do callback quando presentes", async () => {
    const contexto = criarContextoFalso();
    const authService = new AuthService(contexto);

    await authService.processarCallback(
      vscode.Uri.parse(
        "vscode://flexbox-trainer.test/auth/callback?email=aluno%40example.com&nome=Aluno%20Google&token_gmail=google-token&remember=1&userId=7",
      ),
    );

    assert.strictEqual(authService.isAutenticado(), true);
    const sessao = authService.getSessaoAtual();
    assert.ok(sessao);
    assert.strictEqual(sessao?.email, "aluno@example.com");
    assert.strictEqual(sessao?.displayName, "Aluno Google");
    assert.strictEqual(sessao?.tokenGmail, "google-token");
    assert.strictEqual(sessao?.userId, 7);
  });
});