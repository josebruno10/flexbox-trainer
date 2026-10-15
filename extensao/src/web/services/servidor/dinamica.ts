import { ConfiguracaoServidor } from "../../types";
import { ehNaoEncontrado, ehRegistro, requisitarApi } from "./requisicao";

// A dinâmica de treino: o evento do servidor onde ficam os gabaritos e as
// correções do treino.

/** Dados da dinâmica, ou undefined quando ela não existe no servidor. */
export async function buscarDinamica(
  configuracao: ConfiguracaoServidor,
  evento: string,
): Promise<unknown> {
  try {
    const dados = await requisitarApi(
      configuracao,
      "GET",
      `/tipoDinamica/${encodeURIComponent(evento)}`,
      undefined,
      "consultar a dinâmica",
    );
    const vazio =
      dados === null ||
      (Array.isArray(dados) && dados.length === 0) ||
      (ehRegistro(dados) && Object.keys(dados).length === 0);
    return vazio ? undefined : dados;
  } catch (error) {
    if (ehNaoEncontrado(error)) {
      return undefined;
    }
    throw error;
  }
}

// Tipo 2 (projetos diferentes) dá uma pasta por aluno, como no treino
// individual; a configuração de correção 1 é a padrão indicada pelo professor.
export async function criarDinamicaDeTreino(
  configuracao: ConfiguracaoServidor,
  evento: string,
): Promise<unknown> {
  return requisitarApi(
    configuracao,
    "POST",
    "/tipoDinamica",
    new URLSearchParams({ evento, tipo: "2", config_correcao: "1" }),
    "criar a dinâmica",
  );
}

export async function consultarStatusDinamica(
  configuracao: ConfiguracaoServidor,
  evento: string,
): Promise<boolean | undefined> {
  const dados = await requisitarApi(
    configuracao,
    "GET",
    `/tipo-dinamica/${encodeURIComponent(evento)}/status`,
    undefined,
    "consultar o status da dinâmica",
  );
  // A extensão oficial só envia correções quando status é true.
  return ehRegistro(dados) && typeof dados.status === "boolean"
    ? dados.status
    : undefined;
}

export async function abrirDinamica(
  configuracao: ConfiguracaoServidor,
  evento: string,
): Promise<void> {
  await requisitarApi(
    configuracao,
    "PUT",
    `/tipo-dinamica/${encodeURIComponent(evento)}/status`,
    new URLSearchParams({ status: "true" }),
    "abrir a dinâmica",
  );
}
