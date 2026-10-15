// Os sorteios do gerador. O gerador de números vem de fora: o do código do
// desafio, o Math.random ou um fixo nos testes.
export type Aleatorio = () => number;

export function inteiroAleatorio(
  aleatorio: Aleatorio,
  minimo: number,
  maximo: number,
): number {
  const inicio = Math.ceil(Math.min(minimo, maximo));
  const fim = Math.floor(Math.max(minimo, maximo));
  return Math.floor(aleatorio() * (fim - inicio + 1)) + inicio;
}

export function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(Math.max(minimo, maximo), valor));
}

export function itemAleatorio<T>(aleatorio: Aleatorio, itens: readonly T[]): T {
  return itens[inteiroAleatorio(aleatorio, 0, itens.length - 1)];
}
