import * as assert from "assert";
import * as vscode from "vscode";
import { RetornoLocal } from "../../../auth/retornoLocal";
import { voltarDoLogin } from "../../../auth/voltaDoLogin";
import { COMANDO_ABRIR_BARRA } from "../../../provider/barraDeStatus";

// O fim do login no navegador, do lado do VS Code.
suite("Volta do login", () => {
  const executarOriginal = vscode.commands.executeCommand;
  const mostrarErroOriginal = vscode.window.showErrorMessage;

  teardown(() => {
    vscode.commands.executeCommand = executarOriginal;
    vscode.window.showErrorMessage = mostrarErroOriginal;
  });

  function registrar(semFoco = false): { comandos: string[]; erros: string[] } {
    const comandos: string[] = [];
    const erros: string[] = [];
    vscode.commands.executeCommand = (async (comando: string) => {
      if (semFoco && comando === "workbench.action.focusWindow") {
        throw new Error(`command '${comando}' not found`);
      }
      comandos.push(comando);
      return undefined;
    }) as typeof vscode.commands.executeCommand;
    vscode.window.showErrorMessage = (async (mensagem: string) => {
      erros.push(mensagem);
      return undefined;
    }) as typeof vscode.window.showErrorMessage;
    return { comandos, erros };
  }

  test("traz o VS Code para a frente e abre a barra lateral, ou mostra o erro", async () => {
    const { comandos, erros } = registrar();

    await voltarDoLogin({ ok: true, nome: "Ana" });
    assert.deepStrictEqual(comandos, ["workbench.action.focusWindow", COMANDO_ABRIR_BARRA]);

    comandos.length = 0;
    await voltarDoLogin({ ok: false, mensagem: "Token inválido." });
    assert.deepStrictEqual(comandos, ["workbench.action.focusWindow"]);
    assert.deepStrictEqual(erros, ["Erro no login: Token inválido."]);
  });

  test("sem o comando de trazer a janela, abre a barra lateral assim mesmo", async () => {
    const { comandos } = registrar(true);

    await voltarDoLogin({ ok: true });

    assert.deepStrictEqual(comandos, [COMANDO_ABRIR_BARRA]);
  });

  test("o VS Code desktop tem o comando de trazer a janela para a frente", async function () {
    if (!RetornoLocal.disponivel()) {
      this.skip();
    }
    const comandos = await vscode.commands.getCommands(true);
    assert.ok(comandos.includes("workbench.action.focusWindow"));
  });
});
