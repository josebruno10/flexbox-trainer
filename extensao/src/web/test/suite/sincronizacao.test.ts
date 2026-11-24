import * as assert from "assert";
import * as vscode from "vscode";
import { HistoricoDesafios } from "../../services/historico";
import {
  CHAVE_FORMATO,
  CHAVE_NIVEL,
  CHAVE_TAMANHO_LIVRE,
  chavesSincronizadas,
  sincronizarComOutrosComputadores,
} from "../../sincronizacao";

function armazenamentoFalso(): vscode.Memento {
  const valores = new Map<string, unknown>();
  return {
    keys: () => [...valores.keys()],
    get: <T>(chave: string, padrao?: T) =>
      (valores.has(chave) ? valores.get(chave) : padrao) as T,
    update: async (chave: string, valor: unknown) => {
      valores.set(chave, valor);
    },
  } as vscode.Memento;
}

suite("Sincronização entre computadores", () => {
  test("vão o nível, o formato, o histórico, os progressos salvos e os tamanhos livres do aluno da sessão", () => {
    assert.deepStrictEqual(chavesSincronizadas(" Aluno@Example.com "), [
      CHAVE_NIVEL,
      CHAVE_FORMATO,
      CHAVE_TAMANHO_LIVRE,
      "flexboxTrainer.historico4|aluno@example.com",
      "flexboxTrainer.evolucao|aluno@example.com",
      "flexboxTrainer.progressos|aluno@example.com",
      "flexboxTrainer.tamanhosLivres|aluno@example.com",
    ]);
    // Sem sessão, nada de aluno nenhum.
    assert.deepStrictEqual(chavesSincronizadas(undefined), [CHAVE_NIVEL, CHAVE_FORMATO, CHAVE_TAMANHO_LIVRE]);
  });

  test("tudo o que o histórico guarda do aluno está na lista", async () => {
    const armazenamento = armazenamentoFalso();
    const historico = new HistoricoDesafios(armazenamento);
    const aluno = "aluno@example.com";

    await historico.registrarNota(aluno, {
      codigo: "MESA",
      nivel: "medio",
      tentativa: "challenge-MESA-a",
      precisao: 50,
      tempoMs: 600_000,
      instante: Date.now(),
    });

    const sincronizadas = new Set(chavesSincronizadas(aluno));
    assert.ok(armazenamento.keys().length > 0);
    for (const chave of armazenamento.keys()) {
      assert.ok(sincronizadas.has(chave), `${chave} ficaria só neste computador.`);
    }
  });

  test("a lista de cada vez substitui a anterior", () => {
    const listas: (readonly string[])[] = [];
    const estado = { setKeysForSync: (chaves: readonly string[]) => listas.push(chaves) };

    sincronizarComOutrosComputadores(estado, "um@example.com");
    sincronizarComOutrosComputadores(estado, "outro@example.com");

    assert.strictEqual(listas.length, 2);
    assert.ok(!listas[1].some((chave) => chave.endsWith("|um@example.com")));
  });
});
