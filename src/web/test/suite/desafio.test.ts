import * as assert from "assert";
import {
  ALTURA_GABARITO,
  criarDesafioGerado,
  LARGURA_GABARITO,
} from "../../services/desafio";
import { Bloco } from "../../types";

suite("Gerador de desafios", () => {
  test("gera um desafio de 960x540 com a mesma seed", () => {
    const primeiro = criarDesafioGerado({
      dificuldade: "medio",
      seed: 123456,
    });
    const segundo = criarDesafioGerado({
      dificuldade: "medio",
      seed: 123456,
    });

    assert.strictEqual(primeiro.width, LARGURA_GABARITO);
    assert.strictEqual(primeiro.height, ALTURA_GABARITO);
    assert.strictEqual(primeiro.challengeId, "challenge-123456");
    assert.strictEqual(primeiro.backgroundColor, "#9ca3af");
    assert.strictEqual(primeiro.dificuldade, "medio");
    assert.deepStrictEqual(primeiro, segundo);
  });

  test("produz variações para seeds diferentes", () => {
    const primeiro = criarDesafioGerado({ seed: 10 });
    const segundo = criarDesafioGerado({ seed: 11 });

    assert.notDeepStrictEqual(primeiro.blocks, segundo.blocks);
  });

  test("aumenta a complexidade conforme o nível", () => {
    let blocosFaceis = 0;
    let blocosMedios = 0;
    let blocosDificeis = 0;

    for (let seed = 0; seed < 40; seed++) {
      blocosFaceis += criarDesafioGerado({
        dificuldade: "facil",
        seed,
      }).blocks.length;
      blocosMedios += criarDesafioGerado({
        dificuldade: "medio",
        seed,
      }).blocks.length;
      blocosDificeis += criarDesafioGerado({
        dificuldade: "dificil",
        seed,
      }).blocks.length;
    }

    assert.ok(blocosMedios > blocosFaceis);
    assert.ok(blocosDificeis > blocosMedios);
  });

  test("gera círculos e cantos arredondados nos níveis superiores", () => {
    let encontrouCirculo = false;
    let encontrouArredondado = false;

    for (let seed = 0; seed < 80; seed++) {
      const desafio = criarDesafioGerado({
        dificuldade: seed % 2 === 0 ? "medio" : "dificil",
        seed,
      });
      encontrouCirculo ||= desafio.blocks.some(
        (bloco) => bloco.shape === "circle",
      );
      encontrouArredondado ||= desafio.blocks.some(
        (bloco) => (bloco.borderRadius ?? 0) > 0,
      );
    }

    assert.ok(encontrouCirculo, "Nenhum círculo foi gerado.");
    assert.ok(encontrouArredondado, "Nenhum canto arredondado foi gerado.");
  });

  test("mantém todos os blocos dentro do canvas e dos respectivos pais", () => {
    const dificuldades = ["facil", "medio", "dificil"] as const;

    for (let seed = 0; seed < 250; seed++) {
      const dificuldade = dificuldades[seed % dificuldades.length];
      const desafio = criarDesafioGerado({ dificuldade, seed });
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
        assert.ok(
          bloco.shape === "rectangle" || bloco.shape === "circle",
          `Forma inválida na seed ${seed}.`,
        );
        if (bloco.shape === "circle") {
          assert.strictEqual(
            bloco.width,
            bloco.height,
            `Círculo deformado na seed ${seed}.`,
          );
        }

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
