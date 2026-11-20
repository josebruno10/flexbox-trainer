import { ehNivel } from "../../niveis";
import { vscode } from "../api";
import {
  botaoAbrirAba,
  botaoAtualizarPreview,
  botaoCodigo,
  botaoCriarArquivos,
  botaoEncerrarDesafio,
  botaoNovoDesafio,
  botaoPorCodigo,
  botaoPuxarProgresso,
  botaoRefazer,
  botaoSair,
  botaoVerExtensoesIa,
  botaoVerHistorico,
  botaoVerificar,
  botoesNivel,
  botoesVista,
  valorFundo,
} from "./elementos";
import { selecionarComponente } from "./componentes";
import { copiarAoClicar } from "./copiar";
import { ligarCorrecoes } from "./correcoes";
import { estado } from "./estado";
import { definirVista, marcarNivel } from "./quadro";
import { solicitarVerificacao } from "./verificacao";

// Os botões da barra lateral. Quase todos só pedem algo à extensão.
export function ligarAcoes(): void {
  botaoNovoDesafio?.addEventListener("click", () => {
    vscode.postMessage({ type: "novoDesafio" });
  });

  botaoPorCodigo.addEventListener("click", () => {
    vscode.postMessage({ type: "abrirPorCodigo" });
  });

  botaoPuxarProgresso.addEventListener("click", () => {
    vscode.postMessage({ type: "puxarProgresso" });
  });

  botaoRefazer.addEventListener("click", () => {
    vscode.postMessage({ type: "refazer" });
  });

  botaoVerHistorico.addEventListener("click", () => {
    vscode.postMessage({ type: "verHistorico" });
  });

  botaoCodigo.addEventListener("click", () => {
    if (!estado.desafio?.codigo) {
      return;
    }
    vscode.postMessage({ type: "copiarCodigo" });
    botaoCodigo.classList.add("copiado");
    window.setTimeout(() => botaoCodigo.classList.remove("copiado"), 900);
  });

  copiarAoClicar(valorFundo, () => valorFundo.dataset.copiar);

  botaoEncerrarDesafio?.addEventListener("click", () => {
    botaoEncerrarDesafio.disabled = true;
    vscode.postMessage({ type: "encerrarDesafio" });
  });

  botaoAtualizarPreview?.addEventListener("click", () => {
    vscode.postMessage({ type: "atualizarPreview" });
  });

  botaoVerificar?.addEventListener("click", () => {
    void solicitarVerificacao();
  });

  botaoVerExtensoesIa?.addEventListener("click", () => {
    vscode.postMessage({ type: "verExtensoesIa" });
  });

  botaoCriarArquivos?.addEventListener("click", () => {
    vscode.postMessage({ type: "criarArquivos" });
  });

  botaoAbrirAba?.addEventListener("click", () => {
    vscode.postMessage({ type: "abrirPainelGabarito" });
  });

  botaoSair?.addEventListener("click", () => {
    vscode.postMessage({ type: "logout" });
  });

  for (const botao of botoesVista) {
    botao.addEventListener("click", () =>
      definirVista(botao.dataset.vista === "pagina" ? "pagina" : "gabarito"),
    );
  }

  // Um item do que corrigir aparece destacado no gabarito.
  ligarCorrecoes((componente) => {
    definirVista("gabarito");
    selecionarComponente(componente);
  });

  // O nível vale para os desafios novos; a extensão guarda a escolha.
  for (const botao of botoesNivel) {
    botao.addEventListener("click", () => {
      if (ehNivel(botao.dataset.nivel)) {
        marcarNivel(botao.dataset.nivel);
        vscode.postMessage({ type: "definirNivel", nivel: botao.dataset.nivel });
      }
    });
  }
}
