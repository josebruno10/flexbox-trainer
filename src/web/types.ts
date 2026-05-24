// estruturas compartilhadas entre extensão, provider e serviços.
export type Bloco = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

export type Desafio = {
  challengeId: string;
  seed: number;
  titulo: string;
  width: number;
  height: number;
  blocks: Bloco[];
  captureWidth?: number;
  captureHeight?: number;
};

export type ResultadoAvaliacao = {
  precision: number;
  score: number;
  source:
    | "mock-local"
    | "servidor"
    | "api-error"
    | "missing-files"
    | "config-missing"
    | "capture-error"
    | "folder-error";
  error?: string;
};

export type ResumoWorkspace = {
  caminhoHtml: string;
  caminhoCss: string;
  textoHtml: string;
  textoCss: string;
  htmlPreview: string;
  temArquivoHtml: boolean;
  temArquivoCss: boolean;
};

export type TentativaPayload = {
  html: string;
  css: string;
  elapsedMs: number;
  challengeId: string;
  seed: number;
  imagemBase64?: string;
  codigoPasta?: string;
};

export type ConfiguracaoServidor = {
  apiBaseUrl: string;
  apiToken: string;
  dinamicaId: string;
  userId: number;
  teamId: number;
  captureWidth: number;
  captureHeight: number;
};

export type MensagemRecebidaBarraLateral =
  | { type: "pronto" }
  | { type: "novoDesafio" }
  | { type: "atualizarPreview" }
  | { type: "solicitarVerificacao" }
  | { type: "imagemCapturada"; imagemBase64: string }
  | { type: "erroCaptura"; error: string };
