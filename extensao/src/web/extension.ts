import * as vscode from "vscode";
import { AuthService } from "./auth/authService";
import { registrarVoltaDoLogin } from "./auth/voltaDoLogin";
import {
  BarraDeStatus,
  COMANDO_ABRIR_BARRA,
} from "./provider/barraDeStatus";
import { PainelAtalhos } from "./provider/painelAtalhos";
import { ProvedorBarraLateralFlexBox } from "./provider/provedorBarraLateral";
import { sincronizarComOutrosComputadores } from "./sincronizacao";
import { MonitorAlteracoesExternas } from "./services/alteracoesExternas";
import { gerarSolucaoAbsoluta, gerarSolucaoFlexbox } from "./services/solucao";
import { criarDinamicaTreinoInterativa } from "./services/dinamicaTreino";
import { initializeLogger } from "./services/logger";
import {
  avisarAtualizacao,
  avisarVersaoNova,
  pastaDeDownload,
} from "./services/versaoNova";
import { escolherTemaCores } from "./telas/temas";
import {
  ehDocumentoDeTreino,
  escreverArquivosDeTreino,
} from "./services/workspace";

const CHAVE_GUIA_ABERTO = "flexboxTrainer.guiaAberto";

export async function activate(context: vscode.ExtensionContext) {
  initializeLogger(context);

  const authService = new AuthService(context);
  const barraDeStatus = new BarraDeStatus();
  const provedor = new ProvedorBarraLateralFlexBox(
    context.extensionUri,
    authService,
    context.globalState,
    undefined,
    barraDeStatus,
  );

  context.subscriptions.push(authService, barraDeStatus);
  registrarVoltaDoLogin(context, authService);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ProvedorBarraLateralFlexBox.viewType,
      provedor,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    ),
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (ehDocumentoDeTreino(document) && authService.isAutenticado()) {
        void provedor.atualizarPreviewWorkspace();
      }
    }),
    // Sem precisar salvar: a página do aluno atualiza enquanto ele digita.
    vscode.workspace.onDidChangeTextDocument((evento) => {
      if (
        evento.contentChanges.length > 0 &&
        ehDocumentoDeTreino(evento.document) &&
        authService.isAutenticado()
      ) {
        provedor.agendarAtualizacaoPreview();
      }
    }),
  );

  // O guia de primeiros passos marca cada passo pelo que o aluno já fez.
  const contextoGuia = new Map<string, boolean>();
  context.subscriptions.push(
    provedor.onDidMudarProgresso((progresso) => {
      for (const [chave, valor] of Object.entries(progresso)) {
        if (contextoGuia.get(chave) !== valor) {
          contextoGuia.set(chave, valor);
          void vscode.commands.executeCommand(
            "setContext",
            `flexboxTrainer.${chave}`,
            valor,
          );
        }
      }
    }),
  );

  const abrirBarraLateral = () =>
    vscode.commands.executeCommand(COMANDO_ABRIR_BARRA);

  context.subscriptions.push(
    vscode.commands.registerCommand("flexbox-trainer.novoDesafio", async () => {
      await abrirBarraLateral();
      if (!authService.isAutenticado()) {
        void vscode.window.showInformationMessage("Entre antes de gerar um desafio.");
        return;
      }
      await provedor.iniciarNovoDesafio();
    }),
    vscode.commands.registerCommand("flexbox-trainer.abrirPorCodigo", async () => {
      await abrirBarraLateral();
      await provedor.abrirDesafioPorCodigo();
    }),
    vscode.commands.registerCommand("flexbox-trainer.refazerDesafio", () =>
      provedor.refazerDesafio(),
    ),
    vscode.commands.registerCommand("flexbox-trainer.desafioDoDia", async () => {
      await abrirBarraLateral();
      await provedor.abrirDesafioDoDia();
    }),
    vscode.commands.registerCommand("flexbox-trainer.verificar", () =>
      provedor.pedirVerificacao(),
    ),
    vscode.commands.registerCommand("flexbox-trainer.copiarResultado", () =>
      provedor.copiarResultado(),
    ),
    vscode.commands.registerCommand("flexbox-trainer.verHistorico", () =>
      provedor.verHistorico(),
    ),
    vscode.commands.registerCommand("flexbox-trainer.abrirGuia", () =>
      vscode.commands.executeCommand(
        "workbench.action.openWalkthrough",
        `${context.extension.id}#primeirosPassos`,
        false,
      ),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("flexbox-trainer.login", async () => {
      await authService.abrirLoginGoogle();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("flexbox-trainer.abrirGabarito", () => {
      provedor.abrirPainelGabarito();
    }),
  );

  const painelAtalhos = new PainelAtalhos(context.extensionUri);
  context.subscriptions.push(
    painelAtalhos,
    vscode.commands.registerCommand("flexbox-trainer.verAtalhos", () =>
      painelAtalhos.mostrar(),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("flexbox-trainer.verExtensoesIa", () =>
      provedor.verExtensoesIa(),
    ),
    vscode.commands.registerCommand("flexbox-trainer.criarArquivos", () =>
      provedor.criarArquivosDeTreino(),
    ),
    // Habilitar ou desabilitar uma extensão atualiza o aviso de IA e, se
    // houver desafio, pode invalidá-lo.
    vscode.extensions.onDidChange(() => provedor.atualizarExtensoesIa()),
    vscode.workspace.onDidChangeConfiguration((evento) => {
      if (evento.affectsConfiguration("flexboxTrainer.temaCores")) {
        provedor.aplicarCores();
        painelAtalhos.aplicarCores();
      }
    }),
    vscode.commands.registerCommand("flexbox-trainer.escolherCores", () =>
      escolherTemaCores(),
    ),
    vscode.commands.registerCommand("flexbox-trainer.testarServidor", () =>
      provedor.testarServidorPeloComando(),
    ),
    // index.html e style.css gravados fora do editor (por um assistente de IA
    // no terminal, por exemplo) também invalidam o desafio.
    new MonitorAlteracoesExternas((alteracao) => {
      void provedor.registrarAlteracaoExterna(alteracao);
    }).iniciar(),
  );

  // Atalho no topo dos arquivos de treino, como na extensão oficial do torneio.
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      [{ language: "html" }, { language: "css" }],
      {
        provideCodeLenses: (document) =>
          ehDocumentoDeTreino(document)
            ? [
                new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
                  title: "$(preview) Abrir gabarito em uma aba",
                  command: "flexbox-trainer.abrirGabarito",
                }),
              ]
            : [],
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("flexbox-trainer.logout", async () => {
      await authService.logout();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "flexbox-trainer.criarDinamicaTreino",
      async () => {
        await criarDinamicaTreinoInterativa(authService);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "flexbox-trainer.gerarSolucaoTeste",
      async () => {
        // O menu já esconde o comando; isto barra atalhos e chamadas diretas.
        if (
          !vscode.workspace
            .getConfiguration("flexboxTrainer")
            .get<boolean>("modoDesenvolvedor", false)
        ) {
          void vscode.window.showInformationMessage(
            "Este comando é só para testes. Ligue flexboxTrainer.modoDesenvolvedor para usá-lo.",
          );
          return;
        }

        const desafio = provedor.obterDesafioAtual();

        if (!desafio) {
          void vscode.window.showInformationMessage(
            "Gere um desafio na barra lateral antes de gerar a solução.",
          );
          return;
        }

        const montagem = await vscode.window.showQuickPick(
          [
            {
              label: "Flexbox",
              description: "display: flex, gap, padding e alinhamento; sem position",
              gerar: gerarSolucaoFlexbox,
            },
            {
              label: "Posição absoluta",
              description: "cada bloco com left e top dentro do pai",
              gerar: gerarSolucaoAbsoluta,
            },
          ],
          {
            title: "Gerar solução exata do desafio (teste)",
            placeHolder: "Como montar o HTML/CSS?",
          },
        );

        if (!montagem) {
          return;
        }

        const confirmacao = await vscode.window.showWarningMessage(
          "Substituir index.html e style.css pela solução exata do desafio atual?",
          {
            modal: true,
            detail: `Montagem: ${montagem.label}. Serve só para testar se a correção chega a 100%.`,
          },
          "Substituir",
        );

        if (confirmacao !== "Substituir") {
          return;
        }

        try {
          const { html, css } = montagem.gerar(desafio);
          await escreverArquivosDeTreino(html, css);
          await provedor.atualizarPreviewWorkspace();
          void vscode.window.showInformationMessage(
            "Solução exata gravada em index.html e style.css. Clique em Verificar.",
          );
        } catch (error) {
          const mensagem =
            error instanceof Error ? error.message : "Erro desconhecido";
          void vscode.window.showErrorMessage(
            `Não foi possível gravar a solução: ${mensagem}`,
          );
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("flexbox-trainer.iniciar", async () => {
      if (!authService.isAutenticado()) {
        await authService.abrirLoginGoogle();
        await vscode.commands.executeCommand(
          COMANDO_ABRIR_BARRA,
        );
        return;
      }

      await provedor.atualizarPreviewWorkspace();
      await vscode.commands.executeCommand(
        COMANDO_ABRIR_BARRA,
      );
    }),
  );

  // A barra lateral e os comandos precisam estar disponíveis mesmo quando o
  // armazenamento seguro ou a API de autenticação estiverem lentos/offline.
  // A inicialização da sessão atualiza a webview assim que for concluída.
  void authService.inicializar();

  // O histórico do aluno da sessão vai junto na sincronização do VS Code.
  const sincronizar = () =>
    sincronizarComOutrosComputadores(
      context.globalState,
      authService.getSessaoAtual()?.email,
    );
  sincronizar();
  context.subscriptions.push(authService.onDidChangeEstado(sincronizar));

  // Os testes não consultam o GitHub.
  if (context.extensionMode !== vscode.ExtensionMode.Test) {
    const versaoAtual = String(context.extension.packageJSON.version);
    // Quem já tinha aberto o guia já usava a extensão: se a versão mudou, é
    // uma atualização.
    void avisarAtualizacao(
      context.globalState,
      versaoAtual,
      context.globalState.get<boolean>(CHAVE_GUIA_ABERTO) === true,
    );
    void avisarVersaoNova({
      armazenamento: context.globalState,
      versaoAtual,
      pastaDownload: pastaDeDownload(context.globalStorageUri),
    });
  }

  // Uma única vez, na primeira vez que a extensão roda (inclusive depois de
  // atualizar de uma versão sem guia), abre o guia de primeiros passos.
  if (
    context.extensionMode !== vscode.ExtensionMode.Test &&
    !context.globalState.get<boolean>(CHAVE_GUIA_ABERTO)
  ) {
    void context.globalState.update(CHAVE_GUIA_ABERTO, true);
    void vscode.commands.executeCommand(
      "workbench.action.openWalkthrough",
      `${context.extension.id}#primeirosPassos`,
      false,
    );
  }
}

export function deactivate() {}
