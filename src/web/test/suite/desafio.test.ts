import * as assert from "assert";
import {
  ALTURA_GABARITO,
  criarDesafioGerado,
  LARGURA_GABARITO,
} from "../../services/desafio";
import { Bloco } from "../../types";

suite("Gerador de desafios", () => {
  test("gera um desafio de 960x540 com a mesma seed", () => {
    const primeiro = criarDesafioGerado(123456);
    const segundo = criarDesafioGerado(123456);

    assert.strictEqual(primeiro.width, LARGURA_GABARITO);
    assert.strictEqual(primeiro.height, ALTURA_GABARITO);
    assert.strictEqual(primeiro.challengeId, "challenge-123456");
    assert.deepStrictEqual(primeiro, segundo);
  });

  test("produz variações para seeds diferentes", () => {
    const primeiro = criarDesafioGerado(10);
    const segundo = criarDesafioGerado(11);

    assert.notDeepStrictEqual(primeiro.blocks, segundo.blocks);
  });

  test("mantém todos os blocos dentro do canvas e dos respectivos pais", () => {
    for (let seed = 0; seed < 250; seed++) {
      const desafio = criarDesafioGerado(seed);
      const blocosPorId = new Map<number, Bloco>();
      const filhosPorPai = new Map<number | undefined, Bloco[]>();

      assert.ok(desafio.blocks.length >= 3, `Seed ${seed} gerou poucos blocos.`);
      assert.ok(
        desafio.blocks.length <= 100,
        `Seed ${seed} gerou blocos demais: ${desafio.blocks.length}.`,
      );

      for (const bloco of desafio.blocks) {
        assert.ok(!blocosPorId.has(bloco.id), `ID duplicado na seed ${seed}.`);
        assert.ok(bloco.width > 0, `Largura inválida na seed ${seed}.`);
        assert.ok(bloco.height > 0, `Altura inválida na seed ${seed}.`);
        assert.ok(bloco.x >= 0, `Bloco fora à esquerda na seed ${seed}.`);
        assert.ok(bloco.y >= 0, `Bloco fora acima na seed ${seed}.`);
        assert.ok(
          bloco.x + bloco.width <= desafio.width,
          `Bloco fora à direita na seed ${seed}.`,
        );
        assert.ok(
          bloco.y + bloco.height <= desafio.height,
          `Bloco fora abaixo na seed ${seed}.`,
        );
        assert.match(bloco.color, /^#[0-9a-f]{6}$/i);
        assert.ok((bloco.borderRadius ?? 0) >= 0);

        if (bloco.parentId !== undefined) {
          const pai = blocosPorId.get(bloco.parentId);
          assert.ok(pai, `Pai ${bloco.parentId} não encontrado na seed ${seed}.`);
          assertBlocoContido(bloco, pai, seed);
        }

        const irmaos = filhosPorPai.get(bloco.parentId) ?? [];
        for (const irmao of irmaos) {
          assert.ok(
            !retangulosSobrepoem(bloco, irmao),
            `Irmãos ${bloco.id} e ${irmao.id} se sobrepõem na seed ${seed}.`,
          );
        }
        irmaos.push(bloco);
        filhosPorPai.set(bloco.parentId, irmaos);
        blocosPorId.set(bloco.id, bloco);
      }
    }
  });
});

function assertBlocoContido(filho: Bloco, pai: Bloco, seed: number): void {
  assert.ok(
    filho.x >= pai.x,
    `Filho ${filho.id} saiu à esquerda do pai ${pai.id} na seed ${seed}.`,
  );
  assert.ok(
    filho.y >= pai.y,
    `Filho ${filho.id} saiu acima do pai ${pai.id} na seed ${seed}.`,
  );
  assert.ok(
    filho.x + filho.width <= pai.x + pai.width,
    `Filho ${filho.id} saiu à direita do pai ${pai.id} na seed ${seed}.`,
  );
  assert.ok(
    filho.y + filho.height <= pai.y + pai.height,
    `Filho ${filho.id} saiu abaixo do pai ${pai.id} na seed ${seed}.`,
  );
}

function retangulosSobrepoem(primeiro: Bloco, segundo: Bloco): boolean {
  return (
    primeiro.x < segundo.x + segundo.width &&
    primeiro.x + primeiro.width > segundo.x &&
    primeiro.y < segundo.y + segundo.height &&
    primeiro.y + primeiro.height > segundo.y
  );
}
