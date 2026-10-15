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
  test("a base não conta como trabalho do aluno", () => {
    assert.strictEqual(temTrabalhoDoAluno(resumo(modeloHtml(), modeloCss())), false);
    // Espaços e comentários a mais também não.
    assert.strictEqual(
      temTrabalhoDoAluno(resumo(`${modeloHtml()}\n\n<!-- rascunho -->`, `/* oi */\n${modeloCss()}`)),
      false,
    );
  });

  test("a base das versões anteriores, com o comentário no body, também não conta", () => {
    const baseAntiga = modeloHtml().replace(
      "<body>\n",
      "<body>\n  <!-- Recrie aqui o gabarito mostrado na barra lateral do FlexBox Trainer. -->\n",
    );
    assert.notStrictEqual(baseAntiga, modeloHtml());
    assert.strictEqual(temTrabalhoDoAluno(resumo(baseAntiga, modeloCss())), false);
  });

  test("a base das versões anteriores, com o tamanho no comentário do CSS, também não conta", () => {
    const cssAntigo = `/* A página tem o tamanho do gabarito: 800 × 800 px. */\n${modeloCss()}`;
    assert.strictEqual(temTrabalhoDoAluno(resumo(modeloHtml(), cssAntigo)), false);
  });

  test("arquivos vazios ou que não existem não contam", () => {
    assert.strictEqual(temTrabalhoDoAluno(criarResumoWorkspaceVazio()), false);
    assert.strictEqual(temTrabalhoDoAluno(resumo("", "  \n")), false);
  });

  test("conta qualquer HTML ou CSS escrito pelo aluno", () => {
    assert.strictEqual(
      temTrabalhoDoAluno(resumo(modeloHtml().replace("<body>", '<body>\n  <div class="topo"></div>'), modeloCss())),
      true,
    );
    assert.strictEqual(
      temTrabalhoDoAluno(resumo(modeloHtml(), `${modeloCss()}\n.topo { height: 100px; }`)),
      true,
    );
  });
});
