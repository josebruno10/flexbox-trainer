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
    // Sem nível, o gerador entrega a imagem inteira.
    assert.strictEqual(primeiro.nivel, "dificil");
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

  test("os cortes não aparecem: o fundo fica à vista entre os elementos", () => {
    for (let caso = 0; caso < 100; caso++) {
      const desafio = criarDesafioGerado({
        aleatorio: criarAleatorioTeste(caso),
      });
      const raiz = desafio.blocks.filter((bloco) => bloco.parentId === undefined);
      const areaTotal = raiz.reduce(
        (soma, bloco) => soma + bloco.width * bloco.height,
        0,
      );

      assert.ok(
        areaTotal < desafio.width * desafio.height * 0.9,
        `Caso ${caso}: os blocos de fora cobrem quase todo o gabarito.`,
      );
      // Cada elemento fica a 15 px da borda da região: nada encosta na borda
      // do gabarito.
      for (const bloco of raiz.filter((bloco) => bloco.shape === "rectangle")) {
        assert.ok(
          bloco.x >= 15 && bloco.y >= 15,
          `Caso ${caso}: o bloco ${bloco.id} encosta na borda do gabarito.`,
        );
      }
    }
  });

  test("nos níveis mais fáceis saem os menores componentes, sem desfazer padrões", () => {
    const tamanho = (bloco: Bloco) => (bloco.width + bloco.height) / 2;
    // Os números mudam entre os níveis; a posição, o tamanho e a cor, não.
    const chave = (bloco: Bloco) =>
      [bloco.x, bloco.y, bloco.width, bloco.height, bloco.color, bloco.shape].join(",");
    // Para cada bloco, a chave dele e a do pai (vazia na raiz).
    const indexar = (blocos: Bloco[]) => {
      const porId = new Map(blocos.map((bloco) => [bloco.id, bloco]));
      return new Map(
        blocos.map((bloco) => {
          const pai = bloco.parentId === undefined ? undefined : porId.get(bloco.parentId);
          return [chave(bloco), { bloco, pai: pai ? chave(pai) : "", orfao: bloco.parentId !== undefined && !pai }];
        }),
      );
    };
    // Os blocos criados juntos têm o mesmo pai, a mesma cor e o mesmo tamanho.
    const padrao = (bloco: Bloco, pai: string) =>
      [pai, bloco.color, bloco.width, bloco.height].join("|");
    let tirouAPorcentagem = 0;

    for (let caso = 0; caso < 100; caso++) {
      const [dificil, medio, facil] = (["dificil", "medio", "facil"] as const).map(
        (nivel) => criarDesafioGerado({ aleatorio: criarAleatorioTeste(caso), nivel }),
      );
      assert.strictEqual(medio.backgroundColor, dificil.backgroundColor);
      assert.strictEqual(facil.nivel, "facil");

      for (const [maior, menor] of [
        [dificil, medio],
        [medio, facil],
      ]) {
        const doMaior = indexar(maior.blocks);
        const doMenor = indexar(menor.blocks);
        // Numerados de #1 a #N, sem buracos.
        assert.deepStrictEqual(
          menor.blocks.map((bloco) => bloco.id),
          menor.blocks.map((_, indice) => indice + 1),
        );
        // Os que ficam são os mesmos blocos, com o mesmo pai.
        for (const [chaveBloco, { bloco, pai, orfao }] of doMenor) {
          const original = doMaior.get(chaveBloco);
          assert.ok(original, `Caso ${caso}: o bloco ${bloco.id} não existe no nível acima.`);
          assert.ok(!orfao, `Caso ${caso}: o bloco ${bloco.id} ficou sem o pai.`);
          assert.strictEqual(pai, original.pai, `Caso ${caso}: o bloco ${bloco.id} trocou de pai.`);
        }
        const sairam = [...doMaior.entries()].filter(([chaveBloco]) => !doMenor.has(chaveBloco));
        // Saem os menores.
        const menorQueFicou = Math.min(...menor.blocks.map(tamanho));
        // Um padrão sai inteiro ou fica inteiro.
        const padroesQueFicaram = new Set(
          [...doMenor.values()].map(({ bloco, pai }) => padrao(bloco, pai)),
        );
        for (const [, { bloco, pai }] of sairam) {
          assert.ok(
            tamanho(bloco) <= menorQueFicou + 1,
            `Caso ${caso}: saiu o bloco ${bloco.id}, maior que um que ficou.`,
          );
          assert.ok(
            !padroesQueFicaram.has(padrao(bloco, pai)),
            `Caso ${caso}: o padrão do bloco ${bloco.id} ficou pela metade.`,
          );
        }
      }

      assert.ok(
        facil.blocks.length >= Math.min(8, dificil.blocks.length),
        `Caso ${caso}: o fácil ficou com poucos componentes.`,
      );
      const total = dificil.blocks.length;
      if (
        total - facil.blocks.length >= Math.floor(total * 0.5) &&
        total - medio.blocks.length >= Math.floor(total * 0.3)
      ) {
        tirouAPorcentagem++;
      }
    }

    // Quase sempre o fácil tira a metade, e o médio, 30%. As exceções são
    // as imagens pequenas, que param em 8 componentes.
    assert.ok(tirouAPorcentagem >= 95, `Só ${tirouAPorcentagem} de 100 tiraram a porcentagem.`);
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
