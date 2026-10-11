import * as assert from "assert";
import type * as vscode from "vscode";
import { encontrarExtensoesIa } from "../../services/extensoesIa";

function extensao(
  id: string,
  pacote: Record<string, unknown>,
): vscode.Extension<unknown> {
  return {
    id,
    packageJSON: { main: "./extension.js", ...pacote },
  } as unknown as vscode.Extension<unknown>;
}

suite("Detecção de extensões de IA", () => {
  test("acha as de IA pelo ID, pela categoria e pelo nome", () => {
    const encontradas = encontrarExtensoesIa([
      // O Copilot embutido no VS Code usa este ID, com outra caixa.
      extensao("GitHub.copilot-chat", { displayName: "GitHub Copilot" }),
      extensao("anthropic.claude-code", { displayName: "Claude Code" }),
      extensao("teste.assistente", { displayName: "Assistente", categories: ["AI"] }),
      extensao("teste.conversa", { displayName: "Conversa", categories: ["Chat"] }),
      extensao("teste.outro", { displayName: "Meu Tabnine Turbo" }),
      extensao("esbenp.prettier-vscode", {
        displayName: "Prettier",
        categories: ["Formatters"],
      }),
    ]);

    assert.deepStrictEqual(
      encontradas.map((item) => item.id),
      [
        "teste.assistente",
        "anthropic.claude-code",
        "teste.conversa",
        "GitHub.copilot-chat",
        "teste.outro",
      ],
    );
  });

  test("ignora extensões sem código, esta extensão e nomes traduzidos sem pista", () => {
    const encontradas = encontrarExtensoesIa([
      // Embutida no VS Code: só declara recursos de chat, nunca roda.
      extensao("TypeScriptTeam.jsts-chat-features", {
        displayName: "JS/TS Chat Features",
        categories: ["AI"],
        main: undefined,
      }),
      extensao("josebruno10.flexbox-trainer", { categories: ["AI"] }),
      extensao("openai.chatgpt", { displayName: "%displayName%" }),
    ]);

    assert.deepStrictEqual(encontradas, [
      { id: "openai.chatgpt", nome: "openai.chatgpt" },
    ]);
  });
});
