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
