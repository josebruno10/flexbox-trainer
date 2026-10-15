// Leitura das respostas dos servidores, que chegam sem tipo e com nomes de
// campo diferentes conforme a rota.

export function comoObjeto(
  valor: unknown,
): Record<string, unknown> | undefined {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : undefined;
}

export function primeiroTexto(...valores: unknown[]): string {
  const valor = valores.find(
    (candidato): candidato is string =>
      typeof candidato === "string" && candidato.trim().length > 0,
  );
  return valor?.trim() ?? "";
}

export function primeiroNumeroPositivo(...valores: unknown[]): number | undefined {
  for (const valor of valores) {
    const numero = typeof valor === "number" ? valor : Number(valor);
    if (Number.isFinite(numero) && numero > 0) {
      return numero;
    }
  }
  return undefined;
}

export function lerBooleano(valor: string | null, padrao: boolean): boolean {
  if (valor === null || !valor.trim()) {
    return padrao;
  }
  return valor === "1" || valor.toLowerCase() === "true";
}

export function extrairEmailDeTexto(texto: string): string {
  const valor = texto.trim();
  const candidato =
    valor.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || valor;
  return candidato.includes("@") ? candidato.toLowerCase() : "";
}

export function normalizarEmails(emails: string[]): string[] {
  return Array.from(
    new Set(
      emails
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.includes("@")),
    ),
  );
}
