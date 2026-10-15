import * as vscode from "vscode";
import { TIMEOUT_PERFIL_MS, fetchComTimeout, lerJSONObrigatorio } from "./http";
import {
  comoObjeto,
  extrairEmailDeTexto,
  normalizarEmails,
  primeiroTexto,
} from "./leitura";

// O login pelo GitHub e pela Microsoft, com as contas do próprio VS Code: a
// sessão do provedor e o perfil dela (e-mails verificados, nome e foto).

export type ProvedorVSCode = "github" | "microsoft";

export type PerfilProvedor = {
  emails: string[];
  nome: string;
  avatarUrl?: string;
};

const TENTATIVAS_PROVEDOR_VSCODE = 3;

// No primeiro pedido o VS Code ativa a extensão do provedor e espera só 5 s
// pelo registro dele. Numa janela recém-aberta isso leva mais (medido: 5,6 s
// para o GitHub e 11,4 s para a Microsoft), e o provedor continua
// registrando depois do erro; o erro vem antes de qualquer tela de login.
export async function obterSessaoProvedor(
  provedor: ProvedorVSCode,
  scopes: string[],
  aoAguardar: () => void,
): Promise<vscode.AuthenticationSession> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await vscode.authentication.getSession(provedor, scopes, {
        createIfNone: true,
      });
    } catch (error) {
      const aguardandoRegistro =
        error instanceof Error &&
        /timed out waiting for authentication provider/i.test(error.message);

      if (!aguardandoRegistro) {
        throw error;
      }

      if (tentativa >= TENTATIVAS_PROVEDOR_VSCODE) {
        const nome = provedor === "github" ? "GitHub" : "Microsoft";
        throw new Error(
          `O VS Code não disponibilizou o login do ${nome}. Confira se a ` +
            `extensão embutida "${nome} Authentication" está habilitada e ` +
            "tente novamente.",
        );
      }

      aoAguardar();
    }
  }
}

export async function buscarPerfilProvedor(
  provedor: ProvedorVSCode,
  accessToken: string,
  nomeFallback: string,
): Promise<PerfilProvedor> {
  return provedor === "github"
    ? buscarPerfilGitHub(accessToken, nomeFallback)
    : buscarPerfilMicrosoft(accessToken, nomeFallback);
}

async function buscarPerfilGitHub(
  accessToken: string,
  nomeFallback: string,
): Promise<PerfilProvedor> {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${accessToken}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const usuarioRes = await fetchComTimeout(
    "https://api.github.com/user",
    { headers },
    TIMEOUT_PERFIL_MS,
    "consultar o perfil do GitHub",
  );

  if (!usuarioRes.ok) {
    throw new Error(`Falha ao consultar GitHub: HTTP ${usuarioRes.status}`);
  }

  const usuario = comoObjeto(
    await lerJSONObrigatorio(usuarioRes, "perfil do GitHub"),
  );
  const emails: string[] = [primeiroTexto(usuario?.email)];
  const emailsRes = await fetchComTimeout(
    "https://api.github.com/user/emails",
    { headers },
    TIMEOUT_PERFIL_MS,
    "consultar os e-mails do GitHub",
  );

  if (emailsRes.ok) {
    const dadosEmails = await lerJSONObrigatorio(emailsRes, "e-mails do GitHub");

    if (Array.isArray(dadosEmails)) {
      const verificados = dadosEmails
        .map((item) => comoObjeto(item))
        .filter((item) => item?.verified === true && item.email);
      const principal = verificados.find((item) => item?.primary === true);
      emails.push(primeiroTexto(principal?.email));
      verificados.forEach((item) => emails.push(primeiroTexto(item?.email)));
    }
  }

  return {
    emails: normalizarEmails(emails),
    nome:
      primeiroTexto(
        usuario?.name,
        usuario?.login,
        usuario?.email,
        nomeFallback,
      ) || "GitHub",
    avatarUrl: primeiroTexto(usuario?.avatar_url) || undefined,
  };
}

async function buscarPerfilMicrosoft(
  accessToken: string,
  nomeFallback: string,
): Promise<PerfilProvedor> {
  try {
    const resposta = await fetchComTimeout(
      "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName",
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      },
      TIMEOUT_PERFIL_MS,
      "consultar o perfil da Microsoft",
    );

    if (resposta.ok) {
      const dados = comoObjeto(
        await lerJSONObrigatorio(resposta, "perfil da Microsoft"),
      );
      return {
        emails: normalizarEmails([
          primeiroTexto(dados?.mail),
          primeiroTexto(dados?.userPrincipalName),
          extrairEmailDeTexto(nomeFallback),
        ]),
        nome:
          primeiroTexto(
            dados?.displayName,
            dados?.userPrincipalName,
            dados?.mail,
            nomeFallback,
          ) || "Microsoft",
        avatarUrl: await buscarFotoMicrosoft(accessToken),
      };
    }
  } catch {
    // O rótulo da sessão ainda pode conter um e-mail utilizável.
  }

  const emailFallback = extrairEmailDeTexto(nomeFallback);
  return {
    emails: normalizarEmails([emailFallback]),
    nome: nomeFallback || emailFallback || "Microsoft",
  };
}

async function buscarFotoMicrosoft(
  accessToken: string,
): Promise<string | undefined> {
  try {
    const resposta = await fetchComTimeout(
      "https://graph.microsoft.com/v1.0/me/photo/$value",
      { headers: { Authorization: `Bearer ${accessToken}` } },
      TIMEOUT_PERFIL_MS,
      "consultar a foto da Microsoft",
    );

    if (!resposta.ok) {
      return undefined;
    }

    const blob = await resposta.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binario = "";
    for (const byte of bytes) {
      binario += String.fromCharCode(byte);
    }
    return `data:${blob.type || "image/jpeg"};base64,${btoa(binario)}`;
  } catch {
    return undefined;
  }
}
