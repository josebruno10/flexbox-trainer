import * as vscode from "vscode";
import { AuthService } from "../../../auth/authService";
import { BarraDeStatus } from "../../../provider/barra-de-status";
import { ProvedorBarraLateralFlexBox } from "../../../provider/provedor-barra-lateral";
import { criarDesafioGerado, criarDesafioPorCodigo } from "../../../services/desafio";
import {
  ConfiguracaoServidor,
  Desafio,
  EstadoAutenticacao,
  FormaMedida,
  GabaritoGerado,
  ResultadoAvaliacao,
  ResumoWorkspace,
} from "../../../types";

// O que os testes do provedor da barra lateral usam: um provedor com sessão
// falsa, a barra de mentira, o servidor simulado e os dados de exemplo.

export type MensagemWebview = {
  type: string;
  payload?: unknown;
};

export type ProvedorInterno = {
  visualizacaoWebview?: vscode.WebviewView;
  desafioAtual?: Desafio;
  resumoWorkspaceAtual: ResumoWorkspace;
  avaliacaoAtual?: ResultadoAvaliacao;
  inicioTentativaMs: number;
  fimTentativaMs?: number;
  gabaritoAtual?: GabaritoGerado;
  enviarEstado(): void;
  encerrarDesafioAtual(): void;
  verificarTentativaAtual(
    challengeId: string,
    formas: FormaMedida[],
    verificacaoId?: number,
  ): Promise<void>;
  testarConexaoServidor(): Promise<unknown>;
  lerArquivosDoAluno(): Promise<ResumoWorkspace>;
  limparArquivosDoAluno(largura: number, altura: number): Promise<void>;
  lerConfiguracaoServidorAtual(): ConfiguracaoServidor;
};

export type OpcoesProvedorTeste = {
  invalidacoes?: string[];
  serverToken?: string;
  userId?: number;
  teamId?: number;
  registro?: vscode.Memento;
  extensoesIa?: { id: string; nome: string }[];
  barraDeStatus?: BarraDeStatus;
};

export type Requisicao = {
  metodo: string;
  caminho: string;
  corpo?: BodyInit | null;
};

export const BASE_API = "https://api.teste.com/api";
export const CHAVE_REGISTRO = `flexboxTrainer.gabaritoTreino|${BASE_API}|treino|800x800`;
export const NOME_GABARITO = "gab_treino_tam_800x800.png";
export const FORMAS: FormaMedida[] = [
  {
    id: "forma_1",
    tipo: "retangulo_deitado",
    x: 400,
    y: 100,
    width: 800,
    height: 200,
    area: 160000,
    cor: "#ff0000",
  },
  {
    id: "forma_2",
    tipo: "circulo",
    x: 120,
    y: 100,
    width: 160,
    height: 160,
    area: 20106,
    cor: "#00ff00",
  },
];

/** Devolve, ao fim de cada teste, o que os testes trocam no vscode e no relógio. */
export function restaurarAoFim(): void {
  const dateNowOriginal = Date.now;
  const fetchOriginal = globalThis.fetch;
  const getConfigurationOriginal = vscode.workspace.getConfiguration;

  const showInformationMessageOriginal = vscode.window.showInformationMessage;
  const showWarningMessageOriginal = vscode.window.showWarningMessage;
  const executeCommandOriginal = vscode.commands.executeCommand;
  const showInputBoxOriginal = vscode.window.showInputBox;
  const showQuickPickOriginal = vscode.window.showQuickPick;

  teardown(() => {
    vscode.window.showInputBox = showInputBoxOriginal;
    vscode.window.showQuickPick = showQuickPickOriginal;
    Date.now = dateNowOriginal;
    globalThis.fetch = fetchOriginal;
    vscode.workspace.getConfiguration = getConfigurationOriginal;
    vscode.window.showInformationMessage = showInformationMessageOriginal;
    vscode.window.showWarningMessage = showWarningMessageOriginal;
    vscode.commands.executeCommand = executeCommandOriginal;
  });
}

export function criarProvedorParaTeste(
  mensagens: MensagemWebview[],
  opcoes: OpcoesProvedorTeste = {},
): ProvedorBarraLateralFlexBox {
  const estado: EstadoAutenticacao = {
    status: "authenticated",
    displayName: "Aluno de teste",
  };
  const authService = {
    getEstadoAtual: () => estado,
    onDidChangeEstado: () => ({ dispose: () => undefined }),
    isAutenticado: () => true,
    getAccessToken: () => opcoes.serverToken ?? "token-da-sessao",
    getSessaoAtual: () => ({
      displayName: "Aluno de teste",
      email: "aluno@teste.com",
      tokenGmail: "token-google",
      userId: opcoes.userId ?? 74,
      teamId: opcoes.teamId ?? 46,
    }),
    invalidarSessao: async (mensagem: string) => {
      opcoes.invalidacoes?.push(mensagem);
    },
  } as unknown as AuthService;
  const provedor = new ProvedorBarraLateralFlexBox(
    vscode.Uri.parse("file:///extensao"),
    authService,
    opcoes.registro ?? criarRegistroFalso(),
    () => opcoes.extensoesIa ?? [],
    opcoes.barraDeStatus,
  );
  const interno = provedor as unknown as ProvedorInterno;

  interno.visualizacaoWebview = {
    webview: {
      postMessage: async (mensagem: MensagemWebview) => {
        mensagens.push(mensagem);
        return true;
      },
    },
  } as unknown as vscode.WebviewView;

  return provedor;
}

