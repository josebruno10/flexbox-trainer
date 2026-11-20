import type { Desafio, ResultadoNaAba } from "../../types";

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

export type Modo = "gabarito" | "sobreposto" | "comparar" | "lado";

export type VerificacaoRecebida = { andamento: boolean; etapa?: string };

export type MensagemDaExtensao =
  | { type: "desafio"; payload: GabaritoRecebido | null }
  | { type: "paginaAluno"; payload: string | null }
  | {
      type: "resultado";
      payload: { resultado: ResultadoNaAba | null; verificacao: VerificacaoRecebida };
    };
