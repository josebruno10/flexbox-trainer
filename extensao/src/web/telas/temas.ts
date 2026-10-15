import * as vscode from "vscode";

// Cores de destaque da extensão. O resto (fundo, texto, bordas) vem do tema
// do VS Code; aqui ficam só o degradê, o botão principal e o destaque.
export type NomeTema =
  | "floresta"
  | "campus"
  | "oceano"
  | "noite"
  | "violeta"
  | "magenta"
  | "sol"
  | "grafite"
  | "vscode";

export type CoresTema = {
  nome: string;
  descricao: string;
  // Faixa do topo, título do login, barra da nota.
  degrade: string;
  // Fundo do botão principal: mais escuro, para o texto branco ficar legível
  // (contraste de pelo menos 4,5 em toda a faixa).
  degradeBotao: string;
  sobreBotao: string;
  // Pontos, bordas e sombras de destaque (contraste de pelo menos 3 nos temas
  // claro e escuro).
  acento: string;
  // Toques opcionais de uma segunda cor: a ponta da faixa do topo, os números
  // das seções e o círculo do avatar.
  ponta?: string;
  numero?: string;
  avatar?: string;
};

// O verde é a cor principal do projeto, como a do Instituto Federal.
export const TEMA_PADRAO: NomeTema = "floresta";

// Na ordem em que aparecem para escolher.
export const TEMAS: Record<NomeTema, CoresTema> = {
  floresta: {
    nome: "Floresta",
    descricao: "Verdes",
    degrade: "linear-gradient(100deg, #65a30d, #16a34a 45%, #059669)",
    degradeBotao: "linear-gradient(100deg, #4d7c0f, #15803d 50%, #047857)",
    sobreBotao: "#ffffff",
    acento: "#16a34a",
  },
  // Como a logo do IF: o verde nos blocos e o vermelho nos destaques, na
  // ponta da faixa, nos números das seções e no círculo do avatar.
  campus: {
    nome: "Campus",
    descricao: "Verde com toques de vermelho",
    degrade: "linear-gradient(100deg, #3fae4f, #2f9e41 45%, #218a3c)",
    degradeBotao: "linear-gradient(100deg, #24803a, #1f7a35 50%, #1a6d36)",
    sobreBotao: "#ffffff",
    acento: "#dc2626",
    ponta: "#dc2626",
    numero: "#dc2626",
    avatar: "#dc2626",
  },
  oceano: {
    nome: "Oceano",
    descricao: "Azul e verde-água",
    degrade: "linear-gradient(100deg, #0ea5e9, #0891b2 45%, #0d9488)",
    degradeBotao: "linear-gradient(100deg, #0369a1, #0e7490 50%, #0f766e)",
    sobreBotao: "#ffffff",
    acento: "#0891b2",
  },
  noite: {
    nome: "Noite",
    descricao: "Anil",
    degrade: "linear-gradient(100deg, #6366f1, #4f46e5 45%, #4338ca)",
    degradeBotao: "linear-gradient(100deg, #4338ca, #3730a3 50%, #312e81)",
    sobreBotao: "#ffffff",
    acento: "#6366f1",
  },
  violeta: {
    nome: "Violeta",
    descricao: "Roxo e lilás",
    degrade: "linear-gradient(100deg, #8b5cf6, #a855f7 45%, #d946ef)",
    degradeBotao: "linear-gradient(100deg, #6d28d9, #7e22ce 50%, #a21caf)",
    sobreBotao: "#ffffff",
    acento: "#a855f7",
  },
  magenta: {
    nome: "Magenta",
    descricao: "Magenta e laranja",
    degrade: "linear-gradient(100deg, #df18b1, #ec3370 45%, #f95720)",
    degradeBotao: "linear-gradient(100deg, #b5179e, #d6245e 50%, #c94010)",
    sobreBotao: "#ffffff",
    acento: "#f32f67",
  },
  sol: {
    nome: "Pôr do sol",
    descricao: "Amarelo, laranja e vermelho",
    degrade: "linear-gradient(100deg, #f59e0b, #f97316 45%, #ef4444)",
    degradeBotao: "linear-gradient(100deg, #b45309, #c2410c 50%, #b91c1c)",
    sobreBotao: "#ffffff",
    acento: "#ea580c",
  },
  grafite: {
    nome: "Grafite",
    descricao: "Cinzas, para quase nenhuma cor",
    degrade: "linear-gradient(100deg, #9ca3af, #6b7280 45%, #4b5563)",
    degradeBotao: "linear-gradient(100deg, #4b5563, #374151 50%, #1f2937)",
    sobreBotao: "#ffffff",
    acento: "#6b7280",
  },
  vscode: {
    nome: "Tema do VS Code",
    descricao: "A cor de destaque do tema que você usa no VS Code",
    degrade: "var(--vscode-button-background, #0078d4)",
    degradeBotao: "var(--vscode-button-background, #0078d4)",
    sobreBotao: "var(--vscode-button-foreground, #ffffff)",
    acento: "var(--vscode-focusBorder, #0078d4)",
  },
};

/** O conjunto escolhido nas configurações; um valor desconhecido vira o padrão. */
export function lerTemaCores(): NomeTema {
  const valor = vscode.workspace
    .getConfiguration("flexboxTrainer")
    .get<string>("temaCores", TEMA_PADRAO);
  return valor in TEMAS ? (valor as NomeTema) : TEMA_PADRAO;
}

export function variaveisDoTema(nome: NomeTema): string {
  const tema = TEMAS[nome] ?? TEMAS[TEMA_PADRAO];
  return `
      --degrade: ${tema.degrade};
      --degrade-botao: ${tema.degradeBotao};
      --sobre-botao: ${tema.sobreBotao};
      --acento: ${tema.acento};
      --ponta: ${tema.ponta ?? "transparent"};
      --numero: ${tema.numero ?? "var(--texto)"};
      --avatar: ${tema.avatar ?? "var(--degrade)"};`;
}

/** Deixa o aluno escolher um conjunto e grava nas configurações do usuário. */
export async function escolherTemaCores(): Promise<void> {
  const atual = lerTemaCores();
  const escolhido = await vscode.window.showQuickPick(
    (Object.keys(TEMAS) as NomeTema[]).map((nome) => ({
      label: `${nome === atual ? "$(check)" : "$(blank)"} ${TEMAS[nome].nome}`,
      description: nome === TEMA_PADRAO ? "padrão" : undefined,
      detail: TEMAS[nome].descricao,
      nome,
    })),
    {
      title: "Cores do FlexBox Trainer",
      placeHolder: "Muda só as cores de destaque; o resto segue o tema do VS Code",
    },
  );

  if (escolhido && escolhido.nome !== atual) {
    await vscode.workspace
      .getConfiguration("flexboxTrainer")
      .update("temaCores", escolhido.nome, vscode.ConfigurationTarget.Global);
  }
}
