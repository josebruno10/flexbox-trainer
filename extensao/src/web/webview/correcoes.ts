import type {
  Bloco,
  ComponenteCorrigido,
  DetalhesDaNota,
  FormaDoServidor,
  ProblemaDoComponente,
} from "../types";
import { formatarMedida, normalizarHex } from "./desenhoGabarito";

// Os textos do detalhe da nota (veja services/detalhesDaNota.ts), iguais na
// barra lateral e na aba do gabarito.

export function nomeDoComponente(
  componente: ComponenteCorrigido["componente"],
  blocos: readonly Pick<Bloco, "id" | "shape">[],
): string {
  if (componente === "fundo") {
    return "Fundo";
  }
  const bloco = blocos.find((candidato) => candidato.id === componente);
  return `#${componente} ${bloco?.shape === "circle" ? "Círculo" : "Retângulo"}`;
}

export function descreverProblema(problema: ProblemaDoComponente): string {
  switch (problema.tipo) {
    case "faltando":
      return "não aparece na sua página";
    case "forma":
      return problema.esperada === "circulo"
        ? "deveria ser um círculo"
        : "deveria ser um retângulo";
    case "cor":
      return `cor ${normalizarHex(problema.sua)} em vez de ${normalizarHex(problema.esperada)}`;
    case "tamanho":
      return `${medida(problema.sua)} em vez de ${medida(problema.esperada)}`;
    case "posicao":
      return `fora do lugar: ${deslocamento(problema.dx, problema.dy)}`;
  }
}

/** Uma palavra para a marca de cada componente na lista da aba. */
export function marcaDoProblema(problema: ProblemaDoComponente): string {
  switch (problema.tipo) {
    case "faltando":
      return "falta";
    case "forma":
      return "forma";
    case "cor":
      return "cor";
    case "tamanho":
      return "tamanho";
    case "posicao":
      return "lugar";
  }
}

export function descreverAMais(forma: FormaDoServidor): string {
  return `${medida(forma)} ${normalizarHex(forma.cor)}`;
}

/** "7 de 12 certos · 3 para ajustar · 2 faltando · 1 a mais na sua página". */
export function resumirDetalhes(detalhes: DetalhesDaNota): string {
  const total = detalhes.componentes.length;
  const certos = detalhes.componentes.filter((item) => item.problemas.length === 0).length;
  const faltando = detalhes.componentes.filter(
    (item) => item.problemas[0]?.tipo === "faltando",
  ).length;
  const ajustar = total - certos - faltando;
  const partes = [`${certos} de ${total} ${total === 1 ? "certo" : "certos"}`];
  if (ajustar > 0) {
    partes.push(`${ajustar} para ajustar`);
  }
  if (faltando > 0) {
    partes.push(`${faltando} faltando`);
  }
  if (detalhes.aMais.length > 0) {
    partes.push(`${detalhes.aMais.length} a mais na sua página`);
  }
  return partes.join(" · ");
}

/** Os componentes com algo a corrigir, dos que mais tiram pontos aos que menos tiram. */
export function paraCorrigir(detalhes: DetalhesDaNota): ComponenteCorrigido[] {
  return detalhes.componentes
    .map((item, ordem) => ({ item, ordem }))
    .filter(({ item }) => item.problemas.length > 0)
    .sort((a, b) => a.item.pontos - b.item.pontos || a.ordem - b.ordem)
    .map(({ item }) => item);
}

function medida({ width, height }: { width: number; height: number }): string {
  return `${formatarMedida(width)} × ${formatarMedida(height)} px`;
}

function deslocamento(dx: number, dy: number): string {
  const partes: string[] = [];
  if (dx !== 0) {
    partes.push(`${Math.abs(dx)} px ${dx > 0 ? "à direita" : "à esquerda"}`);
  }
  if (dy !== 0) {
    partes.push(`${Math.abs(dy)} px ${dy > 0 ? "abaixo" : "acima"}`);
  }
  return partes.length > 0 ? partes.join(" e ") : "um pouco deslocado";
}
