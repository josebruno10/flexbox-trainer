import { log } from "../services/logger";
import {
  ErroApiAutenticacao,
  TIMEOUT_AUTENTICACAO_MS,
  TIMEOUT_PERFIL_MS,
  extrairDetalheResposta,
  fetchComTimeout,
  lerJSONObrigatorio,
  lerUrlBaseApiAutenticacao,
  respostaDeInexistente,
} from "./http";
import { normalizarEmails } from "./leitura";
import {
  PerfilServidor,
  extrairPerfil,
  extrairTimeId,
  extrairTokenServidor,
} from "./respostasServidor";

// As rotas do servidor do torneio usadas no login.

export type ProvedorAutenticacao = "gmail" | "github" | "microsoft";

// Evento que a extensão oficial do torneio usa para achar o time da conta.
export const EVENTO_DO_TIME = 2;

export type ResultadoTrocaLogin = {
  serverToken: string;
  resposta: unknown;
};

export type PerfilAutenticado = {
  perfil: PerfilServidor;
  // Preenchido quando nenhum e-mail da conta está cadastrado no torneio.
  avisoCadastro?: string;
};

export async function trocarTokenProvedorPorTokenServidor(
  provedor: ProvedorAutenticacao,
  tokenProvedor: string,
): Promise<ResultadoTrocaLogin> {
  const resposta = await fetchComTimeout(
    `${lerUrlBaseApiAutenticacao()}/login`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ provider: provedor, token: tokenProvedor }),
    },
    TIMEOUT_AUTENTICACAO_MS,
    "validar o login",
  );

  if (!resposta.ok) {
    const detalhe = await extrairDetalheResposta(resposta);
    throw new ErroApiAutenticacao(
      `Falha ao validar o login no servidor (HTTP ${resposta.status}): ${detalhe}`,
      resposta.status,
    );
  }

  const dados = await lerJSONObrigatorio(resposta, "login");
  const tokenServidor = extrairTokenServidor(dados);

  if (!tokenServidor) {
    throw new Error("A API de login não retornou token de acesso.");
  }

  return { serverToken: tokenServidor, resposta: dados };
}

export async function buscarPerfilAutenticado(
  tokenServidor: string,
  emailsProvedor: string[] = [],
): Promise<PerfilAutenticado> {
  const resposta = await fetchComTimeout(
    `${lerUrlBaseApiAutenticacao()}/auth/me`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${tokenServidor}`,
      },
    },
    TIMEOUT_PERFIL_MS,
    "validar a sessão",
  );

  if (!resposta.ok) {
    const detalhe = await extrairDetalheResposta(resposta);
    throw new ErroApiAutenticacao(
      `Não foi possível validar a sessão (HTTP ${resposta.status}): ${detalhe}`,
      resposta.status,
    );
  }

  const dados = await lerJSONObrigatorio(resposta, "perfil autenticado");
  const perfil = extrairPerfil(dados);

  if (!perfil.email) {
    throw new Error("A API /auth/me não retornou o e-mail do usuário.");
  }

  // O /auth/me pode trazer o ID do provedor de login (o do GitHub, por
  // exemplo), que não existe na tabela de usuários. A extensão oficial do
  // torneio identifica o aluno pelo e-mail e busca o time pelo ID dele.
  // O e-mail cadastrado no torneio pode ser um secundário da conta, então
  // a busca tenta cada e-mail verificado, a começar pelo do /auth/me.
  const candidatos = normalizarEmails([perfil.email, ...emailsProvedor]);
  let usuarioServidor: PerfilServidor | undefined;
  let emailCadastrado: string | undefined;

  for (const email of candidatos) {
    usuarioServidor = await buscarUsuarioPorEmail(tokenServidor, email);
    if (usuarioServidor?.userId) {
      emailCadastrado = email;
      break;
    }
  }

  const idDoAuthMe = perfil.userId;

  if (usuarioServidor?.userId) {
    perfil.userId = usuarioServidor.userId;
    perfil.teamId =
      (await buscarTimeDoUsuario(tokenServidor, perfil.userId)) ??
      usuarioServidor.teamId ??
      perfil.teamId;
  } else if (perfil.userId && !perfil.teamId) {
    perfil.teamId = await buscarTimeDoUsuario(tokenServidor, perfil.userId);
  }

  log.info(
    emailCadastrado
      ? `Aluno identificado pelo e-mail ${emailCadastrado}: ID ${perfil.userId}, ` +
          `time ${perfil.teamId ?? "nenhum"} (o /auth/me informou ${idDoAuthMe ?? "nenhum"}).`
      : `Nenhum e-mail da conta (${candidatos.join(", ")}) encontrado em ` +
          `/usuarios/por-email; usando o /auth/me: ID ${perfil.userId ?? "nenhum"}, ` +
          `time ${perfil.teamId ?? "nenhum"}.`,
  );
  // Sem cadastro, o servidor aceita o login mas devolve o ID do provedor,
  // que não existe no torneio; a correção não funcionaria. A extensão não
  // cadastra ninguém: só corrige quem já está no Frontend Teams Cup.
  const avisoCadastro = emailCadastrado
    ? undefined
    : (candidatos.length > 1
        ? `Nenhum e-mail desta conta (${candidatos.join(", ")}) está no torneio`
        : `O e-mail ${perfil.email} não está no torneio`) +
      ", e só quem está consegue corrigir. Se você se inscreveu, saia e entre com a conta do e-mail inscrito.";

  if (!perfil.userId) {
    throw new Error("O servidor não informou o ID do usuário.");
  }

  return { perfil, avisoCadastro };
}

// Undefined quando o e-mail não está cadastrado no servidor do torneio.
export async function buscarUsuarioPorEmail(
  tokenServidor: string,
  email: string,
): Promise<PerfilServidor | undefined> {
  const url = new URL(`${lerUrlBaseApiAutenticacao()}/usuarios/por-email`);
  url.searchParams.set("email", email);
  const resposta = await fetchComTimeout(
    url.toString(),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${tokenServidor}`,
      },
    },
    TIMEOUT_PERFIL_MS,
    "buscar o usuário pelo e-mail",
  );

  if (await respostaDeInexistente(resposta, "buscar o usuário pelo e-mail")) {
    return undefined;
  }

  return extrairPerfil(
    await lerJSONObrigatorio(resposta, "usuário do servidor"),
  );
}

export async function buscarTimeDoUsuario(
  tokenServidor: string,
  userId: number,
): Promise<number | undefined> {
  const url = new URL(`${lerUrlBaseApiAutenticacao()}/usuarios/${userId}/time`);
  url.searchParams.set("evento", String(EVENTO_DO_TIME));
  const resposta = await fetchComTimeout(
    url.toString(),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${tokenServidor}`,
      },
    },
    TIMEOUT_PERFIL_MS,
    "consultar a equipe do usuário",
  );

  if (await respostaDeInexistente(resposta, "consultar a equipe")) {
    return undefined;
  }

  return extrairTimeId(
    await lerJSONObrigatorio(resposta, "equipe do usuário"),
  );
}

export async function encerrarNoServidor(tokenServidor: string): Promise<void> {
  await fetchComTimeout(
    `${lerUrlBaseApiAutenticacao()}/logout`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${tokenServidor}`,
      },
    },
    TIMEOUT_PERFIL_MS,
    "encerrar a sessão",
  );
}
