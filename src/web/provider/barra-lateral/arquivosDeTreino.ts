import * as vscode from "vscode";
import { criarArquivosDeTreino } from "../../services/workspace";

const ABRIR_PASTA = "Abrir pasta";
const LIMPAR_E_GERAR = "Limpar e gerar";

/** Pergunta antes de apagar o que o aluno escreveu para o desafio novo. */
export async function confirmarLimpeza(): Promise<boolean> {
  const escolha = await vscode.window.showWarningMessage(
    "Gerar um desafio novo apaga o que você escreveu em index.html e style.css.",
    {
      modal: true,
      detail:
        "Como no torneio, cada desafio começa do zero: ficam só o HTML " +
        "básico e o reset do CSS (box-sizing, margin e padding). Assim o " +
        "tempo conta o desafio inteiro.",
    },
    LIMPAR_E_GERAR,
  );
  return escolha === LIMPAR_E_GERAR;
}

/**
 * Cria na pasta aberta o index.html e o style.css que faltarem, abre os
 * criados e avisa o que aconteceu. Devolve se criou algum.
 */
export async function criarArquivosComAviso(
  largura: number,
  altura: number,
  avisarSeExistirem: boolean,
): Promise<boolean> {
  const resultado = await criarArquivosDeTreino(largura, altura);

  if (resultado.status === "sem-pasta") {
    // Não espera a resposta: a notificação pode ficar aberta.
    void vscode.window
      .showInformationMessage(
        "Abra uma pasta para criar index.html e style.css.",
        ABRIR_PASTA,
      )
      .then((escolha) => {
        if (escolha === ABRIR_PASTA) {
          void vscode.commands.executeCommand("workbench.action.files.openFolder");
        }
      });
    return false;
  }

  if (resultado.status === "ja-existiam") {
    if (avisarSeExistirem) {
      void vscode.window.showInformationMessage(
        "index.html e style.css já existem nesta pasta.",
      );
    }
    return false;
  }

  // O index.html fica em primeiro plano, com o style.css na aba ao lado.
  const ordenados = [...resultado.arquivos].sort((a, b) =>
    a.path.endsWith("index.html") ? 1 : b.path.endsWith("index.html") ? -1 : 0,
  );
  for (const arquivo of ordenados) {
    await vscode.window.showTextDocument(arquivo, { preview: false });
  }
  const nomes = resultado.arquivos.map((arquivo) => arquivo.path.split("/").pop());
  void vscode.window.showInformationMessage(
    `${nomes.join(" e ")} ${nomes.length === 1 ? "criado" : "criados"}.`,
  );
  return true;
}
