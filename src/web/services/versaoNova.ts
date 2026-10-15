import * as vscode from "vscode";
import { log } from "./logger";

// O .vsix não se atualiza sozinho: uma vez por dia, a extensão confere no
// GitHub se saiu uma versão nova e avisa o aluno. No VS Code desktop, ela
// mesma baixa o .vsix e o instala. O pedido não leva nada do aluno.
const REPOSITORIO = "josebruno10/flexbox-trainer";
const ULTIMA_VERSAO =
  `https://api.github.com/repos/${REPOSITORIO}/releases/latest`;
const PAGINA_DA_VERSAO = `https://github.com/${REPOSITORIO}/releases/latest`;
// Só instala um .vsix anexado a uma versão deste repositório.
const DOWNLOADS = `https://github.com/${REPOSITORIO}/releases/download/`;
const CHAVE_ULTIMA_CONSULTA = "flexboxTrainer.ultimaConsultaVersao";
const CHAVE_VERSAO_ABERTA = "flexboxTrainer.versaoAberta";
const UM_DIA_MS = 24 * 60 * 60 * 1000;
// No primeiro pedido da sessão, o VS Code ainda prepara a conexão (proxy e
// certificados), o que pode levar dezenas de segundos num computador lento.
const TEMPO_LIMITE_MS = 60_000;
const TEMPO_LIMITE_DOWNLOAD_MS = 120_000;
const ATUALIZAR = "Atualizar";
const BAIXAR = "Baixar";
const RECARREGAR = "Recarregar";
const O_QUE_MUDOU = "O que mudou";

export type VersaoPublicada = {
  versao: string;
  // O endereço do .vsix anexado à versão, quando há um.
  vsix?: string;
};

// Onde o .vsix baixado fica até ser instalado.
export type ArquivosLocais = Pick<
  vscode.FileSystem,
  "createDirectory" | "writeFile" | "delete"
>;

export type OpcoesVersaoNova = {
  armazenamento: vscode.Memento;
  versaoAtual: string;
  // Pasta para baixar o .vsix. Sem ela (no navegador), o aviso só abre a
  // página da versão.
  pastaDownload?: vscode.Uri;
  buscar?: typeof fetch;
  arquivos?: ArquivosLocais;
};

/**
 * Onde baixar o .vsix de uma atualização, a partir da pasta da extensão. Só o
 * VS Code desktop instala um .vsix sozinho, e só de um arquivo (file:); lá, a
 * pasta da extensão vem como vscode-userdata:, com o mesmo caminho do disco.
 */
export function pastaDeDownload(
  pasta: vscode.Uri,
  interfaceDoVsCode: vscode.UIKind = vscode.env.uiKind,
): vscode.Uri | undefined {
  if (interfaceDoVsCode !== vscode.UIKind.Desktop) {
    return undefined;
  }
  if (pasta.scheme === "file") {
    return pasta;
  }
  return pasta.scheme === "vscode-userdata"
    ? vscode.Uri.file(pasta.fsPath)
    : undefined;
}

/** "0.10.0" é mais nova que "0.9.2"; partes que faltam valem zero. */
export function ehMaisNova(candidata: string, atual: string): boolean {
  const partes = (versao: string) =>
    versao.split(".").map((parte) => Number.parseInt(parte, 10) || 0);
  const [nova, instalada] = [partes(candidata), partes(atual)];
  const tamanho = Math.max(nova.length, instalada.length);
  for (let indice = 0; indice < tamanho; indice++) {
    const diferenca = (nova[indice] ?? 0) - (instalada[indice] ?? 0);
    if (diferenca !== 0) {
      return diferenca > 0;
    }
  }
  return false;
}

/**
 * A versão mais nova publicada no GitHub, com o .vsix dela, ou nada se a
 * resposta não trouxer uma. Sem conexão, o erro sobe.
 */
export async function buscarUltimaVersao(
  buscar: typeof fetch = (url, opcoes) => fetch(url, opcoes),
): Promise<VersaoPublicada | undefined> {
  const dados = await comTempoLimite(TEMPO_LIMITE_MS, async (sinal) => {
    const resposta = await buscar(ULTIMA_VERSAO, {
      headers: { Accept: "application/vnd.github+json" },
      signal: sinal,
    });
    return resposta.ok
      ? ((await resposta.json()) as { tag_name?: unknown; assets?: unknown })
      : undefined;
  });
  const etiqueta = dados?.tag_name;
  if (typeof etiqueta !== "string" || !/^v?\d+(\.\d+)*$/.test(etiqueta)) {
    return undefined;
  }

  const anexos: unknown[] = Array.isArray(dados?.assets) ? dados.assets : [];
  const vsix = anexos
    .map(
      (anexo) =>
        (anexo as { browser_download_url?: unknown } | null)
          ?.browser_download_url,
    )
    .find(
      (endereco): endereco is string =>
        typeof endereco === "string" &&
        endereco.startsWith(DOWNLOADS) &&
        endereco.endsWith(".vsix"),
    );
  return { versao: etiqueta.replace(/^v/, ""), vsix };
}

/**
 * Avisa quando há no GitHub uma versão mais nova que a instalada. Consulta
 * no máximo uma vez por dia; sem conexão, tenta de novo na próxima vez que a
 * extensão abrir.
 */
