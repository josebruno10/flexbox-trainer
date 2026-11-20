import { vscode } from "../api";
import { formatarPorcentagem } from "../barra/formatos";
import { resumirDetalhes } from "../correcoes";
import { marcarCorrecoes } from "./componentes";
import type { ResultadoNaAba } from "../../types";
import { botaoVerificar, notaAba } from "./elementos";
import { estado } from "./estado";
import type { VerificacaoRecebida } from "./tipos";

// O Verificar da aba e a nota do desafio. A medição acontece na barra lateral
// (a extensão a abre e pede a verificação); a aba mostra as etapas e a nota.

export function ligarVerificacao(): void {
  botaoVerificar.addEventListener("click", () => {
    vscode.postMessage({ type: "verificar" });
  });
}

export function mostrarResultado(
  resultado: ResultadoNaAba | null,
  verificacao: VerificacaoRecebida,
): void {
  botaoVerificar.disabled = verificacao.andamento;
  estado.detalhes = resultado?.detalhes;
  marcarCorrecoes();

  if (verificacao.andamento) {
    notaAba.textContent = verificacao.etapa
      ? `Verificando: ${verificacao.etapa}`
      : "Verificando…";
    return;
  }

  if (!resultado || resultado.verificacoes === 0 || resultado.precisao === undefined) {
    notaAba.textContent = resultado?.aviso ?? "Nenhuma verificação.";
    return;
  }

  const partes: Array<string | HTMLElement> = [
    "Última ",
    destaque(`${formatarPorcentagem(resultado.precisao)}%`),
  ];
  if (resultado.melhor !== undefined && resultado.verificacoes > 1) {
    partes.push(" · Melhor ", destaque(`${formatarPorcentagem(resultado.melhor)}%`));
  }
  partes.push(
    ` · ${resultado.verificacoes} ${resultado.verificacoes === 1 ? "verificação" : "verificações"}`,
  );
  if (resultado.detalhes) {
    partes.push(` · ${resumirDetalhes(resultado.detalhes)}`);
  }
  if (resultado.invalidado) {
    partes.push(" · desafio invalidado");
  }
  if (resultado.aviso) {
    partes.push(` · ${resultado.aviso}`);
  }
  notaAba.replaceChildren(...partes);
}

function destaque(texto: string): HTMLElement {
  const forte = document.createElement("strong");
  forte.textContent = texto;
  return forte;
}
