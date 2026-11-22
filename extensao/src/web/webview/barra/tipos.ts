import type { Bloco, DetalhesDaNota, Formato, Nivel, Tamanho } from "../../types";

// O que a extensão manda para a barra lateral.

export type DesafioRecebido = {
  challengeId: string;
  width: number;
  height: number;
  backgroundColor: string;
  blocks: Bloco[];
  tempoAtualMs?: number;
  encerrado?: boolean;
  codigo?: string;
  nivel?: Nivel;
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
  // Os códigos com progresso salvo no servidor: esses podem continuar.
  salvos?: string[];
  // Só quem está no torneio salva e puxa o progresso.
  torneio?: boolean;
};

export type SalvamentoRecebido = {
  torneio: boolean;
  estado: "aguardando" | "salvando" | "salvo" | "falhou";
  instante?: number;
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
  // O que corrigir em cada componente.
  detalhes?: DetalhesDaNota;
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
  | { type: "salvamento"; payload: SalvamentoRecebido }
  | { type: "verificar" }
  | { type: "nivel"; payload: Nivel }
  | { type: "formato"; payload: Formato }
  | { type: "tamanhoLivre"; payload: Tamanho }
  | { type: "progressoVerificacao"; payload: VerificacaoRecebida }
  | { type: "verificacaoConcluida"; payload: VerificacaoRecebida };
