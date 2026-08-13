const params = new URLSearchParams(window.location.search);
const callbackUrl = params.get("callback") || "";
const state = params.get("state") || "";
const clientId = params.get("clientId") || "";
const flowVersion = params.get("flowVersion") || "";
const AUTH_FLOW_VERSION = "2";

const notice = document.getElementById("notice");
const statusBox = document.getElementById("status");
const googleButton = document.getElementById("googleButton");
const googleScript = document.querySelector(
  'script[src="https://accounts.google.com/gsi/client"]',
);
let tentativasGoogle = 0;
const MAX_TENTATIVAS_GOOGLE = 100;
const CALLBACK_PROTOCOLS = new Set(["vscode:", "vscode-insiders:"]);
const CALLBACK_HOSTS = new Set([
  "josebruno10.flexbox-trainer",
  "undefined_publisher.flexbox-trainer",
]);

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", Boolean(isError));
}

function validarParametros() {
  if (!callbackUrl) {
    throw new Error(
      "Callback da extensão não informado. Inicie o login pelo VS Code.",
    );
  }

  if (!state) {
    throw new Error("Estado de segurança ausente. Inicie o login novamente.");
  }

  if (!clientId) {
    throw new Error("Client ID do Google não configurado na extensão.");
  }

  if (flowVersion !== AUTH_FLOW_VERSION) {
    throw new Error(
      "Versão do fluxo de autenticação incompatível. Atualize a extensão e tente novamente.",
    );
  }

  const callback = new URL(callbackUrl);

  if (
    !CALLBACK_PROTOCOLS.has(callback.protocol) ||
    !CALLBACK_HOSTS.has(callback.host) ||
    callback.pathname !== "/auth/callback"
  ) {
    throw new Error("Callback da extensão não reconhecido.");
  }
}

function redirecionarParaExtensao(googleToken) {
  const url = new URL(callbackUrl);
  const fragmento = new URLSearchParams({
    state,
    google_token: googleToken,
    remember: "1",
  });

  // O fragmento evita registrar a credencial Google em query strings do
  // servidor web. A extensão a troca imediatamente por um token próprio da API.
  url.hash = fragmento.toString();
  window.location.replace(url.toString());
}

function inicializarGoogle() {
  try {
    validarParametros();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Parâmetros inválidos.", true);
    return;
  }

  if (!window.google?.accounts?.id) {
    tentativasGoogle += 1;

    if (tentativasGoogle >= MAX_TENTATIVAS_GOOGLE) {
      setStatus(
        "O autenticador do Google não carregou em 10 segundos. Verifique a conexão e recarregue a página.",
        true,
      );
      return;
    }

    window.setTimeout(inicializarGoogle, 100);
    return;
  }

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      const credential = String(response?.credential || "").trim();

      if (!credential) {
        setStatus("O Google não devolveu uma credencial válida.", true);
        return;
      }

      setStatus("Login concluído. Voltando ao VS Code...");
      redirecionarParaExtensao(credential);
    },
  });
  window.google.accounts.id.renderButton(googleButton, {
    type: "standard",
    theme: "filled_black",
    size: "large",
    text: "signin_with",
    shape: "pill",
    width: 280,
  });
  setStatus("Pronto. Entre com sua conta Google.");
}

notice.textContent =
  "A credencial Google será validada pela API do torneio e não ficará armazenada no site.";
googleScript?.addEventListener("error", () => {
  tentativasGoogle = MAX_TENTATIVAS_GOOGLE;
  setStatus("Não foi possível carregar o autenticador do Google.", true);
});
inicializarGoogle();
