import { codigoDoDia } from "../../services/codigoDesafio";
import { ExtensaoIa } from "../../services/extensoesIa";
import {
  Desafio,
  Nivel,
  ResultadoAvaliacao,
  ResumoWorkspace,
} from "../../types";
import { HistoricoNaBarra } from "./historicoDoAluno";

/** O que o guia de primeiros passos precisa saber para marcar cada passo. */
export type ProgressoGuia = {
  autenticado: boolean;
  // A chave workspaceFolderCount do VS Code já vale antes de o guia ser
  // registrado, e o guia só percebe mudanças; esta é definida depois.
  pastaAberta: boolean;
  semExtensoesIa: boolean;
  temDesafio: boolean;
  verificou: boolean;
};

/** Tudo o que a barra lateral mostra de quem está na sessão. */
export type EstadoDaBarra = {
  extensoesIa: ExtensaoIa[];
  nivel: Nivel;
  desafio?: Desafio;
  inicioMs: number;
  fimMs?: number;
  resumoWorkspace: ResumoWorkspace;
  historicoNotas: number[];
  historico: HistoricoNaBarra;
  avaliacao?: ResultadoAvaliacao;
};

export type MensagemParaBarra = { type: string; payload: unknown };

/** As mensagens que deixam a barra lateral em dia, na ordem que ela espera. */
export function mensagensDaBarra(
  estado: EstadoDaBarra,
  agora = Date.now(),
): MensagemParaBarra[] {
  const { desafio } = estado;
  return [
    { type: "extensoesIa", payload: estado.extensoesIa },
    { type: "nivel", payload: estado.nivel },
    ...(desafio
      ? [
          {
            type: "dadosDesafio",
            payload: {
              ...desafio,
              tempoAtualMs: (estado.fimMs ?? agora) - estado.inicioMs,
              encerrado: estado.fimMs !== undefined,
              doDia: desafio.codigo === codigoDoDia(),
            },
          },
        ]
      : []),
    { type: "dadosWorkspace", payload: estado.resumoWorkspace },
    { type: "historicoNotas", payload: estado.historicoNotas },
    { type: "historicoDesafios", payload: estado.historico },
    ...(estado.avaliacao
      ? [{ type: "resultadoAvaliacao", payload: estado.avaliacao }]
      : []),
  ];
}
