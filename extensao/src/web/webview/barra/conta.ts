import {
  avatarFallback,
  avatarUsuario,
  avisoIa,
  botaoNovoDesafio,
  cadastroTorneio,
  statusAutenticacao,
  textoAvisoIa,
} from "./elementos";
import type { EstadoAutenticacaoRecebido, ExtensaoIaRecebida } from "./tipos";

// A conta no topo da barra lateral e os avisos sobre ela.

export function renderizarEstadoAutenticacao(
  estado: EstadoAutenticacaoRecebido,
): void {
  if (!statusAutenticacao) {
    return;
  }

  cadastroTorneio.hidden = !(
    estado.status === "authenticated" && estado.podeCadastrar
  );

  if (estado.status === "checking") {
    statusAutenticacao.textContent = estado.message || "Validando a sessão…";
    return;
  }

  if (estado.status === "authenticated") {
    const nome = estado.displayName || estado.email || "Usuário";
    statusAutenticacao.innerHTML =
      `<strong>${escapeHtml(nome)}</strong>` +
      (estado.aviso
        ? `<span class="aviso-cadastro">${escapeHtml(estado.aviso)}</span>`
        : "");
    renderizarAvatar(nome, estado.avatarUrl);
    return;
  }

  if (estado.status === "error") {
    statusAutenticacao.textContent =
      estado.message || "Não foi possível validar a sessão.";
    return;
  }

  statusAutenticacao.textContent =
    estado.message ||
    "Entre para usar a extensão.";
}

export function renderizarExtensoesIa(extensoes: ExtensaoIaRecebida[]): void {
  const nomes = extensoes.map((extensao) => extensao.nome);
  avisoIa.hidden = nomes.length === 0;
  textoAvisoIa.textContent =
    `${nomes.join(", ")}. Desabilite e reinicie as extensões para treinar.`;
  // A extensão também recusa; o botão desligado só deixa isso claro.
  botaoNovoDesafio.disabled = nomes.length > 0;
  botaoNovoDesafio.title =
    nomes.length > 0 ? "Desabilite as extensões de IA." : "";
}

function renderizarAvatar(nome: string, avatarUrl?: string): void {
  avatarFallback.textContent = nome.trim().charAt(0).toUpperCase() || "U";
  avatarFallback.hidden = false;
  avatarUsuario.hidden = true;
  avatarUsuario.removeAttribute("src");

  if (!avatarUrl || !ehUrlAvatarPermitida(avatarUrl)) {
    return;
  }

  avatarUsuario.onload = () => {
    avatarUsuario.hidden = false;
    avatarFallback.hidden = true;
  };
  avatarUsuario.onerror = () => {
    avatarUsuario.hidden = true;
    avatarFallback.hidden = false;
  };
  avatarUsuario.src = avatarUrl;
}

function ehUrlAvatarPermitida(url: string): boolean {
  return /^https?:\/\//i.test(url) || /^data:image\//i.test(url);
}

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
