import * as vscode from "vscode";
import { NOME_DO_NIVEL } from "../niveis";
import { Nivel } from "../types";
import { formatarCodigo } from "./codigoDesafio";

// Os relatos de problema vão para o formulário de issue do GitHub
// (.github/ISSUE_TEMPLATE/problema.yml). Os campos são preenchidos pelo endereço: cada
// parâmetro tem o id de um campo do formulário.
const NOVA_ISSUE = "https://github.com/josebruno10/flexbox-trainer/issues/new";

export type Ambiente = {
  versao: string;
  vscode: string;
  sistema: string;
  desafio?: { codigo: string; nivel?: Nivel };
  // A mensagem do erro, quando o relato sai dele.
  mensagem?: string;
};

// Um erro longo do servidor não cabe bem num endereço; o começo basta.
const TAMANHO_MAXIMO_MENSAGEM = 1000;

/** O formulário de problema, já com a versão, o sistema e o desafio. */
export function enderecoDoProblema(ambiente: Ambiente): string {
  return novaIssue({
    template: "problema.yml",
    versao: ambiente.versao,
    vscode: ambiente.vscode,
    sistema: ambiente.sistema,
    ...(ambiente.desafio ? { codigo: descreverDesafio(ambiente.desafio) } : {}),
    ...(ambiente.mensagem
      ? { mensagem: ambiente.mensagem.slice(0, TAMANHO_MAXIMO_MENSAGEM) }
      : {}),
  });
}

/** As mesmas informações, para colar numa mensagem à equipe. */
export function textoDoAmbiente(ambiente: Ambiente): string {
  return [
    `FlexBox Trainer ${ambiente.versao}`,
    `VS Code ${ambiente.vscode}`,
    ambiente.sistema,
    ...(ambiente.desafio ? [`desafio ${descreverDesafio(ambiente.desafio)}`] : []),
  ].join(" · ") + (ambiente.mensagem ? `\n${comoErro(ambiente.mensagem)}` : "");
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

// A mensagem da barra lateral já pode começar com "Erro:".
function comoErro(mensagem: string): string {
  return /^erro\b/i.test(mensagem) ? mensagem : `Erro: ${mensagem}`;
}

// Espaços viram %20, e não "+", que nem todo leitor de endereço desfaz.
function novaIssue(parametros: Record<string, string>): string {
  const consulta = Object.entries(parametros)
    .map(
      ([nome, valor]) =>
        `${encodeURIComponent(nome)}=${encodeURIComponent(valor)}`,
    )
    .join("&");
  return `${NOVA_ISSUE}?${consulta}`;
}

function descreverDesafio(desafio: { codigo: string; nivel?: Nivel }): string {
  return (
    formatarCodigo(desafio.codigo) +
    (desafio.nivel ? ` (${NOME_DO_NIVEL[desafio.nivel]})` : "")
  );
}
