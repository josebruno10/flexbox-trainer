// Quem fez a extensão, no pé da barra lateral e da tela de entrada.
export const CREDITOS = "Desenvolvido por José Bruno, Kevyn Willian e Vitor Costa";

export function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// O tempo do desafio: mm:ss, ou hh:mm:ss a partir de uma hora.
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
