import * as assert from "assert";
import * as vscode from "vscode";
import {
  AlteracaoExterna,
  MonitorAlteracoesExternas,
  registrarGravacaoPropria,
} from "../../services/alteracoesExternas";

const ESPERA_MS = 20;

suite("Alterações fora do editor", () => {
  let contador = 0;
  let disco: Map<string, string>;
  let detectadas: AlteracaoExterna[];
  let lidas: string[];
  let monitor: MonitorAlteracoesExternas;

  // O registro de gravações é do módulo: cada teste usa arquivos próprios.
  const arquivo = (caminho: string) =>
    vscode.Uri.file(`/teste-${contador}/${caminho}`);
  const documento = (uri: vscode.Uri, texto: string) => ({
    uri,
    getText: () => texto,
  });

  setup(() => {
    contador++;
    disco = new Map();
    detectadas = [];
    lidas = [];
    monitor = new MonitorAlteracoesExternas(
      (alteracao) => detectadas.push(alteracao),
      async (uri) => {
        lidas.push(uri.path);
        return disco.get(uri.toString());
      },
      ESPERA_MS,
    );
  });

  teardown(() => monitor.dispose());

  test("avisa quando o arquivo é gravado fora do editor", async () => {
    const index = arquivo("index.html");
    disco.set(index.toString(), "<main>escrito por um assistente</main>");
    const antes = Date.now();

    monitor.registrarMudanca(index);
    await esperar(ESPERA_MS * 5);

    assert.strictEqual(detectadas.length, 1);
    assert.strictEqual(detectadas[0].uri.toString(), index.toString());
    assert.ok(detectadas[0].instante >= antes);
  });

  test("aceita o salvamento do editor mesmo quando o disco avisa antes de ele terminar", async () => {
    const style = arquivo("style.css");
    const formatado = "main {\n  color: red;\n}\n";

    // Como no VS Code: começa a salvar, o disco avisa e só depois o
    // salvamento termina, com o texto que o formatador mudou.
    monitor.registrarInicioSalvamento(documento(style, "main{color:red}"));
    disco.set(style.toString(), formatado);
    monitor.registrarMudanca(style);
    await esperar(ESPERA_MS * 3);
    monitor.registrarFimSalvamento(documento(style, formatado));
    await esperar(ESPERA_MS * 5);

    assert.deepStrictEqual(detectadas, []);
  });

  test("aceita os arquivos gravados pela própria extensão", async () => {
    const index = arquivo("index.html");
    registrarGravacaoPropria(index, "<!doctype html>\n");
    disco.set(index.toString(), "<!doctype html>\n");

    monitor.registrarMudanca(index);
    await esperar(ESPERA_MS * 5);

    assert.deepStrictEqual(detectadas, []);
  });

  test("ignora arquivo vazio ou apagado, pastas de build e outros nomes", async () => {
    const vazio = arquivo("index.html");
    disco.set(vazio.toString(), "  \n");
    const apagado = arquivo("style.css");

    for (const uri of [
      vazio,
      apagado,
      arquivo("node_modules/pacote/index.html"),
      arquivo("app.js"),
    ]) {
      monitor.registrarMudanca(uri);
    }
    await esperar(ESPERA_MS * 5);

    assert.deepStrictEqual(detectadas, []);
    assert.deepStrictEqual(lidas.sort(), [vazio.path, apagado.path].sort());
  });

  test("junta os avisos repetidos de uma gravação em uma só conferência", async () => {
    const index = arquivo("index.html");
    disco.set(index.toString(), "<main>de fora</main>");

    monitor.registrarMudanca(index);
    monitor.registrarMudanca(index);
    monitor.registrarMudanca(index);
    await esperar(ESPERA_MS * 5);

    assert.strictEqual(lidas.length, 1);
    assert.strictEqual(detectadas.length, 1);
  });
});

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}
