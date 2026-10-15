import * as vscode from "vscode";
import { ExtensaoIa } from "../../services/extensoesIa";
import { ErroHttpServidor } from "../../services/servidor/requisicao";
import { lerResumoWorkspace } from "../../services/workspace";
import {
  Desafio,
  FormaMedida,
  GabaritoGerado,
  ResultadoAvaliacao,
  ResumoWorkspace,
} from "../../types";
import { Corretor } from "./corretor";
import { motivoExtensoesIa, resultadoInvalidado } from "./regras";

/** O que a verificação lê e muda no provedor da barra lateral. */
export type TentativaEmCurso = {
  autenticado(): boolean;
  desafio(): Desafio | undefined;
  gabarito(): GabaritoGerado | undefined;
  extensoesIa(): ExtensaoIa[];
  motivoInvalidacao(): string | undefined;
  invalidar(motivo: string): void;
  resumo(): ResumoWorkspace;
  definirResumo(resumo: ResumoWorkspace): void;
  guardarResultado(resultado: ResultadoAvaliacao): void;
  registrarNota(precisao: number): Promise<void>;
  enviarEstado(): void;
  criarArquivosQueFaltam(): void;
  recusarSessaoSePreciso(httpStatus?: number): Promise<void>;
  // Para a barra lateral (viewId) e o script dela (mensagens).
  viewId: string;
  postar(mensagem: { type: string; payload: unknown }): void;
};

// A barra lateral mostra as etapas e espera o aviso de conclusão, que vai
// sempre, mesmo quando a verificação para no meio.
export async function verificarTentativa(
  tentativa: TentativaEmCurso,
  corretor: Corretor,
  challengeId: string,
  formas: FormaMedida[],
  verificacaoId?: number,
): Promise<void> {
  const avisar = (type: string, mensagem?: string): void =>
    tentativa.postar({ type, payload: { id: verificacaoId, mensagem } });

  try {
    await vscode.window.withProgress({ location: { viewId: tentativa.viewId } }, () =>
      executarVerificacao(tentativa, corretor, challengeId, formas, (mensagem) =>
        avisar("progressoVerificacao", mensagem),
      ),
    );
  } finally {
    avisar("verificacaoConcluida");
  }
}

async function executarVerificacao(
  tentativa: TentativaEmCurso,
  corretor: Corretor,
  challengeId: string,
  formas: FormaMedida[],
  aoProgredir: (mensagem: string) => void,
): Promise<void> {
  if (
    !tentativa.autenticado() ||
    tentativa.desafio()?.challengeId !== challengeId
  ) {
    return;
  }

  const mostrarResultado = (resultado: ResultadoAvaliacao): void => {
    tentativa.guardarResultado(resultado);
    tentativa.enviarEstado();
  };

  // Como no torneio, nada é corrigido com uma extensão de IA habilitada.
  const extensoesIa = tentativa.extensoesIa();
  if (extensoesIa.length > 0) {
    tentativa.invalidar(motivoExtensoesIa(extensoesIa));
  }
  const motivo = tentativa.motivoInvalidacao();
  if (motivo) {
    mostrarResultado(resultadoInvalidado(motivo));
    return;
  }

  const aindaEhAtual = (): boolean =>
    tentativa.desafio()?.challengeId === challengeId;

  try {
    const lido = await lerResumoWorkspace();
    const resumo =
      lido.temArquivoHtml && lido.temArquivoCss ? lido : tentativa.resumo();
    if (!aindaEhAtual()) {
      return;
    }
    tentativa.definirResumo(resumo);

    if (!resumo.temArquivoHtml || !resumo.temArquivoCss) {
      mostrarResultado(falha("missing-files", "Faltam index.html e style.css."));
      tentativa.criarArquivosQueFaltam();
      return;
    }

    const gabarito = tentativa.gabarito();
    if (gabarito?.challengeId !== challengeId) {
      mostrarResultado(
        falha("gabarito-error", "O gabarito ainda está sendo desenhado. Tente de novo."),
      );
      return;
    }

    const resultado = await corretor.corrigir(
      { challengeId, formas, gabarito },
      aoProgredir,
      aindaEhAtual,
    );
    if (!resultado) {
      return;
    }

    tentativa.guardarResultado(resultado);
    if (resultado.source === "servidor" && !resultado.repetida) {
      await tentativa.registrarNota(resultado.precision);
    }
    tentativa.enviarEstado();

    if (resultado.source === "authentication-error") {
      await tentativa.recusarSessaoSePreciso(resultado.httpStatus);
    }
  } catch (error) {
    if (!aindaEhAtual()) {
      return;
    }

    mostrarResultado(
      falha("api-error", error instanceof Error ? error.message : "Erro desconhecido"),
    );
    if (error instanceof ErroHttpServidor) {
      await tentativa.recusarSessaoSePreciso(error.status);
    }
  }
}

function falha(
  source: ResultadoAvaliacao["source"],
  error: string,
): ResultadoAvaliacao {
  return { precision: 0, score: 0, source, error };
}
