declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

type EstadoAutenticacaoRecebido = {
  status: "checking" | "authenticated" | "unauthenticated" | "error";
  message?: string;
  displayName?: string;
  email?: string;
};

type MensagemDaExtensao = {
  type: "estadoAutenticacao";
  payload: EstadoAutenticacaoRecebido;
};

const vscode = acquireVsCodeApi();

const statusAutenticacao = document.getElementById("statusAutenticacao") as HTMLDivElement;
const botaoCriarConta = document.getElementById("botaoCriarConta");
const botaoFazerLogin = document.getElementById("botaoFazerLogin");
const botaoRevalidar = document.getElementById("botaoRevalidar");
const botaoSair = document.getElementById("botaoSair");

// Novos Botões do VS Code
const botaoGitHub = document.getElementById("botaoGitHub");
const botaoMicrosoft = document.getElementById("botaoMicrosoft");

botaoGitHub?.addEventListener("click", () => {
  vscode.postMessage({ type: "loginGitHub" });
});

botaoMicrosoft?.addEventListener("click", () => {
  vscode.postMessage({ type: "loginMicrosoft" });
});

botaoCriarConta?.addEventListener("click", () => {
  vscode.postMessage({ type: "abrirCadastro" });
});

botaoFazerLogin?.addEventListener("click", () => {
  vscode.postMessage({ type: "abrirLogin" });
});

botaoRevalidar?.addEventListener("click", () => {
  vscode.postMessage({ type: "revalidarSessao" });
});

botaoSair?.addEventListener("click", () => {
  vscode.postMessage({ type: "logout" });
});

window.addEventListener("message", (event: MessageEvent<MensagemDaExtensao>) => {
  if (event.data.type === "estadoAutenticacao") {
    renderizarEstadoAutenticacao(event.data.payload);
  }
});

function renderizarEstadoAutenticacao(estado: EstadoAutenticacaoRecebido): void {
  if (!statusAutenticacao) return;

  if (estado.status === "checking") {
    statusAutenticacao.textContent = estado.message || "Aguardando ação...";
    return;
  }
  if (estado.status === "authenticated") {
    const nome = estado.displayName || estado.email || "Usuário";
    statusAutenticacao.textContent = `${nome} autenticado. Você já pode usar a extensão.`;
    return;
  }
  if (estado.status === "error") {
    statusAutenticacao.textContent = estado.message || "Erro na autenticação.";
    return;
  }
  statusAutenticacao.textContent = estado.message || "Faça login para usar esta extensão.";
}

vscode.postMessage({ type: "pronto" });