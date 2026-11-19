import * as vscode from "vscode";
import { normalizarCodigo } from "../../services/codigoDesafio";
import { oferecerDinamicaDeTreino } from "../../services/dinamicaTreino";
import { log } from "../../services/logger";
import {
  ConteudoDoAluno,
  obterConteudo,
  obterPastaDoAluno,
  salvarConteudo,
} from "../../services/servidor/conteudo";
import { ErroHttpServidor } from "../../services/servidor/requisicao";
import { temTrabalhoDoAluno } from "../../services/workspace";
import { ConfiguracaoServidor, Desafio, ResumoWorkspace } from "../../types";

// Salvar e puxar o progresso: o index.html e o style.css vão para a pasta do
// aluno no servidor, e voltam em outro computador. O servidor guarda só os
// dois arquivos, então o código do desafio vai num comentário na primeira
// linha do HTML salvo; ao puxar, ele sai do arquivo e abre o mesmo desafio.

const PUXAR = "Puxar";

/** O que salvar e puxar leem e fazem no provedor da barra lateral. */
export type ContextoDoProgresso = {
  autenticado(): boolean;
  configuracao(): ConfiguracaoServidor;
  desafio(): Desafio | undefined;
  lerArquivos(): Promise<ResumoWorkspace>;
  // Começa o desafio do código com o conteúdo nos arquivos.
  abrirDesafio(codigo: string, conteudo: ConteudoDoAluno): Promise<void>;
  gravarArquivos(conteudo: ConteudoDoAluno): Promise<void>;
  recusarSessaoSePreciso(httpStatus?: number): Promise<void>;
};

/** Guarda no servidor os arquivos do desafio atual. Devolve se salvou. */
export async function salvarProgresso(
  contexto: ContextoDoProgresso,
): Promise<boolean> {
  if (!contexto.autenticado()) {
    void vscode.window.showWarningMessage("Entre antes de salvar o progresso.");
    return false;
  }

  const codigo = contexto.desafio()?.codigo;
  if (!codigo) {
    void vscode.window.showInformationMessage(
      "Gere ou abra um desafio antes de salvar o progresso.",
    );
    return false;
  }

  const resumo = await contexto.lerArquivos();
  if (!resumo.temArquivoHtml && !resumo.temArquivoCss) {
    void vscode.window.showInformationMessage(
      "Não há index.html nem style.css para salvar.",
    );
    return false;
  }

  const configuracao = await configuracaoParaProgresso(contexto, "salvar");
  if (!configuracao) {
    return false;
  }

  try {
    await comProgresso("Salvando o progresso no servidor…", async () => {
      const codePasta = await obterPastaDoAluno(configuracao);
      await salvarConteudo(configuracao, codePasta, {
        html: marcarDesafio(resumo.textoHtml, codigo),
        css: resumo.textoCss,
      });
      log.info(`Progresso do desafio ${codigo} salvo em ${codePasta}.`);
    });
  } catch (error) {
    await mostrarFalha(contexto, "Não foi possível salvar o progresso", error);
    return false;
  }

  void vscode.window.showInformationMessage(
    `Progresso do desafio ${codigo} salvo no servidor. Em outro computador, ` +
      "entre com a mesma conta e use Puxar progresso.",
  );
  return true;
}

/**
 * Traz o último progresso salvo, de qualquer computador: abre o mesmo
 * desafio com os arquivos salvos. Sem o código do desafio, só grava os
 * arquivos.
 */
