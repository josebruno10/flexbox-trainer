import * as assert from "assert";
import {
  criarResumoWorkspaceVazio,
  modeloCss,
  modeloHtml,
  temTrabalhoDoAluno,
} from "../../services/workspace";
import { ResumoWorkspace } from "../../types";

function resumo(textoHtml: string, textoCss: string): ResumoWorkspace {
  return {
    ...criarResumoWorkspaceVazio(),
    textoHtml,
    textoCss,
    temArquivoHtml: true,
    temArquivoCss: true,
  };
}

suite("Arquivos de treino", () => {
  test("a base, de qualquer tamanho de gabarito, não conta como trabalho do aluno", () => {
    assert.strictEqual(temTrabalhoDoAluno(resumo(modeloHtml(), modeloCss(800, 800))), false);
    assert.strictEqual(temTrabalhoDoAluno(resumo(modeloHtml(), modeloCss(960, 540))), false);
    // Espaços e comentários a mais também não.
    assert.strictEqual(
      temTrabalhoDoAluno(resumo(`${modeloHtml()}\n\n<!-- rascunho -->`, `/* oi */\n${modeloCss(800, 800)}`)),
      false,
    );
  });

  test("arquivos vazios ou que não existem não contam", () => {
    assert.strictEqual(temTrabalhoDoAluno(criarResumoWorkspaceVazio()), false);
    assert.strictEqual(temTrabalhoDoAluno(resumo("", "  \n")), false);
  });

  test("conta qualquer HTML ou CSS escrito pelo aluno", () => {
    assert.strictEqual(
      temTrabalhoDoAluno(resumo(modeloHtml().replace("<body>", '<body>\n  <div class="topo"></div>'), modeloCss(800, 800))),
      true,
    );
    assert.strictEqual(
      temTrabalhoDoAluno(resumo(modeloHtml(), `${modeloCss(800, 800)}\n.topo { height: 100px; }`)),
      true,
    );
  });
});
