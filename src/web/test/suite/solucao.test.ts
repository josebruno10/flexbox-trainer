import * as assert from "assert";
import { criarDesafioGerado } from "../../services/desafio";
import {
  gerarSolucaoAbsoluta,
  gerarSolucaoFlexbox,
} from "../../services/solucao";
import { Desafio } from "../../types";

// A posição final só aparece com layout de verdade; ela foi conferida pixel a
// pixel no Chromium. Aqui ficam a hierarquia, as medidas e as cores.
suite("Solução exata do desafio", () => {
  test("absoluta: cada bloco dentro do pai e na posição relativa a ele", () => {
    for (let caso = 0; caso < 20; caso++) {
      const desafio = gerarDesafio(caso);
      const { html, css } = gerarSolucaoAbsoluta(desafio);
      const paiNoHtml = lerHierarquia(html, caso);
      const blocosPorId = new Map(desafio.blocks.map((bloco) => [bloco.id, bloco]));

      for (const bloco of desafio.blocks) {
        assert.strictEqual(paiNoHtml.get(bloco.id), bloco.parentId);
        const pai =
          bloco.parentId === undefined ? undefined : blocosPorId.get(bloco.parentId);
        const valor = lerRegra(css, `b${bloco.id}`);
        assert.strictEqual(valor("left"), `${bloco.x - (pai?.x ?? 0)}px`);
        assert.strictEqual(valor("top"), `${bloco.y - (pai?.y ?? 0)}px`);
        assertAparencia(valor, desafio, bloco.id);
      }
    }
  });

  test("flexbox: sem position, com cada bloco dentro do pai", () => {
    for (let caso = 0; caso < 50; caso++) {
      const desafio = gerarDesafio(caso);
      const { html, css } = gerarSolucaoFlexbox(desafio);
      const paiNoHtml = lerHierarquia(html, caso);

      assert.doesNotMatch(css, /position:/, `Caso ${caso} usou position.`);
      assert.match(css, /display: flex;/);

      for (const bloco of desafio.blocks) {
        assert.strictEqual(
          paiNoHtml.get(bloco.id),
          bloco.parentId,
          `Caso ${caso}: bloco ${bloco.id} fora do pai certo.`,
        );
        assertAparencia(lerRegra(css, `b${bloco.id}`), desafio, bloco.id);
      }

      // Agrupadores só organizam o layout: não têm cor própria.
      for (const [, classe] of html.matchAll(/class="(g\d+)"/g)) {
        assert.strictEqual(lerRegra(css, classe)("background"), undefined);
      }
    }
  });
});

// Pai de cada bloco no HTML, ignorando os agrupadores (g1, g2...).
function lerHierarquia(
  html: string,
  caso: number,
): Map<number, number | undefined> {
  const pilha: string[] = [];
  const paiNoHtml = new Map<number, number | undefined>();

  for (const marca of html.matchAll(/<div class="(\w+)">|<\/div>/g)) {
    if (!marca[1]) {
      pilha.pop();
      continue;
    }

    if (marca[1].startsWith("b")) {
      const paiBloco = [...pilha].reverse().find((classe) => classe.startsWith("b"));
      paiNoHtml.set(
        Number(marca[1].slice(1)),
        paiBloco === undefined ? undefined : Number(paiBloco.slice(1)),
      );
    }
    pilha.push(marca[1]);
  }

  assert.strictEqual(pilha.length, 0, `Caso ${caso}: divs desbalanceadas.`);
  return paiNoHtml;
}

function lerRegra(
  css: string,
  classe: string,
): (propriedade: string) => string | undefined {
  const regra = new RegExp(`\\.${classe} \\{([^}]*)\\}`).exec(css)?.[1] ?? "";
  return (propriedade) =>
    new RegExp(`(?:^|\\s)${propriedade}: ([^;]+);`).exec(regra)?.[1];
}

function assertAparencia(
  valor: (propriedade: string) => string | undefined,
  desafio: Desafio,
  id: number,
): void {
  const bloco = desafio.blocks.find((candidato) => candidato.id === id)!;
  assert.strictEqual(valor("width"), `${bloco.width}px`);
  assert.strictEqual(valor("height"), `${bloco.height}px`);
  assert.strictEqual(valor("background"), bloco.color);
  assert.strictEqual(
    valor("border-radius"),
    bloco.shape === "circle" ? "50%" : undefined,
  );
}

function gerarDesafio(caso: number): Desafio {
  let estado = caso >>> 0;
  return criarDesafioGerado({
    aleatorio: () => {
      estado = (estado + 0x6d2b79f5) >>> 0;
      let valor = estado;
      valor = Math.imul(valor ^ (valor >>> 15), valor | 1);
      valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61);
      return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296;
    },
  });
}
