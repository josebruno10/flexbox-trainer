import * as vscode from "vscode";
import type { CopiaDeSeguranca } from "../../services/copiasDeSeguranca";
import { criarDesafioPorCodigo } from "../../services/desafio";
import { log } from "../../services/logger";
import { ConteudoDoAluno } from "../../services/servidor/conteudo";
import { temTrabalhoDoAluno } from "../../services/workspace";
import { Desafio, ResumoWorkspace } from "../../types";
import { confirmarLimpeza } from "./arquivosDeTreino";
import { escolherCopia } from "./copias";
import { ContextoDaEscolha, escolherDesafio } from "./tamanhoLivre";

// Começar um desafio: o novo, o de um código, o continuado do servidor ou o
// de uma cópia de segurança. Como no torneio, cada desafio começa do zero: o
// que o aluno escreveu no anterior não é reaproveitado nem fica fora do
// tempo, e vai antes para uma cópia de segurança.

/** O que o começo do desafio lê e muda no provedor da barra lateral. */
export type ContextoDoInicio = {
  escolha: ContextoDaEscolha;
  lerArquivos(): Promise<ResumoWorkspace>;
  limparArquivos(): Promise<void>;
  escreverArquivos(conteudo: ConteudoDoAluno): Promise<void>;
  guardarCopia(arquivos: ResumoWorkspace): Promise<void>;
  // O desafio passa a ser o da barra lateral e da aba, ainda sem relógio.
  mostrar(desafio: Desafio): void;
  // Com os arquivos prontos, o tempo começa.
  iniciarRelogio(): void;
};

/**
 * Sem código, sorteia um desafio; com código, abre exatamente aquele. Com o
 * conteúdo retomado (do servidor ou de uma cópia), o desafio começa com ele
 * nos arquivos, sem perguntar: quem retoma já confirmou a troca. Devolve se
 * o desafio começou.
 */
export async function comecarDesafio(
  contexto: ContextoDoInicio,
  codigo?: string,
  retomado?: ConteudoDoAluno,
): Promise<boolean> {
  // No formato livre, o tamanho vem antes de tudo: sem ele, nada muda.
  const escolhido = await escolherDesafio(contexto.escolha, codigo);
  if (!escolhido) {
    return false;
  }
  const arquivos = await contexto.lerArquivos();
  const temTrabalho = temTrabalhoDoAluno(arquivos);
  if (!retomado && temTrabalho && !(await confirmarLimpeza())) {
    return false;
  }
  if (temTrabalho) {
    await contexto.guardarCopia(arquivos);
  }

  const desafio = criarDesafioPorCodigo(escolhido.codigo, escolhido.tamanho);
  log.info(`Novo desafio: código ${desafio.codigo} (${desafio.challengeId}).`);
  contexto.mostrar(desafio);

  if (retomado) {
    await gravarComAviso(() => contexto.escreverArquivos(retomado));
  } else if (temTrabalho) {
    await gravarComAviso(() => contexto.limparArquivos());
  }
  contexto.iniciarRelogio();
  return true;
}

/**
 * Volta uma cópia de segurança para index.html e style.css, com o desafio
 * dela. Os arquivos de agora também ficam guardados antes da troca.
 */
export async function restaurarCopia(
  contexto: ContextoDoInicio,
  copias: CopiaDeSeguranca[],
  // Começa o desafio da cópia, com as regras de sempre (sessão, IA).
  comecarComCopia: (codigo: string, conteudo: ConteudoDoAluno) => Promise<void>,
): Promise<void> {
  const copia = await escolherCopia(copias);
  if (!copia) {
    return;
  }
  const conteudo = { html: copia.html, css: copia.css };
  if (copia.codigo) {
    await comecarComCopia(copia.codigo, conteudo);
    return;
  }
  // Sem desafio na cópia, só os arquivos voltam.
  const arquivos = await contexto.lerArquivos();
  if (temTrabalhoDoAluno(arquivos)) {
    await contexto.guardarCopia(arquivos);
  }
  await gravarComAviso(() => contexto.escreverArquivos(conteudo));
}

async function gravarComAviso(gravar: () => Promise<void>): Promise<void> {
  try {
    await gravar();
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Erro desconhecido.";
    log.error("Não foi possível gravar os arquivos de treino", error);
    void vscode.window.showErrorMessage(
      `Não foi possível gravar index.html e style.css: ${mensagem}`,
    );
  }
}
