// O script da barra lateral. Cada parte dela fica num módulo de ./barra; aqui
// só chegam as mensagens da extensão e cada uma vai para a sua parte.
import { vscode } from "./api";
import { ligarAcoes } from "./barra/acoes";
import { ligarComponentes } from "./barra/componentes";
import { renderizarEstadoAutenticacao, renderizarExtensoesIa } from "./barra/conta";
import { ligarEvolucao } from "./barra/evolucao";
import {
  desenharDesafio,
  desenharEstadoInicial,
  marcarNivel,
  renderizarMetaDesafio,
} from "./barra/quadro";
import { mostrarMensagem } from "./barra/resultado";
import { renderizarWorkspace } from "./barra/suaPagina";
import type { MensagemDaExtensao } from "./barra/tipos";
import {
  receberConclusao,
  receberHistorico,
  receberHistoricoDesafios,
  receberProgresso,
  receberResultado,
  solicitarVerificacao,
} from "./barra/verificacao";

function receber(mensagem: MensagemDaExtensao): void {
  switch (mensagem.type) {
    case "dadosDesafio":
      desenharDesafio(mensagem.payload);
      break;
    case "dadosWorkspace":
      renderizarWorkspace(mensagem.payload);
      break;
    // O atalho de Verificar (Ctrl+Alt+V), vindo da extensão.
    case "verificar":
      void solicitarVerificacao();
      break;
    case "nivel":
      marcarNivel(mensagem.payload);
      break;
    case "historicoDesafios":
      receberHistoricoDesafios(mensagem.payload);
      break;
    case "historicoNotas":
      receberHistorico(mensagem.payload);
      break;
    case "resultadoAvaliacao":
      receberResultado(mensagem.payload);
      break;
    case "progressoVerificacao":
      receberProgresso(mensagem.payload);
      break;
    case "verificacaoConcluida":
      receberConclusao(mensagem.payload);
      break;
    case "statusServidor":
      mostrarMensagem(mensagem.payload.mensagem);
      break;
    case "estadoAutenticacao":
      renderizarEstadoAutenticacao(mensagem.payload);
      break;
    case "extensoesIa":
      renderizarExtensoesIa(mensagem.payload);
      break;
  }
}

ligarEvolucao();
ligarAcoes();
ligarComponentes();
window.addEventListener("message", (event: MessageEvent<MensagemDaExtensao>) =>
  receber(event.data),
);

desenharEstadoInicial();
window.setInterval(renderizarMetaDesafio, 250);
vscode.postMessage({ type: "pronto" });