export async function puxarProgresso(
  contexto: ContextoDoProgresso,
): Promise<void> {
  if (!contexto.autenticado()) {
    void vscode.window.showWarningMessage("Entre antes de puxar o progresso.");
    return;
  }

  const configuracao = await configuracaoParaProgresso(contexto, "puxar");
  if (!configuracao) {
    return;
  }

  let salvo: ConteudoDoAluno | undefined;
  try {
    salvo = await comProgresso("Puxando o progresso do servidor…", async () =>
      obterConteudo(configuracao, await obterPastaDoAluno(configuracao)),
    );
  } catch (error) {
    await mostrarFalha(contexto, "Não foi possível puxar o progresso", error);
    return;
  }

  if (!salvo) {
    void vscode.window.showInformationMessage(
      "Ainda não há progresso salvo no servidor. Use Salvar progresso no " +
        "computador onde você fez o desafio.",
    );
    return;
  }

  const { codigo, html } = lerMarcaDoDesafio(salvo.html);
  const conteudo = { html, css: salvo.css };
  const temTrabalho = temTrabalhoDoAluno(await contexto.lerArquivos());
  if (temTrabalho && !(await confirmarPuxar(codigo))) {
    return;
  }

  if (codigo) {
    await contexto.abrirDesafio(codigo, conteudo);
    return;
  }
  await contexto.gravarArquivos(conteudo);
  void vscode.window.showInformationMessage(
    "index.html e style.css puxados do servidor. Abra o desafio pelo " +
      "código para continuar.",
  );
}

/** A primeira linha do HTML salvo diz de qual desafio ele é. */
export function marcarDesafio(html: string, codigo: string): string {
  return `<!-- FlexBox Trainer: desafio ${codigo} -->\n${lerMarcaDoDesafio(html).html}`;
}

export function lerMarcaDoDesafio(html: string): {
  codigo?: string;
  html: string;
} {
  const marca = /^<!-- FlexBox Trainer: desafio (\S+) -->\r?\n?/.exec(html);
  if (!marca) {
    return { html };
  }
  return {
    codigo: normalizarCodigo(marca[1]),
    html: html.slice(marca[0].length),
  };
}

// O progresso fica na pasta do aluno, na dinâmica de treino dele; sem ela,
// oferece criar ou informar a do outro computador.
async function configuracaoParaProgresso(
  contexto: ContextoDoProgresso,
  acao: "salvar" | "puxar",
): Promise<ConfiguracaoServidor | undefined> {
  if (!contexto.configuracao().eventoTreino) {
    await oferecerDinamicaDeTreino(
      `Para ${acao} o progresso, use a sua dinâmica de treino.`,
      "O servidor guarda o index.html e o style.css numa pasta sua, dentro " +
        "dela. Num computador novo, informe a dinâmica que você já criou.",
    );
  }

  const configuracao = contexto.configuracao();
  if (!configuracao.eventoTreino) {
    return undefined;
  }
  if (configuracao.userId <= 0 || configuracao.teamId <= 0) {
    void vscode.window.showWarningMessage(
      `Só quem está no torneio consegue ${acao} o progresso no servidor.`,
    );
    return undefined;
  }
  return configuracao;
}

async function confirmarPuxar(codigo: string | undefined): Promise<boolean> {
  const escolha = await vscode.window.showWarningMessage(
    "Puxar o progresso salvo no servidor?",
    {
      modal: true,
      detail:
        "O index.html e o style.css desta pasta serão substituídos pelo que " +
        `você salvou${codigo ? ` no desafio ${codigo}` : ""}. O cronômetro ` +
        "recomeça.",
    },
    PUXAR,
  );
  return escolha === PUXAR;
}

function comProgresso<T>(titulo: string, tarefa: () => Promise<T>): Promise<T> {
  return Promise.resolve(
    vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: titulo },
      tarefa,
    ),
  );
}

async function mostrarFalha(
  contexto: ContextoDoProgresso,
  titulo: string,
  error: unknown,
): Promise<void> {
  log.error(titulo, error);
  const mensagem = error instanceof Error ? error.message : "Erro desconhecido.";
  void vscode.window.showErrorMessage(`${titulo}: ${mensagem}`);
  await contexto.recusarSessaoSePreciso(
    error instanceof ErroHttpServidor ? error.status : undefined,
  );
}
