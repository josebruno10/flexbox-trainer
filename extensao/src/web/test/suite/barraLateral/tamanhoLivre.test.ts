import * as assert from "assert";
import * as vscode from "vscode";
import { formatoDoCodigo } from "../../../formatos";
import { sortearCodigo } from "../../../services/codigoDesafio";
import { chaveDosTamanhosLivres } from "../../../services/tamanhosLivres";
import {
  criarBarraFalsa,
  criarProvedorParaTeste,
  criarRegistroFalso,
  json,
  mockarConfiguracaoServidorValida,
  mockarServidor,
  ProvedorInterno,
  restaurarAoFim,
  ultimaMensagem,
} from "./auxiliares";

// O formato livre: o aluno escolhe a largura e a altura antes de gerar, o
// código é de 4 letras, e quem abre o código em outro computador lê o
// tamanho do gabarito da dinâmica do desafio, no servidor.

const ALUNO = "aluno@teste.com";
const NAO_EXISTE = () =>
  json({ detail: "Erro ao obter tipo de dinâmica: 404: Evento não encontrado." }, 500);
const espera = () => new Promise((pronto) => setTimeout(pronto, 0));

suite("Barra lateral: formato livre", () => {
  restaurarAoFim();
  const randomOriginal = Math.random;
  teardown(() => {
    Math.random = randomOriginal;
  });

  function preparar(registro = criarRegistroFalso()) {
    mockarConfiguracaoServidorValida();
    const provedor = criarProvedorParaTeste([], { registro });
    const interno = provedor as unknown as ProvedorInterno;
    interno.testarConexaoServidor = async () => undefined;
    const barra = criarBarraFalsa();
    provedor.resolveWebviewView(barra.vista);
    barra.receber({ type: "pronto" });
    return { provedor, interno, barra, registro };
  }

  test("guarda a largura e a altura e gera com um código que o servidor não tem", async () => {
    const { provedor, interno, barra, registro } = preparar();
    assert.deepStrictEqual(ultimaMensagem(barra.enviadas, "tamanhoLivre")?.payload, {
      largura: 1000,
      altura: 600,
    });

    barra.receber({ type: "definirFormato", formato: "livre" });
    barra.receber({ type: "definirTamanhoLivre", largura: 1200, altura: 500 });
    await espera();
    assert.deepStrictEqual(registro.get("flexboxTrainer.tamanhoLivre"), { largura: 1200, altura: 500 });
    assert.deepStrictEqual(ultimaMensagem(barra.enviadas, "tamanhoLivre")?.payload, {
      largura: 1200,
      altura: 500,
    });
    // Fora dos limites (de 300 a 1800 de largura e de 300 a 1200 de altura),
    // ou sem ser número inteiro, não vale.
    for (const errado of [
      { largura: 100, altura: 500 },
      { largura: 1801, altura: 500 },
      { largura: 1200, altura: 1201 },
      { largura: 1200, altura: 1800 },
      { largura: "1200", altura: 500 },
      { largura: 1200.5, altura: 500 },
    ]) {
      barra.receber({ type: "definirTamanhoLivre", ...errado });
    }
    await espera();
    assert.deepStrictEqual(provedor.tamanhoLivreEscolhido(), { largura: 1200, altura: 500 });
    // O máximo vale.
    barra.receber({ type: "definirTamanhoLivre", largura: 1800, altura: 1200 });
    await espera();
    assert.deepStrictEqual(provedor.tamanhoLivreEscolhido(), { largura: 1800, altura: 1200 });
    barra.receber({ type: "definirTamanhoLivre", largura: 1200, altura: 500 });
    await espera();

    // O primeiro código sorteado já tem dinâmica no servidor; fica o segundo.
    const sorteios = [0, 0.5];
    Math.random = () => sorteios.shift() ?? randomOriginal();
    const ocupado = sortearCodigo("medio", "livre", () => 0);
    const livre = sortearCodigo("medio", "livre", () => 0.5);
    const requisicoes = mockarServidor({
      [`GET /tipoDinamica/${ocupado.toLowerCase()}`]: () => json({ evento: ocupado.toLowerCase(), tipo: 2 }),
      [`GET /tipoDinamica/${livre.toLowerCase()}`]: NAO_EXISTE,
    });

    await provedor.iniciarNovoDesafio();
    const desafio = interno.tentativa.desafio!;
    assert.strictEqual(desafio.codigo, livre);
    assert.strictEqual(formatoDoCodigo(livre), "livre");
    assert.deepStrictEqual([desafio.width, desafio.height], [1200, 500]);
    assert.strictEqual(desafio.nivel, "medio");
    // Gerar só consulta: nada é criado no servidor antes do Verificar.
    assert.ok(requisicoes.every((requisicao) => requisicao.metodo === "GET"));
    assert.deepStrictEqual(registro.get(chaveDosTamanhosLivres(ALUNO)), [
      [livre, { largura: 1200, altura: 500 }],
    ]);

    // Mudar o tamanho depois não muda o desafio gerado: o Refazer usa o dele,
    // sem perguntar ao servidor.
    barra.receber({ type: "definirTamanhoLivre", largura: 400, altura: 900 });
    await espera();
    mockarServidor({});
    await provedor.iniciarNovoDesafio(livre);
    const refeito = interno.tentativa.desafio!;
    assert.notStrictEqual(refeito.challengeId, desafio.challengeId);
    assert.deepStrictEqual([refeito.width, refeito.height], [1200, 500]);
    assert.deepStrictEqual(refeito.blocks, desafio.blocks);
  });

  test("em outro computador, o tamanho vem do gabarito da dinâmica no servidor", async () => {
    const { provedor, interno, registro } = preparar();
    const codigo = sortearCodigo("facil", "livre", () => 0.25);
    mockarServidor({
      [`GET /tipo-dinamica/${codigo.toLowerCase()}/gabaritos`]: () =>
        json([[312, `/gabaritos/gab_${codigo.toLowerCase()}_tam_1400x900.png`]]),
    });

    await provedor.iniciarNovoDesafio(codigo);
    const desafio = interno.tentativa.desafio!;
    assert.strictEqual(desafio.codigo, codigo);
    assert.deepStrictEqual([desafio.width, desafio.height], [1400, 900]);
    assert.strictEqual(desafio.nivel, "facil");
    // Fica guardado para o Refazer e o Histórico.
    assert.deepStrictEqual(registro.get(chaveDosTamanhosLivres(ALUNO)), [
      [codigo, { largura: 1400, altura: 900 }],
    ]);
  });

  test("um tamanho do servidor fora dos limites não vale", async () => {
    const { provedor, interno } = preparar();
    vscode.window.showWarningMessage = (async () => undefined) as typeof vscode.window.showWarningMessage;
    const codigo = sortearCodigo("medio", "livre", () => 0.5);
    mockarServidor({
      [`GET /tipo-dinamica/${codigo.toLowerCase()}/gabaritos`]: () =>
        json([[313, `/gabaritos/gab_${codigo.toLowerCase()}_tam_1920x1080.png`]]),
    });

    await provedor.iniciarNovoDesafio(codigo);
    assert.strictEqual(interno.tentativa.desafio, undefined);
  });

  test("sem o tamanho no servidor, avisa e não troca o desafio", async () => {
    const { provedor, interno } = preparar();
    const avisos: string[] = [];
    vscode.window.showWarningMessage = (async (mensagem: string) => {
      avisos.push(mensagem);
      return undefined;
    }) as typeof vscode.window.showWarningMessage;
    const codigo = sortearCodigo("medio", "livre", () => 0.75);
    mockarServidor({
      [`GET /tipo-dinamica/${codigo.toLowerCase()}/gabaritos`]: () =>
        json({ detail: "Nenhum gabarito encontrado" }, 404),
    });

    await provedor.iniciarNovoDesafio(codigo);
    assert.strictEqual(interno.tentativa.desafio, undefined);
    assert.strictEqual(avisos.length, 1);
    assert.match(avisos[0], new RegExp(`${codigo} é de tamanho livre`));
  });
});
