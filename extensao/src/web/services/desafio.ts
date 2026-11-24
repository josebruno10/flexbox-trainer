import { Desafio, Nivel, Tamanho } from "../types";
import { TAMANHO_DO_FORMATO, formatoDoCodigo } from "../formatos";
import { nivelDoCodigo } from "../niveis";
import { aleatorioDoCodigo, sortearCodigo } from "./codigoDesafio";
import { corAleatoria, rgbParaHex } from "./gerador/cores";
import { LIMITE_DE_COMPONENTES, tirarOsMenores } from "./gerador/dificuldade";
import {
  ContextoGeracao,
  Regiao,
  cortarRegiao,
} from "./gerador/regioes";
import { escolherLayoutPrimario } from "./gerador/layouts";
import { medidasDaImagem } from "./gerador/medidas";
import { Aleatorio } from "./gerador/sorteio";

// Porta do gerador de Vitor Costa (Gerador-de-imagens-para-torneio-de-CSS,
// commit bdc6f9e, com os 8 layouts primários, as proporções e os níveis por
// quantidade de componentes). As decisões aleatórias seguem o script
// original; muda a saída, que vira uma lista de blocos com hierarquia em vez
// de desenho direto no canvas, e o gerador de números, que pode ser injetado
// nos testes. O script monta os layouts pela proporcaoImagem, que lá é
// trocada à mão; aqui ela é o tamanho do formato.
// As partes do gerador ficam em ./gerador; aqui fica a entrada.

export type OpcoesGeracaoDesafio = {
  aleatorio?: Aleatorio;
  nivel?: Nivel;
  // Sem tamanho, o quadrado de 800x800.
  tamanho?: Tamanho;
};

/**
 * O desafio de um código: o mesmo código gera sempre a mesma imagem, no nível
 * e no formato que ele carrega. Sem código, sorteia um médio e quadrado. Cada
 * vez é uma tentativa nova, com outro challengeId. Um código do formato livre
 * não diz o tamanho: ele vem de quem criou o desafio ou do servidor (veja
 * provider/barraLateral/tamanhoLivre.ts).
 */
export function criarDesafioPorCodigo(
  codigo: string = sortearCodigo(),
  tamanhoLivre?: Tamanho,
): Desafio {
  const formato = formatoDoCodigo(codigo);
  if (formato === "livre" && !tamanhoLivre) {
    throw new Error(`O desafio ${codigo} é de tamanho livre, e falta o tamanho.`);
  }
  const desafio = criarDesafioGerado({
    aleatorio: aleatorioDoCodigo(codigo),
    nivel: nivelDoCodigo(codigo),
    tamanho: formato === "livre" ? tamanhoLivre : TAMANHO_DO_FORMATO[formato],
  });
  const tentativa =
    Date.now().toString(36) +
    Math.floor(Math.random() * 0xffffff)
      .toString(36)
      .padStart(5, "0");
  return { ...desafio, challengeId: `challenge-${codigo}-${tentativa}`, codigo };
}

export function criarDesafioGerado(
  opcoes: OpcoesGeracaoDesafio = {},
): Desafio {
  const { desafio, contexto } = gerarImagemCompleta(opcoes);
  const nivel = opcoes.nivel ?? "dificil";
  return {
    ...desafio,
    blocks: tirarOsMenores(contexto, LIMITE_DE_COMPONENTES[nivel]),
  };
}

/**
 * A imagem antes de o nível tirar componentes, já com o layout do nível (o
 * fácil sorteia entre menos layouts). Fica separada para os testes
 * compararem cada nível com a imagem inteira dele.
 */
export function gerarImagemCompleta(
  opcoes: OpcoesGeracaoDesafio = {},
): { desafio: Desafio; contexto: ContextoGeracao } {
  const aleatorio = opcoes.aleatorio ?? Math.random;
  const nivel = opcoes.nivel ?? "dificil";
  const { largura, altura } = opcoes.tamanho ?? TAMANHO_DO_FORMATO.quadrado;
  const contexto: ContextoGeracao = {
    aleatorio,
    medidas: medidasDaImagem(largura, altura),
    blocks: [],
    proximoId: 1,
    grupoDoBloco: new Map(),
    proximoGrupo: 1,
  };
  const corFundo = corAleatoria(aleatorio);
  const direcao = aleatorio() < 0.5 ? 0 : 1;

  for (const faixa of escolherLayoutPrimario(aleatorio, direcao, largura, altura, nivel)) {
    const regiao: Regiao = {
      area: faixa.area,
      parentId: undefined,
      rgb: corFundo,
      count: 0,
      cortado: true,
    };
    cortarRegiao(contexto, regiao, faixa.direcao);
  }

  const desafio: Desafio = {
    challengeId: criarIdDesafio(aleatorio),
    width: largura,
    height: altura,
    backgroundColor: rgbParaHex(corFundo),
    nivel,
    blocks: contexto.blocks,
  };
  return { desafio, contexto };
}

function criarIdDesafio(aleatorio: Aleatorio): string {
  const trechoAleatorio = Math.floor(aleatorio() * 0xffffffff)
    .toString(36)
    .padStart(7, "0");
  return `challenge-${Date.now().toString(36)}-${trechoAleatorio}`;
}
