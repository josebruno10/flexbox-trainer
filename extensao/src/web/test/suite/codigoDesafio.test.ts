import * as assert from "assert";
import {
  aleatorioDoCodigo,
  normalizarCodigo,
  sortearCodigo,
} from "../../services/codigoDesafio";
import { criarDesafioPorCodigo } from "../../services/desafio";
import { FORMATOS, formatoDoCodigo } from "../../formatos";
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

  test("sorteia sempre 4 letras, de AAAA a ZZZZ, no nível e no formato pedidos", () => {
    assert.strictEqual(sortearCodigo("facil", "quadrado", () => 0), "AAAA");
    assert.strictEqual(sortearCodigo("medio", "quadrado", () => 0), "AAAB");
    assert.strictEqual(sortearCodigo("dificil", "quadrado", () => 0), "AAAC");
    assert.strictEqual(sortearCodigo("facil", "paisagem", () => 0), "AAAD");
    assert.strictEqual(sortearCodigo("dificil", "retrato", () => 0), "AAAI");
    assert.strictEqual(sortearCodigo("facil", "livre", () => 0), "AAAJ");
    assert.strictEqual(sortearCodigo("facil", "quadrado", () => 0.9999999), "ZZZW");
    assert.strictEqual(sortearCodigo("facil", "paisagem", () => 0.9999999), "ZZZZ");
    assert.strictEqual(sortearCodigo("dificil", "livre", () => 0.9999999), "ZZZV");
    for (const nivel of NIVEIS) {
      for (const formato of FORMATOS) {
        for (let vez = 0; vez < 20; vez++) {
          const codigo = sortearCodigo(nivel, formato);
          assert.match(codigo, /^[A-Z]{4}$/);
          assert.strictEqual(nivelDoCodigo(codigo), nivel);
          assert.strictEqual(formatoDoCodigo(codigo), formato);
        }
      }
    }
  });

  test("o formato vem do código e dá o tamanho da imagem", () => {
    assert.strictEqual(formatoDoCodigo("AAAA"), "quadrado");
    assert.strictEqual(formatoDoCodigo("AAAD"), "paisagem");
    assert.strictEqual(formatoDoCodigo("AAAG"), "retrato");
    assert.strictEqual(formatoDoCodigo("AAAJ"), "livre");
    // Depois de 12 códigos, as combinações se repetem.
    assert.strictEqual(formatoDoCodigo("AAAM"), "quadrado");
    const tamanho = (codigo: string) => {
      const desafio = criarDesafioPorCodigo(codigo);
      return [desafio.width, desafio.height];
    };
    assert.deepStrictEqual(tamanho("AAAA"), [800, 800]);
    assert.deepStrictEqual(tamanho("MESA"), [1280, 720]);
    assert.deepStrictEqual(tamanho("AAAG"), [450, 800]);
  });

  test("no formato livre, o tamanho vem de fora do código", () => {
    // TSQR é do formato livre: sem o tamanho, não há desafio.
    assert.strictEqual(formatoDoCodigo("TSQR"), "livre");
    assert.throws(() => criarDesafioPorCodigo("TSQR"), /tamanho livre/);
    const largo = criarDesafioPorCodigo("TSQR", { largura: 1000, altura: 600 });
    const alto = criarDesafioPorCodigo("TSQR", { largura: 600, altura: 1000 });
    assert.deepStrictEqual([largo.width, largo.height], [1000, 600]);
    assert.deepStrictEqual([alto.width, alto.height], [600, 1000]);
    // O mesmo código e o mesmo tamanho dão a mesma imagem.
    assert.deepStrictEqual(
      criarDesafioPorCodigo("TSQR", { largura: 1000, altura: 600 }).blocks,
      largo.blocks,
    );
    // Nos outros formatos, o tamanho do código vale.
    assert.strictEqual(criarDesafioPorCodigo("AAAA", { largura: 1000, altura: 600 }).width, 800);
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

  // Códigos já passados à turma precisam continuar gerando os mesmos
  // desafios. Se este teste falhar, o gerador mudou: os códigos antigos
  // passam a dar outras imagens (e a chave do histórico, em
  // services/historico.ts, precisa mudar junto).
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

// Tirada do gerador com os 8 layouts do Vitor, as cores do commit 162b3d6 e
// os quatro formatos, em que o MESA é paisagem (depois da 0.8.0).
const ASSINATURA_MESA = {
  fundo: "#6e9fd6",
  componentes: 26,
  primeiro: {
    id: 1,
    parentId: undefined,
    x: 104,
    y: 20,
    width: 281,
    height: 121,
    color: "#cd1186",
    borderRadius: 0,
    shape: "rectangle",
  },
};
