import * as vscode from "vscode";
import { NOME_DO_NIVEL } from "../niveis";
import { Nivel } from "../types";
import { formatarCodigo } from "./codigoDesafio";

// Relatos de problema e opiniões vão para os formulários de issue do GitHub
// (.github/ISSUE_TEMPLATE). Os campos são preenchidos pelo endereço: cada
// parâmetro tem o id de um campo do formulário.
const NOVA_ISSUE = "https://github.com/josebruno10/flexbox-trainer/issues/new";

export type Ambiente = {
  versao: string;
  vscode: string;
  sistema: string;
  desafio?: { codigo: string; nivel?: Nivel };
};

/** O formulário de problema, já com a versão, o sistema e o desafio. */
export function enderecoDoProblema(ambiente: Ambiente): string {
  const parametros = new URLSearchParams({
    template: "problema.yml",
    versao: ambiente.versao,
    vscode: ambiente.vscode,
    sistema: ambiente.sistema,
  });
  if (ambiente.desafio) {
    parametros.set("codigo", descreverDesafio(ambiente.desafio));
  }
  return `${NOVA_ISSUE}?${parametros}`;
}

/** O questionário de opinião, já com a versão. */
export function enderecoDaOpiniao(versao: string): string {
  const parametros = new URLSearchParams({ template: "opiniao.yml", versao });
  return `${NOVA_ISSUE}?${parametros}`;
}

/** As mesmas informações, para colar numa mensagem à equipe. */
export function textoDoAmbiente(ambiente: Ambiente): string {
  return [
    `FlexBox Trainer ${ambiente.versao}`,
    `VS Code ${ambiente.vscode}`,
    ambiente.sistema,
    ...(ambiente.desafio ? [`desafio ${descreverDesafio(ambiente.desafio)}`] : []),
  ].join(" · ");
}

/**
 * Abre o formulário de problema no GitHub ou, para quem não tem conta lá,
 * copia as informações para mandar à equipe.
 */
export async function relatarProblema(ambiente: Ambiente): Promise<void> {
  const escolha = await vscode.window.showQuickPick(
    [
      {
        label: "$(github) Abrir o formulário no GitHub",
        detail: "Precisa de uma conta no GitHub. A versão e o sistema já vão preenchidos.",
        abrir: true,
      },
      {
        label: "$(copy) Copiar as informações",
        detail: "Para colar numa mensagem à equipe, junto com o que aconteceu.",
        abrir: false,
      },
    ],
    { title: "Relatar um problema", placeHolder: "Como você prefere avisar?" },
  );
  if (!escolha) {
    return;
  }
  if (escolha.abrir) {
    await vscode.env.openExternal(vscode.Uri.parse(enderecoDoProblema(ambiente)));
    return;
  }
  await vscode.env.clipboard.writeText(textoDoAmbiente(ambiente));
  vscode.window.setStatusBarMessage(
    "Informações copiadas. Conte também o que aconteceu.",
    4000,
  );
}

export async function darOpiniao(versao: string): Promise<void> {
  await vscode.env.openExternal(vscode.Uri.parse(enderecoDaOpiniao(versao)));
}

/** O sistema deste computador; no VS Code pelo navegador, "navegador". */
export function sistemaOperacional(): string {
  return nomeDoSistema(
    typeof process === "undefined" ? undefined : process.platform,
  );
}

/** "Linux", "Windows" ou "macOS"; sem plataforma, "navegador". */
export function nomeDoSistema(plataforma: string | undefined): string {
  const nomes: Record<string, string> = {
    linux: "Linux",
    win32: "Windows",
    darwin: "macOS",
  };
  return (plataforma && nomes[plataforma]) || plataforma || "navegador";
}

function descreverDesafio(desafio: { codigo: string; nivel?: Nivel }): string {
  return (
    formatarCodigo(desafio.codigo) +
    (desafio.nivel ? ` (${NOME_DO_NIVEL[desafio.nivel]})` : "")
  );
}
