import * as assert from "assert";
import { ConteudoDoAluno } from "../../services/servidor/conteudo";
import {
  conteudoDeTeste,
  testarProgressoNaPasta,
} from "../../services/testeDoProgresso";
import { ConfiguracaoServidor } from "../../types";

const BASE_API = "https://api.teste.com/api";
const PASTA = "fb74_2/46_74";
const CONFIGURACAO: ConfiguracaoServidor = {
  apiBaseUrl: BASE_API,
  apiToken: "token-da-sessao",
  eventoTreino: "fb74",
  userId: 74,
  teamId: 46,
};
const AGORA = new Date("2026-11-19T15:00:00.000Z");
const SALVO: ConteudoDoAluno = { html: "<main>meu</main>", css: "main { gap: 8px; }" };

function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Um servidor com uma pasta; "alterarAoLer" imita um servidor que muda o texto.
function simularServidor(
  inicial?: ConteudoDoAluno,
  alterarAoLer = (texto: string) => texto,
) {
  const estado = { pasta: inicial, pedidos: [] as string[] };
  globalThis.fetch = async (input, init) => {
    const metodo = init?.method ?? "GET";
    const caminho = String(input).replace(BASE_API, "");
    estado.pedidos.push(`${metodo} ${caminho.split("?")[0]}`);

    if (caminho.startsWith("/criar-pasta/")) {
      return json({ code_pasta: PASTA });
    }
    if (caminho === "/salvar-conteudo" && metodo === "POST") {
      const corpo = new URLSearchParams(String(init?.body));
      estado.pasta = {
        html: corpo.get("index_conteudo") ?? "",
        css: corpo.get("style_conteudo") ?? "",
      };
      return json({ message: "Conteúdo salvo" });
    }
    if (caminho.startsWith("/obter-conteudo")) {
      return estado.pasta
        ? json({
            "index.html": { conteudo: alterarAoLer(estado.pasta.html) },
            "style.css": { conteudo: alterarAoLer(estado.pasta.css) },
          })
        : json({ detail: "404: Conteúdo não encontrado" }, 500);
    }
    return json({ detail: "rota inesperada" }, 404);
  };
  return estado;
}

suite("Teste do progresso no servidor", () => {
  const fetchOriginal = globalThis.fetch;

  teardown(() => {
    globalThis.fetch = fetchOriginal;
  });

  test("grava o teste, puxa de volta e regrava o que estava salvo", async () => {
    const servidor = simularServidor(SALVO);
    const copias: ConteudoDoAluno[] = [];

    const relatorio = await testarProgressoNaPasta(
      CONFIGURACAO,
      "fb74",
      async (conteudo) => {
        copias.push(conteudo);
        return "/copias/fb74.json";
      },
      AGORA,
    );

    assert.strictEqual(relatorio.ok, true, JSON.stringify(relatorio.passos));
    assert.strictEqual(relatorio.codePasta, PASTA);
    assert.strictEqual(relatorio.copiaLocal, "/copias/fb74.json");
    assert.deepStrictEqual(copias, [SALVO]);
    assert.deepStrictEqual(servidor.pasta, SALVO);
    assert.deepStrictEqual(servidor.pedidos, [
      "POST /criar-pasta/fb74/46/74",
      "GET /obter-conteudo",
      "POST /salvar-conteudo",
      "GET /obter-conteudo",
      "POST /salvar-conteudo",
      "GET /obter-conteudo",
    ]);
  });

  test("nunca pede ao servidor para excluir nada", async () => {
    const servidor = simularServidor(SALVO, (texto) => `${texto} `);
    await testarProgressoNaPasta(CONFIGURACAO, "fb74", async () => "copia", AGORA);
    assert.ok(servidor.pedidos.length > 0);
    assert.ok(servidor.pedidos.every((pedido) => !pedido.startsWith("DELETE")));
  });

  test("numa pasta vazia, não faz cópia e o teste fica nela", async () => {
    const servidor = simularServidor();
    let copiou = false;

    const relatorio = await testarProgressoNaPasta(
      CONFIGURACAO,
      "fb74",
      async () => {
        copiou = true;
        return "copia";
      },
      AGORA,
    );

    assert.strictEqual(relatorio.ok, true, JSON.stringify(relatorio.passos));
    assert.strictEqual(copiou, false);
    assert.deepStrictEqual(servidor.pasta, conteudoDeTeste(AGORA));
  });

  test("se a cópia no computador falha, nada é gravado", async () => {
    const servidor = simularServidor(SALVO);

    const relatorio = await testarProgressoNaPasta(
      CONFIGURACAO,
      "fb74",
      async () => {
        throw new Error("disco cheio");
      },
      AGORA,
    );

    assert.strictEqual(relatorio.ok, false);
    assert.ok(servidor.pedidos.every((pedido) => pedido !== "POST /salvar-conteudo"));
    assert.deepStrictEqual(servidor.pasta, SALVO);
  });

  test("conteúdo que volta diferente é falha, e o salvo é regravado", async () => {
    const servidor = simularServidor(SALVO, (texto) => texto.trim() + "\n");
    const copias: ConteudoDoAluno[] = [];

    const relatorio = await testarProgressoNaPasta(
      CONFIGURACAO,
      "fb74",
      async (conteudo) => {
        copias.push(conteudo);
        return "copia";
      },
      AGORA,
    );

    assert.strictEqual(relatorio.ok, false);
    const puxar = relatorio.passos.find((passo) => passo.nome === "Puxar o teste de volta");
    assert.strictEqual(puxar?.ok, false);
    assert.match(puxar?.detalhe ?? "", /o index\.html e o style\.css voltaram diferentes/);
    // Volta para a pasta exatamente o que foi lido dela (e copiado) antes.
    assert.deepStrictEqual(servidor.pasta, copias[0]);
  });
});
