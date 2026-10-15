import { Bloco, Nivel } from "../../types";
import { ContextoGeracao } from "./regioes";

// A parte dos componentes que sai em cada nível, dos menores para os
// maiores.
export const FRACAO_REMOVIDA: Record<Nivel, number> = {
  facil: 0.5,
  medio: 0.3,
  dificil: 0,
};
// Nenhum nível tira tanto que sobrem menos componentes que isto.
const MINIMO_DE_COMPONENTES = 8;

// SelecionaDificuldade do original: tira os componentes menores. Um padrão
// sai inteiro (sem deixar uma sequência pela metade), dos menores para os
// maiores, até tirar a quantidade do nível; por isso podem sair alguns a
// mais. Os filhos são sempre menores que o pai, então saem antes dele. Os
// que ficam são numerados de novo, para a lista ir de #1 a #N sem buracos.
export function tirarOsMenores(contexto: ContextoGeracao, quantidade: number): Bloco[] {
  if (quantidade === 0) {
    return contexto.blocks;
  }

  const grupos = new Map<number, { tamanho: number; ids: number[] }>();
  for (const bloco of contexto.blocks) {
    const grupo = contexto.grupoDoBloco.get(bloco.id) ?? -bloco.id;
    const tamanho = (bloco.width + bloco.height) / 2;
    const atual = grupos.get(grupo) ?? { tamanho, ids: [] };
    atual.tamanho = Math.max(atual.tamanho, tamanho);
    atual.ids.push(bloco.id);
    grupos.set(grupo, atual);
  }

  const removidos = new Set<number>();
  const limite = contexto.blocks.length - MINIMO_DE_COMPONENTES;
  for (const grupo of [...grupos.values()].sort((a, b) => a.tamanho - b.tamanho)) {
    if (
      removidos.size >= quantidade ||
      removidos.size + grupo.ids.length > limite
    ) {
      break;
    }
    grupo.ids.forEach((id) => removidos.add(id));
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
