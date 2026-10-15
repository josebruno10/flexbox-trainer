// As cores da página como o servidor as compara: #RRGGBB maiúsculo.

export function corDoFundoAtras(
  elemento: Element,
  raizHtml: Element | null,
  corRaiz: string,
): string {
  for (
    let atual = elemento.parentElement;
    atual && atual !== raizHtml;
    atual = atual.parentElement
  ) {
    const cor = normalizarCor(getComputedStyle(atual).backgroundColor);

    if (cor) {
      return cor;
    }
  }

  return corRaiz;
}

export function coresParecidas(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }

  const rgbA = canaisHex(a);
  const rgbB = canaisHex(b);
  return Boolean(
    rgbA && rgbB && rgbA.every((canal, indice) => Math.abs(canal - rgbB[indice]) <= 8),
  );
}

function canaisHex(cor: string): number[] | undefined {
  const hex = /^#([0-9a-f]{6})$/i.exec(cor)?.[1];
  return hex
    ? [0, 2, 4].map((inicio) => Number.parseInt(hex.slice(inicio, inicio + 2), 16))
    : undefined;
}

// Devolve "" para cores transparentes ou que não sabe ler.
export function normalizarCor(cor: string): string {
  const texto = cor.trim();
  const canais = /rgba?\(([^)]+)\)/i
    .exec(texto)?.[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);

  if (!canais) {
    const hex = /^#?([0-9a-f]{6})$/i.exec(texto)?.[1];
    return hex ? `#${hex.toUpperCase()}` : "";
  }

  if (
    canais.length < 3 ||
    canais.slice(0, 3).some((canal) => !Number.isFinite(canal)) ||
    (canais.length >= 4 && canais[3] <= 0.01)
  ) {
    return "";
  }

  return `#${canais
    .slice(0, 3)
    .map((canal) =>
      Math.max(0, Math.min(255, Math.round(canal))).toString(16).padStart(2, "0"),
    )
    .join("")
    .toUpperCase()}`;
}
