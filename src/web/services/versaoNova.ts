import * as vscode from "vscode";
import { log } from "./logger";

// O .vsix não se atualiza sozinho: uma vez por dia, a extensão confere no
// GitHub se saiu uma versão nova e avisa o aluno, com o link para baixar. O
// pedido não leva nada do aluno.
const ULTIMA_VERSAO =
  "https://api.github.com/repos/josebruno10/flexbox-trainer/releases/latest";
const PAGINA_DA_VERSAO =
  "https://github.com/josebruno10/flexbox-trainer/releases/latest";
const CHAVE_ULTIMA_CONSULTA = "flexboxTrainer.ultimaConsultaVersao";
const UM_DIA_MS = 24 * 60 * 60 * 1000;
const TEMPO_LIMITE_MS = 10_000;
const BAIXAR = "Baixar";

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
 * A versão mais nova publicada no GitHub ("0.4.1"), ou nada se a resposta
 * não trouxer uma. Sem conexão, o erro sobe.
 */
export async function buscarUltimaVersao(
  buscar: typeof fetch = (url, opcoes) => fetch(url, opcoes),
): Promise<string | undefined> {
  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), TEMPO_LIMITE_MS);
  try {
    const resposta = await buscar(ULTIMA_VERSAO, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controlador.signal,
    });
    if (!resposta.ok) {
      return undefined;
    }
    const { tag_name: etiqueta } = (await resposta.json()) as {
      tag_name?: unknown;
    };
    return typeof etiqueta === "string" && /^v?\d+(\.\d+)*$/.test(etiqueta)
      ? etiqueta.replace(/^v/, "")
      : undefined;
  } finally {
    clearTimeout(limite);
  }
}

/**
 * Avisa quando há no GitHub uma versão mais nova que `versaoAtual`. Consulta
 * no máximo uma vez por dia; sem conexão, tenta de novo na próxima vez que a
 * extensão abrir.
 */
export async function avisarVersaoNova(
  armazenamento: vscode.Memento,
  versaoAtual: string,
  buscar?: typeof fetch,
): Promise<void> {
  const agora = Date.now();
  if (agora - armazenamento.get<number>(CHAVE_ULTIMA_CONSULTA, 0) < UM_DIA_MS) {
    return;
  }

  let publicada: string | undefined;
  try {
    publicada = await buscarUltimaVersao(buscar);
  } catch (erro) {
    log.info(
      `Não foi possível conferir se há versão nova: ${
        erro instanceof Error ? erro.message : String(erro)
      }`,
    );
    return;
  }
  await armazenamento.update(CHAVE_ULTIMA_CONSULTA, agora);
  if (!publicada || !ehMaisNova(publicada, versaoAtual)) {
    return;
  }

  const escolha = await vscode.window.showInformationMessage(
    `Versão nova do FlexBox Trainer: ${publicada}. Você está na ${versaoAtual}.`,
    BAIXAR,
  );
  if (escolha === BAIXAR) {
    await vscode.env.openExternal(vscode.Uri.parse(PAGINA_DA_VERSAO));
  }
}
