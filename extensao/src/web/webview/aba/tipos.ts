import type { Desafio } from "../../types";

// O que a extensão manda para a aba do gabarito.

export type GabaritoRecebido = Pick<
  Desafio,
  | "challengeId"
  | "codigo"
  | "nivel"
  | "width"
  | "height"
  | "backgroundColor"
  | "blocks"
>;

export type Modo = "gabarito" | "sobreposto" | "lado";

export type MensagemDaExtensao =
  | { type: "desafio"; payload: GabaritoRecebido | null }
  | { type: "paginaAluno"; payload: string | null };
