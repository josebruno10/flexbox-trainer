// estruturas compartilhadas entre extensão, provider e serviços.
export type Bloco = {
  id: number;
  parentId?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  borderRadius?: number;
};

export type Desafio = {
  challengeId: string;
  seed: number;
  titulo: string;
  width: number;
  height: number;
  backgroundColor: string;
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
    | "servidor-sem-nota"
    | "api-error"
    | "missing-files"
    | "config-missing"
    | "capture-error"
    | "folder-error";
  error?: string;
};

export type EstadoAutenticacao = {
  status: "checking" | "authenticated" | "unauthenticated" | "error";
  message?: string;
  displayName?: string;
  email?: string;
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

export type StatusConexaoServidor = {
  ok: boolean;
  mensagem: string;
};

export type MensagemRecebidaBarraLateral =
  | { type: "pronto" }
  | { type: "novoDesafio" }
  | { type: "testarConexao" }
  | { type: "atualizarPreview" }
  | { type: "solicitarVerificacao" }
  | { type: "abrirLogin" }
  | { type: "abrirCadastro" }
  | { type: "loginGitHub" }
  | { type: "loginMicrosoft" }
  | { type: "loginGoogle" }
  | { type: "revalidarSessao" }
  | {
      type: "gabaritoGerado";
      challengeId: string;
      imagemDataUrl: string;
      width: number;
      height: number;
    }
  | { type: "logout" };
