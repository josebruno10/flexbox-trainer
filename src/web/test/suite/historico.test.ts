import * as assert from "assert";
import * as vscode from "vscode";
import { HistoricoDesafios, NotaDoDesafio } from "../../services/historico";

function armazenamentoFalso(inicial: Record<string, unknown> = {}): vscode.Memento {
  const valores = new Map(Object.entries(inicial));
  return {
    keys: () => [...valores.keys()],
    get: <T>(chave: string, padrao?: T) =>
      (valores.has(chave) ? valores.get(chave) : padrao) as T,
    update: async (chave: string, valor: unknown) => {
      valores.set(chave, valor);
    },
  } as vscode.Memento;
}

function nota(sobrescritas: Partial<NotaDoDesafio> = {}): NotaDoDesafio {
  return {
    codigo: "482917",
    tentativa: "challenge-482917-a",
    precisao: 50,
    tempoMs: 600_000,
    instante: 1_000,
    ...sobrescritas,
  };
}

suite("Histórico de desafios", () => {
  const ALUNO = "aluno@example.com";

  test("guarda a melhor nota e o tempo em que ela foi alcançada", async () => {
    const historico = new HistoricoDesafios(armazenamentoFalso());

    await historico.registrarNota(ALUNO, nota({ precisao: 50, tempoMs: 300_000 }));
    await historico.registrarNota(ALUNO, nota({ precisao: 80, tempoMs: 600_000 }));
    await historico.registrarNota(ALUNO, nota({ precisao: 70, tempoMs: 700_000 }));

    const [registro] = historico.listar(ALUNO);
    assert.strictEqual(registro.melhor, 80);
    assert.strictEqual(registro.tempoMelhorMs, 600_000);
    assert.strictEqual(registro.verificacoes, 3);
    assert.strictEqual(registro.vezes, 1);
  });

  test("com a mesma nota, fica o tempo mais rápido", async () => {
    const historico = new HistoricoDesafios(armazenamentoFalso());

    await historico.registrarNota(ALUNO, nota({ precisao: 90, tempoMs: 900_000 }));
    await historico.registrarNota(
      ALUNO,
      nota({ tentativa: "challenge-482917-b", precisao: 90, tempoMs: 500_000 }),
    );

    assert.strictEqual(historico.listar(ALUNO)[0].tempoMelhorMs, 500_000);
  });

  test("refazer um desafio soma na mesma linha e conta as vezes", async () => {
    const historico = new HistoricoDesafios(armazenamentoFalso());

    await historico.registrarNota(ALUNO, nota({ tentativa: "challenge-482917-a" }));
    await historico.registrarNota(ALUNO, nota({ tentativa: "challenge-482917-a" }));
    await historico.registrarNota(ALUNO, nota({ tentativa: "challenge-482917-b" }));

    const registros = historico.listar(ALUNO);
    assert.strictEqual(registros.length, 1);
    assert.strictEqual(registros[0].vezes, 2);
    assert.strictEqual(registros[0].verificacoes, 3);
  });

  test("mostra o mais recente primeiro e guarda no máximo 30", async () => {
    const historico = new HistoricoDesafios(armazenamentoFalso());

    for (let indice = 0; indice < 35; indice++) {
      const codigo = String(indice).padStart(6, "0");
      await historico.registrarNota(
        ALUNO,
        nota({ codigo, tentativa: `challenge-${codigo}-a`, instante: indice }),
      );
    }
    // Uma nota nova num desafio antigo o traz para o topo.
    await historico.registrarNota(
      ALUNO,
      nota({ codigo: "000020", tentativa: "challenge-000020-b", instante: 99 }),
    );

    const codigos = historico.listar(ALUNO).map((registro) => registro.codigo);
    assert.strictEqual(codigos.length, 30);
    assert.deepStrictEqual(codigos.slice(0, 3), ["000020", "000034", "000033"]);
    assert.ok(!codigos.includes("000000"));
  });

  test("cada aluno vê o próprio histórico, e sem sessão não há histórico", async () => {
    const historico = new HistoricoDesafios(armazenamentoFalso());

    await historico.registrarNota("Ana@Example.com", nota({ codigo: "111111" }));
    await historico.registrarNota("bruno@example.com", nota({ codigo: "222222" }));
    await historico.registrarNota(undefined, nota({ codigo: "333333" }));

    assert.deepStrictEqual(
      historico.listar("ana@example.com").map((registro) => registro.codigo),
      ["111111"],
    );
    assert.strictEqual(historico.buscar("bruno@example.com", "222222")?.melhor, 50);
    assert.deepStrictEqual(historico.listar(undefined), []);
  });

  test("ignora registros incompletos de outra versão", () => {
    const historico = new HistoricoDesafios(
      armazenamentoFalso({
        [`flexboxTrainer.historico|${ALUNO}`]: [
          { codigo: "482917" },
          null,
          {
            codigo: "111111",
            melhor: 70,
            tempoMelhorMs: 1,
            verificacoes: 1,
            vezes: 1,
            ultimaVez: 1,
            ultimaTentativa: "challenge-111111-a",
          },
        ],
      }),
    );

    assert.deepStrictEqual(
      historico.listar(ALUNO).map((registro) => registro.codigo),
      ["111111"],
    );
  });

  test("conta os dias seguidos do desafio do dia", async () => {
    const historico = new HistoricoDesafios(armazenamentoFalso());

    for (const dia of ["2026-10-12", "2026-10-13", "2026-10-14"]) {
      await historico.registrarDesafioDoDia(ALUNO, dia);
    }

    assert.deepStrictEqual(historico.sequenciaDoDia(ALUNO, "2026-10-14"), {
      dias: 3,
      feitoHoje: true,
    });
    // No dia seguinte a sequência ainda vale, à espera do desafio de hoje.
    assert.deepStrictEqual(historico.sequenciaDoDia(ALUNO, "2026-10-15"), {
      dias: 3,
      feitoHoje: false,
    });
    // Um dia inteiro sem o desafio a quebra.
    assert.strictEqual(historico.sequenciaDoDia(ALUNO, "2026-10-16"), undefined);
  });

  test("cada dia conta uma vez, e pular um dia recomeça a sequência", async () => {
    const historico = new HistoricoDesafios(armazenamentoFalso());

    await historico.registrarDesafioDoDia(ALUNO, "2026-10-12");
    await historico.registrarDesafioDoDia(ALUNO, "2026-10-12");
    assert.strictEqual(historico.sequenciaDoDia(ALUNO, "2026-10-12")?.dias, 1);

    await historico.registrarDesafioDoDia(ALUNO, "2026-10-14");
    // Um dia que já passou não volta para a sequência.
    await historico.registrarDesafioDoDia(ALUNO, "2026-10-13");
    assert.deepStrictEqual(historico.sequenciaDoDia(ALUNO, "2026-10-14"), {
      dias: 1,
      feitoHoje: true,
    });
  });

  test("a sequência atravessa a virada do mês e do ano", async () => {
    const historico = new HistoricoDesafios(armazenamentoFalso());

    for (const dia of ["2026-09-30", "2026-10-01"]) {
      await historico.registrarDesafioDoDia(ALUNO, dia);
    }
    assert.strictEqual(historico.sequenciaDoDia(ALUNO, "2026-10-01")?.dias, 2);

    for (const dia of ["2026-12-31", "2027-01-01"]) {
      await historico.registrarDesafioDoDia("bruno@example.com", dia);
    }
    assert.strictEqual(
      historico.sequenciaDoDia("bruno@example.com", "2027-01-01")?.dias,
      2,
    );
  });

  test("a sequência é de cada aluno e ignora dados de outra versão", async () => {
    const historico = new HistoricoDesafios(
      armazenamentoFalso({
        [`flexboxTrainer.sequenciaDoDia|${ALUNO}`]: { ultimoDia: "ontem", dias: 2 },
      }),
    );

    assert.strictEqual(historico.sequenciaDoDia(ALUNO, "2026-10-14"), undefined);

    await historico.registrarDesafioDoDia("Ana@Example.com", "2026-10-14");
    await historico.registrarDesafioDoDia(undefined, "2026-10-14");
    assert.strictEqual(historico.sequenciaDoDia("ana@example.com", "2026-10-14")?.dias, 1);
    assert.strictEqual(historico.sequenciaDoDia(ALUNO, "2026-10-14"), undefined);
    assert.strictEqual(historico.sequenciaDoDia(undefined, "2026-10-14"), undefined);
  });
});
