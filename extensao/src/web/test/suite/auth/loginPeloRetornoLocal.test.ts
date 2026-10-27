import * as assert from "assert";
import * as vscode from "vscode";
import { AuthService, ResultadoDoLogin } from "../../../auth/authService";
import { RetornoLocal } from "../../../auth/retornoLocal";
import {
  assertBearer,
  criarContextoFalso,
  MockStorage,
  mockarConfiguracaoAutenticacao,
  perfilServidor,
  responderUsuarioDoServidor,
  respostaJson,
  restaurarAoFim,
} from "./auxiliares";
import { enviarFormulario, pedir, postarRetorno } from "./navegadorFalso";

// Abre o login com Google e segue a ida, como o navegador faria: devolve o
// endereço do site com o que a extensão mandou.
async function abrirLogin(authService: AuthService): Promise<URLSearchParams> {
  mockarConfiguracaoAutenticacao();
  let aberto: unknown;
  vscode.env.openExternal = async (alvo) => {
    aberto = alvo;
    return true;
  };

  await authService.abrirLoginGoogle();

  // Um endereço local e curto: o VS Code o abre sem o aviso de site externo,
  // que mostra por inteiro um endereço passado como texto.
  assert.ok(aberto instanceof vscode.Uri, "abriu um texto, e não um vscode.Uri");
  const entrada = aberto as vscode.Uri;
  assert.strictEqual(entrada.scheme, "http");
  assert.match(entrada.authority, /^127\.0\.0\.1:\d+$/);
  assert.ok(entrada.toString().length < 80, entrada.toString());

  const ida = await pedir(entrada.toString(true));
  assert.strictEqual(ida.status, 302);
  const site = new URL(String(ida.cabecalhos.location));
  assert.strictEqual(site.origin + site.pathname, "https://auth.example.com/login/");
  return site.searchParams;
}

