import * as assert from "assert";
import {
  aleatorioDoCodigo,
  codigoDoDia,
  normalizarCodigo,
  sortearCodigo,
} from "../../services/codigoDesafio";
import { criarDesafioPorCodigo } from "../../services/desafio";
import { NIVEIS, nivelDoCodigo, valorDoCodigo } from "../../niveis";

suite("Código do desafio", () => {
  test("aceita 4 letras, maiúsculas ou não, e recusa o resto", () => {
    assert.strictEqual(normalizarCodigo("MESA"), "MESA");
    assert.strictEqual(normalizarCodigo(" mesa "), "MESA");
    assert.strictEqual(normalizarCodigo("me-sa"), "MESA");
    for (const invalido of ["", "MES", "MESAS", "ME5A", "482917", "çapo"]) {
      assert.strictEqual(normalizarCodigo(invalido), undefined, invalido);
    }
  });

  test("sorteia sempre 4 letras, de AAAA a ZZZZ, no nível pedido", () => {
    assert.strictEqual(sortearCodigo("facil", () => 0), "AAAA");
    assert.strictEqual(sortearCodigo("medio", () => 0), "AAAB");
    assert.strictEqual(sortearCodigo("dificil", () => 0), "AAAC");
    assert.strictEqual(sortearCodigo("facil", () => 0.9999999), "ZZZZ");
    assert.strictEqual(sortearCodigo("medio", () => 0.9999999), "ZZZX");
    assert.strictEqual(sortearCodigo("dificil", () => 0.9999999), "ZZZY");
    for (const nivel of NIVEIS) {
      for (let vez = 0; vez < 50; vez++) {
        const codigo = sortearCodigo(nivel);
        assert.match(codigo, /^[A-Z]{4}$/);
        assert.strictEqual(nivelDoCodigo(codigo), nivel);
      }
    }
  });

  test("o nível vem do código, pelo resto da divisão por 3", () => {
    assert.strictEqual(valorDoCodigo("AAAA"), 0);
    assert.strictEqual(valorDoCodigo("AABA"), 26);
    assert.strictEqual(valorDoCodigo("ZZZZ"), 26 ** 4 - 1);
    assert.strictEqual(nivelDoCodigo("AAAA"), "facil");
    assert.strictEqual(nivelDoCodigo("MESA"), "medio");
    assert.strictEqual(nivelDoCodigo("AAAC"), "dificil");
    assert.strictEqual(criarDesafioPorCodigo("MESA").nivel, "medio");
    // Quem abre o código de um colega treina o mesmo nível dele.
    assert.strictEqual(criarDesafioPorCodigo("MESC").nivel, "facil");
  });

  test("o mesmo código dá a mesma sequência; códigos vizinhos, outras", () => {
    const primeiro = aleatorioDoCodigo("AAAB");
    const outraVez = aleatorioDoCodigo("AAAB");
    const vizinho = aleatorioDoCodigo("AAAC");
    const sequencia = [primeiro(), primeiro(), primeiro()];

    assert.deepStrictEqual([outraVez(), outraVez(), outraVez()], sequencia);
    assert.notDeepStrictEqual([vizinho(), vizinho(), vizinho()], sequencia);
    assert.ok(sequencia.every((valor) => valor >= 0 && valor < 1));
  });

  test("o mesmo código gera a mesma imagem, em tentativas diferentes", () => {
    const primeira = criarDesafioPorCodigo("MESA");
    const segunda = criarDesafioPorCodigo("MESA");

    assert.strictEqual(primeira.codigo, "MESA");
    assert.strictEqual(primeira.backgroundColor, segunda.backgroundColor);
    assert.deepStrictEqual(primeira.blocks, segunda.blocks);
    // Cada vez é uma tentativa nova.
    assert.notStrictEqual(primeira.challengeId, segunda.challengeId);
    assert.match(primeira.challengeId, /^challenge-MESA-[a-z0-9]+$/);
    assert.notDeepStrictEqual(criarDesafioPorCodigo("MESB").blocks, primeira.blocks);
  });

  test("sem código, sorteia um", () => {
    const desafio = criarDesafioPorCodigo();
    assert.match(desafio.codigo ?? "", /^[A-Z]{4}$/);
    assert.deepStrictEqual(
      criarDesafioPorCodigo(desafio.codigo).blocks,
      desafio.blocks,
    );
  });

  test("o desafio do dia é o mesmo o dia inteiro e muda no dia seguinte", () => {
    const manha = codigoDoDia(new Date(2026, 9, 14, 0, 1));
    const noite = codigoDoDia(new Date(2026, 9, 14, 23, 59));
    const amanha = codigoDoDia(new Date(2026, 9, 15, 0, 1));

    assert.match(manha, /^[A-Z]{4}$/);
    assert.strictEqual(noite, manha);
    assert.notStrictEqual(amanha, manha);
    // Alunos com versões diferentes da extensão precisam ter o mesmo desafio
    // do dia: se este valor mudar, a conta do código do dia mudou.
    assert.strictEqual(manha, "DHAG");
    // O desafio do dia é sempre médio.
    for (let dia = 1; dia <= 60; dia++) {
      assert.strictEqual(nivelDoCodigo(codigoDoDia(new Date(2026, 9, dia))), "medio");
    }
  });

  // Códigos já passados à turma precisam continuar gerando os mesmos
  // desafios. Se este teste falhar, o gerador mudou: os códigos antigos
  // passam a dar outras imagens.
  test("os códigos continuam gerando os mesmos desafios entre versões", () => {
    const desafio = criarDesafioPorCodigo("MESA");
    const resumo = {
      fundo: desafio.backgroundColor,
      componentes: desafio.blocks.length,
      primeiro: desafio.blocks[0],
    };
    assert.deepStrictEqual(resumo, ASSINATURA_MESA);
  });
});

// Tirada do gerador da versão 0.7.0, a dos códigos de 4 letras.
const ASSINATURA_MESA = {
  fundo: "#6e9fd6",
  componentes: 19,
  primeiro: {
    id: 1,
    parentId: undefined,
    x: 22,
    y: 49,
    width: 156,
    height: 156,
    color: "#fe0750",
    borderRadius: 78,
    shape: "circle",
  },
};