export function ultimoEstadoDesafio(
  mensagens: MensagemWebview[],
): { tempoAtualMs: number; encerrado: boolean } | undefined {
  const mensagem = ultimaMensagem(mensagens, "dadosDesafio");
  if (!mensagem?.payload || typeof mensagem.payload !== "object") {
    return undefined;
  }

  const payload = mensagem.payload as {
    tempoAtualMs: number;
    encerrado: boolean;
  };
  return {
    tempoAtualMs: payload.tempoAtualMs,
    encerrado: payload.encerrado,
  };
}

export function ultimaMensagem(
  mensagens: MensagemWebview[],
  tipo: string,
): MensagemWebview | undefined {
  return [...mensagens].reverse().find((mensagem) => mensagem.type === tipo);
}

export function mockarConfiguracaoServidorValida(
  extras: Record<string, unknown> = {},
): void {
  vscode.workspace.getConfiguration = ((section: string) => ({
    get: <T>(key: string, defaultValue?: T): T => {
      if (section !== "flexboxTrainer") {
        return defaultValue as T;
      }

      const valores: Record<string, unknown> = {
        apiBaseUrl: BASE_API,
        apiToken: "token-das-configuracoes",
        eventoTreino: "treino",
        ...extras,
      };
      return (valores[key] ?? defaultValue) as T;
    },
  })) as typeof vscode.workspace.getConfiguration;
}

export function criarAleatorioTeste(caso: number): () => number {
  let estado = caso >>> 0;

  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let valor = estado;
    valor = Math.imul(valor ^ (valor >>> 15), valor | 1);
    valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61);
    return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296;
  };
}

// Desafio atual com arquivos e imagem do gabarito já prontos para verificar.
export function prepararVerificacao(
  provedor: ProvedorBarraLateralFlexBox,
  semente: number,
): ProvedorInterno {
  const interno = provedor as unknown as ProvedorInterno;
  interno.desafioAtual = criarDesafioGerado({
    aleatorio: criarAleatorioTeste(semente),
  });
  interno.resumoWorkspaceAtual = {
    caminhoHtml: "/projeto/index.html",
    caminhoCss: "/projeto/style.css",
    textoHtml: "<main></main>",
    textoCss: "main { display: flex; }",
    htmlPreview: "<!doctype html><style>main { display: flex; }</style><main></main>",
    temArquivoHtml: true,
    temArquivoCss: true,
  };
  interno.gabaritoAtual = {
    challengeId: interno.desafioAtual.challengeId,
    // Assinatura PNG: basta para montar o arquivo do formulário.
    imagemDataUrl: "data:image/png;base64,iVBORw0KGgo=",
    width: interno.desafioAtual.width,
    height: interno.desafioAtual.height,
  };
  return interno;
}

export function mockarServidor(
  rotas: Record<string, (init?: RequestInit) => Response>,
): Requisicao[] {
  const requisicoes: Requisicao[] = [];

  globalThis.fetch = async (input, init) => {
    const metodo = init?.method ?? "GET";
    const caminho = String(input).replace(BASE_API, "");
    requisicoes.push({ metodo, caminho, corpo: init?.body });
    const rota = rotas[`${metodo} ${caminho}`];

    if (!rota) {
      throw new Error(`Requisição inesperada: ${metodo} ${caminho}`);
    }

    return rota(init);
  };

  return requisicoes;
}

export function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function criarRegistroFalso(): vscode.Memento {
  const valores = new Map<string, unknown>();

  return {
    keys: () => Array.from(valores.keys()),
    get: <T>(chave: string, padrao?: T) =>
      (valores.has(chave) ? valores.get(chave) : padrao) as T,
    update: async (chave: string, valor: unknown) => {
      valores.set(chave, valor);
    },
  } as vscode.Memento;
}

// Uma vista da barra lateral de mentira: guarda o que a extensão envia e deixa
// o teste mandar mensagens como se fossem do script da barra.
export function criarBarraFalsa() {
  let aoReceber: (mensagem: unknown) => void = () => undefined;
  let aoMudarVisibilidade: () => void = () => undefined;
  let visivel = true;
  const enviadas: MensagemWebview[] = [];
  const vista = {
    get visible() {
      return visivel;
    },
    webview: {
      options: {},
      html: "",
      cspSource: "vscode-webview://teste",
      asWebviewUri: (uri: vscode.Uri) => uri,
      onDidReceiveMessage: (ouvinte: (mensagem: unknown) => void) => {
        aoReceber = ouvinte;
        return { dispose: () => undefined };
      },
      postMessage: async (mensagem: MensagemWebview) => {
        enviadas.push(mensagem);
        return true;
      },
    },
    onDidDispose: () => ({ dispose: () => undefined }),
    onDidChangeVisibility: (ouvinte: () => void) => {
      aoMudarVisibilidade = ouvinte;
      return { dispose: () => undefined };
    },
  } as unknown as vscode.WebviewView;
  return {
    vista,
    enviadas,
    receber: (mensagem: unknown) => aoReceber(mensagem),
    mudarVisibilidade: (valor: boolean) => {
      visivel = valor;
      aoMudarVisibilidade();
    },
  };
}

// Um desafio de código pronto para verificar, com o gabarito já enviado.
export async function prepararCodigo(
  provedor: ProvedorBarraLateralFlexBox,
  registro: vscode.Memento,
  codigo: string,
): Promise<ProvedorInterno> {
  const interno = prepararVerificacao(provedor, 260);
  interno.desafioAtual = criarDesafioPorCodigo(codigo);
  interno.gabaritoAtual = {
    ...interno.gabaritoAtual!,
    challengeId: interno.desafioAtual.challengeId,
  };
  await registro.update(CHAVE_REGISTRO, {
    cod: 91,
    challengeId: interno.desafioAtual.challengeId,
  });
  return interno;
}
