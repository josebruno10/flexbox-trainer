import * as vscode from "vscode";
import { DadosCadastro, OpcoesCadastro } from "./cadastroTorneio";

// Os mesmos códigos de período que o torneio usa no cadastro.
const PERIODOS = [
  { cod: 0, nome: "Matutino" },
  { cod: 1, nome: "Vespertino" },
  { cod: 2, nome: "Noturno" },
  { cod: 3, nome: "Integral" },
];

const TOTAL_PASSOS = 5;

/** Pede os dados do cadastro, um por caixa; undefined se o aluno cancelar. */
export async function pedirDadosCadastro(
  email: string,
  nomeSugerido: string,
  opcoes: OpcoesCadastro,
): Promise<DadosCadastro | undefined> {
  const titulo = (passo: number) =>
    `Cadastro no torneio: ${email} (${passo}/${TOTAL_PASSOS})`;

  const nome = (
    await vscode.window.showInputBox({
      title: titulo(1),
      prompt: "Nome completo",
      value: nomeSugerido,
      ignoreFocusOut: true,
      validateInput: (valor) =>
        valor.trim().length >= 3 ? undefined : "Digite o seu nome.",
    })
  )?.trim();
  if (!nome) {
    return undefined;
  }

  const anoAtual = new Date().getFullYear();
  const ano = await vscode.window.showInputBox({
    title: titulo(2),
    prompt: "Ano de ingresso no curso",
    value: String(anoAtual),
    ignoreFocusOut: true,
    validateInput: (valor) => {
      const numero = Number(valor.trim());
      return Number.isInteger(numero) && numero >= 2000 && numero <= anoAtual
        ? undefined
        : `Digite um ano entre 2000 e ${anoAtual}.`;
    },
  });
  if (!ano) {
    return undefined;
  }

  const periodo = await escolher(
    titulo(3),
    "Período",
    PERIODOS.map((item) => ({ label: item.nome, valor: item.cod })),
  );
  if (periodo === undefined) {
    return undefined;
  }

  if (opcoes.sedes.length === 0) {
    void vscode.window.showErrorMessage(
      "O servidor não listou as sedes do torneio. Tente de novo mais tarde.",
    );
    return undefined;
  }
  const sede = await escolher(
    titulo(4),
    "Sede",
    opcoes.sedes.map((item) => ({ label: item.nome, valor: item.id })),
  );
  if (sede === undefined) {
    return undefined;
  }

  const nivel = await escolher(
    titulo(5),
    "Nível",
    opcoes.niveis.map((item) => ({ label: item.nome, valor: item.cod })),
  );
  if (nivel === undefined) {
    return undefined;
  }

  return { nome, turma: Number(ano.trim()), periodo, sede, nivel };
}

async function escolher(
  title: string,
  placeHolder: string,
  itens: { label: string; valor: number }[],
): Promise<number | undefined> {
  const escolhido = await vscode.window.showQuickPick(itens, {
    title,
    placeHolder,
    ignoreFocusOut: true,
  });
  return escolhido?.valor;
}
