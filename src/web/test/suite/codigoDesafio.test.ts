import * as assert from "assert";
import {
  aleatorioDoCodigo,
  formatarCodigo,
  normalizarCodigo,
  sortearCodigo,
} from "../../services/codigoDesafio";
import { criarDesafioPorCodigo } from "../../services/desafio";

suite("Código do desafio", () => {
  test("aceita o código com ou sem espaço e recusa o resto", () => {
    assert.strictEqual(normalizarCodigo("482917"), "482917");
    assert.strictEqual(normalizarCodigo(" 482 917 "), "482917");
    assert.strictEqual(normalizarCodigo("482-917"), "482917");
    for (const invalido of ["", "48291", "4829170", "48291a", "abc def"]) {
      assert.strictEqual(normalizarCodigo(invalido), undefined, invalido);
    }
  });

  test("mostra o código em dois grupos de três dígitos", () => {
    assert.strictEqual(formatarCodigo("482917"), "482 917");
  });

  test("sorteia sempre 6 dígitos, inclusive com zeros à esquerda", () => {
    assert.strictEqual(sortearCodigo(() => 0), "000000");
    assert.strictEqual(sortearCodigo(() => 0.000123), "000123");
    assert.strictEqual(sortearCodigo(() => 0.9999999), "999999");
    for (let vez = 0; vez < 50; vez++) {
      assert.match(sortearCodigo(), /^\d{6}$/);
    }
  });

  test("o mesmo código dá a mesma sequência; códigos vizinhos, outras", () => {
    const primeiro = aleatorioDoCodigo("000001");
    const outraVez = aleatorioDoCodigo("000001");
    const vizinho = aleatorioDoCodigo("000002");
    const sequencia = [primeiro(), primeiro(), primeiro()];

    assert.deepStrictEqual([outraVez(), outraVez(), outraVez()], sequencia);
    assert.notDeepStrictEqual([vizinho(), vizinho(), vizinho()], sequencia);
    assert.ok(sequencia.every((valor) => valor >= 0 && valor < 1));
  });

  test("o mesmo código gera a mesma imagem, em tentativas diferentes", () => {
    const primeira = criarDesafioPorCodigo("482917");
    const segunda = criarDesafioPorCodigo("482917");

    assert.strictEqual(primeira.codigo, "482917");
    assert.strictEqual(primeira.backgroundColor, segunda.backgroundColor);
    assert.deepStrictEqual(primeira.blocks, segunda.blocks);
    // Cada vez é uma tentativa nova.
    assert.notStrictEqual(primeira.challengeId, segunda.challengeId);
    assert.match(primeira.challengeId, /^challenge-482917-[a-z0-9]+$/);
    assert.notDeepStrictEqual(criarDesafioPorCodigo("482918").blocks, primeira.blocks);
  });

  test("sem código, sorteia um", () => {
    const desafio = criarDesafioPorCodigo();
    assert.match(desafio.codigo ?? "", /^\d{6}$/);
    assert.deepStrictEqual(
      criarDesafioPorCodigo(desafio.codigo).blocks,
      desafio.blocks,
    );
  });

  // Códigos já passados à turma precisam continuar gerando os mesmos
  // desafios. Se este teste falhar, o gerador mudou: os códigos antigos
  // passam a dar outras imagens.
  test("os códigos continuam gerando os mesmos desafios entre versões", () => {
    const desafio = criarDesafioPorCodigo("482917");
    const resumo = {
      fundo: desafio.backgroundColor,
      componentes: desafio.blocks.length,
      primeiro: desafio.blocks[0],
    };
    assert.deepStrictEqual(resumo, ASSINATURA_482917);
  });
});

// Tirada do gerador da versão 0.4.0.
const ASSINATURA_482917 = {
  fundo: "#15fa54",
  componentes: 77,
  primeiro: {
    id: 1,
    parentId: undefined,
    x: 0,
    y: 0,
    width: 300,
    height: 121,
    color: "#29e151",
    borderRadius: 0,
    shape: "rectangle",
  },
};
