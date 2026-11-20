import * as vscode from "vscode";
import type { CopiaDeSeguranca } from "../../services/copiasDeSeguranca";

// A escolha da cópia de segurança a restaurar (veja
// services/copiasDeSeguranca.ts).

export async function escolherCopia(
  copias: CopiaDeSeguranca[],
  agora = new Date(),
): Promise<CopiaDeSeguranca | undefined> {
  if (copias.length === 0) {
    void vscode.window.showInformationMessage(
      "Ainda não há cópias de segurança. Elas são feitas sozinhas quando um " +
        "desafio novo, o Continuar ou uma restauração substitui o que você " +
        "escreveu em index.html e style.css.",
    );
    return undefined;
  }

  const escolha = await vscode.window.showQuickPick(
    copias.map((copia) => ({
      label: copia.codigo ? `Desafio ${copia.codigo}` : "Sem desafio aberto",
      description: descreverQuando(copia.quando, agora),
      detail: `${contarLinhas(copia.html)} de HTML · ${contarLinhas(copia.css)} de CSS`,
      copia,
    })),
    {
      title: "Restaurar cópia de segurança",
      placeHolder:
        "A cópia volta para index.html e style.css, com o desafio dela; os " +
        "arquivos de agora também ficam guardados.",
      matchOnDescription: true,
    },
  );
  return escolha?.copia;
}

/** "hoje às 14:32", "ontem às 09:05" ou "18/11 às 16:40". */
export function descreverQuando(quando: number, agora = new Date()): string {
  const data = new Date(quando);
  const hora = data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diasAtras = Math.round((dia(agora) - dia(data)) / 86_400_000);
  if (diasAtras === 0) {
    return `hoje às ${hora}`;
  }
  if (diasAtras === 1) {
    return `ontem às ${hora}`;
  }
  const diaMes = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${diaMes} às ${hora}`;
}

function contarLinhas(texto: string): string {
  const linhas = texto.split("\n").filter((linha) => linha.trim()).length;
  return linhas === 1 ? "1 linha" : `${linhas} linhas`;
}
