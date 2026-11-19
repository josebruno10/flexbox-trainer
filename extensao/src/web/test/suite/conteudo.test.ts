import * as assert from "assert";
import {
  extrairCodePasta,
  obterConteudo,
  obterPastaDoAluno,
} from "../../services/servidor/conteudo";
import { ConfiguracaoServidor } from "../../types";

const BASE_API = "https://api.teste.com/api";
const CONFIGURACAO: ConfiguracaoServidor = {
  apiBaseUrl: BASE_API,
  apiToken: "token-da-sessao",
  eventoTreino: "fb74",
  userId: 74,
  teamId: 46,
};

function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// As rotas do progresso: criar-pasta e obter-conteudo.
suite("Conteúdo do aluno no servidor", () => {
  const fetchOriginal = globalThis.fetch;

  teardown(() => {
    globalThis.fetch = fetchOriginal;
  });

  test("tenta GET em criar-pasta quando o servidor não aceita POST", async () => {
    const pedidos: string[] = [];
    globalThis.fetch = async (input, init) => {
      const metodo = init?.method ?? "GET";
      pedidos.push(`${metodo} ${String(input).replace(BASE_API, "")}`);
      return metodo === "POST"
        ? json({ detail: "Method Not Allowed" }, 405)
        : json({ code_pasta: "fb74_2/46_74" });
    };

    assert.strictEqual(await obterPastaDoAluno(CONFIGURACAO), "fb74_2/46_74");
    assert.deepStrictEqual(pedidos, [
      "POST /criar-pasta/fb74/46/74",
      "GET /criar-pasta/fb74/46/74",
    ]);
  });

  test("vale a pasta original quando o aluno mudou de time", () => {
    assert.strictEqual(extrairCodePasta({ code_pasta: "fb74_2/46_74" }), "fb74_2/46_74");
    assert.strictEqual(
      extrairCodePasta({
        code_pasta: "fb74_2/50_74",
        code_pasta_original: "fb74_2/46_74",
        usuario_mudou_de_time: true,
      }),
      "fb74_2/46_74",
    );
    assert.strictEqual(extrairCodePasta({ code_pasta: " " }), undefined);
    assert.strictEqual(extrairCodePasta("Sucesso"), undefined);
  });

  test("uma pasta sem conteúdo não é erro", async () => {
    globalThis.fetch = async () => json({ detail: "404: Conteúdo não encontrado" }, 500);
    assert.strictEqual(await obterConteudo(CONFIGURACAO, "fb74_2/46_74"), undefined);

    globalThis.fetch = async () => json({ "index.html": { conteudo: "<p></p>" } });
    assert.deepStrictEqual(await obterConteudo(CONFIGURACAO, "fb74_2/46_74"), {
      html: "<p></p>",
      css: "",
    });
  });
});
