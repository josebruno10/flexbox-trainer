import { Desafio, Nivel } from "../types";
import { nivelDoCodigo } from "../niveis";
import { aleatorioDoCodigo, sortearCodigo } from "./codigoDesafio";
import { corAleatoria, rgbParaHex } from "./gerador/cores";
import { FRACAO_REMOVIDA, tirarOsMenores } from "./gerador/dificuldade";
import {
  ContextoGeracao,
  Regiao,
  cortarRegiao,
  escolherLayoutPrimario,
} from "./gerador/regioes";
import { Aleatorio } from "./gerador/sorteio";

// Porta do gerador de Vitor Costa (Gerador-de-imagens-para-torneio-de-CSS,
// commit 271c492). As decisões aleatórias seguem o script original; muda a
// saída, que vira uma lista de blocos com hierarquia em vez de desenho direto
// no canvas, e o gerador de números, que pode ser injetado nos testes.
// As partes do gerador ficam em ./gerador; aqui fica a entrada.
export const LARGURA_GABARITO = 800;
export const ALTURA_GABARITO = 800;

export type OpcoesGeracaoDesafio = {
  aleatorio?: Aleatorio;
  nivel?: Nivel;
};

/**
 * O desafio de um código: o mesmo código gera sempre a mesma imagem, no nível
 * que ele carrega. Sem código, sorteia um médio. Cada vez é uma tentativa
 * nova, com outro challengeId.
 */
export function criarDesafioPorCodigo(codigo: string = sortearCodigo()): Desafio {
  const desafio = criarDesafioGerado({
    aleatorio: aleatorioDoCodigo(codigo),
    nivel: nivelDoCodigo(codigo),
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
  const aleatorio = opcoes.aleatorio ?? Math.random;
  const nivel = opcoes.nivel ?? "dificil";
  const contexto: ContextoGeracao = {
    aleatorio,
    blocks: [],
    proximoId: 1,
    grupoDoBloco: new Map(),
    proximoGrupo: 1,
  };
  const corFundo = corAleatoria(aleatorio);
  const direcao = aleatorio() < 0.5 ? 0 : 1;

  for (const faixa of escolherLayoutPrimario(aleatorio, direcao)) {
    const regiao: Regiao = {
      area: faixa.area,
      parentId: undefined,
      rgb: corFundo,
      count: 0,
      cortado: true,
    };
    cortarRegiao(contexto, regiao, faixa.direcao);
  }

  return {
    challengeId: criarIdDesafio(aleatorio),
    width: LARGURA_GABARITO,
    height: ALTURA_GABARITO,
    backgroundColor: rgbParaHex(corFundo),
    nivel,
    blocks: tirarOsMenores(
      contexto,
      Math.floor(contexto.blocks.length * FRACAO_REMOVIDA[nivel]),
    ),
  };
}

function criarIdDesafio(aleatorio: Aleatorio): string {
  const trechoAleatorio = Math.floor(aleatorio() * 0xffffffff)
    .toString(36)
    .padStart(7, "0");
  return `challenge-${Date.now().toString(36)}-${trechoAleatorio}`;
}
