import { NOME_DO_NIVEL, nivelDoCodigo } from "../../niveis";
import { vscode } from "./api";
import {
  botaoCopiarResultado,
  botaoVerHistorico,
  historicoNotas,
  linhaMelhor,
  linhaRecorde,
  linhaTentativas,
  listaHistorico,
  secaoHistorico,
  valorMelhor,
  valorRecorde,
  valorTentativas,
} from "./elementos";
import { estado } from "./estado";
import { renderizarEvolucao } from "./evolucao";
import {
  formatarCodigo,
  formatarPorcentagem,
  formatarTempo,
} from "./formatos";
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
  // Só há o que copiar depois da primeira nota deste desafio.
  botaoCopiarResultado.hidden = notas.length === 0;
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

// Os desafios mais recentes do aluno, com a melhor nota e o tempo dela; cada
// um pode ser refeito. O recorde do desafio em andamento vai para o Resultado.
export function renderizarHistoricoDesafios(
  historico: HistoricoDesafiosRecebido,
): void {
  recordeAtual = historico.recorde ?? undefined;
  renderizarHistorico(notasAtuais);

  secaoHistorico.hidden = historico.registros.length === 0;
  renderizarEvolucao(historico.evolucao ?? []);
  botaoVerHistorico.hidden = historico.total <= historico.registros.length;
  botaoVerHistorico.textContent = `Ver todos (${historico.total})`;
  listaHistorico.replaceChildren(
    ...historico.registros.map((registro) => {
      const item = document.createElement("li");
      item.classList.toggle("atual", registro.codigo === estado.desafio?.codigo);
      const nomeDoNivel = NOME_DO_NIVEL[nivelDoCodigo(registro.codigo)];
      const codigo = document.createElement("span");
      const nivel = document.createElement("span");
      nivel.className = "nivel";
      nivel.textContent = nomeDoNivel;
      codigo.append(formatarCodigo(registro.codigo), " ", nivel);
      const nota = document.createElement("span");
      nota.textContent = `${formatarPorcentagem(registro.melhor)}%`;
      const tempo = document.createElement("span");
      tempo.className = "tempo";
      tempo.textContent = formatarTempo(registro.tempoMelhorMs);
      const refazer = document.createElement("button");
      refazer.type = "button";
      refazer.className = "discreto";
      refazer.textContent = "↻";
      refazer.title = `Refazer o desafio ${formatarCodigo(registro.codigo)} (${nomeDoNivel})`;
      refazer.setAttribute("aria-label", refazer.title);
      refazer.addEventListener("click", () => {
        vscode.postMessage({ type: "refazer", codigo: registro.codigo });
      });
      item.append(codigo, nota, tempo, refazer);
      return item;
    }),
  );
}
