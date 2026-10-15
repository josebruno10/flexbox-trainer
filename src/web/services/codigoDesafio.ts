// Cada desafio tem um código de 6 dígitos, fácil de ditar em sala: o mesmo
// código gera sempre a mesma imagem. Assim a turma treina o mesmo layout, e o
// aluno pode refazer um desafio para bater a própria nota.
//
// O código vira a semente do sorteio do gerador. Se o gerador mudar, os
// códigos já compartilhados passam a gerar outros desafios; os testes do
// gerador avisam quando isso acontece.

const DIGITOS = 6;
const TOTAL_CODIGOS = 10 ** DIGITOS;

export function sortearCodigo(aleatorio: () => number = Math.random): string {
  return String(Math.floor(aleatorio() * TOTAL_CODIGOS) % TOTAL_CODIGOS).padStart(
    DIGITOS,
    "0",
  );
}

/** Aceita "482917", "482 917" ou "482-917"; qualquer outra coisa é inválida. */
export function normalizarCodigo(texto: string): string | undefined {
  const codigo = texto.replace(/[\s.-]/g, "");
  return /^\d{6}$/.test(codigo) ? codigo : undefined;
}

/** "482917" vira "482 917", mais fácil de ler e de ditar. */
export function formatarCodigo(codigo: string): string {
  return `${codigo.slice(0, 3)} ${codigo.slice(3)}`;
}

/**
 * O desafio do dia: o mesmo código para todos na mesma data, a do
 * computador. Assim a turma treina o mesmo layout sem o professor passar um.
 */
export function codigoDoDia(data: Date = new Date()): string {
  const dia = [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
  ].join("-");
  return String(semente(`flexbox-trainer:dia:${dia}`) % TOTAL_CODIGOS).padStart(
    DIGITOS,
    "0",
  );
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

// Espalha o texto num número de 32 bits, para códigos vizinhos ("000001" e
// "000002") darem desafios bem diferentes.
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
