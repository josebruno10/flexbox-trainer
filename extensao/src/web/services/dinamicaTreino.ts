import * as vscode from "vscode";
import { AuthService } from "../auth/authService";
import { log } from "./logger";
import { lerConfiguracaoServidor } from "./servidor/configuracao";
import {
  abrirDinamica,
  buscarDinamica,
  consultarStatusDinamica,
  criarDinamicaDeTreino,
} from "./servidor/dinamica";

// O banco guarda o código em character varying(4), e o nome do gabarito
// (gab_<evento>_tam_...) é lido pela extensão oficial só com letras e números.
const CODIGO_VALIDO = /^[a-z0-9]{2,4}$/;

const CRIAR_DINAMICA = "Criar dinâmica de treino";
const JA_TENHO_DINAMICA = "Já tenho uma";

/**
 * Cria no servidor a dinâmica de treino de quem está logado, abre para
 * correções e grava o código em flexboxTrainer.eventoTreino. Nunca altera
 * uma dinâmica que já exista.
 */
export async function criarDinamicaTreinoInterativa(
  authService: AuthService,
): Promise<void> {
  if (!authService.isAutenticado()) {
    void vscode.window.showWarningMessage(
      "Faça login antes de criar a dinâmica de treino.",
    );
    return;
  }

  const evento = (
    await vscode.window.showInputBox({
      title: "Criar dinâmica de treino",
      prompt: "Até 4 letras ou números. Uma dinâmica por pessoa.",
      value: sugerirCodigo(authService),
      validateInput: (valor) =>
        CODIGO_VALIDO.test(valor.trim())
          ? undefined
          : "Use de 2 a 4 letras minúsculas ou números, sem espaços.",
    })
  )?.trim();

  if (!evento) {
    return;
  }

  const configuracao = lerConfiguracaoServidor(authService.getAccessToken());

  try {
    if ((await buscarDinamica(configuracao, evento)) !== undefined) {
      void vscode.window.showWarningMessage(
        `Já existe uma dinâmica "${evento}". Escolha outro código.`,
      );
      return;
    }

    const confirmacao = await vscode.window.showWarningMessage(
      `Criar a dinâmica de treino "${evento}" no servidor do torneio?`,
      {
        modal: true,
        detail:
          "Tipo 2 (projetos diferentes), correção padrão (código 1). Ela " +
          "fica aberta no servidor; a extensão não apaga dinâmicas.",
      },
      "Criar",
    );

    if (confirmacao !== "Criar") {
      return;
    }

    const criada = await criarDinamicaDeTreino(configuracao, evento);
    log.info(
      `Dinâmica de treino criada: ${JSON.stringify(criada).slice(0, 500)}`,
    );
  } catch (error) {
    mostrarFalha("Não foi possível criar a dinâmica de treino", error);
    return;
  }

  // Grava antes de abrir: se a abertura falhar, a dinâmica já existe e não
  // pode ser recriada pelo comando.
  await vscode.workspace
    .getConfiguration("flexboxTrainer")
    .update("eventoTreino", evento, vscode.ConfigurationTarget.Global);

  try {
    if ((await consultarStatusDinamica(configuracao, evento)) !== true) {
      await abrirDinamica(configuracao, evento);
    }
  } catch (error) {
    mostrarFalha(
      `A dinâmica "${evento}" foi criada, mas não abriu`,
      error,
    );
    return;
  }

  void vscode.window.showInformationMessage(
    `Dinâmica "${evento}" criada. Gere um desafio e clique em Verificar.`,
  );
}

/**
 * Outro computador: a dinâmica já foi criada no primeiro, então o aluno
 * informa o código dela, que é conferido no servidor e gravado em
 * flexboxTrainer.eventoTreino. Não cria nem altera nada no servidor.
 */
export async function usarDinamicaExistenteInterativa(
  authService: AuthService,
): Promise<void> {
  if (!authService.isAutenticado()) {
    void vscode.window.showWarningMessage(
      "Faça login antes de informar a dinâmica de treino.",
    );
    return;
  }

  const evento = (
    await vscode.window.showInputBox({
      title: "Usar a sua dinâmica de treino",
      prompt: "O código da dinâmica que você criou no outro computador.",
      value: sugerirCodigo(authService),
      ignoreFocusOut: true,
      validateInput: (valor) =>
        CODIGO_VALIDO.test(valor.trim())
          ? undefined
          : "Use de 2 a 4 letras minúsculas ou números, sem espaços.",
    })
  )?.trim();

  if (!evento) {
    return;
  }

  try {
    const configuracao = lerConfiguracaoServidor(authService.getAccessToken());
    if ((await buscarDinamica(configuracao, evento)) === undefined) {
      void vscode.window.showWarningMessage(
        `Não existe a dinâmica "${evento}". Confira o código ou crie uma.`,
      );
      return;
    }
  } catch (error) {
    mostrarFalha("Não foi possível conferir a dinâmica de treino", error);
    return;
  }

  await vscode.workspace
    .getConfiguration("flexboxTrainer")
    .update("eventoTreino", evento, vscode.ConfigurationTarget.Global);
  void vscode.window.showInformationMessage(
    `Usando a dinâmica de treino "${evento}".`,
  );
}

/**
 * Sem dinâmica de treino: oferece criar uma, ou informar a que o aluno já
 * criou em outro computador, sem sair do que ele estava fazendo.
 */
export async function oferecerDinamicaDeTreino(
  mensagem: string,
  detalhe: string,
): Promise<void> {
  const escolha = await vscode.window.showInformationMessage(
    mensagem,
    { modal: true, detail: detalhe },
    CRIAR_DINAMICA,
    JA_TENHO_DINAMICA,
  );
  if (escolha === CRIAR_DINAMICA) {
    await vscode.commands.executeCommand("flexbox-trainer.criarDinamicaTreino");
  } else if (escolha === JA_TENHO_DINAMICA) {
    await vscode.commands.executeCommand("flexbox-trainer.usarDinamicaTreino");
  }
}

// O ID da sessão é o do aluno no servidor (buscado pelo e-mail no login).
function sugerirCodigo(authService: AuthService): string {
  const id = authService.getSessaoAtual()?.userId ?? 0;
  if (id <= 0) {
    return "";
  }

  // "fb" + ID cabe nos 4 caracteres até o ID 99; acima disso, "f" e os três
  // últimos dígitos (a consulta prévia impede repetir um código existente).
  const texto = String(id);
  return texto.length <= 2 ? `fb${texto}` : `f${texto.slice(-3)}`;
}

function mostrarFalha(contexto: string, error: unknown): void {
  const mensagem = error instanceof Error ? error.message : "Erro desconhecido";
  log.error(contexto, error);
  void vscode.window.showErrorMessage(`${contexto}: ${mensagem}`);
}
