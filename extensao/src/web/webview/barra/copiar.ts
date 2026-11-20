import { vscode } from "../api";

// O que o aluno costuma copiar (o código, as cores, as medidas) se copia com
// um clique, como na aba do gabarito. A extensão grava na área de
// transferência; o botão fica na cor de destaque por um instante.

export function copiarAoClicar(
  botao: HTMLButtonElement,
  texto: () => string | undefined,
): void {
  botao.addEventListener("click", (evento) => {
    // Dentro do detalhe do componente, o clique não seleciona outro.
    evento.stopPropagation();
    const valor = texto();
    if (!valor) {
      return;
    }
    vscode.postMessage({ type: "copiar", texto: valor });
    botao.classList.add("copiado");
    window.setTimeout(() => botao.classList.remove("copiado"), 900);
  });
}

/** Um valor que parece texto e copia `texto` ao clicar. */
export function criarValorCopiavel(
  conteudo: Array<Node | string>,
  texto: string,
  dica: string,
): HTMLButtonElement {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "valor-copiavel";
  botao.title = `${dica}: ${texto}`;
  botao.append(...conteudo);
  copiarAoClicar(botao, () => texto);
  return botao;
}
