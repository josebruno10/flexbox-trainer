declare function acquireVsCodeApi(): { postMessage(message: unknown): void; };

type EstadoAutenticacaoRecebido = {
  status: "checking" | "authenticated" | "unauthenticated" | "error";
  message?: string;
  displayName?: string;
  email?: string;
};

const vscode = acquireVsCodeApi();
const statusAutenticacao = document.getElementById("statusAutenticacao") as HTMLDivElement;
const botaoSair = document.getElementById("botaoSair") as HTMLButtonElement;

document.getElementById("botaoGitHub")?.addEventListener("click", () => {
  vscode.postMessage({ type: "loginGitHub" });
});

document.getElementById("botaoMicrosoft")?.addEventListener("click", () => {
  vscode.postMessage({ type: "loginMicrosoft" });
});

document.getElementById("botaoGoogle")?.addEventListener("click", () => {
  vscode.postMessage({ type: "loginGoogle" });
});

botaoSair.addEventListener("click", () => {
  vscode.postMessage({ type: "logout" });
});

window.addEventListener("message", (event: MessageEvent<{ type: string; payload: EstadoAutenticacaoRecebido }>) => {
  if (event.data.type !== "estadoAutenticacao") {
    return;
  }

  // O quadro só aparece quando há algo a dizer; sem sessão, os botões bastam.
  const estado = event.data.payload;
  const texto =
    estado.status === "checking"
      ? estado.message || "Validando a sessão…"
      : estado.status === "authenticated"
        ? `${estado.displayName || estado.email} conectado.`
        : estado.status === "error"
          ? estado.message || "Não foi possível validar a sessão."
          : estado.message || "";
  statusAutenticacao.textContent = texto;
  statusAutenticacao.hidden = !texto;
  // Só uma sessão que deu erro tem o que desconectar.
  botaoSair.hidden = estado.status !== "error";
});

vscode.postMessage({ type: "pronto" });
