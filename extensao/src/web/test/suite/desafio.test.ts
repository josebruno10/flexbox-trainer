import * as assert from "assert";
import {
  FORMATOS_FIXOS,
  TAMANHO_DO_FORMATO,
  TAMANHO_LIVRE_MAXIMO,
  TAMANHO_LIVRE_MINIMO,
} from "../../formatos";
import { criarDesafioGerado, gerarImagemCompleta } from "../../services/desafio";
import { LIMITE_DE_COMPONENTES } from "../../services/gerador/dificuldade";
import { escolherLayoutPrimario } from "../../services/gerador/layouts";
import { medidasDaImagem } from "../../services/gerador/medidas";
import { Bloco, Tamanho } from "../../types";

// Os tamanhos em que o gerador é conferido: os formatos prontos e alguns
// tamanhos livres, inclusive os extremos.
const TAMANHOS: readonly Tamanho[] = [
  ...FORMATOS_FIXOS.map((formato) => TAMANHO_DO_FORMATO[formato]),
  { largura: 1000, altura: 600 },
  { largura: TAMANHO_LIVRE_MINIMO, altura: TAMANHO_LIVRE_MINIMO },
  TAMANHO_LIVRE_MAXIMO,
  { largura: TAMANHO_LIVRE_MINIMO, altura: TAMANHO_LIVRE_MAXIMO.altura },
  { largura: TAMANHO_LIVRE_MAXIMO.largura, altura: TAMANHO_LIVRE_MINIMO },
];

