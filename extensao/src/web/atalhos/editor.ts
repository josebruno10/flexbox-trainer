import type { Plataforma } from "./plataforma";

// Atalhos do próprio VS Code que mais ajudam a escrever HTML e CSS. As teclas
// são as padrão de cada sistema. As da primeira lista foram conferidas no
// VS Code 1.142; as que entraram depois (as que o Vitor passou e as de
// cursores, de seleção e de arquivos) seguem a lista de atalhos padrão do
// VS Code e ainda pedem um teste em cada sistema.
export type AtalhoDoEditor = {
  teclas: Record<Plataforma, string>;
  acao: string;
};

export type GrupoDoEditor = {
  nome: string;
  atalhos: readonly AtalhoDoEditor[];
};

const iguais = (teclas: string, mac: string): Record<Plataforma, string> => ({
  windows: teclas,
  linux: teclas,
  mac,
});

export const GRUPOS_DO_EDITOR: readonly GrupoDoEditor[] = [
  {
    nome: "Vários cursores",
    atalhos: [
      {
        teclas: iguais("Ctrl+D", "⌘D"),
        acao: "seleciona a próxima vez que a palavra aparece, para editar as duas juntas",
      },
      {
        teclas: iguais("Ctrl+Shift+L", "⇧⌘L"),
        acao: "seleciona todas as vezes que a palavra aparece",
      },
      { teclas: iguais("Alt+clique", "⌥+clique"), acao: "põe mais um cursor" },
      {
        teclas: {
          windows: "Ctrl+Alt+↑ / Ctrl+Alt+↓",
          linux: "Shift+Alt+↑ / Shift+Alt+↓",
          mac: "⌥⌘↑ / ⌥⌘↓",
        },
        acao: "põe mais um cursor na linha de cima ou na de baixo",
      },
      { teclas: iguais("Ctrl+U", "⌘U"), acao: "desfaz o último cursor posto" },
    ],
  },
  {
    nome: "Andar e selecionar",
    atalhos: [
      {
        teclas: iguais("Ctrl+← / Ctrl+→", "⌥← / ⌥→"),
        acao: "anda uma palavra inteira para a esquerda ou para a direita",
      },
      {
        teclas: iguais("Ctrl+Shift+← / Ctrl+Shift+→", "⇧⌥← / ⇧⌥→"),
        acao: "seleciona de palavra em palavra",
      },
      {
        teclas: {
          windows: "Shift+Alt+→ / Shift+Alt+←",
          linux: "Shift+Alt+→ / Shift+Alt+←",
          mac: "⌃⇧⌘→ / ⌃⇧⌘←",
        },
        acao: "aumenta ou diminui a seleção: a palavra, o valor, a regra inteira",
      },
      { teclas: iguais("Ctrl+L", "⌘L"), acao: "seleciona a linha inteira" },
    ],
  },
  {
    nome: "Linhas",
    atalhos: [
      { teclas: iguais("Alt+↑ / Alt+↓", "⌥↑ / ⌥↓"), acao: "move a linha para cima ou para baixo" },
      {
        teclas: {
          windows: "Shift+Alt+↑ / Shift+Alt+↓",
          linux: "Ctrl+Shift+Alt+↑ / Ctrl+Shift+Alt+↓",
          mac: "⇧⌥↑ / ⇧⌥↓",
        },
        acao: "copia a linha para cima ou para baixo",
      },
      { teclas: iguais("Ctrl+Shift+K", "⇧⌘K"), acao: "apaga a linha" },
      {
        teclas: iguais("Ctrl+X", "⌘X"),
        acao: "sem nada selecionado, recorta a linha inteira",
      },
      {
        teclas: iguais("Ctrl+Enter", "⌘Enter"),
        acao: "abre uma linha nova embaixo, de qualquer ponto da linha",
      },
      {
        teclas: iguais("Ctrl+Shift+Enter", "⇧⌘Enter"),
        acao: "abre uma linha nova em cima",
      },
      { teclas: iguais("Ctrl+] / Ctrl+[", "⌘] / ⌘["), acao: "aumenta ou diminui o recuo da linha" },
      { teclas: iguais("Ctrl+/", "⌘/"), acao: "comenta ou descomenta a linha" },
    ],
  },
  {
    nome: "Desfazer e arrumar",
    atalhos: [
      { teclas: iguais("Ctrl+Z", "⌘Z"), acao: "desfaz a última mudança" },
      {
        teclas: { windows: "Ctrl+Y", linux: "Ctrl+Shift+Z", mac: "⇧⌘Z" },
        acao: "refaz o que foi desfeito",
      },
      { teclas: iguais("Ctrl+Espaço", "⌃Espaço"), acao: "mostra as sugestões" },
      {
        teclas: { windows: "Shift+Alt+F", linux: "Ctrl+Shift+I", mac: "⇧⌥F" },
        acao: "formata o arquivo e arruma a indentação",
      },
    ],
  },
  {
    nome: "Arquivos",
    atalhos: [
      {
        teclas: iguais("Ctrl+Tab", "⌃Tab"),
        acao: "troca de aba: do index.html para o style.css e de volta",
      },
      {
        teclas: iguais("Ctrl+\\", "⌘\\"),
        acao: "divide o editor, para ver o index.html e o style.css lado a lado",
      },
      {
        teclas: iguais("Ctrl+1 / Ctrl+2", "⌘1 / ⌘2"),
        acao: "vai para o lado esquerdo ou o direito do editor dividido",
      },
      { teclas: iguais("Ctrl+P", "⌘P"), acao: "abre um arquivo pelo nome" },
    ],
  },
];

/** Os atalhos do editor, na ordem dos grupos. */
export const ATALHOS_DO_EDITOR: readonly AtalhoDoEditor[] = GRUPOS_DO_EDITOR.flatMap(
  (grupo) => grupo.atalhos,
);
