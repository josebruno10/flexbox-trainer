import * as assert from "assert";
import { criarDesafioPorCodigo } from "../../services/desafio";
import { lerDetalhesDoServidor, ligarAosComponentes } from "../../services/detalhesDaNota";
import type { FormaMedida } from "../../types";
import {
  descreverProblema,
  paraCorrigir,
  resumirDetalhes,
} from "../../webview/correcoes";

// A resposta de corrigir-formas de um desafio fácil, como o servidor mandou
// (a página tinha só o fundo branco). Ela veio do TSQR, com 11 componentes,
// antes dos 8 layouts do gerador. Desde que o fácil fica com 7 componentes,
// ela é a do ACAE: a cor do fundo é a dele (era #1930f8), e as formas não
// encontradas e a nota máxima são as de 7 componentes (eram 11 e 12).
const RESPOSTA_ACAE = {
  message: "Correção por formas concluída.",
  pontuacao: { "81_74_800x800": { pontuacao_total: 0.8, pontuacao_maxima: 8, percentual: 10 } },
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
          gabarito_forma: { x: 400, y: 400, id: "gab_6", cor: "#8bf9c1", width: 800, height: 800, label_cor: "Verde" },
        },
      ],
      extras: [],
      nao_encontradas: [0, 1, 2, 3, 4, 6, 7],
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
    const desafio = criarDesafioPorCodigo("ACAE");
    const detalhes = ligarAosComponentes(desafio, lerDetalhesDoServidor(RESPOSTA_ACAE)!);

    assert.strictEqual(detalhes.componentes.length, desafio.blocks.length + 1);
    assert.deepStrictEqual(detalhes.componentes[0], {
      componente: "fundo",
      pontos: 0.8,
      problemas: [{ tipo: "cor", sua: "#ffffff", esperada: "#8bf9c1" }],
    });
    for (const item of detalhes.componentes.slice(1)) {
      assert.deepStrictEqual(item.problemas, [{ tipo: "faltando" }], `#${item.componente}`);
    }
    assert.strictEqual(resumirDetalhes(detalhes), "0 de 8 certos · 1 para ajustar · 7 faltando");
  });

  test("separa blocos da mesma cor pela posição e diz quanto e para onde mexer", () => {
    // No ACAE, os blocos de 2 a 5 têm a mesma cor, um embaixo do outro.
    const desafio = criarDesafioPorCodigo("ACAE");
    const gabarito3 = formaDoBloco("ACAE", 3);
    const pagina3 = formaDoBloco("ACAE", 3, { x: 12, y: -4 });
    const gabarito7 = formaDoBloco("ACAE", 7, { width: -1 });
    const pagina7 = { ...formaDoBloco("ACAE", 7, { width: -20 }), cor: "#000000" };
    const resposta = {
      detalhes: [
        {
          pares: [
            { pontos: 0.9, status: "0.90 pts (tam:1.00, dist:0.75, cor:1.00)", forma_correta: true, gabarito_forma: gabarito3, cliente_forma: pagina3 },
            { pontos: 0.5, status: "0.50 pts (tam:0.88, dist:1.00, cor:0.00)", forma_correta: true, gabarito_forma: gabarito7, cliente_forma: pagina7 },
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
    const bloco7 = desafio.blocks.find((bloco) => bloco.id === 7)!;
    assert.deepStrictEqual(porId.get(7)?.problemas, [
      {
        tipo: "tamanho",
        sua: { width: bloco7.width - 20, height: bloco7.height },
        esperada: { width: bloco7.width, height: bloco7.height },
      },
      { tipo: "cor", sua: "#000000", esperada: bloco7.color },
    ]);
    assert.deepStrictEqual(detalhes.aMais, [{ x: 50, y: 50, width: 30, height: 30, cor: "#ff0000" }]);

    // Os que mais tiram pontos vêm primeiro: os que faltam, depois o 7 e o 3.
    const ordem = paraCorrigir(detalhes).map((item) => item.componente);
    assert.deepStrictEqual(ordem.slice(-2), [7, 3]);
    assert.strictEqual(
      descreverProblema({ tipo: "posicao", dx: 12, dy: -4 }),
      "fora do lugar: 12 px à direita e 4 px acima",
    );
    assert.strictEqual(
      descreverProblema(porId.get(7)!.problemas[0]),
      `${bloco7.width - 20} × ${bloco7.height} px em vez de ${bloco7.width} × ${bloco7.height} px`,
    );
  });

  test("o arredondamento do servidor ao medir o gabarito não vira problema", () => {
    const desafio = criarDesafioPorCodigo("ACAE");
    const gabarito = formaDoBloco("ACAE", 1, { width: -1, height: -1 });
    const pagina = formaDoBloco("ACAE", 1);
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
