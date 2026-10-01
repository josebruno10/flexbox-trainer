// src/web/services/servidor.ts

import * as vscode from "vscode";
import {
  ConfiguracaoServidor,
  FormaMedida,
  ResultadoAvaliacao,
} from "../types";
import { log } from "./logger";

export class ErroHttpServidor extends Error {
  public constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ErroHttpServidor";
  }
}

export function lerConfiguracaoServidor(
  tokenSessao?: string,
): ConfiguracaoServidor {
  const config = vscode.workspace.getConfiguration("flexboxTrainer");

  let apiBaseUrl = config.get<string>("apiBaseUrl", "").trim();
  if (!apiBaseUrl) {
    apiBaseUrl = config
      .get<string>("authApiBaseUrl", "https://frontendteamscup.com.br/api")
      .trim();
  }

  return {
    apiBaseUrl: normalizarApiBaseUrl(apiBaseUrl),
    apiToken:
      tokenSessao?.trim() || config.get<string>("apiToken", "").trim(),
    dinamicaId: config.get<string>("dinamicaId", "").trim(),
    eventoTreino: config.get<string>("eventoTreino", "").trim(),
    userId: config.get<number>("userId", 0),
    teamId: config.get<number>("teamId", 0),
    captureWidth: config.get<number>("captureWidth", 960),
    captureHeight: config.get<number>("captureHeight", 540),
  };
}

export function temConfiguracaoServidorMinima(
  configuracao: ConfiguracaoServidor,
): boolean {
  return Boolean(
    configuracao.apiBaseUrl &&
      configuracao.apiToken &&
      configuracao.dinamicaId &&
      configuracao.userId > 0 &&
      configuracao.teamId > 0,
  );
}

export async function verificarConexaoServidor(
  configuracao: ConfiguracaoServidor,
): Promise<string> {
  if (!configuracao.apiBaseUrl) {
    throw new Error("A URL base da API não está configurada.");
  }

  if (!configuracao.apiToken) {
    throw new Error("Configure o token da API antes de testar o servidor.");
  }

  const apiBaseUrl = normalizarApiBaseUrl(configuracao.apiBaseUrl);
  const rotaPerfil = `${apiBaseUrl}/auth/me`;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 10000);

  log.info(`Testando sessão com o servidor: ${rotaPerfil}`);

  const resposta = await fetch(rotaPerfil, {
    method: "GET",
    mode: "cors",
    headers: montarCabecalhos(configuracao),
    signal: abortController.signal,
  })
    .catch((erro: unknown) => {
      const mensagem =
        erro instanceof Error ? erro.message : "Erro de rede desconhecido";
      const detalhe =
        erro instanceof Error && erro.name === "AbortError"
          ? "Tempo limite de 10 segundos excedido."
          : mensagem;

      throw new Error(`Não foi possível conectar ao servidor: ${detalhe}`);
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });

  if (!resposta.ok) {
    const detalhe = await extrairDetalheDeErro(resposta);
    throw new ErroHttpServidor(
      `Servidor respondeu com erro (HTTP ${resposta.status}): ${detalhe}`,
      resposta.status,
    );
  }

  return `Conexão realizada com sucesso (HTTP ${resposta.status}).`;
}

export async function criarPastaDoAluno(
  configuracao: ConfiguracaoServidor,
): Promise<string> {
  const apiBaseUrl = normalizarApiBaseUrl(configuracao.apiBaseUrl);
  const rotaCriarPasta = `${apiBaseUrl}/criar-pasta/${encodeURIComponent(configuracao.dinamicaId)}/${configuracao.teamId}/${configuracao.userId}`;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 10000);

  log.info(`Chamando API criar-pasta: ${rotaCriarPasta}`);

  const resposta = await fetch(rotaCriarPasta, {
    method: "POST",
    mode: "cors",
    headers: montarCabecalhos(configuracao),
    signal: abortController.signal,
  })
    .catch((erro: unknown) => {
      const mensagem =
        erro instanceof Error ? erro.message : "Erro de rede desconhecido";
      const detalhe =
        erro instanceof Error && erro.name === "AbortError"
          ? "Tempo limite de 10 segundos excedido."
          : mensagem;

      log.error(`Erro fatal no fetch (criar-pasta): ${detalhe}`);
      throw new Error(`Não foi possível conectar ao servidor: ${detalhe}`);
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });

  if (!resposta.ok) {
    const detalhe = await extrairDetalheDeErro(resposta);
    throw new ErroHttpServidor(
      `Falha ao criar pasta (HTTP ${resposta.status}): ${detalhe}`,
      resposta.status,
    );
  }

  const dados = await extrairCorpoResposta(resposta);
  const codigoPasta = extrairCodigoPasta(dados);

  if (!codigoPasta) {
    throw new Error("A API não retornou o código da pasta.");
  }

  return codigoPasta;
}

