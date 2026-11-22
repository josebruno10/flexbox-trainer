import * as assert from "assert";
import { criarDesafioPorCodigo } from "../../services/desafio";
import { lerDetalhesDoServidor, ligarAosComponentes } from "../../services/detalhesDaNota";
import type { FormaMedida } from "../../types";
import {
  descreverProblema,
  paraCorrigir,
  resumirDetalhes,
} from "../../webview/correcoes";

// A resposta de corrigir-formas de um desafio fácil com 11 componentes, como
// o servidor mandou (a página tinha só o fundo branco). Ela veio do TSQR,
// antes dos 8 layouts do gerador; hoje, o BZVG também tem 11 componentes, e
// a cor do fundo foi trocada pela dele (era #1930f8).
const RESPOSTA_BZVG = {
  message: "Correção por formas concluída.",
  pontuacao: { "81_74_800x800": { pontuacao_total: 0.8, pontuacao_maxima: 12, percentual: 6.67 } },
  detalhes: [
    {
      chave: "81_74_800x800",
      viewport: { width: 800, height: 800 },
      pares: [
        {
          cliente_id: "forma_1",
          cliente_index: 0,
          gabarito_index: 5,
          pontos: 0.8,
          status: "0.80 pts (tam:1.00, dist:1.00, cor:0.00)",
          forma_correta: true,
          distancia_px: 0,
          cliente_forma: { id: "forma_1", tipo: "quadrado", x: 400, y: 400, width: 800, height: 800, cor: "#ffffff" },
          gabarito_forma: { x: 400, y: 400, id: "gab_6", cor: "#4023f2", width: 800, height: 800, label_cor: "Azul" },
        },
      ],
      extras: [],
      nao_encontradas: [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11],
    },
  ],
};

// Uma forma do gabarito como o servidor descreve: x e y no centro.
function formaDoBloco(codigo: string, id: number, mudar: Partial<Record<"x" | "y" | "width" | "height", number>> = {}) {
  const bloco = criarDesafioPorCodigo(codigo).blocks.find((candidato) => candidato.id === id)!;
  return {
    x: bloco.x + bloco.width / 2 + (mudar.x ?? 0),
    y: bloco.y + bloco.height / 2 + (mudar.y ?? 0),
    width: bloco.width + (mudar.width ?? 0),
    height: bloco.height + (mudar.height ?? 0),
    cor: bloco.color,
  };
}

suite("Detalhes da nota", () => {
  test("liga a resposta do servidor ao fundo e aos blocos do desafio", () => {
    const desafio = criarDesafioPorCodigo("BZVG");
    const detalhes = ligarAosComponentes(desafio, lerDetalhesDoServidor(RESPOSTA_BZVG)!);

    assert.strictEqual(detalhes.componentes.length, desafio.blocks.length + 1);
    assert.deepStrictEqual(detalhes.componentes[0], {
      componente: "fundo",
      pontos: 0.8,
      problemas: [{ tipo: "cor", sua: "#ffffff", esperada: "#4023f2" }],
    });
    for (const item of detalhes.componentes.slice(1)) {
      assert.deepStrictEqual(item.problemas, [{ tipo: "faltando" }], `#${item.componente}`);
    }
    assert.strictEqual(resumirDetalhes(detalhes), "0 de 12 certos · 1 para ajustar · 11 faltando");
  });

  test("separa blocos da mesma cor pela posição e diz quanto e para onde mexer", () => {
    // No BZVG, os blocos 2, 3 e 4 têm a mesma cor, um embaixo do outro.
    const desafio = criarDesafioPorCodigo("BZVG");
    const gabarito3 = formaDoBloco("BZVG", 3);
    const pagina3 = formaDoBloco("BZVG", 3, { x: 12, y: -4 });
    const gabarito9 = formaDoBloco("BZVG", 9, { width: -1 });
    const pagina9 = { ...formaDoBloco("BZVG", 9, { width: -20 }), cor: "#000000" };
    const resposta = {
      detalhes: [
        {
          pares: [
            { pontos: 0.9, status: "0.90 pts (tam:1.00, dist:0.75, cor:1.00)", forma_correta: true, gabarito_forma: gabarito3, cliente_forma: pagina3 },
            { pontos: 0.5, status: "0.50 pts (tam:0.88, dist:1.00, cor:0.00)", forma_correta: true, gabarito_forma: gabarito9, cliente_forma: pagina9 },
          ],
          extras: [0],
          nao_encontradas: [],
        },
      ],
    };
    const formas: FormaMedida[] = [
      { id: "forma_1", tipo: "quadrado", x: 50, y: 50, width: 30, height: 30, area: 900, cor: "#ff0000" },
    ];

    const detalhes = ligarAosComponentes(desafio, lerDetalhesDoServidor(resposta, formas)!);
    const porId = new Map(detalhes.componentes.map((item) => [item.componente, item]));

    assert.deepStrictEqual(porId.get(3)?.problemas, [{ tipo: "posicao", dx: 12, dy: -4 }]);
    assert.deepStrictEqual(porId.get(2)?.problemas, [{ tipo: "faltando" }]);
    assert.deepStrictEqual(porId.get(4)?.problemas, [{ tipo: "faltando" }]);
    const bloco9 = desafio.blocks.find((bloco) => bloco.id === 9)!;
    assert.deepStrictEqual(porId.get(9)?.problemas, [
      {
        tipo: "tamanho",
        sua: { width: bloco9.width - 20, height: bloco9.height },
        esperada: { width: bloco9.width, height: bloco9.height },
      },
      { tipo: "cor", sua: "#000000", esperada: bloco9.color },
    ]);
    assert.deepStrictEqual(detalhes.aMais, [{ x: 50, y: 50, width: 30, height: 30, cor: "#ff0000" }]);

    // Os que mais tiram pontos vêm primeiro: os que faltam, depois o 9 e o 3.
    const ordem = paraCorrigir(detalhes).map((item) => item.componente);
    assert.deepStrictEqual(ordem.slice(-2), [9, 3]);
    assert.strictEqual(
      descreverProblema({ tipo: "posicao", dx: 12, dy: -4 }),
      "fora do lugar: 12 px à direita e 4 px acima",
    );
    assert.strictEqual(
      descreverProblema(porId.get(9)!.problemas[0]),
      `${bloco9.width - 20} × ${bloco9.height} px em vez de ${bloco9.width} × ${bloco9.height} px`,
    );
  });

  test("o arredondamento do servidor ao medir o gabarito não vira problema", () => {
    const desafio = criarDesafioPorCodigo("BZVG");
    const gabarito = formaDoBloco("BZVG", 1, { width: -1, height: -1 });
    const pagina = formaDoBloco("BZVG", 1);
    const resposta = {
      detalhes: [
        {
          pares: [
            { pontos: 0.99, status: "0.99 pts (tam:0.99, dist:0.99, cor:1.00)", forma_correta: true, gabarito_forma: gabarito, cliente_forma: pagina },
          ],
          extras: [],
          nao_encontradas: [],
        },
      ],
    };

    const detalhes = ligarAosComponentes(desafio, lerDetalhesDoServidor(resposta)!);

    assert.deepStrictEqual(detalhes.componentes.find((item) => item.componente === 1)?.problemas, []);
  });

  test("sem o detalhe na resposta, não há o que corrigir", () => {
    assert.strictEqual(lerDetalhesDoServidor({ pontuacao: 50 }), undefined);
    assert.strictEqual(lerDetalhesDoServidor(undefined), undefined);
  });
});
