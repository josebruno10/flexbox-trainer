import * as vscode from "vscode";
import { NOME_DO_NIVEL, nivelDoCodigo } from "../../niveis";
import { normalizarCodigo } from "../../services/codigoDesafio";
import { log } from "../../services/logger";
import {
  dinamicaDoDesafio,
  ProgressosSalvos,
} from "../../services/progressosSalvos";
import {
  ConteudoDoAluno,
  obterConteudo,
  obterPastaDoAluno,
  salvarConteudo,
} from "../../services/servidor/conteudo";
import {
  abrirDinamica,
  buscarDinamica,
  consultarStatusDinamica,
  criarDinamicaDeTreino,
} from "../../services/servidor/dinamica";
import {
  dataUrlParaPng,
  garantirGabaritoDaDinamica,
} from "../../services/servidor/gabaritos";
import { ErroHttpServidor } from "../../services/servidor/requisicao";
import { temTrabalhoDoAluno } from "../../services/workspace";
import {
  ConfiguracaoServidor,
  Desafio,
  GabaritoGerado,
  ResumoWorkspace,
} from "../../types";
import { pedirCodigo } from "./codigos";

// Salvar e puxar o progresso pelo código do desafio, como o professor pediu:
// cada desafio tem a própria dinâmica no servidor, com o mesmo código (o
// MESA fica na dinâmica "mesa"), e o index.html e o style.css vão para a
// pasta do aluno nela. Para continuar, o aluno escolhe ou digita o código e
// puxa o que está no servidor daquele desafio, um por vez.
//
// O servidor só guarda conteúdo numa dinâmica com gabarito: antes de gravar,
// a imagem do desafio vai como gabarito da dinâmica dele, se ainda faltar.
//
// Salvar só grava numa dinâmica que a extensão criou para o aluno: uma com o
// mesmo código, criada por outra pessoa, pode ser do torneio. A primeira
// linha do HTML salvo leva o código do desafio; ao puxar, ela mostra que a
// pasta foi gravada pela extensão e sai do arquivo.

const PUXAR = "Puxar";
const DIGITAR_CODIGO = "Digitar outro código…";

