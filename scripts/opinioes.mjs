// Junta as respostas do questionário de opinião (issues com a etiqueta
// "opinião", criadas pelo formulário .github/ISSUE_TEMPLATE/opiniao.yml) e
// calcula a nota SUS de cada uma e a média. Usa o gh, já autenticado.
// Uso: node scripts/opinioes.mjs
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const PERGUNTAS_SUS = 10;

/**
 * As respostas das 10 perguntas do SUS no corpo de uma issue do formulário,
 * ou nada se faltar alguma. O GitHub escreve cada campo como "### <rótulo>",
 * e a resposta começa pelo número (de 1 a 5).
 */
export function respostasSus(corpo) {
  const respostas = [];
  for (const secao of corpo.split(/^### /m).slice(1)) {
    const [titulo, ...resto] = secao.split("\n");
    const pergunta = /^(\d+)\./.exec(titulo)?.[1];
    const valor = /^\s*([1-5])\b/.exec(resto.join("\n").trim())?.[1];
    if (pergunta && Number(pergunta) <= PERGUNTAS_SUS && valor) {
      respostas[Number(pergunta) - 1] = Number(valor);
    }
  }
  return respostas.filter(Boolean).length === PERGUNTAS_SUS ? respostas : undefined;
}

/**
 * A nota SUS, de 0 a 100: nas perguntas ímpares, positivas, conta a resposta
 * menos 1; nas pares, negativas, 5 menos a resposta; a soma vezes 2,5.
 */
export function notaSus(respostas) {
  const soma = respostas.reduce(
    (total, resposta, indice) =>
      total + (indice % 2 === 0 ? resposta - 1 : 5 - resposta),
    0,
  );
  return soma * 2.5;
}

function principal() {
  const issues = JSON.parse(
    execFileSync(
      "gh",
      [
        "issue",
        "list",
        "--label",
        "opinião",
        "--state",
        "all",
        "--limit",
        "1000",
        "--json",
        "number,createdAt,body",
      ],
      { encoding: "utf8" },
    ),
  );

  const notas = [];
  for (const issue of issues) {
    const respostas = respostasSus(issue.body ?? "");
    const dia = issue.createdAt.slice(0, 10);
    if (!respostas) {
      console.log(`#${issue.number} (${dia}): respostas incompletas, fora da média`);
      continue;
    }
    const nota = notaSus(respostas);
    notas.push(nota);
    console.log(`#${issue.number} (${dia}): SUS ${nota.toFixed(1)}`);
  }

  if (notas.length === 0) {
    console.log("Nenhuma resposta completa ainda.");
    return;
  }
  const media = notas.reduce((soma, nota) => soma + nota, 0) / notas.length;
  // Uma nota acima de 68 fica acima da média dos sistemas avaliados com o SUS.
  console.log(
    `\n${notas.length} ${notas.length === 1 ? "resposta" : "respostas"}; ` +
      `média SUS ${media.toFixed(1)} (${media >= 68 ? "acima" : "abaixo"} de 68, a média de referência).`,
  );
}

// Só roda sozinho quando chamado pelo node; importado, só exporta as contas.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal();
}
