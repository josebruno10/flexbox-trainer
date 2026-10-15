import * as assert from "assert";
import * as vscode from "vscode";
import { AuthService } from "../../../auth/authService";
import {
  assertBearer,
  criarContextoFalso,
  MockStorage,
  perfilServidor,
  responderUsuarioDoServidor,
  respostaJson,
  restaurarAoFim,
} from "./auxiliares";

// O login pelo GitHub e pela Microsoft, com as contas do próprio VS Code.
suite("AuthService: login pelas contas do VS Code", () => {
  restaurarAoFim();

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
      const usuario = responderUsuarioDoServidor(url);
      if (usuario) {
        return usuario;
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

  test("procura o aluno pelos outros e-mails verificados da conta do GitHub", async () => {
    const storage: MockStorage = {};
    const authService = new AuthService(criarContextoFalso(storage));
    vscode.authentication.getSession = async () =>
      ({
        accessToken: "oauth-github",
        account: { label: "Aluno GitHub" },
      }) as vscode.AuthenticationSession;
    vscode.window.showErrorMessage = async () => undefined;
    const buscados: string[] = [];

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "api.github.com" && url.pathname === "/user") {
        return respostaJson({ login: "aluno", email: "pessoal@example.com" });
      }
      if (url.hostname === "api.github.com" && url.pathname === "/user/emails") {
        return respostaJson([
          { email: "pessoal@example.com", verified: true, primary: true },
          { email: "falso@example.com", verified: false, primary: false },
          { email: "Aluno@Example.com", verified: true, primary: false },
        ]);
      }
      if (url.pathname.endsWith("/login")) {
        return respostaJson({ access_token: "token-github-servidor" });
      }
      if (url.pathname.endsWith("/auth/me")) {
        // O /auth/me traz o e-mail principal e o ID do GitHub.
        return respostaJson(
          perfilServidor({ id: 176078921, email: "pessoal@example.com", time_id: undefined }),
        );
      }
      if (url.pathname.endsWith("/usuarios/por-email")) {
        const email = url.searchParams.get("email") ?? "";
        buscados.push(email);
        return email === "aluno@example.com"
          ? respostaJson(perfilServidor())
          : respostaJson({ detail: "Usuário não encontrado" }, 404);
      }
      if (url.pathname.endsWith("/usuarios/74/time")) {
        return respostaJson({ id: 46, nome_time: "Time de teste" });
      }
      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.loginComProvedorVSCode("github");

    // O e-mail não verificado nunca é usado.
    assert.deepStrictEqual(buscados, ["pessoal@example.com", "aluno@example.com"]);
    assert.strictEqual(authService.getSessaoAtual()?.userId, 74);
    assert.strictEqual(authService.getSessaoAtual()?.teamId, 46);
    assert.strictEqual(authService.getEstadoAtual().aviso, undefined);
    assert.deepStrictEqual(authService.getSessaoAtual()?.emailsProvedor, [
      "pessoal@example.com",
      "aluno@example.com",
    ]);
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
      const usuario = responderUsuarioDoServidor(url);
      if (usuario) {
        return usuario;
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
});
