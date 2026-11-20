import { NOME_DO_NIVEL, nivelDoCodigo } from "../../niveis";
import { formatarTempo } from "../../telas/comum";

export type MelhorDaTentativa = { precisao: number; tempoMs: number };

/** "Desafio médio MESA: 87,42% em 12:34", para colar no grupo da turma. */
export function textoDoResultado(
  codigo: string,
  melhor: MelhorDaTentativa,
): string {
  const nome = `Desafio ${NOME_DO_NIVEL[nivelDoCodigo(codigo)]} ${codigo}`;
  return `${nome}: ${formatarPorcentagem(melhor.precisao)}% em ${formatarTempo(melhor.tempoMs)}`;
}

// Com a mesma nota, vale a que saiu mais rápido.
export function melhorEntre(
  atual: MelhorDaTentativa | undefined,
  nova: MelhorDaTentativa,
): MelhorDaTentativa {
  return !atual ||
    nova.precisao > atual.precisao ||
    (nova.precisao === atual.precisao && nova.tempoMs < atual.tempoMs)
    ? nova
    : atual;
}

export function formatarPorcentagem(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
