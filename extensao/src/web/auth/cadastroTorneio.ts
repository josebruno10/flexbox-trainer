import { log } from "../services/logger";
import {
  EVENTO_DO_TIME,
  buscarTimeDoUsuario,
  buscarUsuarioPorEmail,
} from "./apiTorneio";
import {
  ErroApiAutenticacao,
  TIMEOUT_AUTENTICACAO_MS,
  TIMEOUT_PERFIL_MS,
  extrairDetalheResposta,
  fetchComTimeout,
  lerJSONOuVazio,
  lerUrlBaseApiAutenticacao,
} from "./http";
import { comoObjeto, primeiroTexto } from "./leitura";
import { extrairPerfil } from "./respostasServidor";
import type { SessaoAutenticacao } from "./tokenManager";

// O pré-cadastro no torneio, pelas mesmas rotas da extensão oficial.

export type DadosCadastro = {
  nome: string;
  // Ano de ingresso, como na extensão oficial.
  turma: number;
  periodo: number;
  sede: number;
  nivel: number;
};

export type OpcoesCadastro = {
  sedes: { id: number; nome: string }[];
  niveis: { cod: number; nome: string }[];
};

// Time do torneio para quem se cadastra sem time, como na extensão oficial.
const TIME_GENERICO = 45;
// Níveis de reserva quando o servidor não lista as categorias.
const NIVEIS_PADRAO = [
  { cod: 1, nome: "Médio" },
  { cod: 2, nome: "Graduação" },
];

/** Sedes do evento e níveis do torneio, para o formulário de cadastro. */
export async function carregarOpcoesCadastro(token: string): Promise<OpcoesCadastro> {
  const base = lerUrlBaseApiAutenticacao();
  const [sedes, niveis] = await Promise.all([
    buscarListaOpcional(token, `${base}/eventos/${EVENTO_DO_TIME}/sedes`, "sedes"),
    buscarListaOpcional(token, `${base}/categorias`, "categorias"),
  ]);

  return {
    sedes: sedes
      .map((item) => comoObjeto(item))
      .map((sede) => ({
        id: Number(sede?.id),
        nome: primeiroTexto(
          sede?.nome_campus,
          sede?.instituicao,
          sede?.campus,
          sede?.nome,
        ) || `Sede ${sede?.id}`,
      }))
      .filter((sede) => Number.isInteger(sede.id) && sede.id > 0),
    niveis: (() => {
      const lidos = niveis
        .map((item) => comoObjeto(item))
        .map((nivel) => ({
          cod: Number(nivel?.cod ?? nivel?.id),
          nome: primeiroTexto(nivel?.nome, nivel?.descricao),
        }))
        .filter((nivel) => Number.isInteger(nivel.cod) && nivel.cod > 0 && nivel.nome);
      return lidos.length > 0 ? lidos : NIVEIS_PADRAO;
    })(),
  };
}

/**
 * Cadastra o e-mail da sessão no torneio e põe o aluno no time genérico se
 * ele ficar sem time.
 */
export async function cadastrarAluno(
  token: string,
  sessao: SessaoAutenticacao,
  dados: DadosCadastro,
): Promise<void> {
  const base = lerUrlBaseApiAutenticacao();

  // Se alguém já cadastrou o e-mail, não cria um segundo usuário.
  let userId = (await buscarUsuarioPorEmail(token, sessao.email))?.userId;

  if (!userId) {
    const corpo = new URLSearchParams({
      nome: dados.nome.trim(),
      email: sessao.email,
      turma: String(dados.turma),
      periodo: String(dados.periodo),
      sede: String(dados.sede),
      nivel: String(dados.nivel),
      categoria: String(dados.nivel),
    });
    if (sessao.avatarUrl) {
      corpo.set("url_image_perfil", sessao.avatarUrl);
    }
    const resposta = await enviarFormulario(
      token,
      `${base}/usuarios`,
      corpo,
      "cadastrar o aluno",
    );
    userId =
      extrairPerfil(await lerJSONOuVazio(resposta)).userId ??
      (await buscarUsuarioPorEmail(token, sessao.email))?.userId;
  }

  if (!userId) {
    throw new Error("O servidor não informou o ID do aluno cadastrado.");
  }

  if (!(await buscarTimeDoUsuario(token, userId))) {
    try {
      await enviarFormulario(
        token,
        `${base}/times/${TIME_GENERICO}/integrantes`,
        new URLSearchParams({
          usuario_id: String(userId),
          funcao: "INTEGRANTE",
          evento: String(EVENTO_DO_TIME),
        }),
        "pôr o aluno no time genérico",
      );
    } catch (error) {
      // Já estar no time não é erro.
      if (!/duplicad|duplicate|já existe|ja existe|already|unique/i.test(String(error))) {
        throw error;
      }
    }
  }

  log.info(`Aluno ${userId} cadastrado no torneio com o e-mail ${sessao.email}.`);
}

async function enviarFormulario(
  token: string,
  url: string,
  corpo: URLSearchParams,
  acao: string,
): Promise<Response> {
  const resposta = await fetchComTimeout(
    url,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: corpo.toString(),
    },
    TIMEOUT_AUTENTICACAO_MS,
    acao,
  );

  if (!resposta.ok) {
    const detalhe = await extrairDetalheResposta(resposta);
    throw new ErroApiAutenticacao(
      `Não foi possível ${acao} (HTTP ${resposta.status}): ${detalhe}`,
      resposta.status,
    );
  }

  return resposta;
}

// Lista vazia quando a rota falha: o formulário usa valores de reserva.
async function buscarListaOpcional(
  token: string,
  url: string,
  nome: string,
): Promise<unknown[]> {
  try {
    const resposta = await fetchComTimeout(
      url,
      { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } },
      TIMEOUT_PERFIL_MS,
      `carregar ${nome}`,
    );
    if (!resposta.ok) {
      return [];
    }
    const dados = await lerJSONOuVazio(resposta);
    const raiz = comoObjeto(dados);
    const lista = Array.isArray(dados) ? dados : raiz?.[nome] ?? raiz?.data;
    return Array.isArray(lista) ? lista : [];
  } catch (error) {
    log.error(`Não foi possível carregar ${nome}`, error);
    return [];
  }
}
