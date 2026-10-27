import * as assert from "assert";
import * as vscode from "vscode";
import { AuthService } from "../../../auth/authService";
import {
  assertBearer,
  criarContextoFalso,
  iniciarFluxoGoogle,
  MockStorage,
  perfilServidor,
  responderUsuarioDoServidor,
  respostaJson,
  restaurarAoFim,
  SEM_RETORNO_LOCAL,
} from "./auxiliares";

function sessaoGuardada(): Record<string, unknown> {
  return {
    accessToken: "token-restaurado",
    serverToken: "token-restaurado",
    email: "aluno@example.com",
    displayName: "Nome antigo",
    tokenGmail: "gmail",
    userId: 74,
    teamId: 46,
    remember: true,
    authenticatedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  };
}

function esperarAutenticado(
  authService: AuthService,
): Promise<{ displayName?: string }> {
  return new Promise((resolve) => {
    const assinatura = authService.onDidChangeEstado((estado) => {
      if (estado.status === "authenticated") {
        assinatura.dispose();
        resolve(estado);
      }
    });
  });
}

// A sessão guardada no VS Code: restaurar ao abrir, revalidar e encerrar.
suite("AuthService: sessão guardada", () => {
  restaurarAoFim();

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

  test("ao abrir, mostra a sessão guardada antes de o servidor responder", async () => {
    const authService = new AuthService(
      criarContextoFalso({ valor: JSON.stringify(sessaoGuardada()) }),
    );
    let liberar = () => {};
    const servidorRespondeu = new Promise<void>((resolve) => (liberar = resolve));
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/auth/me")) {
        await servidorRespondeu;
        return respostaJson(perfilServidor({ nome: "Nome atualizado" }));
      }
      return responderUsuarioDoServidor(url) ?? respostaJson({}, 404);
    };

    const autenticado = esperarAutenticado(authService);
    const abrindo = authService.inicializar();

    // O servidor ainda não respondeu, e a sessão já está na barra lateral.
    assert.strictEqual((await autenticado).displayName, "Nome antigo");
    assert.strictEqual(authService.getAccessToken(), "token-restaurado");

    liberar();
    await abrindo;
    assert.strictEqual(authService.getSessaoAtual()?.displayName, "Nome atualizado");
  });

  test("ao abrir sem resposta do servidor, a sessão guardada continua", async () => {
    const authService = new AuthService(
      criarContextoFalso({ valor: JSON.stringify(sessaoGuardada()) }),
    );
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };

    await authService.inicializar();

    assert.strictEqual(authService.isAutenticado(), true);
    assert.strictEqual(authService.getSessaoAtual()?.displayName, "Nome antigo");

    // Pedida pelo aluno, a revalidação mostra o erro.
    await authService.revalidarSessao();
    assert.strictEqual(authService.getEstadoAtual().status, "error");
  });

  test("sair enquanto a sessão é confirmada não a traz de volta", async () => {
    const authService = new AuthService(
      criarContextoFalso({ valor: JSON.stringify(sessaoGuardada()) }),
    );
    let liberar = () => {};
    const servidorRespondeu = new Promise<void>((resolve) => (liberar = resolve));
    globalThis.fetch = async (input: RequestInfo | URL) => {
      await servidorRespondeu;
      return responderUsuarioDoServidor(new URL(String(input))) ??
        respostaJson(perfilServidor());
    };

    const autenticado = esperarAutenticado(authService);
    const abrindo = authService.inicializar();
    await autenticado;
    await authService.invalidarSessao("Desconectado.");
    liberar();
    await abrindo;

    assert.strictEqual(authService.getEstadoAtual().status, "unauthenticated");
    assert.strictEqual(authService.getAccessToken(), undefined);
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

  test("ao reabrir, revalida o aluno pelos e-mails da conta guardados na sessão", async () => {
    const sessao = {
      accessToken: "token-restaurado",
      serverToken: "token-restaurado",
      email: "pessoal@example.com",
      displayName: "Aluno",
      tokenGmail: "github",
      userId: 74,
      teamId: 46,
      emailsProvedor: ["pessoal@example.com", "aluno@example.com"],
      remember: true,
      authenticatedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    };
    const authService = new AuthService(
      criarContextoFalso({ valor: JSON.stringify(sessao) }),
    );
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/auth/me")) {
        return respostaJson(
          perfilServidor({ id: 176078921, email: "pessoal@example.com", time_id: undefined }),
        );
      }
      if (url.pathname.endsWith("/usuarios/por-email")) {
        return url.searchParams.get("email") === "aluno@example.com"
          ? respostaJson(perfilServidor())
          : respostaJson({ detail: "Usuário não encontrado" }, 404);
      }
      if (url.pathname.endsWith("/usuarios/74/time")) {
        return respostaJson({ id: 46, nome_time: "Time de teste" });
      }
      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.inicializar();

    // Sem os e-mails guardados, a sessão passaria a usar o ID do GitHub.
    assert.strictEqual(authService.getSessaoAtual()?.userId, 74);
    assert.strictEqual(authService.getEstadoAtual().aviso, undefined);
  });

  test("invalidarSessao remove token e metadados", async () => {
    const storage: MockStorage = {};
    const authService = new AuthService(criarContextoFalso(storage), SEM_RETORNO_LOCAL);
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
