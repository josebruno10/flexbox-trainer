declare function acquireVsCodeApi(): { postMessage(message: unknown): void; };

type EstadoAutenticacaoRecebido = {
  status: "checking" | "authenticated" | "unauthenticated" | "error";
  message?: string;
  displayName?: string;
  email?: string;
};

const vscode = acquireVsCodeApi();
const statusAutenticacao = document.getElementById("statusAutenticacao") as HTMLDivElement;

document.getElementById("botaoGoogle")?.addEventListener("click", () => {
  vscode.postMessage({ type: "loginGoogle" });
});

document.getElementById("botaoSair")?.addEventListener("click", () => {
  vscode.postMessage({ type: "logout" });
});

window.addEventListener("message", (event: MessageEvent<{ type: string; payload: EstadoAutenticacaoRecebido }>) => {
  if (event.data.type === "estadoAutenticacao") {
    if (!statusAutenticacao) {
      return;
    }
    const estado = event.data.payload;
    if (estado.status === "checking") {
      statusAutenticacao.textContent = estado.message || "Carregando...";
    } else if (estado.status === "authenticated") {
      statusAutenticacao.textContent = `${estado.displayName || estado.email} conectado.`;
    } else if (estado.status === "error") {
      statusAutenticacao.textContent = estado.message || "Erro.";
    } else {
      statusAutenticacao.textContent =
        estado.message || "Entre com sua conta Google para continuar.";
    }
  }
});

vscode.postMessage({ type: "pronto" });
