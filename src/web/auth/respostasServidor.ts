import { comoObjeto, primeiroNumeroPositivo, primeiroTexto } from "./leitura";

// O que interessa nas respostas do servidor do torneio: o token, o perfil, o
// time e a validade da sessão.

export type PerfilServidor = {
  email: string;
  displayName: string;
  avatarUrl?: string;
  userId?: number;
  teamId?: number;
};

const DURACAO_SESSAO_PADRAO_MS = 30 * 24 * 60 * 60 * 1000;

export function extrairTokenServidor(dados: unknown): string | undefined {
  const raiz = comoObjeto(dados);
  const data = comoObjeto(raiz?.data);
  const tokens = comoObjeto(raiz?.tokens);
  const auth = comoObjeto(raiz?.auth);
  const session = comoObjeto(raiz?.session);
  return (
    primeiroTexto(
      raiz?.server_token,
      raiz?.serverToken,
      raiz?.access_token,
      raiz?.accessToken,
      raiz?.token,
      raiz?.jwt,
      raiz?.bearerToken,
      data?.server_token,
      data?.serverToken,
      data?.access_token,
      data?.accessToken,
      data?.token,
      tokens?.server_token,
      tokens?.serverToken,
      tokens?.access_token,
      tokens?.accessToken,
      auth?.token,
      session?.token,
    ) || undefined
  );
}

export function extrairPerfil(dados: unknown): PerfilServidor {
  const raiz = comoObjeto(dados) ?? {};
  const data = comoObjeto(raiz.data);
  const candidato =
    comoObjeto(raiz.usuario) ??
    comoObjeto(raiz.user) ??
    comoObjeto(raiz.perfil) ??
    comoObjeto(data?.usuario) ??
    comoObjeto(data?.user) ??
    comoObjeto(data?.perfil) ??
    data ??
    raiz;
  const time =
    comoObjeto(candidato.time) ??
    comoObjeto(candidato.team) ??
    comoObjeto(candidato.equipe);
  const email = primeiroTexto(
    candidato.email,
    candidato.mail,
    candidato.user_email,
    candidato.preferred_username,
    candidato.upn,
  ).toLowerCase();

  return {
    email,
    displayName:
      primeiroTexto(
        candidato.nome,
        candidato.name,
        candidato.display_name,
        candidato.displayName,
        candidato.nome_completo,
        email,
      ) || "Usuário",
    avatarUrl:
      primeiroTexto(
        candidato.url_image_perfil,
        candidato.avatar_url,
        candidato.avatarUrl,
        candidato.avatar,
        candidato.picture,
      ) || undefined,
    userId: primeiroNumeroPositivo(
      candidato.usuario_id,
      candidato.user_id,
      candidato.userId,
      candidato.integrante_id,
      candidato.id,
    ),
    teamId: primeiroNumeroPositivo(
      candidato.time_id,
      candidato.team_id,
      candidato.teamId,
      candidato.equipe_id,
      time?.id,
    ),
  };
}

export function extrairTimeId(dados: unknown): number | undefined {
  const raiz = Array.isArray(dados) ? comoObjeto(dados[0]) : comoObjeto(dados);
  const data = comoObjeto(raiz?.data);
  const candidato =
    comoObjeto(raiz?.time) ??
    comoObjeto(raiz?.team) ??
    comoObjeto(raiz?.equipe) ??
    comoObjeto(data?.time) ??
    comoObjeto(data?.team) ??
    comoObjeto(data?.equipe) ??
    data ??
    raiz;

  return candidato
    ? primeiroNumeroPositivo(
        candidato.time_id,
        candidato.team_id,
        candidato.equipe_id,
        candidato.id,
      )
    : undefined;
}

export function extrairExpiracao(dados: unknown, tokenServidor: string): number {
  const raiz = comoObjeto(dados) ?? {};
  const data = comoObjeto(raiz.data) ?? {};
  const expiresIn = primeiroNumeroPositivo(
    raiz.expires_in,
    raiz.expiresIn,
    data.expires_in,
    data.expiresIn,
  );

  if (expiresIn) {
    return Date.now() + expiresIn * 1000;
  }

  const expiresAt = converterInstante(
    raiz.expires_at ?? raiz.expiresAt ?? data.expires_at ?? data.expiresAt,
  );
  return (
    expiresAt ??
    extrairExpiracaoJwt(tokenServidor) ??
    Date.now() + DURACAO_SESSAO_PADRAO_MS
  );
}

function extrairExpiracaoJwt(token: string): number | undefined {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return undefined;
    }
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const normalizado = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const dados = JSON.parse(atob(normalizado)) as { exp?: unknown };
    const exp = primeiroNumeroPositivo(dados.exp);
    return exp ? exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

function converterInstante(valor: unknown): number | undefined {
  if (typeof valor === "number" && Number.isFinite(valor)) {
    return valor > 10_000_000_000 ? valor : valor * 1000;
  }

  if (typeof valor === "string" && valor.trim()) {
    const numero = Number(valor);
    if (Number.isFinite(numero)) {
      return numero > 10_000_000_000 ? numero : numero * 1000;
    }
    const data = Date.parse(valor);
    return Number.isFinite(data) ? data : undefined;
  }

  return undefined;
}
