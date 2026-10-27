import type { Nivel } from "../../types";

// O que a extensão manda para a barra lateral.

export type DesafioRecebido = {
  challengeId: string;
  width: number;
  height: number;
  backgroundColor: string;
  blocks: Array<{
    id: number;
    parentId?: number;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    borderRadius?: number;
    shape?: "rectangle" | "circle";
  }>;
  tempoAtualMs?: number;
  encerrado?: boolean;
  codigo?: string;
  nivel?: Nivel;
  doDia?: boolean;
};

export type BlocoRecebido = DesafioRecebido["blocks"][number];

type RegistroHistoricoRecebido = {
  codigo: string;
  melhor: number;
  tempoMelhorMs: number;
};

export type NotaDoDiaRecebida = {
  dia: string;
  melhor: number;
};

export type HistoricoDesafiosRecebido = {
  registros: RegistroHistoricoRecebido[];
  total: number;
  recorde: number | null;
  evolucao: NotaDoDiaRecebida[];
};

export type ResumoWorkspaceRecebido = {
  caminhoHtml: string;
  caminhoCss: string;
  textoHtml: string;
  textoCss: string;
  htmlPreview: string;
  temArquivoHtml: boolean;
  temArquivoCss: boolean;
};

export type ResultadoAvaliacaoRecebido = {
  precision: number;
  score: number;
  source: string;
  error?: string;
  // A página não mudou desde a última correção e não foi reenviada.
  repetida?: boolean;
};

export type VerificacaoRecebida = { id?: number; mensagem?: string };

type StatusConexaoServidorRecebido = {
  ok: boolean;
  mensagem: string;
};

export type EstadoAutenticacaoRecebido = {
  status: "checking" | "authenticated" | "unauthenticated" | "error";
  message?: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  aviso?: string;
};

export type ExtensaoIaRecebida = { id: string; nome: string };

export type MensagemDaExtensao =
  | { type: "dadosDesafio"; payload: DesafioRecebido }
  | { type: "dadosWorkspace"; payload: ResumoWorkspaceRecebido }
  | { type: "resultadoAvaliacao"; payload: ResultadoAvaliacaoRecebido }
  | { type: "statusServidor"; payload: StatusConexaoServidorRecebido }
  | { type: "estadoAutenticacao"; payload: EstadoAutenticacaoRecebido }
  | { type: "extensoesIa"; payload: ExtensaoIaRecebida[] }
  | { type: "historicoNotas"; payload: number[] }
  | { type: "historicoDesafios"; payload: HistoricoDesafiosRecebido }
  | { type: "verificar" }
  | { type: "nivel"; payload: Nivel }
  | { type: "progressoVerificacao"; payload: VerificacaoRecebida }
  | { type: "verificacaoConcluida"; payload: VerificacaoRecebida };
