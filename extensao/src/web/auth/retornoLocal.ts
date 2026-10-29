import * as http from "http";
import type { AddressInfo } from "net";
import { hexAleatorio } from "./aleatorio";
import {
  paginaDeAviso,
  paginaDoResultado,
  paginaDoRetorno,
  textosDoResultado,
} from "./paginasDoRetorno";
import type { RetornoDoSite } from "./retornoDoSite";

// No VS Code desktop, o login com Google passa por um servidor que só a
// própria máquina enxerga (127.0.0.1), nas duas pontas:
// - na ida, o VS Code abre um endereço curto e local, que ele abre sem pedir
//   confirmação, e o servidor leva o navegador ao site de login;
// - na volta, o site manda o login para este servidor, e não para um
//   endereço vscode://, que o navegador e o VS Code pedem para confirmar.
// O site manda o login num formulário (POST): no endereço, o token ficaria
// no histórico do navegador, que num laboratório outros alunos usam. Um site
// mais antigo manda o token no fragmento (#), que o navegador não envia: a
// página de retorno o lê e o manda num POST. No VS Code pelo navegador não
// há servidor (o módulo http fica vazio), e o login volta pelo vscode://.

/** O fim do login, que a página do navegador mostra. */
export type ResultadoDoLogin =
  | { ok: true; nome?: string }
  | { ok: false; mensagem: string };

// A página espera a extensão conferir a conta no servidor do torneio.
const TEMPO_DA_PAGINA_MS = 30_000;
// Um login esquecido não deixa o servidor aberto: o state vale dez minutos.
const DURACAO_MAXIMA_MS = 11 * 60 * 1000;
const TAMANHO_MAXIMO_DO_RETORNO = 16 * 1024;

export type RespostaDaPagina =
  | { estado: "ok"; nome?: string }
  | { estado: "erro"; mensagem: string }
  | { estado: "aguardando" | "repetido" };

// Quem espera a resposta: o script da página de retorno (JSON) ou o
// navegador, que enviou o formulário do site (uma página).
type Espera = { resposta: http.ServerResponse; formato: "json" | "html" };

export class RetornoLocal {
  /** Só no host Node (desktop); no navegador, o http é um módulo vazio. */
  public static disponivel(): boolean {
    return typeof http.createServer === "function";
  }

  public static async abrir(tempoDaPaginaMs = TEMPO_DA_PAGINA_MS): Promise<RetornoLocal> {
    const servidor = http.createServer();
    await new Promise<void>((pronto, falhou) => {
      servidor.once("error", falhou);
      servidor.listen(0, "127.0.0.1", () => {
        servidor.off("error", falhou);
        pronto();
      });
    });
    return new RetornoLocal(servidor, tempoDaPaginaMs);
  }

  /** Para onde o site manda o login. */
  public readonly enderecoDeRetorno: string;
  /** O retorno do site; falha se o servidor fechar antes. */
  public readonly recebido: Promise<RetornoDoSite>;

  private readonly base: string;
  private readonly codigo = hexAleatorio(16);
  private readonly hostsAceitos: Set<string>;
  private destino?: { endereco: string; estado: string };
  private receber!: (retorno: RetornoDoSite) => void;
  private desistir!: (erro: Error) => void;
  private pagina?: Espera;
  private esperaDaPagina?: ReturnType<typeof setTimeout>;
  private readonly limite: ReturnType<typeof setTimeout>;
  private jaRecebeu = false;
  private fechado = false;

  private constructor(
    private readonly servidor: http.Server,
    private readonly tempoDaPaginaMs: number,
  ) {
    const { port } = servidor.address() as AddressInfo;
    this.base = `http://127.0.0.1:${port}`;
    this.enderecoDeRetorno = `${this.base}/retorno`;
    this.hostsAceitos = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    this.recebido = new Promise((receber, desistir) => {
      this.receber = receber;
      this.desistir = desistir;
    });
    // Quem espera o retorno trata a falha; sem este, fechar antes de chegar
    // algo geraria um aviso de promessa rejeitada sem tratamento.
    this.recebido.catch(() => undefined);
    this.limite = setTimeout(() => this.fechar(), DURACAO_MAXIMA_MS);
    servidor.on("request", (pedido, resposta) => {
      void this.atender(pedido, resposta).catch(() => {
        if (!resposta.headersSent) {
          enviar(resposta, 500, "text/plain", "Erro ao atender o pedido.");
        }
      });
    });
  }

  /**
   * O endereço curto que o VS Code abre no navegador: leva ao site de login
   * (destino), e só um retorno com o mesmo state é aceito.
   */
  public entrada(destino: string, estado: string): string {
    this.destino = { endereco: destino, estado };
    return `${this.base}/entrar?c=${this.codigo}`;
  }

  /** O endereço pelo qual o navegador chega, quando a porta é encaminhada. */
  public aceitarHost(authority: string): void {
    this.hostsAceitos.add(authority.toLowerCase());
  }

  /** Mostra o resultado na página do navegador e fecha o servidor. */
  public concluir(resultado: ResultadoDoLogin): void {
    this.responderPagina(
      resultado.ok
        ? { estado: "ok", nome: resultado.nome }
        : { estado: "erro", mensagem: resultado.mensagem },
    );
    this.fechar();
  }

  public fechar(): void {
    if (this.fechado) {
      return;
    }
    this.fechado = true;
    clearTimeout(this.limite);
    this.responderPagina({ estado: "aguardando" });
    this.desistir(new Error("O login pelo navegador foi encerrado."));
    this.servidor.close();
  }