export async function enviarConteudoDaTentativa(
  configuracao: ConfiguracaoServidor,
  codigoPasta: string,
  html: string,
  css: string,
): Promise<ResultadoAvaliacao> {
  const apiBaseUrl = normalizarApiBaseUrl(configuracao.apiBaseUrl);
  const rotaSalvarConteudo = `${apiBaseUrl}/salvar-conteudo`;
  const formulario = new URLSearchParams();
  formulario.set("code_pasta", codigoPasta);
  formulario.set("tipo", "ambos");
  formulario.set("index_conteudo", html);
  formulario.set("style_conteudo", css);

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 15000);

  log.info(`Enviando conteúdo para pasta: ${codigoPasta}`);

  const resposta = await fetch(rotaSalvarConteudo, {
    method: "POST",
    mode: "cors",
    headers: montarCabecalhos(configuracao, {
      "Content-Type": "application/x-www-form-urlencoded",
    }),
    signal: abortController.signal,
    body: formulario.toString(),
  })
    .catch((erro: unknown) => {
      const mensagem =
        erro instanceof Error ? erro.message : "Erro de rede desconhecido";
      const detalhe =
        erro instanceof Error && erro.name === "AbortError"
          ? "Tempo limite de 15 segundos excedido."
          : mensagem;

      log.error(`Erro na rota salvar-conteudo: ${detalhe}`);
      throw new Error(`Falha de rede ao enviar a tentativa: ${detalhe}`);
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });

  if (!resposta.ok) {
    const detalhe = await extrairDetalheDeErro(resposta);
    throw new ErroHttpServidor(
      `Falha ao enviar conteúdo (HTTP ${resposta.status}): ${detalhe}`,
      resposta.status,
    );
  }

  const dados = await extrairCorpoResposta(resposta);
  const nota = extrairNotaServidor(dados);
  // O contrato da API não documenta a resposta desta rota; o registro mostra
  // se ela devolve alguma nota ou só confirma o salvamento.
  log.info(
    `Resposta de salvar-conteudo (HTTP ${resposta.status}): ` +
      JSON.stringify(dados).slice(0, 500),
  );

  if (nota === undefined) {
    return {
      precision: 0,
      score: 0,
      source: "servidor-sem-nota",
      error: extrairMensagemServidor(dados),
    };
  }

  return {
    precision: nota,
    score: nota,
    source: "servidor",
  };
}

/**
 * Garante que a imagem do desafio esteja cadastrada como gabarito no evento de
 * treino e devolve o código dele. O servidor nomeia o arquivo só por evento e
 * tamanho, então um segundo gabarito do mesmo tamanho sobrescreveria o
 * primeiro: só substitui (via PUT) o gabarito que a própria extensão criou.
 */
export async function enviarGabaritoDeTreino(
  configuracao: ConfiguracaoServidor,
  png: Uint8Array<ArrayBuffer>,
  largura: number,
  altura: number,
  codCriadoPelaExtensao: number | undefined,
): Promise<number> {
  const evento = configuracao.eventoTreino;
  const existentes = await listarGabaritos(configuracao, evento);

  if (existentes.some((item) => !temNomeDeGabarito(item))) {
    throw new Error(
      `Não foi possível identificar o tamanho dos gabaritos do evento "${evento}". ` +
        "Para não sobrescrever nenhum, nada foi enviado.",
    );
  }

  const mesmoTamanho = existentes.filter((item) =>
    temTamanho(item, largura, altura),
  );
  let cod: number | undefined;

  if (mesmoTamanho.length === 0) {
    const resposta = await requisitarApi(
      configuracao,
      "POST",
      `/tipo-dinamica/${encodeURIComponent(evento)}/gabarito`,
      criarFormularioImagem(png),
      "cadastrar o gabarito",
    );
    log.info(`Gabarito cadastrado: ${JSON.stringify(resposta).slice(0, 500)}`);
    cod = extrairCodGabarito(resposta);

    if (!cod) {
      // A resposta não é documentada; o código também aparece na listagem.
      const cadastrados = (await listarGabaritos(configuracao, evento)).filter(
        (item) => temTamanho(item, largura, altura),
      );
      cod =
        cadastrados.length === 1
          ? extrairCodGabarito(cadastrados[0])
          : undefined;
    }

    if (!cod) {
      throw new Error("O servidor não informou o código do gabarito cadastrado.");
    }
  } else if (
    mesmoTamanho.length === 1 &&
    codCriadoPelaExtensao !== undefined &&
    extrairCodGabarito(mesmoTamanho[0]) === codCriadoPelaExtensao
  ) {
    cod = codCriadoPelaExtensao;
    await requisitarApi(
      configuracao,
      "PUT",
      `/tipo-dinamica/gabarito/${cod}`,
      criarFormularioImagem(png),
      "substituir o gabarito",
    );
  } else {
    throw new Error(
      `O evento "${evento}" já tem um gabarito ${largura}x${altura} que não ` +
        "foi criado por esta extensão. Para não sobrescrevê-lo, nada foi enviado.",
    );
  }

  await registrarMedidasDoGabarito(configuracao, largura, altura);
  return cod;
}

