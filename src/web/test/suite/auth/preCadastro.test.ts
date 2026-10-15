import * as assert from "assert";
import * as vscode from "vscode";
import { AuthService } from "../../../auth/authService";
import {
  criarContextoFalso,
  mockarConfiguracaoAutenticacao,
  perfilServidor,
  respostaJson,
  restaurarAoFim,
} from "./auxiliares";

// O pré-cadastro de quem entra com um e-mail que o torneio não conhece.
suite("AuthService: pré-cadastro no torneio", () => {
  restaurarAoFim();

  const DADOS = { nome: "Aluno Novo", turma: 2025, periodo: 1, sede: 7, nivel: 2 };
  type Pedido = { metodo: string; caminho: string; corpo?: Record<string, string> };

  // Login pelo GitHub com um e-mail que o torneio ainda não conhece.
  async function entrarSemCadastro(
    servidor: { cadastrado: boolean; timeAutomatico?: boolean },
    pedidos: Pedido[],
  ): Promise<AuthService> {
    const authService = new AuthService(criarContextoFalso({}));
    vscode.authentication.getSession = async () =>
      ({ accessToken: "oauth-github", account: { label: "Aluno" } }) as vscode.AuthenticationSession;
    vscode.window.showErrorMessage = async () => undefined;
    let noTime = false;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const metodo = init?.method ?? "GET";
      const corpo =
        typeof init?.body === "string" && init.body.includes("=")
          ? Object.fromEntries(new URLSearchParams(init.body))
          : undefined;
      if (url.hostname !== "api.github.com" && !url.pathname.endsWith("/login")) {
        pedidos.push({ metodo, caminho: url.pathname.replace("/api", ""), corpo });
      }
      if (url.hostname === "api.github.com") {
        return url.pathname === "/user"
          ? respostaJson({ login: "aluno", email: "novo@example.com" })
          : respostaJson([]);
      }
      if (url.pathname.endsWith("/login")) {
        return respostaJson({ access_token: "token-servidor" });
      }
      if (url.pathname.endsWith("/auth/me")) {
        return respostaJson(perfilServidor({ id: 176078921, email: "novo@example.com", time_id: undefined }));
      }
      if (url.pathname.endsWith("/usuarios/por-email")) {
        return servidor.cadastrado
          ? respostaJson(perfilServidor({ id: 900, email: "novo@example.com", time_id: undefined }))
          : respostaJson({ detail: "Usuário não encontrado" }, 404);
      }
      if (url.pathname.endsWith("/usuarios") && metodo === "POST") {
        servidor.cadastrado = true;
        noTime = Boolean(servidor.timeAutomatico);
        return respostaJson({ message: "Usuário criado", usuario: { id: 900, email: "novo@example.com" } });
      }
      if (url.pathname.endsWith("/times/45/integrantes")) {
        noTime = true;
        return respostaJson({ message: "Integrante adicionado" });
      }
      if (url.pathname.endsWith("/usuarios/176078921/time")) {
        return respostaJson({ detail: "Usuário não encontrado" }, 404);
      }
      if (url.pathname.endsWith("/usuarios/900/time")) {
        return noTime
          ? respostaJson({ id: 45, nome_time: "Time genérico" })
          : respostaJson({ detail: "Time não encontrado" }, 404);
      }
      if (url.pathname.endsWith("/eventos/2/sedes")) {
        return respostaJson({ sedes: [{ id: 7, nome_campus: "Campus Três Lagoas" }] });
      }
      if (url.pathname.endsWith("/categorias")) {
        return respostaJson([{ cod: 1, nome: "Médio" }, { cod: 2, nome: "Graduação" }]);
      }
      throw new Error(`Fetch inesperado: ${metodo} ${url.toString()}`);
    };
    await authService.loginComProvedorVSCode("github");
    return authService;
  }

  test("cadastra o aluno, põe no time genérico e passa a corrigir com o ID novo", async () => {
    mockarConfiguracaoAutenticacao({ preCadastro: true });
    const pedidos: Pedido[] = [];
    const authService = await entrarSemCadastro({ cadastrado: false }, pedidos);

    assert.strictEqual(authService.getEstadoAtual().podeCadastrar, true);
    const opcoes = await authService.carregarOpcoesCadastro();
    assert.deepStrictEqual(opcoes.sedes, [{ id: 7, nome: "Campus Três Lagoas" }]);
    assert.deepStrictEqual(opcoes.niveis.map((nivel) => nivel.cod), [1, 2]);

    pedidos.length = 0;
    await authService.cadastrarNoTorneio(DADOS);

    const cadastro = pedidos.find((pedido) => pedido.caminho === "/usuarios");
    assert.deepStrictEqual(cadastro?.corpo, {
      nome: "Aluno Novo",
      email: "novo@example.com",
      turma: "2025",
      periodo: "1",
      sede: "7",
      nivel: "2",
      categoria: "2",
      url_image_perfil: "https://example.com/avatar.png",
    });
    const time = pedidos.find((pedido) => pedido.caminho === "/times/45/integrantes");
    assert.deepStrictEqual(time?.corpo, { usuario_id: "900", funcao: "INTEGRANTE", evento: "2" });
    assert.strictEqual(authService.getSessaoAtual()?.userId, 900);
    assert.strictEqual(authService.getSessaoAtual()?.teamId, 45);
    assert.strictEqual(authService.getEstadoAtual().aviso, undefined);
    assert.strictEqual(authService.getEstadoAtual().podeCadastrar, false);
  });

  test("não chama a rota do time quando o servidor já põe o aluno no time genérico", async () => {
    mockarConfiguracaoAutenticacao({ preCadastro: true });
    const pedidos: Pedido[] = [];
    const authService = await entrarSemCadastro({ cadastrado: false, timeAutomatico: true }, pedidos);

    await authService.cadastrarNoTorneio(DADOS);

    assert.ok(!pedidos.some((pedido) => pedido.caminho.includes("/times/")));
    assert.strictEqual(authService.getSessaoAtual()?.teamId, 45);
  });

  test("desligado, não oferece o cadastro nem escreve no servidor", async () => {
    mockarConfiguracaoAutenticacao({ preCadastro: false });
    const pedidos: Pedido[] = [];
    const authService = await entrarSemCadastro({ cadastrado: false }, pedidos);

    assert.ok(authService.getEstadoAtual().aviso);
    assert.strictEqual(authService.getEstadoAtual().podeCadastrar, false);
    await assert.rejects(authService.cadastrarNoTorneio(DADOS), /não está disponível/);
    assert.ok(!pedidos.some((pedido) => pedido.metodo === "POST"));
  });
});
