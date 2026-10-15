import { FormaMedida } from "../../types";

const TIPOS_FORMA: ReadonlySet<unknown> = new Set<FormaMedida["tipo"]>([
  "circulo",
  "quadrado",
  "retangulo_deitado",
  "retangulo_em_pe",
]);

// A mensagem vem da webview; só passam formas com números e cor válidos.
export function sanitizarFormas(formas: unknown): FormaMedida[] {
  if (!Array.isArray(formas)) {
    return [];
  }

  return formas
    .filter(
      (forma): forma is FormaMedida =>
        typeof forma === "object" &&
        forma !== null &&
        TIPOS_FORMA.has(forma.tipo) &&
        typeof forma.id === "string" &&
        typeof forma.cor === "string" &&
        /^#[0-9a-f]{6}$/i.test(forma.cor) &&
        [forma.x, forma.y, forma.width, forma.height, forma.area].every(
          (valor) => typeof valor === "number" && Number.isFinite(valor),
        ),
    )
    .slice(0, 1000)
    .map(({ id, tipo, x, y, width, height, area, cor }) => ({
      id,
      tipo,
      x,
      y,
      width,
      height,
      area,
      cor,
    }));
}