/** O que salvar e puxar leem e fazem no provedor da barra lateral. */
export type ContextoDoProgresso = {
  autenticado(): boolean;
  // O e-mail da sessão: os progressos salvos são de cada aluno.
  dono(): string | undefined;
  progressos: ProgressosSalvos;
  configuracao(): ConfiguracaoServidor;
  desafio(): Desafio | undefined;
  // A imagem do desafio, gerada pela barra lateral: vira o gabarito da
  // dinâmica dele, sem o qual o servidor não guarda o conteúdo.
  gabarito(): GabaritoGerado | undefined;
  lerArquivos(): Promise<ResumoWorkspace>;
  // Começa o desafio do código com o conteúdo nos arquivos.
  abrirDesafio(codigo: string, conteudo: ConteudoDoAluno): Promise<void>;
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

  const desafio = contexto.desafio();
  const codigo = desafio?.codigo;
  if (!codigo) {
    void vscode.window.showInformationMessage(
      "Gere ou abra um desafio antes de salvar o progresso.",
    );
    return false;
  }

  const gabarito = contexto.gabarito();
  if (gabarito?.challengeId !== desafio.challengeId) {
    void vscode.window.showInformationMessage(
      "A imagem do desafio ainda não ficou pronta. Abra a barra lateral do " +
        "FlexBox Trainer e tente salvar de novo.",
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

  const configuracao = configuracaoDoTorneio(contexto, "salvar");
  if (!configuracao) {
    return false;
  }

  const evento = dinamicaDoDesafio(codigo);
  let salvou = false;
  try {
    salvou = await comProgresso("Salvando o progresso no servidor…", async () => {
      if (!(await prepararDinamica(contexto, configuracao, codigo))) {
        return false;
      }
      await garantirGabaritoDaDinamica(
        configuracao,
        evento,
        dataUrlParaPng(gabarito.imagemDataUrl),
      );
      const codePasta = await obterPastaDoAluno(configuracao, evento);
      await salvarConteudo(configuracao, codePasta, {
        html: marcarDesafio(resumo.textoHtml, codigo),
        css: resumo.textoCss,
      });
      await contexto.progressos.registrar(contexto.dono(), codigo);
      log.info(`Progresso do desafio ${codigo} salvo em ${codePasta}.`);
      return true;
    });
  } catch (error) {
    await mostrarFalha(contexto, "Não foi possível salvar o progresso", error);
    return false;
  }

  if (!salvou) {
    void vscode.window.showWarningMessage(
      `Já existe no servidor uma dinâmica "${evento}", que não foi criada ` +
        "por você pela extensão. Ela pode ser do torneio, então o progresso " +
        `do desafio ${codigo} não foi salvo.`,
    );
    return false;
  }

  void vscode.window.showInformationMessage(
    `Progresso do desafio ${codigo} salvo no servidor. Para continuar em ` +
      "outro computador, entre com a mesma conta, clique em Puxar progresso " +
      `e escolha ${codigo}.`,
  );
  return true;
}

/**
 * Pede o código do desafio e traz o que está salvo no servidor para ele:
 * abre o mesmo desafio com os arquivos salvos.
 */
export async function puxarProgresso(
  contexto: ContextoDoProgresso,
): Promise<void> {
  if (!contexto.autenticado()) {
    void vscode.window.showWarningMessage("Entre antes de puxar o progresso.");
    return;
  }

  const configuracao = configuracaoDoTorneio(contexto, "puxar");
  if (!configuracao) {
    return;
  }

  const codigo = await escolherCodigo(contexto.progressos.listar(contexto.dono()));
  if (!codigo) {
    return;
  }

  // Puxar só lê: vale para qualquer dinâmica com o código.
  const evento = dinamicaDoDesafio(codigo);
  let salvo: ConteudoDoAluno | undefined;
  try {
    salvo = await comProgresso(`Puxando o desafio ${codigo} do servidor…`, async () =>
      (await buscarDinamica(configuracao, evento)) === undefined
        ? undefined
        : obterConteudo(configuracao, await obterPastaDoAluno(configuracao, evento)),
    );
  } catch (error) {
    await mostrarFalha(contexto, "Não foi possível puxar o progresso", error);
    return;
  }

  if (!salvo) {
    void vscode.window.showInformationMessage(
      `Não há progresso seu salvo no servidor para o desafio ${codigo}.`,
    );
    return;
  }

  const marca = lerMarcaDoDesafio(salvo.html);
  const temTrabalho = temTrabalhoDoAluno(await contexto.lerArquivos());
  if (temTrabalho && !(await confirmarPuxar(codigo))) {
    return;
  }

  // Com a marca do mesmo desafio, a pasta foi gravada pela extensão: num
  // computador sem a lista sincronizada, o aluno pode voltar a salvar nela.
  if (marca.codigo === codigo) {
    await contexto.progressos.registrar(contexto.dono(), codigo);
  }
  await contexto.abrirDesafio(codigo, { html: marca.html, css: salvo.css });
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

/**
 * Cria a dinâmica do desafio na primeira vez. Devolve se o aluno pode gravar
 * nela: uma que já existia só vale se a extensão a criou para ele.
 */
async function prepararDinamica(
  contexto: ContextoDoProgresso,
  configuracao: ConfiguracaoServidor,
  codigo: string,
): Promise<boolean> {
  const evento = dinamicaDoDesafio(codigo);
  if ((await buscarDinamica(configuracao, evento)) !== undefined) {
    return contexto.progressos.criouADinamica(contexto.dono(), codigo);
  }

  // Como a de treino: tipo 2 (uma pasta por aluno), correção padrão.
  await criarDinamicaDeTreino(configuracao, evento);
  await contexto.progressos.registrar(contexto.dono(), codigo);
  log.info(`Dinâmica do desafio ${codigo} criada: ${evento}.`);
  if ((await consultarStatusDinamica(configuracao, evento)) !== true) {
    await abrirDinamica(configuracao, evento);
  }
  return true;
}

// A pasta do aluno precisa do ID dele e do time no servidor.
function configuracaoDoTorneio(
  contexto: ContextoDoProgresso,
  acao: "salvar" | "puxar",
): ConfiguracaoServidor | undefined {
  const configuracao = contexto.configuracao();
  if (configuracao.userId <= 0 || configuracao.teamId <= 0) {
    void vscode.window.showWarningMessage(
      `Só quem está no torneio consegue ${acao} o progresso no servidor.`,
    );
    return undefined;
  }
  return configuracao;
}

// Os desafios salvos, do mais recente ao mais antigo, ou outro código.
async function escolherCodigo(salvos: string[]): Promise<string | undefined> {
  const digitar = () =>
    pedirCodigo("Puxar progresso", "O código de 4 letras do desafio que você salvou.");
  if (salvos.length === 0) {
    return digitar();
  }

  const escolha = await vscode.window.showQuickPick(
    [
      ...salvos.map((codigo) => ({
        label: codigo,
        description: `desafio ${NOME_DO_NIVEL[nivelDoCodigo(codigo)]}`,
      })),
      { label: DIGITAR_CODIGO },
    ],
    {
      title: "Puxar progresso",
      placeHolder: "Escolha o desafio que você quer continuar",
    },
  );
  return escolha?.label === DIGITAR_CODIGO ? digitar() : escolha?.label;
}

async function confirmarPuxar(codigo: string): Promise<boolean> {
  const escolha = await vscode.window.showWarningMessage(
    `Puxar o progresso do desafio ${codigo}?`,
    {
      modal: true,
      detail:
        "O index.html e o style.css desta pasta serão substituídos pelo que " +
        "você salvou nesse desafio. O cronômetro recomeça.",
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
