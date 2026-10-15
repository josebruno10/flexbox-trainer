import { NOME_DO_NIVEL } from "../../niveis";
import { formatarMedida, normalizarHex } from "../desenhoGabarito";
import { passarMouse, selecionar } from "./destaques";
import { lista, resumo } from "./elementos";
import { estado } from "./estado";
import type { GabaritoRecebido } from "./tipos";
import { criarAmostra, criarDado, criarValor } from "./valores";

// O resumo do gabarito (código, tamanho, fundo) e a lista dos componentes
// com as medidas.

export function renderizarResumo(atual: GabaritoRecebido): void {
  const rotulo = document.createElement("p");
  rotulo.className = "rotulo";
  // O código identifica o desafio, para conferir que é o mesmo da turma.
  rotulo.textContent = atual.codigo
    ? `Desafio ${atual.codigo.slice(0, 3)} ${atual.codigo.slice(3)}` +
      (atual.nivel ? ` · ${NOME_DO_NIVEL[atual.nivel]}` : "")
    : "Gabarito";
  const titulo = document.createElement("strong");
  titulo.className = "titulo-tela";
  titulo.textContent =
    `${formatarMedida(atual.width)} × ${formatarMedida(atual.height)} px`;
  const cabecalho = document.createElement("div");
  cabecalho.append(rotulo, titulo);

  const corFundo = normalizarHex(atual.backgroundColor);
  const dados = document.createElement("dl");
  dados.className = "dados";
  dados.append(
    criarDado(
      "Fundo",
      criarAmostra(atual.backgroundColor),
      criarValor(corFundo, corFundo, "Copiar a cor do fundo"),
    ),
    criarDado("Componentes", String(atual.blocks.length)),
  );
  resumo.replaceChildren(cabecalho, dados);
}

export function renderizarLista(atual: GabaritoRecebido): void {
  lista.replaceChildren(
    ...atual.blocks.map((bloco) => {
      const item = document.createElement("li");
      item.className = "componente";
      item.dataset.id = String(bloco.id);
      item.classList.toggle("selecionado", bloco.id === estado.selecionadoId);

      // Uma linha por componente: a amostra (redonda nos círculos), o número
      // e os valores, que se copiam com um clique.
      const circulo = bloco.shape === "circle";
      const forma = circulo ? "Círculo" : "Retângulo";
      item.title = `${forma} #${bloco.id}`;

      const amostra = criarAmostra(bloco.color);
      amostra.classList.toggle("circulo", circulo);
      const numero = document.createElement("span");
      numero.className = "numero-componente";
      numero.textContent = `#${bloco.id}`;
      const nomeParaLeitor = document.createElement("span");
      nomeParaLeitor.className = "so-leitor";
      nomeParaLeitor.textContent = forma;

      const largura = formatarMedida(bloco.width);
      const altura = formatarMedida(bloco.height);
      const cor = normalizarHex(bloco.color);
      const valores = document.createElement("div");
      valores.className = "valores";
      // Círculos também em largura e altura: o aluno os faz com
      // border-radius numa caixa.
      valores.append(
        criarValor(`larg. ${largura}`, `${largura}px`, "Copiar a largura"),
        criarValor(`alt. ${altura}`, `${altura}px`, "Copiar a altura"),
        criarValor(cor, cor, "Copiar a cor"),
      );

      item.append(amostra, numero, nomeParaLeitor, valores);
      item.addEventListener("click", () => selecionar(bloco.id, false));
      item.addEventListener("mouseenter", () => passarMouse(bloco.id));
      item.addEventListener("mouseleave", () => passarMouse(undefined));
      return item;
    }),
  );
}
