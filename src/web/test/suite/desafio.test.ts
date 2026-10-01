import * as assert from "assert";
import {
  ALTURA_GABARITO,
  criarDesafioGerado,
  LARGURA_GABARITO,
} from "../../services/desafio";
import { Bloco } from "../../types";

suite("Gerador de desafios", () => {
  test("gera um desafio reproduzível de 800x800 nos testes", () => {
    const primeiro = criarDesafioGerado({
      aleatorio: criarAleatorioTeste(123456),
    });
    const segundo = criarDesafioGerado({
      aleatorio: criarAleatorioTeste(123456),
    });

    assert.strictEqual(primeiro.width, LARGURA_GABARITO);
    assert.strictEqual(primeiro.height, ALTURA_GABARITO);
    assert.match(primeiro.challengeId, /^challenge-[a-z0-9]+-[a-z0-9]+$/);
    assert.match(primeiro.backgroundColor, /^#[0-9a-f]{6}$/i);
    assert.strictEqual(
      "dificuldade" in primeiro,
      false,
      "O desafio não deve possuir nível de dificuldade.",
    );
    assert.strictEqual(
      "titulo" in primeiro,
      false,
      "O desafio gerado não deve exigir um título do usuário.",
    );
    assert.deepStrictEqual(primeiro.blocks, segundo.blocks);
  });

  test("produz uma nova combinação aleatória a cada geração", () => {
    const primeiro = criarDesafioGerado({ aleatorio: criarAleatorioTeste(10) });
    const segundo = criarDesafioGerado({ aleatorio: criarAleatorioTeste(11) });

    assert.notDeepStrictEqual(primeiro.blocks, segundo.blocks);
  });

  test("usa cortes, elementos internos, sequências e círculos do gerador", () => {
    let encontrouBlocoAninhado = false;
    let encontrouSequencia = false;
    let encontrouCirculo = false;

    for (let caso = 0; caso < 100; caso++) {
      const desafio = criarDesafioGerado({
        aleatorio: criarAleatorioTeste(caso),
      });
      const filhosPorPai = new Map<number, number>();

      for (const bloco of desafio.blocks) {
        encontrouCirculo ||= bloco.shape === "circle";

        if (bloco.parentId !== undefined) {
          encontrouBlocoAninhado = true;
          filhosPorPai.set(
            bloco.parentId,
            (filhosPorPai.get(bloco.parentId) ?? 0) + 1,
          );
        }
      }

      encontrouSequencia ||= [...filhosPorPai.values()].some(
        (quantidade) => quantidade >= 2,
      );
    }

    assert.ok(encontrouBlocoAninhado, "Nenhum bloco interno foi gerado.");
    assert.ok(encontrouSequencia, "Nenhuma sequência de blocos foi gerada.");
    assert.ok(encontrouCirculo, "Nenhum círculo foi gerado.");
  });

  test("o layout primário cobre todo o gabarito sem sobreposição", () => {
    for (let caso = 0; caso < 100; caso++) {
      const desafio = criarDesafioGerado({
        aleatorio: criarAleatorioTeste(caso),
      });
      const raiz = desafio.blocks.filter((bloco) => bloco.parentId === undefined);
      const areaTotal = raiz.reduce(
        (soma, bloco) => soma + bloco.width * bloco.height,
        0,
      );

      assert.strictEqual(
        areaTotal,
        desafio.width * desafio.height,
        `Caso ${caso}: as regiões principais não cobrem o gabarito.`,
      );
      raiz.forEach((bloco, indice) =>
        raiz.slice(indice + 1).forEach((outro) =>
          assert.ok(
            !retangulosSobrepoem(bloco, outro),
            `Caso ${caso}: regiões ${bloco.id} e ${outro.id} se sobrepõem.`,
          ),
        ),
      );
    }
  });

  test("mantém todos os blocos dentro do canvas e dos respectivos pais", () => {
    for (let caso = 0; caso < 300; caso++) {
      const desafio = criarDesafioGerado({
        aleatorio: criarAleatorioTeste(caso),
      });
      const blocosPorId = new Map<number, Bloco>();
      const filhosPorPai = new Map<number | undefined, Bloco[]>();

      assert.ok(desafio.blocks.length >= 3, `Caso ${caso} gerou poucos blocos.`);
      // O original fica abaixo de 100 blocos; o limite só pega recursão
      // descontrolada.
      assert.ok(
        desafio.blocks.length <= 200,
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

        if (bloco.shape === "circle") {
          assert.strictEqual(
            bloco.width,
            bloco.height,
            `Círculo ${bloco.id} deformado no caso ${caso}.`,
          );
          assert.ok(bloco.parentId !== undefined, `Círculo sem pai no caso ${caso}.`);
        } else {
          assert.strictEqual(bloco.shape, "rectangle");
          assert.strictEqual(bloco.borderRadius, 0);
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