// O login com Google no desktop, que volta pelo servidor local.
suite("AuthService: login pelo servidor local", function () {
  restaurarAoFim();
  suiteSetup(function () {
    if (!RetornoLocal.disponivel()) {
      this.skip();
    }
  });

  test("abre o navegador sem aviso e recebe o login de volta, sem o vscode://", async () => {
    const storage: MockStorage = {};
    const authService = new AuthService(criarContextoFalso(storage));
    const voltas: ResultadoDoLogin[] = [];
    authService.onDidVoltarDoNavegador((resultado) => voltas.push(resultado));
    const parametros = await abrirLogin(authService);

    const callback = new URL(parametros.get("callback") ?? "");
    assert.match(callback.host, /^(127\.0\.0\.1|localhost):\d+$/);
    assert.strictEqual(callback.pathname, "/retorno");
    const state = parametros.get("state") ?? "";
    assert.match(state, /^[a-f0-9]{48}$/);
    assert.strictEqual(parametros.get("mode"), "login");

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/auth/me")) {
        assertBearer(init, "token-servidor");
        return respostaJson(perfilServidor());
      }
      const usuario = responderUsuarioDoServidor(url);
      if (usuario) {
        return usuario;
      }
      throw new Error(`Fetch inesperado: ${url.toString()}`);
    };

    // O site devolve o login num formulário, como o authserviceflexbox.
    const fim = await enviarFormulario(callback.toString(), {
      server_token: "token-servidor",
      provider: "gmail",
      remember: "1",
      mode: "login",
      state,
    });

    assert.match(fim.corpo, /Você entrou como Aluno Servidor\./);
    assert.strictEqual(authService.isAutenticado(), true);
    assert.strictEqual(authService.getAccessToken(), "token-servidor");
    assert.ok(storage.valor?.includes("token-servidor"));
    assert.deepStrictEqual(voltas, [{ ok: true, nome: "Aluno Servidor" }]);
    authService.dispose();
  });

  test("mostra na página e avisa a extensão quando o servidor recusa a sessão", async () => {
    const authService = new AuthService(criarContextoFalso());
    const voltas: ResultadoDoLogin[] = [];
    authService.onDidVoltarDoNavegador((resultado) => voltas.push(resultado));
    const parametros = await abrirLogin(authService);
    globalThis.fetch = async () => respostaJson({ detail: "Token inválido" }, 401);

    const fim = await enviarFormulario(parametros.get("callback") ?? "", {
      server_token: "ruim",
      state: parametros.get("state") ?? "",
    });

    assert.match(fim.corpo, /Não deu para entrar/);
    assert.match(fim.corpo, /HTTP 401/);
    assert.strictEqual(authService.isAutenticado(), false);
    assert.strictEqual(voltas.length, 1);
    assert.strictEqual(voltas[0].ok, false);
    authService.dispose();
  });

  test("também recebe o login no fragmento, como mandava o site antigo", async () => {
    const authService = new AuthService(criarContextoFalso());
    const parametros = await abrirLogin(authService);
    globalThis.fetch = async (input: RequestInfo | URL) =>
      responderUsuarioDoServidor(new URL(String(input))) ?? respostaJson(perfilServidor());

    const fim = await postarRetorno(parametros.get("callback") ?? "", {
      fragmento: `server_token=token-servidor&state=${parametros.get("state")}`,
    });

    const dados = JSON.parse(fim.corpo) as Record<string, string>;
    assert.strictEqual(dados.estado, "ok");
    assert.strictEqual(dados.titulo, "Pronto!");
    assert.strictEqual(authService.isAutenticado(), true);
    authService.dispose();
  });

  test("um login novo fecha o servidor do anterior, também num clique duplo", async () => {
    const authService = new AuthService(criarContextoFalso());
    const primeiro = await abrirLogin(authService);
    await abrirLogin(authService);
    await assert.rejects(
      enviarFormulario(primeiro.get("callback") ?? "", {
        server_token: "x",
        state: primeiro.get("state") ?? "",
      }),
    );

    // Dois cliques antes de o primeiro abrir o navegador: só o último vale.
    const abertos: vscode.Uri[] = [];
    vscode.env.openExternal = async (alvo) => {
      abertos.push(alvo as vscode.Uri);
      return true;
    };
    await Promise.all([authService.abrirLoginGoogle(), authService.abrirLoginGoogle()]);
    const respostas = await Promise.allSettled(abertos.map((alvo) => pedir(alvo.toString(true))));
    assert.deepStrictEqual(
      respostas.map((resposta) => resposta.status),
      ["rejected", "fulfilled"],
    );
    authService.dispose();
  });

  test("volta pelo vscode:// quando o navegador não chega ao servidor por 127.0.0.1", async () => {
    // Num Codespace, a porta local vira um endereço do github.dev, que o
    // site não aceita como retorno; sem o servidor, o mesmo.
    const casos: Array<() => void> = [
      () => {
        vscode.env.asExternalUri = async (uri) =>
          uri.scheme === "http"
            ? vscode.Uri.parse("https://exemplo-4000.app.github.dev/retorno")
            : uri;
      },
      () => undefined,
    ];
    for (const [indice, preparar] of casos.entries()) {
      const authService = new AuthService(
        criarContextoFalso(),
        indice === 1
          ? {
              abrirRetornoLocal: async () => {
                throw new Error("porta ocupada");
              },
            }
          : {},
      );
      mockarConfiguracaoAutenticacao();
      preparar();
      let aberto: unknown;
      vscode.env.openExternal = async (alvo) => {
        aberto = alvo;
        return true;
      };

      await authService.abrirLoginGoogle();

      assert.strictEqual(typeof aberto, "string", `caso ${indice}`);
      const callback = new URL(aberto as string).searchParams.get("callback") ?? "";
      assert.ok(callback.endsWith("/auth/callback"), callback);
      authService.dispose();
    }
  });
});
