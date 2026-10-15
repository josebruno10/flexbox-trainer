import * as assert from "assert";
import * as vscode from "vscode";
import { AuthService } from "../../../auth/authService";

// O que os testes do AuthService usam: contexto e configuração falsos,
// respostas do servidor e o começo do login pelo site.

export type MockStorage = {
  valor?: string;
  exclusoes?: number;
};

const getConfigurationOriginal = vscode.workspace.getConfiguration;

export function mockarConfiguracaoAutenticacao(
  extras: Record<string, unknown> = {},
): void {
  vscode.workspace.getConfiguration = (section?: string) => {
    const configuracaoOriginal = getConfigurationOriginal.call(
      vscode.workspace,
      section,
    );

    return {
      ...configuracaoOriginal,
      get: <T>(chave: string, valorPadrao?: T): T => {
        if (section === "flexboxTrainer") {
          const valores: Record<string, unknown> = {
            authSiteUrl: "https://auth.example.com/login/",
            authApiBaseUrl: "https://frontendteamscup.com.br/api",
            googleClientId: "client-id-google",
            ...extras,
          };
          if (chave in valores) {
            return valores[chave] as T;
          }
        }

        return configuracaoOriginal.get(chave, valorPadrao as T) as T;
      },
    } as vscode.WorkspaceConfiguration;
  };
}

export function criarContextoFalso(storage: MockStorage = {}): vscode.ExtensionContext {
  const secretos = {
    get: async () => storage.valor,
    store: async (_chave: string, valor: string) => {
      storage.valor = valor;
    },
    delete: async () => {
      storage.valor = undefined;
      storage.exclusoes = (storage.exclusoes || 0) + 1;
    },
    onDidChange: undefined,
  } as unknown as vscode.SecretStorage;

  return {
    secrets: secretos,
    extension: {
      id: "flexbox-trainer.test",
    } as vscode.Extension<unknown>,
  } as vscode.ExtensionContext;
}

export function respostaJson(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function assertBearer(init: RequestInit | undefined, token: string): void {
  const headers = init?.headers as Record<string, string> | undefined;
  assert.strictEqual(headers?.Authorization, `Bearer ${token}`);
}

export function perfilServidor(
  sobrescritas: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 74,
    nome: "Aluno Servidor",
    email: "aluno@example.com",
    time_id: 46,
    url_image_perfil: "https://example.com/avatar.png",
    ...sobrescritas,
  };
}

let ultimosParametrosAbertos: URLSearchParams | undefined;

/** Os parâmetros do último endereço aberto para o site de login. */
export function ultimosParametros(): URLSearchParams | undefined {
  return ultimosParametrosAbertos;
}

// Rotas que o login consulta depois do /auth/me: o usuário pelo e-mail e o
// time dele.
export function responderUsuarioDoServidor(url: URL): Response | undefined {
  if (url.pathname.endsWith("/usuarios/por-email")) {
    return respostaJson(perfilServidor());
  }

  if (url.pathname.endsWith("/usuarios/74/time")) {
    return respostaJson({ id: 46, nome_time: "Time de teste" });
  }

  return undefined;
}

export async function iniciarFluxoGoogle(
  authService: AuthService,
  callbackExterno?: string,
): Promise<string> {
  mockarConfiguracaoAutenticacao();
  let urlAberta: unknown;
  vscode.env.asExternalUri = async (uri) =>
    callbackExterno ? vscode.Uri.parse(callbackExterno) : uri;
  vscode.env.openExternal = async (uri) => {
    urlAberta = uri;
    return true;
  };

  await authService.abrirLoginGoogle();

  // Um Uri seria recodificado pelo VS Code antes de chegar ao navegador; só
  // uma string garante que o site lê exatamente estes parâmetros.
  assert.strictEqual(typeof urlAberta, "string");
  const parametros = new URL(urlAberta as string).searchParams;
  ultimosParametrosAbertos = parametros;
  const state = parametros.get("state") || "";
  assert.match(state, /^[a-f0-9]{48}$/);
  assert.ok(parametros.get("callback")?.includes("/auth/callback"));
  assert.strictEqual(parametros.get("mode"), "login");
  assert.strictEqual(
    parametros.get("apiBaseUrl"),
    "https://frontendteamscup.com.br/api",
  );
  assert.strictEqual(parametros.get("clientId"), "client-id-google");
  assert.strictEqual(
    parametros.get("googleClientId"),
    "client-id-google",
  );
  return state;
}

/** Devolve, ao fim de cada teste, o que os testes trocam no vscode e no fetch. */
export function restaurarAoFim(): void {
  const originalFetch = globalThis.fetch;
  const originalGetSession = vscode.authentication.getSession;
  const originalShowErrorMessage = vscode.window.showErrorMessage;
  const originalOpenExternal = vscode.env.openExternal;
  const originalAsExternalUri = vscode.env.asExternalUri;

  teardown(() => {
    globalThis.fetch = originalFetch;
    vscode.authentication.getSession = originalGetSession;
    vscode.window.showErrorMessage = originalShowErrorMessage;
    vscode.env.openExternal = originalOpenExternal;
    vscode.env.asExternalUri = originalAsExternalUri;
    vscode.workspace.getConfiguration = getConfigurationOriginal;
  });
}
