import { NOME_DO_NIVEL, nivelDoCodigo } from "../../niveis";
import { vscode } from "../api";
import { criarValorCopiavel } from "./copiar";
import {
  botaoPuxarProgresso,
  botaoVerHistorico,
  historicoNotas,
  historicoVazio,
  linhaMelhor,
  linhaRecorde,
  linhaTentativas,
  listaHistorico,
  textoDoBotao,
  valorMelhor,
  valorRecorde,
  valorTentativas,
} from "./elementos";
import { estado } from "./estado";
import { renderizarEvolucao } from "./evolucao";
import { formatarTempo } from "../../telas/comum";
import { formatarPorcentagem } from "./formatos";
import type { HistoricoDesafiosRecebido } from "./tipos";

// O recorde do código em andamento, quando o aluno já o fez antes.
let recordeAtual: number | undefined;
let notasAtuais: number[] = [];
// No histórico cabem as três últimas tentativas na largura da barra.
const TENTATIVAS_NO_HISTORICO = 3;

// As últimas precisões do desafio e a melhor: a evolução, sem dizer o que
// está errado.
export function renderizarHistorico(notas: number[]): void {
  notasAtuais = notas;
  const comTentativas = notas.length >= 2;
  linhaTentativas.hidden = !comTentativas;
  linhaMelhor.hidden = !comTentativas;
  linhaRecorde.hidden = recordeAtual === undefined;
  historicoNotas.hidden = !comTentativas && recordeAtual === undefined;
  if (recordeAtual !== undefined) {
    valorRecorde.textContent = `${formatarPorcentagem(recordeAtual)}%`;
  }
  if (!comTentativas) {
    return;
  }

  const ultimas = notas.slice(-TENTATIVAS_NO_HISTORICO);
  const partes: Array<Node | string> = notas.length > ultimas.length ? ["… "] : [];
  ultimas.forEach((nota, indice) => {
    const atual = indice === ultimas.length - 1;
    const valor = document.createElement("span");
    valor.className = atual ? "atual" : "anterior";
    valor.textContent = formatarPorcentagem(nota) + (atual ? "%" : "");
    partes.push(...(indice > 0 ? [" → ", valor] : [valor]));
  });
  valorTentativas.replaceChildren(...partes);
  valorMelhor.textContent = `${formatarPorcentagem(Math.max(...notas))}%`;
}

// Os desafios mais recentes do aluno, com a melhor nota e o tempo dela. O
// código se copia com um clique; um desafio com progresso salvo pode
// continuar de onde parou (⤓), e todos podem ser refeitos do zero (↻). O
// recorde do desafio em andamento vai para o Resultado.
export function renderizarHistoricoDesafios(
  historico: HistoricoDesafiosRecebido,
): void {
  recordeAtual = historico.recorde ?? undefined;
  renderizarHistorico(notasAtuais);

  // A seção fica à vista mesmo vazia: dela também se puxa o progresso.
  historicoVazio.hidden = historico.registros.length > 0;
  const salvos = new Set(historico.salvos ?? []);
  botaoPuxarProgresso.hidden = !historico.torneio;
  renderizarEvolucao(historico.evolucao ?? []);
  botaoVerHistorico.hidden = historico.total <= historico.registros.length;
  textoDoBotao(botaoVerHistorico).textContent = `Ver todos (${historico.total})`;
  listaHistorico.replaceChildren(
    ...historico.registros.map((registro) => {
      const item = document.createElement("li");
      item.classList.toggle("atual", registro.codigo === estado.desafio?.codigo);
      const nomeDoNivel = NOME_DO_NIVEL[nivelDoCodigo(registro.codigo)];
      const codigo = document.createElement("span");
      const nivel = document.createElement("span");
      nivel.className = "nivel";
      nivel.textContent = nomeDoNivel;
      const copiar = criarValorCopiavel(
        [registro.codigo],
        registro.codigo,
        "Copiar o código: com ele, outra pessoa abre este mesmo desafio",
      );
      copiar.classList.replace("valor-copiavel", "valor-codigo");
      codigo.append(copiar, " ", nivel);
      const nota = document.createElement("span");
      nota.textContent = `${formatarPorcentagem(registro.melhor)}%`;
      const tempo = document.createElement("span");
      tempo.className = "tempo";
      tempo.textContent = formatarTempo(registro.tempoMelhorMs);
      const continuar = salvos.has(registro.codigo)
        ? criarAcao(
            "⤓",
            `Continuar o desafio ${registro.codigo}: traz o index.html e o style.css que você salvou`,
            () => vscode.postMessage({ type: "puxarProgresso", codigo: registro.codigo }),
          )
        : semAcao();
      const refazer = criarAcao(
        "↻",
        `Refazer o desafio ${registro.codigo} (${nomeDoNivel}) do zero, com os arquivos limpos`,
        () => vscode.postMessage({ type: "refazer", codigo: registro.codigo }),
      );
      item.append(codigo, nota, tempo, continuar, refazer);
      return item;
    }),
  );
}

function criarAcao(
  simbolo: string,
  dica: string,
  acao: () => void,
): HTMLButtonElement {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "discreto acao";
  botao.textContent = simbolo;
  botao.title = dica;
  botao.setAttribute("aria-label", dica);
  botao.addEventListener("click", acao);
  return botao;
}

// O lugar do Continuar, vazio, para as colunas ficarem alinhadas.
function semAcao(): HTMLSpanElement {
  const vazio = document.createElement("span");
  vazio.className = "sem-acao";
  vazio.setAttribute("aria-hidden", "true");
  return vazio;
}
