import { ConfiguracaoServidor } from "../../types";
import { log } from "../logger";

// Os pedidos à API do servidor do torneio: endereço, cabeçalhos, tempo
// limite e erros com o status HTTP.

export class ErroHttpServidor extends Error {
  public constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ErroHttpServidor";
  }
}

export async function requisitarApi(
  configuracao: ConfiguracaoServidor,
  metodo: "GET" | "POST" | "PUT",
  caminho: string,
  corpo: string | FormData | URLSearchParams | undefined,
  acao: string,
): Promise<unknown> {
  const url = `${normalizarApiBaseUrl(configuracao.apiBaseUrl)}${caminho}`;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 20000);

  log.info(`${metodo} ${url}`);

  const resposta = await fetch(url, {
    method: metodo,
    mode: "cors",
    // FormData define o próprio Content-Type com o boundary.
    headers: montarCabecalhos(
      configuracao,
      typeof corpo === "string"
        ? { "Content-Type": "application/json" }
        : corpo instanceof URLSearchParams
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {},
    ),
    signal: abortController.signal,
    body: corpo,
  })
    .catch((erro: unknown) => {
      const detalhe =
        erro instanceof Error && erro.name === "AbortError"
          ? "Tempo limite de 20 segundos excedido."
          : erro instanceof Error
            ? erro.message
            : "Erro de rede desconhecido";
      throw new Error(`Falha de rede ao ${acao}: ${detalhe}`);
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });

  if (!resposta.ok) {
    const detalhe = await extrairDetalheDeErro(resposta);
    throw new ErroHttpServidor(
      `Falha ao ${acao} (HTTP ${resposta.status}): ${detalhe}`,
      resposta.status,
    );
  }

  return extrairCorpoResposta(resposta);
}

// O servidor embrulha alguns 404 num 500, por exemplo "Erro ao obter tipo de
// dinâmica: 404: Evento não encontrado."
export function ehNaoEncontrado(error: unknown): boolean {
  return (
    error instanceof ErroHttpServidor &&
    (error.status === 404 ||
      (error.status === 500 && /\b404\b|não encontrad/i.test(error.message)))
  );
}

export function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}

export function extrairMensagemServidor(dados: unknown, padrao: string): string {
  if (dados && typeof dados === "object") {
    const resposta = dados as Record<string, unknown>;
    const mensagem = resposta.message ?? resposta.mensagem ?? resposta.detail;

    if (typeof mensagem === "string" && mensagem.trim()) {
      return mensagem.trim();
    }
  }

  return padrao;
}

export async function extrairDetalheDeErro(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}`;

  try {
    const dados = (await extrairCorpoResposta(response)) as {
      detail?: unknown;
      message?: string;
    };

    if (typeof dados.message === "string" && dados.message.trim()) {
      return dados.message;
    }

    if (typeof dados.detail === "string" && dados.detail.trim()) {
      return dados.detail;
    }

    if (Array.isArray(dados.detail) && dados.detail.length > 0) {
      return JSON.stringify(dados.detail[0]);
    }

    return fallback;
  } catch {
    return fallback;
  }
}

async function extrairCorpoResposta(response: Response): Promise<unknown> {
  const texto = await response.text();

  if (!texto.trim()) {
    return {};
  }

  try {
    return JSON.parse(texto);
  } catch {
    return texto.trim();
  }
}

export function normalizarApiBaseUrl(apiBaseUrl: string): string {
  const url = new URL(apiBaseUrl);

  if (url.protocol !== "https:") {
    throw new Error("A URL base da API precisa usar HTTPS.");
  }

  if (url.username || url.password) {
    throw new Error("A URL base da API não pode conter credenciais.");
  }

  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/docs\/?$/, "").replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

export function montarCabecalhos(
  configuracao: ConfiguracaoServidor,
  overrides?: Record<string, string>,
): Record<string, string> {
  const cabecalhos: Record<string, string> = {
    Accept: "application/json",
    ...(overrides ?? {}),
  };

  if (configuracao.apiToken) {
    cabecalhos.Authorization = `Bearer ${configuracao.apiToken}`;
  }

  log.info(
    "[FlexBox Trainer] Cabeçalhos enviados:",
    resumirCabecalhosParaLog(cabecalhos),
  );

  return cabecalhos;
}

export function resumirCabecalhosParaLog(
  cabecalhos: Record<string, string>,
): { nomes: string[]; authorization?: string } {
  return {
    nomes: Object.keys(cabecalhos),
    authorization: cabecalhos.Authorization
      ? "Bearer [PROTEGIDO]"
      : undefined,
  };
}