export async function avisarVersaoNova(opcoes: OpcoesVersaoNova): Promise<void> {
  const { armazenamento, versaoAtual } = opcoes;
  const agora = Date.now();
  if (agora - armazenamento.get<number>(CHAVE_ULTIMA_CONSULTA, 0) < UM_DIA_MS) {
    return;
  }

  let publicada: VersaoPublicada | undefined;
  try {
    publicada = await buscarUltimaVersao(opcoes.buscar);
  } catch (erro) {
    log.info(
      `Não foi possível conferir se há versão nova: ${textoDoErro(erro)}`,
    );
    return;
  }
  await armazenamento.update(CHAVE_ULTIMA_CONSULTA, agora);
  if (!publicada || !ehMaisNova(publicada.versao, versaoAtual)) {
    return;
  }

  const podeInstalar = Boolean(opcoes.pastaDownload && publicada.vsix);
  const escolha = await vscode.window.showInformationMessage(
    `Versão nova do FlexBox Trainer: ${publicada.versao}. ` +
      `Você está na ${versaoAtual}.`,
    podeInstalar ? ATUALIZAR : BAIXAR,
  );
  if (escolha === ATUALIZAR && opcoes.pastaDownload && publicada.vsix) {
    await instalar(
      publicada.versao,
      publicada.vsix,
      opcoes.pastaDownload,
      opcoes.buscar ?? ((url, init) => fetch(url, init)),
      opcoes.arquivos ?? vscode.workspace.fs,
    );
  } else if (escolha === BAIXAR) {
    await abrirPaginaDaVersao();
  }
}

/**
 * Na primeira vez que uma versão nova abre, avisa que a extensão foi
 * atualizada, com o link das novidades. Numa instalação nova não avisa: o
 * guia de primeiros passos já se apresenta. `jaUsava` diz se a extensão já
 * rodou antes, para reconhecer quem atualiza da 0.4.0, que não guardava a
 * versão.
 */
export async function avisarAtualizacao(
  armazenamento: vscode.Memento,
  versaoAtual: string,
  jaUsava: boolean,
): Promise<void> {
  const anterior = armazenamento.get<string>(CHAVE_VERSAO_ABERTA);
  if (anterior === versaoAtual) {
    return;
  }
  await armazenamento.update(CHAVE_VERSAO_ABERTA, versaoAtual);
  if (anterior ? !ehMaisNova(versaoAtual, anterior) : !jaUsava) {
    return;
  }

  const escolha = await vscode.window.showInformationMessage(
    `O FlexBox Trainer foi atualizado para a versão ${versaoAtual}.`,
    O_QUE_MUDOU,
  );
  if (escolha === O_QUE_MUDOU) {
    await vscode.env.openExternal(
      vscode.Uri.parse(
        `https://github.com/${REPOSITORIO}/releases/tag/v${versaoAtual}`,
      ),
    );
  }
}

// Baixa o .vsix e pede ao VS Code para instalá-lo por cima da versão atual.
async function instalar(
  versao: string,
  endereco: string,
  pasta: vscode.Uri,
  buscar: typeof fetch,
  arquivos: ArquivosLocais,
): Promise<void> {
  const arquivo = vscode.Uri.joinPath(pasta, `flexbox-trainer-${versao}.vsix`);
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Atualizando o FlexBox Trainer para a ${versao}...`,
      },
      async () => {
        const conteudo = await comTempoLimite(
          TEMPO_LIMITE_DOWNLOAD_MS,
          async (sinal) => {
            const resposta = await buscar(endereco, { signal: sinal });
            if (!resposta.ok) {
              throw new Error(`o download respondeu ${resposta.status}`);
            }
            return new Uint8Array(await resposta.arrayBuffer());
          },
        );
        // Um .vsix é um zip, que começa com "PK".
        if (conteudo[0] !== 0x50 || conteudo[1] !== 0x4b) {
          throw new Error("o arquivo baixado não é um .vsix");
        }
        await arquivos.createDirectory(pasta);
        await arquivos.writeFile(arquivo, conteudo);
        await vscode.commands.executeCommand(
          "workbench.extensions.installExtension",
          arquivo,
        );
      },
    );
  } catch (erro) {
    log.info(
      `Não foi possível atualizar o FlexBox Trainer: ${textoDoErro(erro)}`,
    );
    const escolha = await vscode.window.showWarningMessage(
      "Não deu para atualizar sozinho. Baixe a versão nova pela página dela.",
      BAIXAR,
    );
    if (escolha === BAIXAR) {
      await abrirPaginaDaVersao();
    }
    return;
  } finally {
    // Instalada ou não, a cópia baixada não serve mais.
    await Promise.resolve(arquivos.delete(arquivo)).catch(() => undefined);
  }

  const escolha = await vscode.window.showInformationMessage(
    `FlexBox Trainer ${versao} instalado. ` +
      "Recarregue a janela para usar a versão nova.",
    RECARREGAR,
  );
  if (escolha === RECARREGAR) {
    await vscode.commands.executeCommand("workbench.action.reloadWindow");
  }
}

async function abrirPaginaDaVersao(): Promise<void> {
  await vscode.env.openExternal(vscode.Uri.parse(PAGINA_DA_VERSAO));
}

// O limite vale para o pedido inteiro, inclusive a leitura da resposta.
async function comTempoLimite<T>(
  tempoMs: number,
  pedido: (sinal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), tempoMs);
  try {
    return await pedido(controlador.signal);
  } finally {
    clearTimeout(limite);
  }
}

function textoDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}
