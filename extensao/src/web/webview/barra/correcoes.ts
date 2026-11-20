import type { DetalhesDaNota } from "../../types";
import { vscode } from "../api";
import {
  descreverAMais,
  descreverProblema,
  nomeDoComponente,
  paraCorrigir,
  resumirDetalhes,
} from "../correcoes";
import { criarAmostra } from "./componentes";
import {
  botaoTodasCorrecoes,
  caixaCorrecoes,
  listaCorrecoes,
  resumoCorrecoes,
} from "./elementos";
import { estado } from "./estado";

// O que corrigir, embaixo da nota: os componentes que mais tiram pontos,
// com o que está diferente em cada um. Clicar num deles o mostra no gabarito;
// a lista inteira fica na aba do gabarito.
const MAXIMO_NA_BARRA = 5;

let aoEscolher: (componente: number) => void = () => undefined;

export function ligarCorrecoes(escolher: (componente: number) => void): void {
  aoEscolher = escolher;
  botaoTodasCorrecoes.addEventListener("click", () => {
    vscode.postMessage({ type: "abrirPainelGabarito" });
  });
}

export function renderizarCorrecoes(detalhes: DetalhesDaNota | undefined): void {
  const desafio = estado.desafio;
  if (!detalhes || !desafio) {
    caixaCorrecoes.hidden = true;
    listaCorrecoes.replaceChildren();
    return;
  }

  caixaCorrecoes.hidden = false;
  resumoCorrecoes.textContent = resumirDetalhes(detalhes);
  const itens = paraCorrigir(detalhes);
  const linhas: HTMLLIElement[] = itens.slice(0, MAXIMO_NA_BARRA).map((item) => {
    const bloco = desafio.blocks.find((candidato) => candidato.id === item.componente);
    const cor = item.componente === "fundo" ? desafio.backgroundColor : bloco?.color ?? "";
    const amostra = criarAmostra(cor);
    amostra.classList.toggle("circulo", bloco?.shape === "circle");
    const nome = document.createElement("strong");
    nome.textContent = nomeDoComponente(item.componente, desafio.blocks);
    const texto = document.createElement("span");
    texto.textContent = item.problemas.map(descreverProblema).join("; ");

    const linha = document.createElement("li");
    linha.dataset.tipo = item.problemas[0]?.tipo ?? "";
    if (typeof item.componente === "number") {
      // Um botão: o componente aparece destacado no gabarito.
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "correcao";
      botao.title = "Mostrar no gabarito";
      const componente = item.componente;
      botao.addEventListener("click", () => aoEscolher(componente));
      botao.append(amostra, nome, texto);
      linha.append(botao);
    } else {
      const caixa = document.createElement("div");
      caixa.className = "correcao";
      caixa.append(amostra, nome, texto);
      linha.append(caixa);
    }
    return linha;
  });

  for (const forma of detalhes.aMais.slice(0, Math.max(0, MAXIMO_NA_BARRA - linhas.length))) {
    const linha = document.createElement("li");
    linha.dataset.tipo = "a-mais";
    const caixa = document.createElement("div");
    caixa.className = "correcao";
    const nome = document.createElement("strong");
    nome.textContent = "A mais";
    const texto = document.createElement("span");
    texto.textContent = `na sua página, sem par no gabarito: ${descreverAMais(forma)}`;
    caixa.append(criarAmostra(forma.cor), nome, texto);
    linha.append(caixa);
    linhas.push(linha);
  }
  listaCorrecoes.replaceChildren(...linhas);

  const restantes = itens.length + detalhes.aMais.length - linhas.length;
  botaoTodasCorrecoes.hidden = restantes <= 0;
  botaoTodasCorrecoes.textContent = `E mais ${restantes}: ver todos na aba do gabarito`;
}
