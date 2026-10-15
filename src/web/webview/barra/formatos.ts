export function formatarCodigo(codigo: string): string {
  return `${codigo.slice(0, 3)} ${codigo.slice(3)}`;
}

export function formatarPorcentagem(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatarTempo(tempoMs: number): string {
  const totalSegundos = Math.max(0, Math.floor(tempoMs / 1000));
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  const partes = [minutos, segundos].map((parte) =>
    parte.toString().padStart(2, "0"),
  );

  if (horas > 0) {
    partes.unshift(horas.toString().padStart(2, "0"));
  }
  return partes.join(":");
}