suite("Gerador de desafios", () => {
  test("gera um desafio reproduzível de 800x800 nos testes", () => {
    const primeiro = criarDesafioGerado({
      aleatorio: criarAleatorioTeste(123456),
    });
    const segundo = criarDesafioGerado({
      aleatorio: criarAleatorioTeste(123456),
    });

    // Sem formato, o quadrado de sempre.
    assert.strictEqual(primeiro.width, 800);
    assert.strictEqual(primeiro.height, 800);
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

  test("a imagem tem o tamanho pedido", () => {
    for (const tamanho of TAMANHOS) {
      const desafio = criarDesafioGerado({ aleatorio: criarAleatorioTeste(7), tamanho });
      assert.deepStrictEqual([desafio.width, desafio.height], [tamanho.largura, tamanho.altura]);
    }
    // O servidor não distingue um tamanho do mesmo tamanho virado.
    const tamanhos = FORMATOS_FIXOS.map((formato) => {
      const { largura, altura } = TAMANHO_DO_FORMATO[formato];
      return [largura, altura].sort((a, b) => a - b).join("x");
    });
    assert.strictEqual(new Set(tamanhos).size, FORMATOS_FIXOS.length);
  });

  test("os 8 layouts primários cobrem a imagem inteira, sem sobrar nem sobrepor", () => {
    for (const { largura, altura } of TAMANHOS) {
      const formato = `${largura}x${altura}`;
      const vistos = new Set<string>();
      for (let layout = 0; layout < 8; layout++) {
        // O sorteio do layout é o primeiro: (layout + 0,5) / 8 cai nele.
        const faixas = escolherLayoutPrimario(() => (layout + 0.5) / 8, 0, largura, altura);
        const areas = faixas.map(({ area }) => area);
        vistos.add(JSON.stringify(areas));
        const soma = areas.reduce((total, area) => total + area.width * area.height, 0);
        assert.ok(Math.abs(soma - largura * altura) < 1e-6, `${formato}, layout ${layout}: não cobre tudo.`);
        for (const [indice, area] of areas.entries()) {
          assert.ok(area.x >= 0 && area.y >= 0, `${formato}, layout ${layout}: faixa fora.`);
          assert.ok(area.x + area.width <= largura + 1e-6, `${formato}, layout ${layout}: faixa fora.`);
          assert.ok(area.y + area.height <= altura + 1e-6, `${formato}, layout ${layout}: faixa fora.`);
          for (const outra of areas.slice(indice + 1)) {
            assert.ok(!retangulosSobrepoem(area, outra), `${formato}, layout ${layout}: faixas sobrepostas.`);
          }
        }
      }
      assert.strictEqual(vistos.size, 8, `${formato}: layouts repetidos.`);
    }
    // No quadrado, as coordenadas do script do Vitor (o rodapé do layout 2
    // começa em 600).
    const rodape = escolherLayoutPrimario(() => 2.5 / 8, 0, 800, 800)[2].area;
    assert.deepStrictEqual(rodape, { x: 0, y: 600, width: 800, height: 200 });
    // Na paisagem, a altura certa: 3/4 de 720, e não de 1280.
    const rodapePaisagem = escolherLayoutPrimario(() => 2.5 / 8, 0, 1280, 720)[2].area;
    assert.deepStrictEqual(rodapePaisagem, { x: 0, y: 540, width: 1280, height: 180 });
  });

  test("os tamanhos mínimos acompanham a imagem, como no script do Vitor", () => {
    // No 800x800, os de antes; nos outros, pela média dos dois lados.
    assert.deepStrictEqual(medidasDaImagem(800, 800), {
      tamanhoMinimo: 70,
      margem: 15,
      diametroMinimo: 20,
      espacoCirculos: 30,
    });
    assert.deepStrictEqual(medidasDaImagem(1280, 720), {
      tamanhoMinimo: 87.5,
      margem: 18.75,
      diametroMinimo: 25,
      espacoCirculos: 37.5,
    });
    // Uma imagem com o dobro dos lados não sai com quatro vezes mais
    // componentes. Sai com um pouco mais, porque os limites de "cabe um
    // elemento" e "cabe uma sequência" continuam em px, como no script.
    const media = (tamanho: Tamanho) => {
      const quantidades = Array.from({ length: 100 }, (_, caso) =>
        criarDesafioGerado({ aleatorio: criarAleatorioTeste(caso), tamanho }).blocks.length,
      );
      return quantidades.reduce((soma, valor) => soma + valor, 0) / quantidades.length;
    };
    const normal = media({ largura: 800, altura: 800 });
    const dobro = media({ largura: 1600, altura: 1600 });
    assert.ok(dobro < normal * 2, `800x800: ${normal}; 1600x1600: ${dobro}.`);
  });

  test("os cortes não aparecem: o fundo fica à vista entre os elementos", () => {
    for (const { tamanho, caso } of casosEmCadaTamanho(100)) {
      const desafio = criarDesafioGerado({
        aleatorio: criarAleatorioTeste(caso),
        tamanho,
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
      // Cada elemento fica à margem da borda da região (15 px no 800x800):
      // nada encosta na borda do gabarito.
      const margem = Math.floor(medidasDaImagem(tamanho.largura, tamanho.altura).margem);
      for (const bloco of raiz.filter((bloco) => bloco.shape === "rectangle")) {
        assert.ok(
          bloco.x >= margem && bloco.y >= margem,
          `Caso ${caso}: o bloco ${bloco.id} encosta na borda do gabarito.`,
        );
      }
    }
  });

  test("nos níveis mais fáceis saem os círculos e os menores, sem desfazer padrões", () => {
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
    const noLimite = { facil: 0, medio: 0 };

    for (let caso = 0; caso < 100; caso++) {
      // O difícil é a imagem inteira; o médio tira componentes da mesma imagem.
      const dificil = criarDesafioGerado({ aleatorio: criarAleatorioTeste(caso) });
      const medioInteiro = gerarImagemCompleta({ aleatorio: criarAleatorioTeste(caso), nivel: "medio" });
      assert.deepStrictEqual(medioInteiro.desafio.blocks, dificil.blocks);

      for (const nivel of ["medio", "facil"] as const) {
        const inteiro = gerarImagemCompleta({ aleatorio: criarAleatorioTeste(caso), nivel }).desafio;
        const menor = criarDesafioGerado({ aleatorio: criarAleatorioTeste(caso), nivel });
        assert.strictEqual(menor.nivel, nivel);
        assert.strictEqual(menor.backgroundColor, inteiro.backgroundColor);
        const doInteiro = indexar(inteiro.blocks);
        const doMenor = indexar(menor.blocks);
        // Numerados de #1 a #N, sem buracos.
        assert.deepStrictEqual(
          menor.blocks.map((bloco) => bloco.id),
          menor.blocks.map((_, indice) => indice + 1),
        );
        // Os que ficam são os mesmos blocos, com o mesmo pai.
        for (const [chaveBloco, { bloco, pai, orfao }] of doMenor) {
          const original = doInteiro.get(chaveBloco);
          assert.ok(original, `Caso ${caso}, ${nivel}: o bloco ${bloco.id} não existe na imagem inteira.`);
          assert.ok(!orfao, `Caso ${caso}, ${nivel}: o bloco ${bloco.id} ficou sem o pai.`);
          assert.strictEqual(pai, original.pai, `Caso ${caso}, ${nivel}: o bloco ${bloco.id} trocou de pai.`);
        }
        const sairam = [...doInteiro.entries()]
          .filter(([chaveBloco]) => !doMenor.has(chaveBloco))
          .map(([, valor]) => valor);
        // Como no script do Vitor, os círculos saem antes de qualquer retângulo.
        if (sairam.some(({ bloco }) => bloco.shape !== "circle")) {
          assert.ok(
            menor.blocks.every((bloco) => bloco.shape !== "circle"),
            `Caso ${caso}, ${nivel}: saiu um retângulo e ficou um círculo.`,
          );
        }
        // Em cada forma, saem os menores.
        for (const forma of ["circle", "rectangle"] as const) {
          const ficaram = menor.blocks.filter((bloco) => bloco.shape === forma);
          const menorQueFicou = Math.min(...ficaram.map(tamanho));
          for (const { bloco } of sairam.filter(({ bloco }) => bloco.shape === forma)) {
            assert.ok(
              tamanho(bloco) <= menorQueFicou + 1,
              `Caso ${caso}, ${nivel}: saiu o bloco ${bloco.id}, maior que um que ficou.`,
            );
          }
        }
        // Um padrão sai inteiro ou fica inteiro.
        const padroesQueFicaram = new Set(
          [...doMenor.values()].map(({ bloco, pai }) => padrao(bloco, pai)),
        );
        for (const { bloco, pai } of sairam) {
          assert.ok(
            !padroesQueFicaram.has(padrao(bloco, pai)),
            `Caso ${caso}, ${nivel}: o padrão do bloco ${bloco.id} ficou pela metade.`,
          );
        }
        // Fica o limite do nível, ou perto dele quando um padrão inteiro
        // passaria do limite; uma imagem com menos fica inteira.
        const limite = LIMITE_DE_COMPONENTES[nivel];
        if (inteiro.blocks.length <= limite) {
          assert.strictEqual(menor.blocks.length, inteiro.blocks.length);
        } else {
          assert.ok(
            Math.abs(menor.blocks.length - limite) <= 3,
            `Caso ${caso}, ${nivel}: ficou com ${menor.blocks.length} componentes.`,
          );
        }
        if (menor.blocks.length === Math.min(limite, inteiro.blocks.length)) {
          noLimite[nivel]++;
        }
      }
    }

    // Na maioria, fica exatamente o limite (uns 80% nos códigos).
    assert.ok(noLimite.facil >= 65, `Só ${noLimite.facil} de 100 fáceis ficaram com 7.`);
    assert.ok(noLimite.medio >= 65, `Só ${noLimite.medio} de 100 médios ficaram com 14.`);
  });

  test("o fácil usa só os dois primeiros layouts, como no script do Vitor", () => {
    for (const { largura, altura } of TAMANHOS) {
      const doFacil = new Set<string>();
      for (let sorteio = 0; sorteio < 8; sorteio++) {
        const faixas = escolherLayoutPrimario(() => (sorteio + 0.5) / 8, 0, largura, altura, "facil");
        doFacil.add(JSON.stringify(faixas));
      }
      const primeiros = [0, 1].map((layout) =>
        JSON.stringify(escolherLayoutPrimario(() => (layout + 0.5) / 8, 0, largura, altura)),
      );
      assert.deepStrictEqual([...doFacil].sort(), [...primeiros].sort());
    }
  });

  test("mantém todos os blocos dentro do canvas e dos respectivos pais", () => {
    for (const { tamanho, caso } of casosEmCadaTamanho(300)) {
      const desafio = criarDesafioGerado({
        aleatorio: criarAleatorioTeste(caso),
        tamanho,
      });
      const blocosPorId = new Map<number, Bloco>();
      const filhosPorPai = new Map<number | undefined, Bloco[]>();

      assert.ok(desafio.blocks.length >= 3, `Caso ${caso} gerou poucos blocos.`);
      // O original fica abaixo de 100 blocos no 800x800; o limite, que cresce
      // com a área, só pega recursão descontrolada.
      const area = (tamanho.largura * tamanho.altura) / (800 * 800);
      assert.ok(
        desafio.blocks.length <= 200 * Math.max(1, area),
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

// Os mesmos casos em cada tamanho da imagem.
function casosEmCadaTamanho(quantidade: number) {
  return TAMANHOS.flatMap((tamanho) =>
    Array.from({ length: quantidade }, (_, caso) => ({ tamanho, caso })),
  );
}

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

type Caixa = { x: number; y: number; width: number; height: number };

function retangulosSobrepoem(primeiro: Caixa, segundo: Caixa): boolean {
  return (
    primeiro.x < segundo.x + segundo.width &&
    primeiro.x + primeiro.width > segundo.x &&
    primeiro.y < segundo.y + segundo.height &&
    primeiro.y + primeiro.height > segundo.y
  );
}
