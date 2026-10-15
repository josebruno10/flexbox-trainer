import * as vscode from "vscode";

// Conteúdos que o próprio VS Code gravou nos arquivos de treino: os salvos no
// editor e os criados por esta extensão. Uma mudança no disco com outro
// conteúdo veio de fora do editor (um assistente de IA no terminal, por
// exemplo).
const conteudosProprios = new Map<string, string[]>();
const MAXIMO_POR_ARQUIVO = 5;

// As mesmas pastas que a busca dos arquivos de treino ignora.
const PASTAS_IGNORADAS =
  /\/(node_modules|\.vscode-test-web|\.git|dist|out|build)\//i;

// O disco avisa a gravação antes de o salvamento terminar; a conferência
// espera o fim do salvamento por no máximo este tempo.
const ESPERA_MAXIMA_SALVAMENTO_MS = 10_000;

export type AlteracaoExterna = {
  uri: vscode.Uri;
  // Quando o disco avisou a última mudança.
  instante: number;
};

type DocumentoSalvo = Pick<vscode.TextDocument, "uri" | "getText">;

/** Conteúdo gravado pelo próprio VS Code; chame antes de gravar no disco. */
export function registrarGravacaoPropria(
  uri: vscode.Uri,
  conteudo: string,
): void {
  const chave = uri.toString();
  const anteriores = (conteudosProprios.get(chave) ?? []).filter(
    (item) => item !== conteudo,
  );
  conteudosProprios.set(
    chave,
    [...anteriores, conteudo].slice(-MAXIMO_POR_ARQUIVO),
  );
}

/**
 * Avisa quando o index.html ou o style.css mudam no disco com um conteúdo que
 * não saiu do editor nem desta extensão.
 */
export class MonitorAlteracoesExternas implements vscode.Disposable {
  private readonly agendados = new Map<
    string,
    { timer: ReturnType<typeof setTimeout>; instante: number }
  >();

  // Salvamentos começados no editor e ainda não terminados.
  private readonly salvando = new Map<string, number>();

  private readonly inscricoes: vscode.Disposable[] = [];

  public constructor(
    private readonly aoDetectar: (alteracao: AlteracaoExterna) => void,
    private readonly lerConteudo: (
      uri: vscode.Uri,
    ) => Thenable<string | undefined> = lerDoDisco,
    // Junta os avisos repetidos de uma mesma gravação.
    private readonly esperaMs = 1500,
  ) {}

  public iniciar(): this {
    const vigia = vscode.workspace.createFileSystemWatcher(
      "**/{index.html,style.css}",
    );
    this.inscricoes.push(
      vigia,
      vigia.onDidChange((uri) => this.registrarMudanca(uri)),
      vigia.onDidCreate((uri) => this.registrarMudanca(uri)),
      vscode.workspace.onWillSaveTextDocument(({ document }) =>
        this.registrarInicioSalvamento(document),
      ),
      vscode.workspace.onDidSaveTextDocument((document) =>
        this.registrarFimSalvamento(document),
      ),
    );
    return this;
  }

  public registrarInicioSalvamento(documento: DocumentoSalvo): void {
    if (!ehArquivoDeTreino(documento.uri)) {
      return;
    }

    this.salvando.set(documento.uri.toString(), Date.now());
    // Sem formatação ao salvar, este já é o conteúdo que vai para o disco.
    registrarGravacaoPropria(documento.uri, documento.getText());
  }

  public registrarFimSalvamento(documento: DocumentoSalvo): void {
    if (!ehArquivoDeTreino(documento.uri)) {
      return;
    }

    this.salvando.delete(documento.uri.toString());
    registrarGravacaoPropria(documento.uri, documento.getText());
  }

  public registrarMudanca(uri: vscode.Uri): void {
    if (!ehArquivoDeTreino(uri)) {
      return;
    }

    this.agendar(uri, Date.now());
  }

  public dispose(): void {
    for (const { timer } of this.agendados.values()) {
      clearTimeout(timer);
    }
    this.agendados.clear();
    this.inscricoes.forEach((inscricao) => inscricao.dispose());
  }

  private agendar(uri: vscode.Uri, instante: number): void {
    const chave = uri.toString();
    clearTimeout(this.agendados.get(chave)?.timer);
    this.agendados.set(chave, {
      timer: setTimeout(() => void this.conferir(uri), this.esperaMs),
      instante,
    });
  }

  private async conferir(uri: vscode.Uri): Promise<void> {
    const chave = uri.toString();
    const instante = this.agendados.get(chave)?.instante ?? Date.now();
    this.agendados.delete(chave);

    const inicioSalvamento = this.salvando.get(chave);
    if (
      inicioSalvamento !== undefined &&
      Date.now() - inicioSalvamento < ESPERA_MAXIMA_SALVAMENTO_MS
    ) {
      this.agendar(uri, instante);
      return;
    }

    const conteudo = await this.lerConteudo(uri);

    // Um arquivo apagado ou vazio (como o criado pelo Explorer) não traz
    // código de fora.
    if (
      conteudo === undefined ||
      !conteudo.trim() ||
      (conteudosProprios.get(chave) ?? []).includes(conteudo)
    ) {
      return;
    }

    this.aoDetectar({ uri, instante });
  }
}

function ehArquivoDeTreino(uri: vscode.Uri): boolean {
  const caminho = uri.path.replace(/\\/g, "/").toLowerCase();
  return (
    /\/(index\.html|style\.css)$/.test(caminho) &&
    !PASTAS_IGNORADAS.test(caminho)
  );
}

async function lerDoDisco(uri: vscode.Uri): Promise<string | undefined> {
  try {
    // O TextDecoder descarta o BOM, como o texto do documento no editor.
    return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  } catch {
    return undefined;
  }
}
