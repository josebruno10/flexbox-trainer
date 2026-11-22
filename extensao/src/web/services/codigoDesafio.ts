// Cada desafio tem um código de 4 letras, fácil de ditar em sala: o mesmo
// código gera sempre a mesma imagem, no mesmo nível. Assim a turma treina o
// mesmo layout, e o aluno pode refazer um desafio para bater a própria nota.
//
// O código vira a semente do sorteio do gerador. Se o gerador mudar, os
// códigos já compartilhados passam a gerar outros desafios; os testes do
// gerador avisam quando isso acontece.

import type { Formato, Nivel } from "../types";
import { FORMATOS } from "../formatos";
import { LETRAS_DO_CODIGO, NIVEIS, TAMANHO_DO_CODIGO } from "../niveis";

const TOTAL_CODIGOS = LETRAS_DO_CODIGO.length ** TAMANHO_DO_CODIGO;
// Cada combinação de nível e formato é um resto da divisão por 9.
const COMBINACOES = NIVEIS.length * FORMATOS.length;

/**
 * Um código ao acaso, entre os do nível e do formato pedidos (veja
 * nivelDoCodigo e formatoDoCodigo).
 */
export function sortearCodigo(
  nivel: Nivel = "medio",
  formato: Formato = "quadrado",
  aleatorio: () => number = Math.random,
): string {
  const resto = NIVEIS.indexOf(nivel) + FORMATOS.indexOf(formato) * NIVEIS.length;
  // Quantos códigos de AAAA a ZZZZ deixam esse resto na divisão por 9.
  const quantidade = Math.floor((TOTAL_CODIGOS - 1 - resto) / COMBINACOES) + 1;
  const indice = Math.min(quantidade - 1, Math.floor(aleatorio() * quantidade));
  return codigoDoValor(indice * COMBINACOES + resto);
}

/** Aceita "MESA", "mesa" ou "me-sa"; qualquer outra coisa é inválida. */
export function normalizarCodigo(texto: string): string | undefined {
  const codigo = texto.replace(/[\s.-]/g, "").toUpperCase();
  return new RegExp(`^[A-Z]{${TAMANHO_DO_CODIGO}}$`).test(codigo)
    ? codigo
    : undefined;
}

/** A data do computador, como "2026-10-14". */
export function diaLocal(data: Date): string {
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
  ].join("-");
}

/** O sorteio do gerador para um código: sempre a mesma sequência. */
export function aleatorioDoCodigo(codigo: string): () => number {
  let estado = semente(`flexbox-trainer:${codigo}`);

  // mulberry32: rápido, com boa distribuição e o mesmo resultado em qualquer
  // motor de JavaScript.
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let valor = estado;
    valor = Math.imul(valor ^ (valor >>> 15), valor | 1);
    valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61);
    return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296;
  };
}

// O contrário de valorDoCodigo: 0 é "AAAA", 1 é "AAAB" e 456975 é "ZZZZ".
function codigoDoValor(valor: number): string {
  let codigo = "";
  for (let posicao = 0; posicao < TAMANHO_DO_CODIGO; posicao++) {
    codigo = LETRAS_DO_CODIGO[valor % LETRAS_DO_CODIGO.length] + codigo;
    valor = Math.floor(valor / LETRAS_DO_CODIGO.length);
  }
  return codigo;
}

// Espalha o texto num número de 32 bits, para códigos vizinhos ("AAAB" e
// "AAAC") darem desafios bem diferentes.
function semente(texto: string): number {
  let valor = 1779033703 ^ texto.length;
  for (let indice = 0; indice < texto.length; indice++) {
    valor = Math.imul(valor ^ texto.charCodeAt(indice), 3432918353);
    valor = (valor << 13) | (valor >>> 19);
  }
  valor = Math.imul(valor ^ (valor >>> 16), 2246822507);
  valor = Math.imul(valor ^ (valor >>> 13), 3266489909);
  return (valor ^ (valor >>> 16)) >>> 0;
}
