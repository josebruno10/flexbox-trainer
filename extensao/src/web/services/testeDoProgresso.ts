import * as vscode from "vscode";
import { AuthService } from "../auth/authService";
import { ConfiguracaoServidor } from "../types";
import { log } from "./logger";
import { lerConfiguracaoServidor } from "./servidor/configuracao";
import {
  ConteudoDoAluno,
  obterConteudo,
  obterPastaDoAluno,
  salvarConteudo,
} from "./servidor/conteudo";

// Ferramenta de teste (modo desenvolvedor): confere no servidor de verdade
// as rotas do Salvar e do Continuar, na pasta do aluno dentro da
// dinâmica de treino dele. Só cria a pasta (se faltar), grava e lê: nada é
// excluído. O que já estava salvo é copiado para o computador antes do teste
// e regravado depois.

export type PassoDoTeste = { nome: string; ok: boolean; detalhe: string };

export type RelatorioDoTeste = {
  ok: boolean;
  passos: PassoDoTeste[];
  codePasta?: string;
  copiaLocal?: string;
};

/** O HTML e o CSS que o teste grava, marcados com o instante do teste. */
export function conteudoDeTeste(agora: Date): ConteudoDoAluno {
  const marca = `teste do FlexBox Trainer em ${agora.toISOString()}`;
  return {
    html: `<!-- ${marca} -->\n<p>Teste do progresso</p>`,
    css: `/* ${marca} */\np { color: #336699; }`,
  };
}

/** Em que os dois conteúdos diferem, ou nada se são iguais. */
export function diferencas(
  esperado: ConteudoDoAluno,
  lido: ConteudoDoAluno | undefined,
): string | undefined {
  if (!lido) {
    return "o servidor não devolveu nada";
  }
  const html = lido.html !== esperado.html;
  const css = lido.css !== esperado.css;
  if (html && css) {
    return "o index.html e o style.css voltaram diferentes";
  }
  return html
    ? "o index.html voltou diferente"
    : css
      ? "o style.css voltou diferente"
      : undefined;
}

/**
 * Abre a pasta, lê o que está salvo, guarda uma cópia, grava o teste, lê de
 * volta e regrava o que estava lá. Se a cópia falhar, nada é gravado.
 */
export async function testarProgressoNaPasta(
  configuracao: ConfiguracaoServidor,
  evento: string,
  guardarCopia: (conteudo: ConteudoDoAluno) => Promise<string>,
  agora = new Date(),
): Promise<RelatorioDoTeste> {
  const relatorio: RelatorioDoTeste = { ok: false, passos: [] };
  const passo = async <T>(nome: string, fazer: () => Promise<[T, string]>) => {
    try {
      const [valor, detalhe] = await fazer();
      relatorio.passos.push({ nome, ok: true, detalhe });
      return { valor };
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : String(error);
      relatorio.passos.push({ nome, ok: false, detalhe });
      return undefined;
    }
  };
  const conferir = (esperado: ConteudoDoAluno) => async (): Promise<[true, string]> => {
    const problema = diferencas(esperado, await obterConteudo(configuracao, codePasta));
    if (problema) {
      throw new Error(problema);
    }
    return [true, "o index.html e o style.css voltaram iguais"];
  };

  const pasta = await passo("Abrir a pasta (criar-pasta)", async () => {
    const codigo = await obterPastaDoAluno(configuracao, evento);
    return [codigo, codigo];
  });
  if (!pasta) {
    return relatorio;
  }
  const codePasta = pasta.valor;
  relatorio.codePasta = codePasta;

  const leitura = await passo("Ler o que já estava salvo (obter-conteudo)", async () => {
    const original = await obterConteudo(configuracao, codePasta);
    return [original, original ? "a pasta tinha conteúdo" : "a pasta estava vazia"];
  });
  if (!leitura) {
    return relatorio;
  }
  const original = leitura.valor;

  if (original) {
    const copia = await passo("Guardar uma cópia no computador", async () => {
      const caminho = await guardarCopia(original);
      return [caminho, caminho];
    });
    if (!copia) {
      return relatorio;
    }
    relatorio.copiaLocal = copia.valor;
  }

  const teste = conteudoDeTeste(agora);
  const gravou = await passo("Salvar o teste (salvar-conteudo)", async () => {
    await salvarConteudo(configuracao, codePasta, teste);
    return [true, "o servidor aceitou"];
  });
  const voltou = gravou && (await passo("Puxar o teste de volta", conferir(teste)));

  // Mesmo se o teste falhou no meio, o que estava salvo volta para a pasta.
  let restaurou = true;
  if (original) {
    restaurou = Boolean(
      (await passo("Regravar o que estava salvo", async () => {
        await salvarConteudo(configuracao, codePasta, original);
        return [true, "o servidor aceitou"];
      })) && (await passo("Conferir o que foi regravado", conferir(original))),
    );
  } else if (gravou) {
    relatorio.passos.push({
      nome: "Regravar o que estava salvo",
      ok: true,
      detalhe: "a pasta estava vazia; o teste ficou nela",
    });
  }

  relatorio.ok = Boolean(gravou && voltou && restaurou);
  return relatorio;
}

