import { avisoSalvamento } from "./elementos";
import { estado } from "./estado";
import type { SalvamentoRecebido } from "./tipos";

// Embaixo do Verificar, para quem está no torneio: cada verificação salva o
// progresso no servidor, e o aluno vê que o trabalho dele está guardado.

const TEXTOS: Record<SalvamentoRecebido["estado"], string> = {
  aguardando: "Cada verificação salva o seu progresso no servidor.",
  salvando: "Salvando no servidor…",
  salvo: "Salvo no servidor",
  falhou:
    "Não deu para salvar no servidor. Tente de novo pelo menu ⋯ (Salvar Progresso no Servidor).",
};

export function renderizarSalvamento(salvamento: SalvamentoRecebido): void {
  avisoSalvamento.hidden = !salvamento.torneio || !estado.desafio;
  avisoSalvamento.dataset.estado = salvamento.estado;
  const hora =
    salvamento.estado === "salvo" && salvamento.instante
      ? ` às ${new Date(salvamento.instante).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}.`
      : salvamento.estado === "salvo"
        ? "."
        : "";
  avisoSalvamento.textContent = TEXTOS[salvamento.estado] + hora;
}
