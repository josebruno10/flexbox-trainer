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
  shape?: "rectangle" | "circle";
};

export type Desafio = {
  challengeId: string;
  width: number;
  height: number;
  backgroundColor: string;
  blocks: Bloco[];
  captureWidth?: number;
  captureHeight?: number;
  encerrado?: boolean;
};

// Elemento visível da página do aluno, no formato de FormaGeometricaPayload
// da rota corrigir-formas: x e y são o centro e cor é #rrggbb.
export type FormaMedida = {
  id: string;
  tipo: "circulo" | "quadrado" | "retangulo_deitado" | "retangulo_em_pe";
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  cor: string;
};

export type ResultadoAvaliacao = {
  precision: number;
  score: number;
  source:
    | "servidor"
    | "servidor-sem-nota"
    | "api-error"
    | "authentication-error"
    | "missing-files"
    | "sem-formas"
    | "config-missing"
    | "gabarito-error";
  error?: string;
  httpStatus?: number;
};

export type EstadoAutenticacao = {
  status: "checking" | "authenticated" | "unauthenticated" | "error";
  message?: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
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

export type GabaritoGerado = {
  challengeId: string;
  imagemDataUrl: string;
  width: number;
  height: number;
};

export type TentativaPayload = {
  challengeId: string;
  formas: FormaMedida[];
  gabarito: GabaritoGerado;
};

export type ConfiguracaoServidor = {
  apiBaseUrl: string;
  apiToken: string;
  dinamicaId: string;
  // Evento só de treino que recebe a imagem de cada desafio gerado.
  eventoTreino: string;
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
  | { type: "encerrarDesafio" }
  | { type: "testarConexao" }
  | { type: "atualizarPreview" }
  | { type: "solicitarVerificacao"; challengeId: string; formas: unknown }
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
