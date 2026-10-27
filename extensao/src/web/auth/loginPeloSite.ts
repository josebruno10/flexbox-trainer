import * as vscode from "vscode";
import { log } from "../services/logger";
import { lerUrlBaseApiAutenticacao } from "./http";
import { RetornoLocal } from "./retornoLocal";

// A ida ao site de login com Google (authSiteUrl) e o caminho de volta.

/** Para onde o site manda o login e, no desktop, o servidor que o recebe. */
export type VoltaDoLogin = { callback: string; retornoLocal?: RetornoLocal };

/** O servidor local, quando o host tem o módulo http (VS Code desktop). */
export async function abrirRetornoLocalSePuder(): Promise<RetornoLocal | undefined> {
  return RetornoLocal.disponivel() ? RetornoLocal.abrir() : undefined;
}

/**
 * A volta pelo servidor local, quando o navegador chega a ele por 127.0.0.1;
 * senão, pelo endereço vscode:// da extensão, como antes.
 */
export async function prepararVolta(
  idDaExtensao: string,
  abrirRetornoLocal: () => Promise<RetornoLocal | undefined>,
): Promise<VoltaDoLogin> {
  let retornoLocal: RetornoLocal | undefined;
  try {
    retornoLocal = await abrirRetornoLocal();
  } catch (error) {
    log.info(
      "Sem o servidor local do login; a volta é pelo vscode://: " +
        (error instanceof Error ? error.message : "erro desconhecido"),
    );
  }

  if (retornoLocal) {
    const externo = await vscode.env.asExternalUri(
      vscode.Uri.parse(retornoLocal.enderecoDeRetorno),
    );
    // O site só devolve o login a 127.0.0.1 ou localhost; num Codespace, o
    // endereço externo é outro, e a volta é pelo vscode://.
    if (ehLocal(externo)) {
      retornoLocal.aceitarHost(externo.authority);
      return { callback: externo.toString(true), retornoLocal };
    }
    retornoLocal.fechar();
  }

  const callback = await vscode.env.asExternalUri(
    vscode.Uri.parse(`${vscode.env.uriScheme}://${idDaExtensao}/auth/callback`),
  );
  // toString() codificaria = e & da query do callback do vscode.dev.
  return { callback: callback.toString(true) };
}

/** Preenche o endereço do site com o que ele precisa para o login. */
export function montarEnderecoDoSite(
  site: URL,
  dados: { callback: string; estado: string; googleClientId: string },
): void {
  site.searchParams.set("callback", dados.callback);
  site.searchParams.set("state", dados.estado);
  // O site devolve o modo no retorno; só existe o login.
  site.searchParams.set("mode", "login");
  site.searchParams.set("apiBaseUrl", lerUrlBaseApiAutenticacao());

  if (dados.googleClientId) {
    // O site mais novo usa clientId; googleClientId mantém compatibilidade
    // com a versão anterior publicada pelo projeto.
    site.searchParams.set("clientId", dados.googleClientId);
    site.searchParams.set("googleClientId", dados.googleClientId);
  }
}

/** Abre o site de login no navegador. */
export async function abrirNoNavegador(
  site: URL,
  estado: string,
  retornoLocal?: RetornoLocal,
): Promise<boolean> {
  if (retornoLocal) {
    // Um endereço local e curto, que o VS Code abre sem pedir confirmação; o
    // servidor leva o navegador ao site. O openExternal encaminha a porta
    // sozinho, quando a extensão roda numa máquina remota.
    return vscode.env.openExternal(
      vscode.Uri.parse(retornoLocal.entrada(site.toString(), estado)),
    );
  }

  // Um Uri passa por encodeURI(uri.toString(true)) antes de chegar ao
  // navegador, o que codifica os parâmetros em dobro (https%253A...) e faz
  // o site recusar apiBaseUrl e callback. Uma string é aberta como está,
  // inclusive quando o callback do vscode.dev contém ? e &.
  return vscode.env.openExternal(site.toString() as unknown as vscode.Uri);
}

function ehLocal(uri: vscode.Uri): boolean {
  return uri.scheme === "http" && /^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(uri.authority);
}
