import { vscode } from "../api";

// As peças do resumo e da lista: amostras de cor, valores que se copiam com
// um clique e as linhas de dados.

export function criarAmostra(cor: string): HTMLSpanElement {
  const amostra = document.createElement("span");
  amostra.className = "amostra";
  amostra.style.background = cor;
  return amostra;
}

// Clicar em um valor copia só o valor, sem selecionar o componente.
export function criarValor(
  rotulo: string,
  texto: string,
  dica: string,
): HTMLButtonElement {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "valor";
  botao.textContent = rotulo;
  botao.title = `${dica}: ${texto}`;
  botao.addEventListener("click", (evento) => {
    evento.stopPropagation();
    vscode.postMessage({ type: "copiar", texto });
    botao.classList.add("copiado");
    window.setTimeout(() => botao.classList.remove("copiado"), 900);
  });
  return botao;
}

export function criarDado(
  nome: string,
  ...valor: Array<Node | string>
): HTMLDivElement {
  const linha = document.createElement("div");
  const termo = document.createElement("dt");
  termo.textContent = nome;
  const descricao = document.createElement("dd");
  descricao.append(...valor);
  linha.append(termo, descricao);
  return linha;
}
