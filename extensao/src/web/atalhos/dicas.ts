import { ATALHOS_DO_EDITOR } from "./editor";
import { EMMET_CSS, EMMET_HTML } from "./emmet";
import type { Plataforma } from "./plataforma";

// Uma dica de digitação, em pedaços: texto comum ou código. A barra lateral
// mostra uma por vez e troca a cada desafio novo.
export type ParteDaDica = { texto: string } | { codigo: string };
export type Dica = ParteDaDica[];

/** Todas as dicas, intercaladas: CSS, HTML e editor, um de cada vez. */
export function dicasDeDigitacao(plataforma: Plataforma): Dica[] {
  const css: Dica[] = EMMET_CSS.flatMap((grupo) => grupo.abreviacoes).map(
    ({ abreviacao, resultado }) => [
      { texto: "No style.css, " },
      { codigo: abreviacao },
      { texto: " + Tab vira " },
      { codigo: resultado },
    ],
  );
  const html: Dica[] = EMMET_HTML.map(({ abreviacao, explicacao }) => [
    { texto: "No index.html, " },
    { codigo: abreviacao },
    { texto: ` + Tab: ${explicacao}.` },
  ]);
  const editor: Dica[] = ATALHOS_DO_EDITOR.map(({ teclas, acao }) => [
    { codigo: teclas[plataforma] },
    { texto: ` ${acao}.` },
  ]);

  const todas: Dica[] = [];
  for (let indice = 0; indice < Math.max(css.length, html.length, editor.length); indice++) {
    for (const lista of [css, html, editor]) {
      if (indice < lista.length) {
        todas.push(lista[indice]);
      }
    }
  }
  return todas;
}
