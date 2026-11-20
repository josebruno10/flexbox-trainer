import { ConfiguracaoServidor } from "../../types";
import {
  ehNaoEncontrado,
  ehRegistro,
  ErroHttpServidor,
  requisitarApi,
} from "./requisicao";

// O index.html e o style.css do aluno guardados no servidor, na pasta dele
// dentro de uma dinâmica, pelas mesmas rotas da extensão oficial:
// criar-pasta dá o code_pasta, salvar-conteudo grava e obter-conteudo lê.
// Assim o aluno continua o treino em outro computador.

export type ConteudoDoAluno = {
  html: string;
  css: string;
};

/**
 * O code_pasta do aluno na dinâmica. A rota cria a pasta só na primeira
 * vez; depois devolve a mesma.
 */
export async function obterPastaDoAluno(
  configuracao: ConfiguracaoServidor,
  evento: string,
): Promise<string> {
  const caminho =
    `/criar-pasta/${encodeURIComponent(evento)}` +
    `/${configuracao.teamId}/${configuracao.userId}`;
  let dados: unknown;
  try {
    dados = await requisitarApi(
      configuracao,
      "POST",
      caminho,
      undefined,
      "abrir a sua pasta no servidor",
    );
  } catch (error) {
    // A extensão oficial tenta GET quando o servidor não aceita POST.
    if (!(error instanceof ErroHttpServidor && error.status === 405)) {
      throw error;
    }
    dados = await requisitarApi(
      configuracao,
      "GET",
      caminho,
      undefined,
      "abrir a sua pasta no servidor",
    );
  }

  const codePasta = extrairCodePasta(dados);
  if (!codePasta) {
    throw new Error("O servidor não informou a sua pasta (code_pasta).");
  }
  return codePasta;
}

export async function salvarConteudo(
  configuracao: ConfiguracaoServidor,
  codePasta: string,
  conteudo: ConteudoDoAluno,
): Promise<void> {
  await requisitarApi(
    configuracao,
    "POST",
    "/salvar-conteudo",
    new URLSearchParams({
      code_pasta: codePasta,
      tipo: "ambos",
      index_conteudo: conteudo.html,
      style_conteudo: conteudo.css,
    }),
    "salvar o seu progresso",
  );
}

/** O que está salvo na pasta, ou nada se ela ainda está vazia. */
export async function obterConteudo(
  configuracao: ConfiguracaoServidor,
  codePasta: string,
): Promise<ConteudoDoAluno | undefined> {
  const consulta = new URLSearchParams({ code_pasta: codePasta, tipo: "ambos" });
  let dados: unknown;
  try {
    dados = await requisitarApi(
      configuracao,
      "GET",
      `/obter-conteudo?${consulta.toString()}`,
      undefined,
      "puxar o seu progresso",
    );
  } catch (error) {
    if (ehNaoEncontrado(error)) {
      return undefined;
    }
    throw error;
  }

  // A resposta traz cada arquivo com o texto em "conteudo":
  // {"index.html": {"conteudo": "..."}, "style.css": {"conteudo": "..."}}.
  const html = conteudoDoArquivo(dados, "index.html");
  const css = conteudoDoArquivo(dados, "style.css");
  if (!html?.trim() && !css?.trim()) {
    return undefined;
  }
  return { html: html ?? "", css: css ?? "" };
}

// Como a extensão oficial: se o aluno mudou de time, vale a pasta original.
export function extrairCodePasta(dados: unknown): string | undefined {
  if (!ehRegistro(dados)) {
    return undefined;
  }
  const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");
  const atual = texto(dados.code_pasta);
  const original = texto(dados.code_pasta_original);
  const mudouDeTime = Boolean(dados.usuario_mudou_de_time || dados.registro_de_outro_time);
  return (mudouDeTime && original ? original : atual || original) || undefined;
}

function conteudoDoArquivo(dados: unknown, nome: string): string | undefined {
  const arquivo = ehRegistro(dados) ? dados[nome] : undefined;
  return ehRegistro(arquivo) && typeof arquivo.conteudo === "string"
    ? arquivo.conteudo
    : undefined;
}
