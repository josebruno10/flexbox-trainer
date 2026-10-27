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
  ultimosParametros,
} from "./auxiliares";

// O login do Google, pelo site de autenticação e o retorno dele à extensão
// pelo endereço vscode://, como no VS Code pelo navegador. A volta pelo
// servidor local, do desktop, está em loginPeloRetornoLocal.test.ts.
suite("AuthService: login pelo site", () => {
  restaurarAoFim();

  test("envia state seguro e configuração ao site de autenticação", async () => {
    const authService = new AuthService(criarContextoFalso(), SEM_RETORNO_LOCAL);

    await iniciarFluxoGoogle(authService);

    assert.strictEqual(authService.getEstadoAtual().status, "checking");
    authService.dispose();
  });

  test("preserva o callback do vscode.dev, que contém ? e &", async () => {
    const authService = new AuthService(criarContextoFalso(), SEM_RETORNO_LOCAL);
    await iniciarFluxoGoogle(
      authService,
      "https://vscode.dev/callback?vscode-reqid=7&vscode-scheme=vscode&vscode-path=%2Fauth%2Fcallback",
    );

    const callback = new URL(ultimosParametros()?.get("callback") || "");
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
    const authService = new AuthService(criarContextoFalso(storage), SEM_RETORNO_LOCAL);
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
      const usuario = responderUsuarioDoServidor(url);
      if (usuario) {
        return usuario;
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

  test("identifica o aluno pelo e-mail quando o /auth/me traz o ID do provedor", async () => {
    const authService = new AuthService(criarContextoFalso(), SEM_RETORNO_LOCAL);
    const state = await iniciarFluxoGoogle(authService);
    const consultas: string[] = [];

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      consultas.push(`${url.pathname}${url.search}`);
      if (url.pathname.endsWith("/auth/me")) {
        // Cenário real: o login pelo GitHub devolveu o ID do provedor.
        return respostaJson({
          id: 176078921,
          nome: "Aluno",
          email: "aluno@example.com",
        });
      }
      if (url.pathname.endsWith("/usuarios/por-email")) {
        return respostaJson({ id: 74, nome: "Aluno", email: "aluno@example.com" });
      }
      if (url.pathname.endsWith("/usuarios/74/time")) {
        return respostaJson({ id: 46, nome_time: "Time de teste" });
      }
      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.processarCallback(
      vscode.Uri.parse(
        `vscode://flexbox-trainer.test/auth/callback#server_token=token-servidor&state=${state}`,
      ),
    );

    assert.strictEqual(authService.getSessaoAtual()?.userId, 74);
    assert.strictEqual(authService.getSessaoAtual()?.teamId, 46);
    assert.strictEqual(authService.getEstadoAtual().aviso, undefined);
    assert.deepStrictEqual(consultas, [
      "/api/auth/me",
      "/api/usuarios/por-email?email=aluno%40example.com",
      "/api/usuarios/74/time?evento=2",
    ]);
  });

  test("mantém o ID do /auth/me quando o e-mail não está cadastrado no servidor", async () => {
    const authService = new AuthService(criarContextoFalso(), SEM_RETORNO_LOCAL);
    const state = await iniciarFluxoGoogle(authService);
    const consultas: string[] = [];

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      consultas.push(url.pathname);
      if (url.pathname.endsWith("/auth/me")) {
        return respostaJson(perfilServidor());
      }
      if (url.pathname.endsWith("/usuarios/por-email")) {
        // O servidor responde "não existe" dentro de um 500.
        return respostaJson(
          { detail: "Erro ao buscar usuário: 404: Usuário não encontrado" },
          500,
        );
      }
      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await authService.processarCallback(
      vscode.Uri.parse(
        `vscode://flexbox-trainer.test/auth/callback#server_token=token-servidor&state=${state}`,
      ),
    );

    assert.strictEqual(authService.getSessaoAtual()?.userId, 74);
    assert.strictEqual(authService.getSessaoAtual()?.teamId, 46);
    assert.deepStrictEqual(consultas, ["/api/auth/me", "/api/usuarios/por-email"]);
    assert.strictEqual(authService.getEstadoAtual().status, "authenticated");
    assert.match(
      authService.getEstadoAtual().aviso ?? "",
      /aluno@example\.com não está cadastrado no torneio/,
    );

    await authService.invalidarSessao("Saiu.");
    assert.strictEqual(authService.getEstadoAtual().aviso, undefined);
  });

  test("não conclui o login quando a busca pelo e-mail falha por outro motivo", async () => {
    const authService = new AuthService(criarContextoFalso(), SEM_RETORNO_LOCAL);
    const state = await iniciarFluxoGoogle(authService);

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/auth/me")) {
        return respostaJson(perfilServidor());
      }
      if (url.pathname.endsWith("/usuarios/por-email")) {
        return respostaJson({ detail: "Acesso negado" }, 403);
      }
      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    await assert.rejects(
      authService.processarCallback(
        vscode.Uri.parse(
          `vscode://flexbox-trainer.test/auth/callback#server_token=token-servidor&state=${state}`,
        ),
      ),
      /buscar o usuário pelo e-mail \(HTTP 403\): Acesso negado/,
    );
    assert.strictEqual(authService.isAutenticado(), false);
  });

  test("troca token Gmail no POST /login e nunca persiste a credencial do provedor", async () => {
    const storage: MockStorage = {};
    const authService = new AuthService(criarContextoFalso(storage), SEM_RETORNO_LOCAL);
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
      const usuario = responderUsuarioDoServidor(url);
      if (usuario) {
        return usuario;
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
    const authService = new AuthService(criarContextoFalso(), SEM_RETORNO_LOCAL);
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
    const authService = new AuthService(criarContextoFalso(), SEM_RETORNO_LOCAL);
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
    const authService = new AuthService(criarContextoFalso(storage), SEM_RETORNO_LOCAL);
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
    const authService = new AuthService(criarContextoFalso(storage), SEM_RETORNO_LOCAL);
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

  test("um login aberto enquanto a sessão guardada é lida não é cancelado", async () => {
    // O comando de login também liga a extensão: a leitura da sessão
    // guardada (inicializar) termina depois de o login começar.
    const contexto = criarContextoFalso();
    let entregarSessao: (valor: undefined) => void = () => undefined;
    contexto.secrets.get = () =>
      new Promise((pronto) => {
        entregarSessao = pronto;
      });
    const authService = new AuthService(contexto, SEM_RETORNO_LOCAL);
    const leitura = authService.inicializar();

    const state = await iniciarFluxoGoogle(authService);
    entregarSessao(undefined);
    await leitura;

    assert.strictEqual(authService.getEstadoAtual().status, "checking");
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      return responderUsuarioDoServidor(url) ?? respostaJson(perfilServidor());
    };
    await authService.processarCallback(
      vscode.Uri.parse(
        `vscode://flexbox-trainer.test/auth/callback#server_token=token-servidor&state=${state}`,
      ),
    );
    assert.strictEqual(authService.isAutenticado(), true);
    authService.dispose();
  });

  test("sair cancela o login que estava aberto", async () => {
    const authService = new AuthService(criarContextoFalso(), SEM_RETORNO_LOCAL);
    const state = await iniciarFluxoGoogle(authService);

    await authService.logout();

    await assert.rejects(
      authService.processarCallback(
        vscode.Uri.parse(
          `vscode://flexbox-trainer.test/auth/callback#server_token=token-servidor&state=${state}`,
        ),
      ),
      /não iniciado por esta extensão/,
    );
    authService.dispose();
  });
});
