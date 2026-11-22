import { ConfiguracaoServidor } from "../../types";
import { EstadoDoSalvamento } from "./estado";
import {
  ContextoDoProgresso,
  estaNoTorneio,
  ResultadoDoSalvamento,
  salvarProgresso,
  salvarProgressoAutomatico,
} from "./progresso";

/**
 * O progresso no servidor, para quem está no torneio: salvo sozinho depois de
 * cada nota e pelo menu. Guarda o último salvamento, que a barra lateral
 * mostra embaixo do Verificar, e os desafios em que salvar sozinho deu recusa
 * ou erro nesta sessão: neles, não tenta de novo a cada Verificar (o Salvar
 * progresso do menu ainda tenta).
 */
export class SalvamentoNoServidor {
  private readonly semSalvarSozinho = new Set<string>();

  private ultimo?: {
    codigo: string;
    estado: "salvando" | "salvo" | "falhou";
    instante?: number;
  };

  public constructor(
    private readonly contexto: () => ContextoDoProgresso,
    private readonly codigoAtual: () => string | undefined,
    private readonly configuracao: () => ConfiguracaoServidor,
    // A barra lateral mostra o aviso novo.
    private readonly aoMudar: () => void,
  ) {}

  /** Pelo menu: pergunta e avisa. Devolve se salvou. */
  public async salvarPeloMenu(): Promise<boolean> {
    const codigo = this.codigoAtual();
    const salvou = await salvarProgresso(this.contexto());
    if (salvou && codigo) {
      // O aluno tentou de novo e deu certo: volta a salvar sozinho.
      this.semSalvarSozinho.delete(codigo);
      this.ultimo = { codigo, estado: "salvo", instante: Date.now() };
      this.aoMudar();
    }
    return salvou;
  }

  /** Depois de cada nota, sem perguntar. Devolve o que aconteceu. */
  public async salvarSozinho(): Promise<ResultadoDoSalvamento> {
    const codigo = this.codigoAtual();
    if (
      !codigo ||
      this.semSalvarSozinho.has(codigo) ||
      !estaNoTorneio(this.configuracao())
    ) {
      return "ignorado";
    }
    const anterior = this.ultimo;
    this.ultimo = { codigo, estado: "salvando" };
    this.aoMudar();
    const resultado = await salvarProgressoAutomatico(this.contexto());
    if (resultado === "recusado" || resultado === "falhou") {
      this.semSalvarSozinho.add(codigo);
      this.ultimo = { codigo, estado: "falhou" };
    } else if (resultado === "salvo") {
      this.ultimo = { codigo, estado: "salvo", instante: Date.now() };
    } else {
      this.ultimo = anterior;
    }
    // O aviso embaixo do Verificar e, salvo, o ⤓ Continuar no histórico.
    this.aoMudar();
    return resultado;
  }

  /** O que o aviso embaixo do Verificar diz sobre o desafio atual. */
  public estado(): EstadoDoSalvamento {
    const codigo = this.codigoAtual();
    const torneio = estaNoTorneio(this.configuracao());
    if (codigo && this.semSalvarSozinho.has(codigo)) {
      return { torneio, estado: "falhou" };
    }
    const atual = this.ultimo?.codigo === codigo ? this.ultimo : undefined;
    return {
      torneio,
      estado: atual?.estado ?? "aguardando",
      ...(atual?.instante ? { instante: atual.instante } : {}),
    };
  }
}
