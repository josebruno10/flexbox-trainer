import * as vscode from "vscode";
import { AuthService } from "../auth/authService";
import { log } from "./logger";
import {
  abrirDinamica,
  buscarDinamica,
  consultarStatusDinamica,
  criarDinamicaDeTreino,
  lerConfiguracaoServidor,
} from "./servidor";

// O banco guarda o código em character varying(4), e o nome do gabarito
// (gab_<evento>_tam_...) é lido pela extensão oficial só com letras e números.
const CODIGO_VALIDO = /^[a-z0-9]{2,4}$/;

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
      "Faça login no FlexBox Trainer antes de criar a dinâmica de treino.",
    );
    return;
  }

  const evento = (
    await vscode.window.showInputBox({
      title: "Criar dinâmica de treino",
      prompt:
        "Código da nova dinâmica, com até 4 letras ou números (limite do " +
        "servidor). Use uma por pessoa: o servidor guarda um " +
        "gabarito por tamanho em cada dinâmica.",
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
        `Já existe uma dinâmica "${evento}" no servidor. Nada foi alterado; ` +
          "escolha outro código.",
      );
      return;
    }

    const confirmacao = await vscode.window.showWarningMessage(
      `Criar a dinâmica de treino "${evento}" no servidor do torneio?`,
      {
        modal: true,
        detail:
          "Tipo 2 (projetos diferentes) com a configuração de correção " +
          "padrão (código 1). Ela será aberta para receber correções e " +
          "ficará no servidor: a extensão não apaga dinâmicas.",
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
      `A dinâmica "${evento}" foi criada e configurada, mas não foi possível abri-la`,
      error,
    );
    return;
  }

  void vscode.window.showInformationMessage(
    `Dinâmica de treino "${evento}" criada, aberta e configurada. Gere um ` +
      "desafio e clique em Verificar.",
  );
}

// Mesma regra dos envios: com o override ligado, o ID das configurações vence
// o do login, que pode ser o ID do provedor OAuth.
function sugerirCodigo(authService: AuthService): string {
  const configuracao = vscode.workspace.getConfiguration("flexboxTrainer");
  const idConfigurado = configuracao.get<number>("userId", 0);
  const idSessao = authService.getSessaoAtual()?.userId ?? 0;
  const id =
    configuracao.get<boolean>("usarIdsDasConfiguracoes", false) &&
    idConfigurado > 0
      ? idConfigurado
      : idSessao > 0
        ? idSessao
        : idConfigurado;
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