/** O comando de teste: confirma, roda e mostra o resultado e o log. */
export async function testarProgressoInterativo(
  authService: AuthService,
  pastaDeCopias: vscode.Uri,
): Promise<void> {
  const config = vscode.workspace.getConfiguration("flexboxTrainer");
  if (!config.get<boolean>("modoDesenvolvedor", false)) {
    void vscode.window.showInformationMessage(
      "Este comando é só para testes. Ligue flexboxTrainer.modoDesenvolvedor para usá-lo.",
    );
    return;
  }
  if (!authService.isAutenticado()) {
    void vscode.window.showWarningMessage("Entre antes de testar o progresso.");
    return;
  }

  const sessao = authService.getSessaoAtual();
  const configuracao: ConfiguracaoServidor = {
    ...lerConfiguracaoServidor(authService.getAccessToken()),
    userId: sessao?.userId ?? 0,
    teamId: sessao?.teamId ?? 0,
  };
  const evento = configuracao.eventoTreino;
  if (!evento) {
    void vscode.window.showWarningMessage(
      "Crie ou informe a sua dinâmica de treino antes do teste.",
    );
    return;
  }
  if (configuracao.userId <= 0 || configuracao.teamId <= 0) {
    void vscode.window.showWarningMessage(
      "A sessão não tem aluno e time do servidor; o teste precisa dos dois.",
    );
    return;
  }

  const confirmacao = await vscode.window.showWarningMessage(
    `Testar o progresso na sua pasta da dinâmica "${evento}"?`,
    {
      modal: true,
      detail:
        "Grava um index.html e um style.css de teste na sua pasta, puxa de " +
        "volta para comparar e regrava o que estava lá. Antes, guarda uma " +
        "cópia do que estava salvo no computador. Nada é excluído do servidor.",
    },
    "Testar",
  );
  if (confirmacao !== "Testar") {
    return;
  }

  const guardarCopia = async (conteudo: ConteudoDoAluno): Promise<string> => {
    await vscode.workspace.fs.createDirectory(pastaDeCopias);
    const nome = `${evento}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const arquivo = vscode.Uri.joinPath(pastaDeCopias, nome);
    await vscode.workspace.fs.writeFile(
      arquivo,
      new TextEncoder().encode(JSON.stringify(conteudo, null, 2)),
    );
    return arquivo.scheme === "file" ? arquivo.fsPath : arquivo.toString();
  };

  const relatorio = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Testando o progresso…" },
    () => testarProgressoNaPasta(configuracao, evento, guardarCopia),
  );

  log.info(`Teste do progresso na dinâmica ${evento}:`);
  for (const { nome, ok, detalhe } of relatorio.passos) {
    log.info(`  ${ok ? "ok   " : "FALHA"} ${nome}: ${detalhe}`);
  }

  const verLog = "Ver log";
  const escolha = relatorio.ok
    ? await vscode.window.showInformationMessage(
        `Teste do progresso: tudo certo na pasta ${relatorio.codePasta}.`,
        verLog,
      )
    : await vscode.window.showErrorMessage(
        "Teste do progresso: houve falha. " +
          (relatorio.copiaLocal
            ? `A cópia do que estava salvo ficou em ${relatorio.copiaLocal}.`
            : "Veja os passos no log."),
        verLog,
      );
  if (escolha === verLog) {
    log.mostrar();
  }
}
