import { Bloco, Nivel } from "../../types";
import { ContextoGeracao } from "./regioes";

// Quantos componentes ficam em cada nível, como no script do Vitor desde o
// commit bdc6f9e: 7 no fácil, 14 no médio e todos no difícil.
export const LIMITE_DE_COMPONENTES: Record<Nivel, number> = {
  facil: 7,
  medio: 14,
  dificil: Infinity,
};

type Padrao = { tamanho: number; circulo: boolean; ids: number[] };

// SelecionaDificuldade do original: ficam os maiores retângulos, e os
// círculos só depois de todos os retângulos. Aqui um padrão sai inteiro
// (sem deixar uma sequência ou uma fileira de círculos pela metade): saem os
// círculos, dos menores para os maiores, e depois os retângulos, até o
// limite do nível. Quando o próximo padrão passaria do limite, fica o que
// chegar mais perto dele (no empate, o padrão fica); por isso o nível pode
// ter alguns componentes a mais ou a menos. Os filhos são sempre menores que
// o pai, e os círculos não têm filhos, então nenhum bloco perde o pai. Os
// que ficam são numerados de novo, para a lista ir de #1 a #N sem buracos.
export function tirarOsMenores(contexto: ContextoGeracao, limite: number): Bloco[] {
  let restam = contexto.blocks.length;
  if (restam <= limite) {
    return contexto.blocks;
  }

  const removidos = new Set<number>();
  for (const padrao of padroesNaOrdemDeSaida(contexto)) {
    const depois = restam - padrao.ids.length;
    const passaria = depois < limite;
    if (passaria && limite - depois >= restam - limite) {
      break;
    }
    padrao.ids.forEach((id) => removidos.add(id));
    restam = depois;
    if (restam <= limite) {
      break;
    }
  }

  const ficam = contexto.blocks.filter((bloco) => !removidos.has(bloco.id));
  const novoId = new Map(ficam.map((bloco, indice) => [bloco.id, indice + 1]));
  return ficam.map((bloco) => ({
    ...bloco,
    id: novoId.get(bloco.id) ?? bloco.id,
    parentId:
      bloco.parentId === undefined ? undefined : novoId.get(bloco.parentId),
  }));
}

// Os círculos antes dos retângulos e, em cada forma, os menores primeiro.
function padroesNaOrdemDeSaida(contexto: ContextoGeracao): Padrao[] {
  const padroes = new Map<number, Padrao>();
  for (const bloco of contexto.blocks) {
    const grupo = contexto.grupoDoBloco.get(bloco.id) ?? -bloco.id;
    const tamanho = (bloco.width + bloco.height) / 2;
    const atual = padroes.get(grupo) ?? {
      tamanho,
      circulo: bloco.shape === "circle",
      ids: [],
    };
    atual.tamanho = Math.max(atual.tamanho, tamanho);
    atual.ids.push(bloco.id);
    padroes.set(grupo, atual);
  }
  return [...padroes.values()].sort((a, b) =>
    a.circulo !== b.circulo ? (a.circulo ? -1 : 1) : a.tamanho - b.tamanho,
  );
}
