import * as assert from "assert";
import { calcularPrecisaoImagem } from "../../services/comparacaoImagem";

suite("Comparação visual", () => {
  test("retorna 100% para imagens idênticas", () => {
    const imagem = pixels([156, 163, 175], [220, 38, 38]);
    const resultado = calcularPrecisaoImagem(imagem, imagem.slice());

    assert.strictEqual(resultado.precisao, 100);
    assert.strictEqual(resultado.pixelsProximos, 100);
  });

  test("retorna 0% para imagens totalmente opostas", () => {
    const alvo = pixels([0, 0, 0], [0, 0, 0]);
    const atual = pixels([255, 255, 255], [255, 255, 255]);

    assert.strictEqual(calcularPrecisaoImagem(alvo, atual).precisao, 0);
  });

  test("penaliza diferenças grandes mesmo quando parte do quadro coincide", () => {
    const alvo = pixels([100, 100, 100], [255, 0, 0]);
    const atual = pixels([100, 100, 100], [0, 255, 255]);
    const resultado = calcularPrecisaoImagem(alvo, atual);

    assert.ok(resultado.precisao > 40);
    assert.ok(resultado.precisao < 70);
    assert.strictEqual(resultado.pixelsProximos, 50);
  });

  test("considera perfeita uma diferença residual de rasterização", () => {
    const alvo = new Uint8ClampedArray(4000).fill(255);
    const atual = alvo.slice();
    atual[0] = 0;
    const resultado = calcularPrecisaoImagem(alvo, atual);

    assert.strictEqual(resultado.precisao, 100);
    assert.ok(resultado.similaridadeMedia < 100);
  });

  test("rejeita quadros com tamanhos diferentes", () => {
    assert.throws(
      () => calcularPrecisaoImagem(new Uint8ClampedArray(4), new Uint8ClampedArray(8)),
      /mesmas dimensões/,
    );
  });
});

function pixels(...cores: Array<[number, number, number]>): Uint8ClampedArray {
  return new Uint8ClampedArray(
    cores.flatMap(([vermelho, verde, azul]) => [vermelho, verde, azul, 255]),
  );
}