export async function corrigirFormas(
  configuracao: ConfiguracaoServidor,
  gabaritoCod: number,
  largura: number,
  altura: number,
  formas: FormaMedida[],
): Promise<ResultadoAvaliacao> {
  const dados = await requisitarApi(
    configuracao,
    "POST",
    `/tipo-dinamica/${encodeURIComponent(configuracao.eventoTreino)}/corrigir-formas`,
    JSON.stringify({
      time_id: configuracao.teamId,
      integrante_id: configuracao.userId,
      // Treino não entra no ranking do torneio.
      salvar_pontuacao: false,
      frames: [
        {
          gabarito_cod: gabaritoCod,
          viewport: { width: largura, height: altura },
          formas,
        },
      ],
    }),
    "corrigir as formas",
  );
  log.info(
    `Resposta de corrigir-formas (${formas.length} formas): ` +
      JSON.stringify(dados).slice(0, 1500),
  );
  const nota = extrairNotaServidor(dados);

  if (nota === undefined) {
    return {
      precision: 0,
      score: 0,
      source: "servidor-sem-nota",
      error: extrairMensagemServidor(
        dados,
        "A correção respondeu sem nota/precisão. Veja a resposta em FlexBox Trainer Logs.",
      ),
    };
  }

  return { precision: nota, score: nota, source: "servidor" };
}

async function listarGabaritos(
  configuracao: ConfiguracaoServidor,
  evento: string,
): Promise<unknown[]> {
  try {
    const dados = await requisitarApi(
      configuracao,
      "GET",
      `/tipo-dinamica/${encodeURIComponent(evento)}/gabaritos`,
      undefined,
      "listar os gabaritos do evento",
    );
    const lista = Array.isArray(dados)
      ? dados
      : dados && typeof dados === "object"
        ? Object.values(dados as Record<string, unknown>).find(Array.isArray)
        : undefined;

    if (!lista) {
      // Sem entender a listagem não dá para garantir que nada será sobrescrito.
      throw new Error(
        `Listagem de gabaritos em formato inesperado: ${JSON.stringify(dados).slice(0, 200)}`,
      );
    }

    return lista;
  } catch (error) {
    // Evento ainda sem gabaritos.
    if (error instanceof ErroHttpServidor && error.status === 404) {
      return [];
    }
    throw error;
  }
}

// Só registra o que o servidor detectou, para conferir tipo e cor das formas.
async function registrarMedidasDoGabarito(
  configuracao: ConfiguracaoServidor,
  largura: number,
  altura: number,
): Promise<void> {
  const nome = `gab_${configuracao.eventoTreino}_tam_${largura}x${altura}.png`;

  try {
    const medidas = await requisitarApi(
      configuracao,
      "GET",
      `/medidas-gabarito?gabarito=${encodeURIComponent(nome)}`,
      undefined,
      "consultar as medidas do gabarito",
    );
    log.info(`Medidas do gabarito ${nome}: ${JSON.stringify(medidas).slice(0, 1500)}`);
  } catch (error) {
    log.info(
      `Medidas do gabarito ${nome} indisponíveis: ${
        error instanceof Error ? error.message : "erro desconhecido"
      }`,
    );
  }
}

const NOME_GABARITO = /gab_.+_tam_(\d+)x(\d+)\.\w+/i;

function temNomeDeGabarito(item: unknown): boolean {
  return textosDoItem(item).some((texto) => NOME_GABARITO.test(texto));
}

