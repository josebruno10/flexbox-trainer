import * as assert from "assert";
import * as vscode from "vscode";
import {
  BarraDeStatus,
  conteudoBarraDeStatus,
} from "../../provider/barraDeStatus";

suite("Barra de status", () => {
  test("mostra o tempo e a última precisão do desafio em andamento", () => {
    const conteudo = conteudoBarraDeStatus(
      { inicioMs: 0, precisao: 87.42, invalidado: false },
      754_000,
    );

    assert.strictEqual(conteudo.texto, "$(watch) 12:34 · 87,42%");
    assert.strictEqual(conteudo.aviso, false);
  });

  test("congela o tempo ao encerrar e destaca o desafio invalidado", () => {
    assert.strictEqual(
      conteudoBarraDeStatus({ inicioMs: 1_000, fimMs: 61_000, invalidado: false }, 999_999).texto,
      "$(watch) 01:00 · encerrado",
    );

    const invalidado = conteudoBarraDeStatus({ inicioMs: 0, invalidado: true }, 3_725_000);
    assert.strictEqual(invalidado.texto, "$(warning) 01:02:05 · invalidado");
    assert.strictEqual(invalidado.aviso, true);
  });

  test("some sem desafio e abre a barra lateral ao ser clicada", () => {
    const item = {
      visivel: false,
      descartado: false,
      text: "",
      command: undefined as unknown,
      show() {
        this.visivel = true;
      },
      hide() {
        this.visivel = false;
      },
      dispose() {
        this.descartado = true;
      },
    };
    const barra = new BarraDeStatus(item as unknown as vscode.StatusBarItem);

    barra.atualizar({ inicioMs: Date.now(), invalidado: false });
    assert.strictEqual(item.visivel, true);
    assert.strictEqual(item.command, "flexbox-trainer.sidebar.focus");
    assert.match(item.text, /^\$\(watch\) 00:0\d$/);

    barra.atualizar(undefined);
    assert.strictEqual(item.visivel, false);

    barra.dispose();
    assert.strictEqual(item.descartado, true);
  });
});
