import * as vscode from "vscode";

export type ExtensaoIa = {
  id: string;
  nome: string;
};

// Lista da extensão oficial do torneio, mais assistentes que vieram depois.
const IDS_IA = new Set([
  "github.copilot",
  "github.copilot-chat",
  "continue.continue",
  "codeium.codeium",
  "tabnine.tabnine-vscode",
  "sourcegraph.cody-ai",
  "saoudrizwan.claude-dev",
  "rooveterinaryinc.roo-cline",
  "augment.vscode-augment",
  "amazonwebservices.amazon-q-vscode",
  "blackboxapp.blackbox",
  "blackboxapp.blackboxagent",
  "visualstudioexptteam.vscodeintellicode",
  "anthropic.claude-code",
  "openai.chatgpt",
  "google.geminicodeassist",
  "google.gemini-cli-vscode-ide-companion",
  "supermaven.supermaven",
  "kilocode.kilo-code",
  "qodo.qodo-gen",
  "codium.codium",
  "danielsanmedium.dscodegpt",
  "bito.bito",
  "sourcegraph.amp",
]);

// Categorias do Marketplace para assistentes de IA.
const CATEGORIAS_IA = new Set(["ai", "chat"]);

const NOMES_IA = ["copilot", "codeium", "tabnine", "claude", "chatgpt", "gemini", "cody"];

const ID_DESTA_EXTENSAO = "josebruno10.flexbox-trainer";

/**
 * Extensões de IA habilitadas. Cada host do VS Code só enxerga as próprias
 * extensões; no desktop, a detecção depende de esta extensão rodar no host
 * Node, onde ficam as de IA.
 */
export function encontrarExtensoesIa(
  extensoes: readonly vscode.Extension<unknown>[] = vscode.extensions.all,
): ExtensaoIa[] {
  return extensoes
    .filter(ehExtensaoIa)
    .map((extensao) => ({ id: extensao.id, nome: nomeDaExtensao(extensao) }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

/**
 * Abre a página da extensão, onde dá para desabilitá-la; com várias, deixa
 * escolher qual abrir.
 */
export async function abrirExtensoesIa(lista: ExtensaoIa[]): Promise<void> {
  if (lista.length === 0) {
    void vscode.window.showInformationMessage(
      "Nenhuma extensão de IA habilitada.",
    );
    return;
  }

  const escolhida =
    lista.length === 1
      ? lista[0]
      : await vscode.window.showQuickPick(
          lista.map((extensao) => ({
            label: extensao.nome,
            description: extensao.id,
            extensao,
          })),
          {
            title: "Extensões de IA habilitadas",
            placeHolder: "Escolha uma para abrir e desabilitar",
          },
        ).then((item) => item?.extensao);

  if (escolhida) {
    await vscode.commands.executeCommand("extension.open", escolhida.id);
  }
}

function ehExtensaoIa(extensao: vscode.Extension<unknown>): boolean {
  const pacote = (extensao.packageJSON ?? {}) as Record<string, unknown>;
  const id = extensao.id.toLowerCase();

  // Sem código, a extensão só declara recursos e nunca roda (como a
  // "JS/TS Chat Features" embutida no VS Code).
  if (id === ID_DESTA_EXTENSAO || (!pacote.main && !pacote.browser)) {
    return false;
  }

  const categorias = Array.isArray(pacote.categories)
    ? pacote.categories.map((categoria) => String(categoria).toLowerCase())
    : [];
  const nome = nomeDaExtensao(extensao).toLowerCase();

  return (
    IDS_IA.has(id) ||
    categorias.some((categoria) => CATEGORIAS_IA.has(categoria)) ||
    NOMES_IA.some((trecho) => nome.includes(trecho))
  );
}

function nomeDaExtensao(extensao: vscode.Extension<unknown>): string {
  const pacote = (extensao.packageJSON ?? {}) as Record<string, unknown>;
  const nome = String(pacote.displayName ?? pacote.name ?? "");
  // Nomes traduzidos chegam como "%displayName%"; aí vale o ID.
  return nome && !nome.startsWith("%") ? nome : extensao.id;
}
