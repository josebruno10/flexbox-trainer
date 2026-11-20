import { ConfiguracaoServidor } from "../../types";
import {
  ErroHttp,
  ErroTempoLimite,
  extrairDetalhe,
  fetchComTimeout,
  lerCorpo,
  normalizarUrlApi,
} from "../http";
import { log } from "../logger";

// Os pedidos à API do servidor do torneio: endereço, cabeçalhos e erros com o
// status HTTP (veja services/http.ts).

const TIMEOUT_SERVIDOR_MS = 20_000;

export async function requisitarApi(
  configuracao: ConfiguracaoServidor,
  metodo: "GET" | "POST" | "PUT",
  caminho: string,
  corpo: string | FormData | URLSearchParams | undefined,
  acao: string,
): Promise<unknown> {
  const url = `${normalizarApiBaseUrl(configuracao.apiBaseUrl)}${caminho}`;
  // FormData define o próprio Content-Type com o boundary.
  const cabecalhos = montarCabecalhos(
    configuracao,
    typeof corpo === "string"
      ? { "Content-Type": "application/json" }
      : corpo instanceof URLSearchParams
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {},
  );

  log.info(descreverPedido(metodo, url, cabecalhos));

  const resposta = await fetchComTimeout(
    url,
    { method: metodo, mode: "cors", headers: cabecalhos, body: corpo },
    TIMEOUT_SERVIDOR_MS,
    acao,
  ).catch((erro: unknown) => {
    if (erro instanceof ErroTempoLimite) {
      throw erro;
    }
    const detalhe =
      erro instanceof Error ? erro.message : "Erro de rede desconhecido";
    throw new Error(`Falha de rede ao ${acao}: ${detalhe}`);
  });

  if (!resposta.ok) {
    const detalhe = await extrairDetalhe(resposta);
    throw new ErroHttp(
      `Falha ao ${acao} (HTTP ${resposta.status}): ${detalhe}`,
      resposta.status,
    );
  }

  return lerCorpo(resposta);
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

export function normalizarApiBaseUrl(apiBaseUrl: string): string {
  return normalizarUrlApi(apiBaseUrl, "base da API");
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

  return cabecalhos;
}

/** Uma linha para o log, com o método e a URL, sem nunca mostrar o token. */
export function descreverPedido(
  metodo: string,
  url: string,
  cabecalhos: Record<string, string>,
): string {
  return `${metodo} ${url}${cabecalhos.Authorization ? " (com token)" : " (sem token)"}`;
}
