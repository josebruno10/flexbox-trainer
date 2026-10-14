import * as vscode from "vscode";

// O tempo e a última precisão ficam na barra de status, à vista enquanto o
// aluno escreve o CSS com a barra lateral fechada.
export type EstadoBarraDeStatus = {
  inicioMs: number;
  fimMs?: number;
  precisao?: number;
  invalidado: boolean;
};

export type ConteudoBarraDeStatus = {
  texto: string;
  dica: string;
  aviso: boolean;
};

const COMANDO_ABRIR_BARRA = "workbench.view.extension.flexboxTrainer";

export function conteudoBarraDeStatus(
  estado: EstadoBarraDeStatus,
  agora: number,
): ConteudoBarraDeStatus {
  const tempo = formatarTempo((estado.fimMs ?? agora) - estado.inicioMs);
  const partes = [estado.invalidado ? `$(warning) ${tempo}` : `$(watch) ${tempo}`];

  if (estado.invalidado) {
    partes.push("invalidado");
  } else if (estado.fimMs !== undefined) {
    partes.push("encerrado");
  }
  if (estado.precisao !== undefined) {
    partes.push(
      `${estado.precisao.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}%`,
    );
  }

  return {
    texto: partes.join(" · "),
    dica: estado.invalidado
      ? "FlexBox Trainer: o desafio foi invalidado e não pode mais ser corrigido. Clique para abrir a barra lateral."
      : "FlexBox Trainer: tempo do desafio e última precisão. Clique para abrir a barra lateral.",
    aviso: estado.invalidado,
  };
}

export class BarraDeStatus implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private estado?: EstadoBarraDeStatus;
  private relogio?: ReturnType<typeof setInterval>;

  public constructor(
    item: vscode.StatusBarItem = vscode.window.createStatusBarItem(
      "flexbox-trainer.tempo",
      vscode.StatusBarAlignment.Left,
      100,
    ),
  ) {
    this.item = item;
    this.item.name = "FlexBox Trainer";
    this.item.command = COMANDO_ABRIR_BARRA;
  }

  /** Sem estado (sem sessão ou sem desafio), o item some. */
  public atualizar(estado: EstadoBarraDeStatus | undefined): void {
    this.estado = estado;
    // O relógio anda até o desafio ser encerrado, como o da barra lateral.
    const andando = Boolean(estado && estado.fimMs === undefined);
    if (andando && !this.relogio) {
      this.relogio = setInterval(() => this.desenhar(), 1000);
    } else if (!andando && this.relogio) {
      clearInterval(this.relogio);
      this.relogio = undefined;
    }
    this.desenhar();
  }

  public dispose(): void {
    if (this.relogio) {
      clearInterval(this.relogio);
    }
    this.item.dispose();
  }

  private desenhar(): void {
    if (!this.estado) {
      this.item.hide();
      return;
    }

    const conteudo = conteudoBarraDeStatus(this.estado, Date.now());
    this.item.text = conteudo.texto;
    this.item.tooltip = conteudo.dica;
    this.item.backgroundColor = conteudo.aviso
      ? new vscode.ThemeColor("statusBarItem.warningBackground")
      : undefined;
    this.item.show();
  }
}

export function formatarTempo(tempoMs: number): string {
  const totalSegundos = Math.max(0, Math.floor(tempoMs / 1000));
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  const partes = [minutos, segundos].map((parte) =>
    parte.toString().padStart(2, "0"),
  );
  if (horas > 0) {
    partes.unshift(horas.toString().padStart(2, "0"));
  }
  return partes.join(":");
}
