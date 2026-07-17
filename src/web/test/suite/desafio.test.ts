import * as assert from "assert";
import {
  ALTURA_GABARITO,
  criarDesafioGerado,
  LARGURA_GABARITO,
} from "../../services/desafio";
import { Bloco } from "../../types";

suite("Gerador de desafios", () => {
  test("gera um desafio reproduzível de 960x540 nos testes", () => {
    const primeiro = criarDesafioGerado({
      dificuldade: "medio",
      aleatorio: criarAleatorioTeste(123456),
    });
    const segundo = criarDesafioGerado({
      dificuldade: "medio",
      aleatorio: criarAleatorioTeste(123456),
    });

    assert.strictEqual(primeiro.width, LARGURA_GABARITO);
    assert.strictEqual(primeiro.height, ALTURA_GABARITO);
    assert.match(primeiro.challengeId, /^challenge-[a-z0-9]+-[a-z0-9]+$/);
    assert.strictEqual(primeiro.backgroundColor, "#9ca3af");
    assert.strictEqual(primeiro.dificuldade, "medio");
    assert.strictEqual(
      "titulo" in primeiro,
      false,
      "O desafio gerado não deve exigir um título do usuário.",
    );
    assert.deepStrictEqual(primeiro.blocks, segundo.blocks);
  });

  test("produz variações aleatórias diferentes", () => {
    const primeiro = criarDesafioGerado({ aleatorio: criarAleatorioTeste(10) });
    const segundo = criarDesafioGerado({ aleatorio: criarAleatorioTeste(11) });

    assert.notDeepStrictEqual(primeiro.blocks, segundo.blocks);
  });

  test("aumenta a complexidade conforme o nível", () => {
    let blocosFaceis = 0;
    let blocosMedios = 0;
    let blocosDificeis = 0;

    for (let caso = 0; caso < 40; caso++) {
      blocosFaceis += criarDesafioGerado({
        dificuldade: "facil",
        aleatorio: criarAleatorioTeste(caso),
      }).blocks.length;
      blocosMedios += criarDesafioGerado({
        dificuldade: "medio",
        aleatorio: criarAleatorioTeste(caso),
      }).blocks.length;
      blocosDificeis += criarDesafioGerado({
        dificuldade: "dificil",
        aleatorio: criarAleatorioTeste(caso),
      }).blocks.length;
    }

    assert.ok(blocosMedios > blocosFaceis);
    assert.ok(blocosDificeis > blocosMedios);
  });

  test("gera círculos e cantos arredondados nos níveis superiores", () => {
    let encontrouCirculo = false;
    let encontrouArredondado = false;

    for (let caso = 0; caso < 80; caso++) {
      const desafio = criarDesafioGerado({
        dificuldade: caso % 2 === 0 ? "medio" : "dificil",
        aleatorio: criarAleatorioTeste(caso),
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

    for (let caso = 0; caso < 250; caso++) {
      const dificuldade = dificuldades[caso % dificuldades.length];
      const desafio = criarDesafioGerado({
        dificuldade,
        aleatorio: criarAleatorioTeste(caso),
      });
      const blocosPorId = new Map<number, Bloco>();
      const filhosPorPai = new Map<number | undefined, Bloco[]>();

      assert.ok(desafio.blocks.length >= 3, `Caso ${caso} gerou poucos blocos.`);
      assert.ok(
        desafio.blocks.length <= 100,
        `Caso ${caso} gerou blocos demais: ${desafio.blocks.length}.`,
      );

      for (const bloco of desafio.blocks) {
        assert.ok(!blocosPorId.has(bloco.id), `ID duplicado no caso ${caso}.`);
        assert.ok(bloco.width > 0, `Largura inválida no caso ${caso}.`);
        assert.ok(bloco.height > 0, `Altura inválida no caso ${caso}.`);
        assert.ok(bloco.x >= 0, `Bloco fora à esquerda no caso ${caso}.`);
        assert.ok(bloco.y >= 0, `Bloco fora acima no caso ${caso}.`);
        assert.ok(
          bloco.x + bloco.width <= desafio.width,
          `Bloco fora à direita no caso ${caso}.`,
        );
        assert.ok(
          bloco.y + bloco.height <= desafio.height,
          `Bloco fora abaixo no caso ${caso}.`,
        );
        assert.match(bloco.color, /^#[0-9a-f]{6}$/i);
        assert.ok((bloco.borderRadius ?? 0) >= 0);
        assert.ok(
          bloco.shape === "rectangle" || bloco.shape === "circle",
          `Forma inválida no caso ${caso}.`,
        );
        if (bloco.shape === "circle") {
          assert.strictEqual(
            bloco.width,
            bloco.height,
            `Círculo deformado no caso ${caso}.`,
          );
        }

        if (bloco.parentId !== undefined) {
          const pai = blocosPorId.get(bloco.parentId);
          assert.ok(pai, `Pai ${bloco.parentId} não encontrado no caso ${caso}.`);
          assertBlocoContido(bloco, pai, caso);
        }

        const irmaos = filhosPorPai.get(bloco.parentId) ?? [];
        for (const irmao of irmaos) {
          assert.ok(
            !retangulosSobrepoem(bloco, irmao),
            `Irmãos ${bloco.id} e ${irmao.id} se sobrepõem no caso ${caso}.`,
          );
        }
        irmaos.push(bloco);
        filhosPorPai.set(bloco.parentId, irmaos);
        blocosPorId.set(bloco.id, bloco);
      }
    }
  });
});

function assertBlocoContido(filho: Bloco, pai: Bloco, caso: number): void {
  assert.ok(
    filho.x >= pai.x,
    `Filho ${filho.id} saiu à esquerda do pai ${pai.id} no caso ${caso}.`,
  );
  assert.ok(
    filho.y >= pai.y,
    `Filho ${filho.id} saiu acima do pai ${pai.id} no caso ${caso}.`,
  );
  assert.ok(
    filho.x + filho.width <= pai.x + pai.width,
    `Filho ${filho.id} saiu à direita do pai ${pai.id} no caso ${caso}.`,
  );
  assert.ok(
    filho.y + filho.height <= pai.y + pai.height,
    `Filho ${filho.id} saiu abaixo do pai ${pai.id} no caso ${caso}.`,
  );
}

function criarAleatorioTeste(caso: number): () => number {
  let estado = caso >>> 0;

  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let valor = estado;
    valor = Math.imul(valor ^ (valor >>> 15), valor | 1);
    valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61);
    return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296;
  };
}

function retangulosSobrepoem(primeiro: Bloco, segundo: Bloco): boolean {
  return (
    primeiro.x < segundo.x + segundo.width &&
    primeiro.x + primeiro.width > segundo.x &&
    primeiro.y < segundo.y + segundo.height &&
    primeiro.y + primeiro.height > segundo.y
  );
}
