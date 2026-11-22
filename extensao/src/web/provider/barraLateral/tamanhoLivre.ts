import * as vscode from "vscode";
import { ehTamanhoLivre, formatoDoCodigo } from "../../formatos";
import { sortearCodigo } from "../../services/codigoDesafio";
import { log } from "../../services/logger";
import { dinamicaDoDesafio } from "../../services/progressosSalvos";
import { buscarDinamica } from "../../services/servidor/dinamica";
import { tamanhoDoGabaritoDaDinamica } from "../../services/servidor/gabaritos";
import { TamanhosLivres } from "../../services/tamanhosLivres";
import { ConfiguracaoServidor, Desafio, Formato, Nivel, Tamanho } from "../../types";

// O próximo desafio: o código e, no formato livre, o tamanho.
//
// No formato livre, o aluno escolhe a largura e a altura antes de gerar, e o
// desafio gerado não muda mais de tamanho. O código é de 4 letras, como os
// outros, mas não guarda o tamanho: ele fica nesta instalação e, no primeiro
// Verificar, vai para o servidor no gabarito da dinâmica do desafio
// (gab_<código>_tam_<largura>x<altura>), como o progresso de qualquer
// desafio. Quem abre o código em outro computador lê o tamanho de lá.
//
// Para o código ser único, um desafio livre novo só fica com um código que
// ainda não tem dinâmica no servidor.

const TENTATIVAS = 8;

/** O que a escolha do desafio lê do provedor da barra lateral. */
export type ContextoDaEscolha = {
  nivel(): Nivel;
  formato(): Formato;
  tamanhoLivre(): Tamanho;
  dono(): string | undefined;
  tamanhos: TamanhosLivres;
  desafioAtual(): Desafio | undefined;
  configuracao(): ConfiguracaoServidor;
};

export type DesafioEscolhido = { codigo: string; tamanho?: Tamanho };

/**
 * Sem código, sorteia um no nível e no formato escolhidos. Com código, o
 * tamanho do desafio livre vem desta instalação ou do servidor; sem ele,
 * avisa o aluno e devolve undefined.
 */
export async function escolherDesafio(
  contexto: ContextoDaEscolha,
  codigo?: string,
): Promise<DesafioEscolhido | undefined> {
  if (!codigo) {
    const formato = contexto.formato();
    if (formato !== "livre") {
      return { codigo: sortearCodigo(contexto.nivel(), formato) };
    }
    const tamanho = contexto.tamanhoLivre();
    const novo = await sortearCodigoLivre(contexto);
    await contexto.tamanhos.registrar(contexto.dono(), novo, tamanho);
    return { codigo: novo, tamanho };
  }

  if (formatoDoCodigo(codigo) !== "livre") {
    return { codigo };
  }
  let tamanho: Tamanho | undefined;
  try {
    tamanho = await tamanhoDoCodigo(contexto, codigo);
  } catch (error) {
    log.error(`Não foi possível buscar o tamanho do desafio ${codigo}`, error);
    void vscode.window.showErrorMessage(
      `Não foi possível buscar no servidor o tamanho do desafio ${codigo}: ${
        error instanceof Error ? error.message : "erro desconhecido"
      }`,
    );
    return undefined;
  }
  if (!tamanho) {
    void vscode.window.showWarningMessage(
      `O desafio ${codigo} é de tamanho livre, e o tamanho dele ainda não está no servidor.`,
      {
        modal: true,
        detail:
          "Quem criou o desafio precisa verificá-lo uma vez: assim ele vai para " +
          "o servidor, e o código passa a abrir em qualquer computador.",
      },
    );
    return undefined;
  }
  await contexto.tamanhos.registrar(contexto.dono(), codigo, tamanho);
  return { codigo, tamanho };
}

// Um código do formato livre que nem o aluno nem o servidor conhecem. Sem
// conexão, fica o primeiro que o aluno não conhece.
async function sortearCodigoLivre(contexto: ContextoDaEscolha): Promise<string> {
  let codigo = sortearCodigo(contexto.nivel(), "livre");
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    if (!contexto.tamanhos.tamanho(contexto.dono(), codigo)) {
      try {
        const evento = dinamicaDoDesafio(codigo);
        if ((await buscarDinamica(contexto.configuracao(), evento)) === undefined) {
          return codigo;
        }
      } catch (error) {
        log.error(`Não foi possível conferir no servidor o código ${codigo}`, error);
        return codigo;
      }
    }
    codigo = sortearCodigo(contexto.nivel(), "livre");
  }
  return codigo;
}

// O tamanho de um desafio livre: o desta instalação, o do desafio aberto ou o
// do gabarito da dinâmica dele no servidor.
async function tamanhoDoCodigo(
  contexto: ContextoDaEscolha,
  codigo: string,
): Promise<Tamanho | undefined> {
  const guardado = contexto.tamanhos.tamanho(contexto.dono(), codigo);
  if (guardado) {
    return guardado;
  }
  const atual = contexto.desafioAtual();
  if (atual?.codigo === codigo) {
    return { largura: atual.width, altura: atual.height };
  }
  const doServidor = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Buscando o tamanho do desafio ${codigo} no servidor…`,
    },
    () => tamanhoDoGabaritoDaDinamica(contexto.configuracao(), dinamicaDoDesafio(codigo)),
  );
  return ehTamanhoLivre(doServidor) ? doServidor : undefined;
}
