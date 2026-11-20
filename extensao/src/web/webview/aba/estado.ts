import type { DetalhesDaNota } from "../../types";
import type { GabaritoRecebido, Modo } from "./tipos";

// O que a aba mostra agora, lido e mudado pelas partes dela.
export const estado: {
  gabarito?: GabaritoRecebido;
  htmlAluno?: string;
  modo: Modo;
  selecionadoId?: number;
  sobMouseId?: number;
  // Lado a lado, a lista começa escondida para as imagens ficarem maiores.
  listaVisivel: boolean;
  limpezaSelecao?: number;
  // O que corrigir em cada componente, da última nota.
  detalhes?: DetalhesDaNota;
} = {
  modo: "gabarito",
  listaVisivel: true,
};