function temTamanho(item: unknown, largura: number, altura: number): boolean {
  // O nome segue gab_[evento]_tam_[A]x[B]; a ordem de A e B varia na documentação.
  return textosDoItem(item).some((texto) => {
    const tamanho = NOME_GABARITO.exec(texto);
    return Boolean(
      tamanho &&
        ((Number(tamanho[1]) === largura && Number(tamanho[2]) === altura) ||
          (Number(tamanho[1]) === altura && Number(tamanho[2]) === largura)),
    );
  });
}

function textosDoItem(item: unknown): string[] {
  if (typeof item === "string") {
    return [item];
  }

  return item && typeof item === "object"
    ? Object.values(item as Record<string, unknown>).filter(
        (valor): valor is string => typeof valor === "string",
      )
    : [];
}

export function extrairCodGabarito(dados: unknown): number | undefined {
  if (!dados || typeof dados !== "object") {
    return undefined;
  }

  const registro = dados as Record<string, unknown>;
  const candidatos = [
    registro.cod,
    registro.codigo,
    registro.gabarito_cod,
    registro.cod_gabarito,
    registro.id,
  ];
  const cod = candidatos
    .map((valor) => Number(valor))
    .find((valor) => Number.isInteger(valor) && valor > 0);

  if (cod) {
    return cod;
  }

  const aninhado = registro.gabarito ?? registro.data;
  return aninhado && typeof aninhado === "object"
    ? extrairCodGabarito(aninhado)
    : undefined;
}

function criarFormularioImagem(png: Uint8Array<ArrayBuffer>): FormData {
  const formulario = new FormData();
  formulario.append(
    "arquivo",
    new Blob([png], { type: "image/png" }),
    "gabarito.png",
  );
  return formulario;
}

async function requisitarApi(
  configuracao: ConfiguracaoServidor,
  metodo: "GET" | "POST" | "PUT",
  caminho: string,
  corpo: string | FormData | undefined,
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
      typeof corpo === "string" ? { "Content-Type": "application/json" } : {},
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

export function extrairNotaServidor(dados: unknown): number | undefined {
  if (!dados || typeof dados !== "object") {
    return undefined;
  }

  const fila: unknown[] = [dados];
  const visitados = new Set<object>();
  const chavesNota = new Set([
    "nota",
    "pontuacao",
    "score",
    "precisao",
    "precision",
    "porcentagem",
    "percentage",
    "acuracia",
    "accuracy",
  ]);

  while (fila.length > 0) {
    const atual = fila.shift();

    if (!atual || typeof atual !== "object" || visitados.has(atual)) {
      continue;
    }

    visitados.add(atual);

    for (const [chave, valor] of Object.entries(
      atual as Record<string, unknown>,
    )) {
      if (chavesNota.has(chave.toLowerCase())) {
        const numero =
          typeof valor === "number"
            ? valor
            : typeof valor === "string" && valor.trim()
              ? Number(valor)
              : undefined;

        if (numero !== undefined && Number.isFinite(numero)) {
          return numero;
        }
      }

      if (valor && typeof valor === "object") {
        fila.push(valor);
      }
    }
  }

  return undefined;
}

function extrairMensagemServidor(
  dados: unknown,
  padrao = "Conteúdo salvo, mas a API não retornou nota/precisão nesta rota.",
): string {
  if (dados && typeof dados === "object") {
    const resposta = dados as Record<string, unknown>;
    const mensagem = resposta.message ?? resposta.mensagem ?? resposta.detail;

    if (typeof mensagem === "string" && mensagem.trim()) {
      return mensagem.trim();
    }
  }

  return padrao;
}

async function extrairDetalheDeErro(response: Response): Promise<string> {
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

export function extrairCodigoPasta(dados: unknown): string | undefined {
  if (typeof dados === "string" && dados.trim()) {
    return dados;
  }

  if (!dados || typeof dados !== "object") {
    return undefined;
  }

  const resposta = dados as Record<string, unknown>;
  const candidatos = [
    resposta.code_pasta,
    resposta.codigo_pasta,
    resposta.codigoPasta,
    resposta.codPasta,
    resposta.cod_pasta,
    resposta.pastaCodigo,
    resposta.codigo,
  ];

  return candidatos.find(
    (valor): valor is string =>
      typeof valor === "string" &&
      valor.trim().length > 0 &&
      !valor.includes("Sucesso"),
  );
}

function normalizarApiBaseUrl(apiBaseUrl: string): string {
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

function montarCabecalhos(
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
