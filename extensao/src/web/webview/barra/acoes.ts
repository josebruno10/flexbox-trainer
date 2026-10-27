import { ehNivel } from "../../niveis";
import { vscode } from "../api";
import {
  botaoAbrirAba,
  botaoAtualizarPreview,
  botaoCodigo,
  botaoCopiarResultado,
  botaoCriarArquivos,
  botaoDesafioDia,
  botaoEncerrarDesafio,
  botaoNovoDesafio,
  botaoPorCodigo,
  botaoRefazer,
  botaoSair,
  botaoVerExtensoesIa,
  botaoVerHistorico,
  botaoVerificar,
  botoesNivel,
  botoesVista,
  textoDoBotao,
} from "./elementos";
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

  botaoDesafioDia.addEventListener("click", () => {
    vscode.postMessage({ type: "desafioDoDia" });
  });

  botaoCopiarResultado.addEventListener("click", () => {
    vscode.postMessage({ type: "copiarResultado" });
    textoDoBotao(botaoCopiarResultado).textContent = "Copiado";
    window.setTimeout(() => {
      textoDoBotao(botaoCopiarResultado).textContent = "Copiar resultado";
    }, 1500);
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
