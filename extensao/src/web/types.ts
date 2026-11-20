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

// Nos níveis mais fáceis, saem os componentes menores, que dão mais trabalho.
export type Nivel = "facil" | "medio" | "dificil";

export type Desafio = {
  challengeId: string;
  // Reproduz a mesma imagem (veja services/codigoDesafio.ts). Os desafios
  // criados pela extensão sempre têm um; os dos testes podem não ter.
  codigo?: string;
  // Vem do código; os desafios dos testes, sem código, podem não ter.
  nivel?: Nivel;
  width: number;
  height: number;
  backgroundColor: string;
  blocks: Bloco[];
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
  // A página não mudou desde a última correção e não foi reenviada.
  repetida?: boolean;
  source:
    | "servidor"
    | "servidor-sem-nota"
    | "api-error"
    | "authentication-error"
    | "missing-files"
    | "desafio-invalidado"
    | "sem-formas"
    | "config-missing"
    | "gabarito-error";
  error?: string;
  httpStatus?: number;
  // O que o servidor disse de cada forma, como veio (veja
  // services/detalhesDaNota.ts); a extensão o liga aos componentes.
  detalhesDoServidor?: DetalhesDoServidor;
  // Cada componente do desafio, com o que falta acertar nele.
  detalhes?: DetalhesDaNota;
};

/** Uma forma como a rota corrigir-formas descreve: x e y são o centro. */
export type FormaDoServidor = {
  x: number;
  y: number;
  width: number;
  height: number;
  cor: string;
};

/** Um par da correção: a forma do gabarito e a da página que o servidor ligou. */
export type ParDoServidor = {
  // De 0 a 1, e as partes da nota: tamanho, distância e cor.
  pontos: number;
  tamanho?: number;
  distancia?: number;
  cor?: number;
  formaCorreta?: boolean;
  gabarito: FormaDoServidor;
  pagina: FormaDoServidor;
};

export type DetalhesDoServidor = {
  pares: ParDoServidor[];
  // Formas da página que não correspondem a nada do gabarito.
  aMais: FormaDoServidor[];
  // Quantas formas do gabarito não apareceram na página.
  naoEncontradas: number;
};

/** O que falta acertar num componente, com os valores para comparar. */
export type ProblemaDoComponente =
  | { tipo: "faltando" }
  | { tipo: "forma"; esperada: "circulo" | "retangulo" }
  | { tipo: "cor"; sua: string; esperada: string }
  | {
      tipo: "tamanho";
      sua: { width: number; height: number };
      esperada: { width: number; height: number };
    }
  // dx e dy: quanto o centro da forma da página está à direita e abaixo do
  // centro do componente (negativos: à esquerda e acima).
  | { tipo: "posicao"; dx: number; dy: number };

export type ComponenteCorrigido = {
  // O id do bloco, ou "fundo".
  componente: number | "fundo";
  // De 0 a 1; faltando, 0.
  pontos: number;
  problemas: ProblemaDoComponente[];
};

export type DetalhesDaNota = {
  // O fundo primeiro, depois os blocos, na ordem do desafio.
  componentes: ComponenteCorrigido[];
  aMais: FormaDoServidor[];
};

export type EstadoAutenticacao = {
  status: "checking" | "authenticated" | "unauthenticated" | "error";
  message?: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  // O e-mail da conta não está no torneio: entra, mas não corrige.
  aviso?: string;
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
  // Evento só de treino que recebe a imagem de cada desafio gerado.
  eventoTreino: string;
  userId: number;
  teamId: number;
};

export type StatusConexaoServidor = {
  ok: boolean;
  mensagem: string;
};

export type MensagemRecebidaBarraLateral =
  | { type: "pronto" }
  | { type: "novoDesafio" }
  | { type: "encerrarDesafio" }
  | { type: "atualizarPreview" }
  | {
      type: "solicitarVerificacao";
      challengeId: string;
      formas: unknown;
      verificacaoId?: unknown;
    }
  | { type: "abrirLogin" }
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
  | { type: "abrirPainelGabarito" }
  | { type: "verExtensoesIa" }
  | { type: "criarArquivos" }
  | { type: "abrirPorCodigo" }
  | { type: "definirNivel"; nivel?: unknown }
  | { type: "refazer"; codigo?: unknown }
  | { type: "verHistorico" }
  | { type: "verAtalhos" }
  | { type: "copiarCodigo" }
  | { type: "copiar"; texto?: unknown }
  | { type: "puxarProgresso"; codigo?: unknown }
  | { type: "logout" };

/** A nota do desafio atual, mostrada na aba do gabarito ao lado do Verificar. */
export type ResultadoNaAba = {
  precisao?: number;
  melhor?: number;
  verificacoes: number;
  invalidado: boolean;
  // A última verificação não deu nota nova: o motivo, ou a página repetida.
  aviso?: string;
  detalhes?: DetalhesDaNota;
};
