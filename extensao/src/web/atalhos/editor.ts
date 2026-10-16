import type { Plataforma } from "./plataforma";

// Atalhos do próprio VS Code que mais ajudam a escrever HTML e CSS. As teclas
// são as padrão de cada sistema (conferidas no VS Code 1.142).
export type AtalhoDoEditor = {
  teclas: Record<Plataforma, string>;
  acao: string;
};

const iguais = (teclas: string, mac: string): Record<Plataforma, string> => ({
  windows: teclas,
  linux: teclas,
  mac,
});

export const ATALHOS_DO_EDITOR: readonly AtalhoDoEditor[] = [
  { teclas: iguais("Ctrl+Espaço", "⌃Espaço"), acao: "mostra as sugestões" },
  {
    teclas: iguais("Ctrl+D", "⌘D"),
    acao: "seleciona a próxima vez que a palavra aparece, para editar as duas juntas",
  },
  {
    teclas: iguais("Ctrl+Shift+L", "⇧⌘L"),
    acao: "seleciona todas as vezes que a palavra aparece",
  },
  { teclas: iguais("Alt+clique", "⌥+clique"), acao: "põe mais um cursor" },
  { teclas: iguais("Alt+↑ / Alt+↓", "⌥↑ / ⌥↓"), acao: "move a linha para cima ou para baixo" },
  {
    teclas: { windows: "Shift+Alt+↓", linux: "Ctrl+Shift+Alt+↓", mac: "⇧⌥↓" },
    acao: "copia a linha para baixo",
  },
  { teclas: iguais("Ctrl+Shift+K", "⇧⌘K"), acao: "apaga a linha" },
  {
    teclas: iguais("Ctrl+Enter", "⌘Enter"),
    acao: "abre uma linha nova embaixo, de qualquer ponto da linha",
  },
  { teclas: iguais("Ctrl+/", "⌘/"), acao: "comenta ou descomenta a linha" },
  {
    teclas: { windows: "Shift+Alt+F", linux: "Ctrl+Shift+I", mac: "⇧⌥F" },
    acao: "formata o arquivo e arruma a indentação",
  },
];
