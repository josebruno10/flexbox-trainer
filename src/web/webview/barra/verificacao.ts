import { vscode } from "../api";
import { botaoVerificar } from "./elementos";
import { estado } from "./estado";
import { renderizarHistorico, renderizarHistoricoDesafios } from "./historico";
import { mostrarMensagem, renderizarResultado } from "./resultado";
import {
  aguardarDoisFrames,
  atualizarWorkspaceAntesDaVerificacao,
  medirFormasDoAluno,
} from "./suaPagina";
import type {
  HistoricoDesafiosRecebido,
  ResultadoAvaliacaoRecebido,
  VerificacaoRecebida,
} from "./tipos";

// Uma verificação vai do clique em Verificar até a extensão avisar que ela
// terminou. Nesse meio tempo a extensão reenvia o estado (com o resultado
// antigo) ao reler os arquivos; ele fica guardado e só o último é exibido.
const LIMITE_VERIFICACAO_MS = 120_000;
let verificacaoPendente: { id: number; challengeId: string } | undefined;
let contadorVerificacoes = 0;
let resultadoDuranteVerificacao: ResultadoAvaliacaoRecebido | undefined;
let historicoDuranteVerificacao: number[] | undefined;
let historicoDesafiosDuranteVerificacao: HistoricoDesafiosRecebido | undefined;
let limiteVerificacao: number | undefined;

export function verificacaoEmAndamento(): boolean {
  return Boolean(verificacaoPendente);
}

/** Uma verificação do desafio anterior não vale para o novo. */
export function esquecerVerificacao(): void {
  window.clearTimeout(limiteVerificacao);
  verificacaoPendente = undefined;
  resultadoDuranteVerificacao = undefined;
  historicoDuranteVerificacao = undefined;
  historicoDesafiosDuranteVerificacao = undefined;
}

export async function solicitarVerificacao(): Promise<void> {
  if (!estado.desafio || botaoVerificar.disabled) {
    return;
  }

  const challengeId = estado.desafio.challengeId;
  const id = ++contadorVerificacoes;
  verificacaoPendente = { id, challengeId };
  resultadoDuranteVerificacao = undefined;
  window.clearTimeout(limiteVerificacao);
  limiteVerificacao = window.setTimeout(() => {
    if (verificacaoPendente?.id === id) {
      concluirVerificacao();
      mostrarMensagem(
        "A verificação não respondeu. Tente de novo.",
      );
    }
  }, LIMITE_VERIFICACAO_MS);
  botaoVerificar.disabled = true;
  mostrarMensagem("Lendo os arquivos…");

  try {
    await atualizarWorkspaceAntesDaVerificacao();
  } catch (error) {
    if (estado.desafio?.challengeId !== challengeId) {
      return;
    }

    const mensagem =
      error instanceof Error ? error.message : "Falha ao atualizar o preview.";
    mostrarMensagem(
      `Preview: ${mensagem} Enviando assim mesmo…`,
    );
  }

  if (estado.desafio?.challengeId !== challengeId) {
    return;
  }

  // A superfície de avaliação já tem o HTML/CSS recém-lidos; espera o layout
  // assentar antes de medir.
  await document.fonts?.ready;
  await aguardarDoisFrames();

  if (estado.desafio?.challengeId !== challengeId) {
    return;
  }

  mostrarMensagem("Medindo a página…");
  vscode.postMessage({
    type: "solicitarVerificacao",
    challengeId,
    verificacaoId: id,
    formas: medirFormasDoAluno(),
  });
}

// Durante a verificação, o estado reenviado fica guardado até o fim.

export function receberResultado(resultado: ResultadoAvaliacaoRecebido): void {
  if (verificacaoPendente) {
    resultadoDuranteVerificacao = resultado;
  } else {
    renderizarResultado(resultado);
  }
}

export function receberHistorico(notas: number[]): void {
  if (verificacaoPendente) {
    historicoDuranteVerificacao = notas;
  } else {
    renderizarHistorico(notas);
  }
}

export function receberHistoricoDesafios(
  historico: HistoricoDesafiosRecebido,
): void {
  if (verificacaoPendente) {
    historicoDesafiosDuranteVerificacao = historico;
  } else {
    renderizarHistoricoDesafios(historico);
  }
}

export function receberProgresso(progresso: VerificacaoRecebida): void {
  if (progresso.id === verificacaoPendente?.id && progresso.mensagem) {
    mostrarMensagem(progresso.mensagem);
  }
}

export function receberConclusao(conclusao: VerificacaoRecebida): void {
  if (conclusao.id === verificacaoPendente?.id) {
    concluirVerificacao();
  }
}

function concluirVerificacao(): void {
  window.clearTimeout(limiteVerificacao);
  verificacaoPendente = undefined;
  const resultado = resultadoDuranteVerificacao;
  resultadoDuranteVerificacao = undefined;
  renderizarResultado(resultado);
  if (historicoDuranteVerificacao) {
    renderizarHistorico(historicoDuranteVerificacao);
    historicoDuranteVerificacao = undefined;
  }
  if (historicoDesafiosDuranteVerificacao) {
    renderizarHistoricoDesafios(historicoDesafiosDuranteVerificacao);
    historicoDesafiosDuranteVerificacao = undefined;
  }
}
