import * as assert from "assert";
import {
  aleatorioDoCodigo,
  codigoDoDia,
  formatarCodigo,
  normalizarCodigo,
  sortearCodigo,
} from "../../services/codigoDesafio";
import { criarDesafioPorCodigo } from "../../services/desafio";
import { NIVEIS, nivelDoCodigo } from "../../niveis";

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

  test("sorteia sempre 6 dígitos, inclusive com zeros à esquerda, no nível pedido", () => {
    assert.strictEqual(sortearCodigo("facil", () => 0), "000000");
    assert.strictEqual(sortearCodigo("medio", () => 0), "000001");
    assert.strictEqual(sortearCodigo("dificil", () => 0), "000002");
    assert.strictEqual(sortearCodigo("facil", () => 0.9999999), "999999");
    assert.strictEqual(sortearCodigo("medio", () => 0.9999999), "999997");
    assert.strictEqual(sortearCodigo("dificil", () => 0.9999999), "999998");
    for (const nivel of NIVEIS) {
      for (let vez = 0; vez < 50; vez++) {
        const codigo = sortearCodigo(nivel);
        assert.match(codigo, /^\d{6}$/);
        assert.strictEqual(nivelDoCodigo(codigo), nivel);
      }
    }
  });

  test("o nível vem do código, pelo resto da divisão por 3", () => {
    assert.strictEqual(nivelDoCodigo("000000"), "facil");
    assert.strictEqual(nivelDoCodigo("482917"), "medio");
    assert.strictEqual(nivelDoCodigo("000002"), "dificil");
    assert.strictEqual(criarDesafioPorCodigo("482917").nivel, "medio");
    // Quem abre o código de um colega treina o mesmo nível dele.
    assert.strictEqual(criarDesafioPorCodigo("482919").nivel, "facil");
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

  test("o desafio do dia é o mesmo o dia inteiro e muda no dia seguinte", () => {
    const manha = codigoDoDia(new Date(2026, 9, 14, 0, 1));
    const noite = codigoDoDia(new Date(2026, 9, 14, 23, 59));
    const amanha = codigoDoDia(new Date(2026, 9, 15, 0, 1));

    assert.match(manha, /^\d{6}$/);
    assert.strictEqual(noite, manha);
    assert.notStrictEqual(amanha, manha);
    // Alunos com versões diferentes da extensão precisam ter o mesmo desafio
    // do dia: se este valor mudar, a conta do código do dia mudou.
    assert.strictEqual(manha, "071881");
    // O desafio do dia é sempre médio.
    for (let dia = 1; dia <= 60; dia++) {
      assert.strictEqual(nivelDoCodigo(codigoDoDia(new Date(2026, 9, dia))), "medio");
    }
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

// Tirada do gerador da versão 0.5.0 (commit 6cbe24e do gerador do Vitor).
const ASSINATURA_482917 = {
  fundo: "#15fa54",
  componentes: 23,
  primeiro: {
    id: 1,
    parentId: undefined,
    x: 76,
    y: 17,
    width: 63,
    height: 63,
    color: "#bf8bbf",
    borderRadius: 31.5,
    shape: "circle",
  },
};