  private async atender(
    pedido: http.IncomingMessage,
    resposta: http.ServerResponse,
  ): Promise<void> {
    // Cada resposta fecha a conexão: assim o servidor fecha de vez no fim.
    resposta.setHeader("Connection", "close");
    resposta.setHeader("Cache-Control", "no-store");
    resposta.setHeader("Referrer-Policy", "no-referrer");
    resposta.setHeader("X-Content-Type-Options", "nosniff");

    // Outro nome apontando para 127.0.0.1 (DNS rebinding) não passa.
    if (!this.hostsAceitos.has((pedido.headers.host ?? "").toLowerCase())) {
      enviar(resposta, 400, "text/plain", "Endereço não aceito.");
      return;
    }

    const url = new URL(pedido.url ?? "/", this.base);
    if (pedido.method === "GET" && url.pathname === "/entrar") {
      this.entrar(url, resposta);
    } else if (pedido.method === "GET" && url.pathname === "/retorno") {
      const nonce = hexAleatorio(16);
      resposta.setHeader(
        "Content-Security-Policy",
        `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; ` +
          "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      );
      enviar(resposta, 200, "text/html", paginaDoRetorno(nonce));
    } else if (pedido.method === "POST" && url.pathname === "/retorno") {
      await this.receberDaPagina(pedido, resposta);
    } else {
      enviar(
        resposta,
        404,
        "text/html",
        paginaDeAviso("Página não encontrada", "Volte ao VS Code para entrar."),
      );
    }
  }

  private entrar(url: URL, resposta: http.ServerResponse): void {
    if (!this.destino || url.searchParams.get("c") !== this.codigo) {
      enviar(
        resposta,
        404,
        "text/html",
        paginaDeAviso(
          "Este login não vale mais",
          "Volte ao VS Code e clique em Entrar com Google de novo.",
        ),
      );
      return;
    }
    resposta.writeHead(302, { Location: this.destino.endereco });
    resposta.end();
  }

  // O POST do formulário do site (os campos são o próprio login) ou da página
  // de retorno (a query e o fragmento como vieram do site). A resposta espera
  // a extensão conferir a conta.
  private async receberDaPagina(
    pedido: http.IncomingMessage,
    resposta: http.ServerResponse,
  ): Promise<void> {
    const corpo = await lerCorpo(pedido);
    if (corpo === undefined) {
      enviar(resposta, 413, "text/plain", "Retorno grande demais.");
      return;
    }

    const dados = new URLSearchParams(corpo);
    const daPagina = dados.has("fragmento") || dados.has("consulta");
    const espera: Espera = { resposta, formato: daPagina ? "json" : "html" };
    // O script da página de retorno é deste servidor; o formulário vem do
    // site, cuja origem o navegador pode nem informar (no-referrer).
    const origem = pedido.headers.origin;
    if (daPagina && origem && !this.hostsAceitos.has(hostDaOrigem(origem))) {
      responder(espera, 403, { estado: "erro", mensagem: "Pedido de outro site." });
      return;
    }

    const retorno: RetornoDoSite = daPagina
      ? { query: dados.get("consulta") ?? "", fragment: dados.get("fragmento") ?? "" }
      : { query: "", fragment: corpo };
    if (this.jaRecebeu) {
      responder(espera, 409, { estado: "repetido" });
      return;
    }
    // Um retorno de outro login (ou sem state) não encerra o que está em
    // andamento: o certo ainda pode chegar.
    if (!this.destino || estadoDoRetorno(retorno) !== this.destino.estado) {
      responder(espera, 400, {
        estado: "erro",
        mensagem: "Este retorno não é do login em andamento.",
      });
      return;
    }

    this.jaRecebeu = true;
    this.pagina = espera;
    this.esperaDaPagina = setTimeout(
      () => this.responderPagina({ estado: "aguardando" }),
      this.tempoDaPaginaMs,
    );
    this.receber(retorno);
  }

  private responderPagina(dados: RespostaDaPagina): void {
    const pagina = this.pagina;
    this.pagina = undefined;
    clearTimeout(this.esperaDaPagina);
    if (pagina && !pagina.resposta.writableEnded) {
      responder(pagina, 200, dados);
    }
  }
}

// O state vem no fragmento (como o site manda) ou na query.
function estadoDoRetorno(retorno: RetornoDoSite): string | null {
  return (
    new URLSearchParams(retorno.fragment).get("state") ??
    new URLSearchParams(retorno.query).get("state")
  );
}

function hostDaOrigem(origem: string): string {
  try {
    return new URL(origem).host.toLowerCase();
  } catch {
    return "";
  }
}

// Até TAMANHO_MAXIMO_DO_RETORNO; maior que isso, undefined.
function lerCorpo(pedido: http.IncomingMessage): Promise<string | undefined> {
  return new Promise((pronto, falhou) => {
    const partes: Buffer[] = [];
    let tamanho = 0;
    pedido.on("data", (parte: Buffer) => {
      tamanho += parte.length;
      if (tamanho > TAMANHO_MAXIMO_DO_RETORNO) {
        pronto(undefined);
        pedido.destroy();
        return;
      }
      partes.push(parte);
    });
    pedido.on("end", () => pronto(Buffer.concat(partes).toString("utf8")));
    pedido.on("error", falhou);
  });
}

function responder(espera: Espera, status: number, dados: RespostaDaPagina): void {
  if (espera.formato === "json") {
    const corpo = JSON.stringify({ ...dados, ...textosDoResultado(dados) });
    enviar(espera.resposta, status, "application/json", corpo);
  } else {
    enviar(espera.resposta, status, "text/html", paginaDoResultado(dados));
  }
}

function enviar(
  resposta: http.ServerResponse,
  status: number,
  tipo: string,
  corpo: string,
): void {
  resposta.writeHead(status, { "Content-Type": `${tipo}; charset=utf-8` });
  resposta.end(corpo);
}
