// Os pedidos HTTP ao servidor do torneio, do login e do resto da extensão:
// tempo limite, leitura do corpo e erros com o status, para distinguir sessão
// recusada (401/403) de servidor fora do ar.

export class ErroHttp extends Error {
  public constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ErroHttp";
  }
}

export class ErroTempoLimite extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ErroTempoLimite";
  }
}

export async function fetchComTimeout(
  url: string,
  opcoes: RequestInit,
  timeoutMs: number,
  contexto: string,
): Promise<Response> {
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), timeoutMs);

  try {
    return await fetch(url, { ...opcoes, signal: controlador.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ErroTempoLimite(
        `Tempo limite de ${Math.round(timeoutMs / 1000)} segundos ao ${contexto}.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** O corpo da resposta: o JSON, o texto quando não é JSON, ou {} se vazio. */
export async function lerCorpo(resposta: Response): Promise<unknown> {
  const texto = await resposta.text();
  if (!texto.trim()) {
    return {};
  }
  try {
    return JSON.parse(texto);
  } catch {
    return texto.trim();
  }
}

/** A mensagem de erro que o servidor mandou, ou o status HTTP. */
export async function extrairDetalhe(resposta: Response): Promise<string> {
  try {
    const dados = await lerCorpo(resposta);
    if (dados && typeof dados === "object" && !Array.isArray(dados)) {
      const { message, detail } = dados as Record<string, unknown>;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
      if (typeof detail === "string" && detail.trim()) {
        return detail;
      }
      if (Array.isArray(detail) && detail.length > 0) {
        return JSON.stringify(detail[0]);
      }
    }
  } catch {
    // Usa o status HTTP.
  }
  return `HTTP ${resposta.status}`;
}

// O servidor embrulha alguns 404 num 500, por exemplo "Erro ao obter tipo de
// dinâmica: 404: Evento não encontrado."
export function indicaNaoEncontrado(status: number, detalhe: string): boolean {
  return (
    status === 404 ||
    (status === 500 && /\b404\b|não encontrad/i.test(detalhe))
  );
}

export function ehNaoEncontrado(erro: unknown): boolean {
  return erro instanceof ErroHttp && indicaNaoEncontrado(erro.status, erro.message);
}

/** `contexto` já com o artigo: "da API", "do site de autenticação". */
export function validarUrlHttps(valor: string, contexto: string): URL {
  const url = new URL(valor);
  if (url.protocol !== "https:") {
    throw new Error(`A URL ${contexto} precisa usar HTTPS.`);
  }
  if (url.username || url.password) {
    throw new Error(`A URL ${contexto} não pode conter credenciais.`);
  }
  return url;
}

/** A URL base de uma API, sem /docs, consulta, fragmento nem barra no fim. */
export function normalizarUrlApi(valor: string, contexto: string): string {
  const url = validarUrlHttps(valor, contexto);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/docs\/?$/, "").replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}
