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
    nivel: "medio",
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
        [`flexboxTrainer.historico2|${ALUNO}`]: [
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

  test("guarda a melhor nota de cada dia, do dia mais antigo ao mais recente", async () => {
    const historico = new HistoricoDesafios(armazenamentoFalso());
    const em = (dia: number, hora = 10) => new Date(2026, 9, dia, hora).getTime();

    await historico.registrarNota(ALUNO, nota({ precisao: 40, instante: em(13) }));
    await historico.registrarNota(ALUNO, nota({ precisao: 60, instante: em(13, 11) }));
    await historico.registrarNota(ALUNO, nota({ precisao: 50, instante: em(13, 12) }));
    await historico.registrarNota(ALUNO, nota({ precisao: 70, instante: em(14) }));
    // Uma nota com o relógio atrasado entra no dia certo.
    await historico.registrarNota(ALUNO, nota({ precisao: 30, instante: em(12) }));

    assert.deepStrictEqual(historico.evolucao(ALUNO), [
      { dia: "2026-10-12", nivel: "medio", melhor: 30 },
      { dia: "2026-10-13", nivel: "medio", melhor: 60 },
      { dia: "2026-10-14", nivel: "medio", melhor: 70 },
    ]);
    assert.deepStrictEqual(historico.evolucao("bruno@example.com"), []);
    assert.deepStrictEqual(historico.evolucao(undefined), []);
  });

  test("a evolução separa os níveis", async () => {
    const historico = new HistoricoDesafios(armazenamentoFalso());
    const em = new Date(2026, 9, 14, 10).getTime();

    await historico.registrarNota(ALUNO, nota({ precisao: 90, instante: em, nivel: "facil" }));
    await historico.registrarNota(ALUNO, nota({ precisao: 55, instante: em, nivel: "dificil" }));

    assert.deepStrictEqual(historico.evolucao(ALUNO, "facil"), [
      { dia: "2026-10-14", nivel: "facil", melhor: 90 },
    ]);
    assert.deepStrictEqual(historico.evolucao(ALUNO, "dificil"), [
      { dia: "2026-10-14", nivel: "dificil", melhor: 55 },
    ]);
    assert.deepStrictEqual(historico.evolucao(ALUNO, "medio"), []);
    assert.strictEqual(historico.evolucao(ALUNO).length, 2);
  });

  test("a evolução guarda os 60 dias mais recentes e ignora dados de outra versão", async () => {
    const historico = new HistoricoDesafios(
      armazenamentoFalso({
        [`flexboxTrainer.evolucao|${ALUNO}`]: [
          { dia: "ontem", nivel: "medio", melhor: 10 },
          // Da versão sem níveis.
          { dia: "2026-01-01", melhor: 10 },
          null,
        ],
      }),
    );
    assert.deepStrictEqual(historico.evolucao(ALUNO), []);

    for (let dia = 1; dia <= 65; dia++) {
      await historico.registrarNota(
        ALUNO,
        nota({ precisao: dia, instante: new Date(2026, 0, dia, 10).getTime() }),
      );
    }

    // Os 60 dias valem para cada nível: um dia de outro nível não tira lugar.
    await historico.registrarNota(
      ALUNO,
      nota({ precisao: 80, instante: new Date(2025, 11, 1, 10).getTime(), nivel: "facil" }),
    );

    const evolucao = historico.evolucao(ALUNO, "medio");
    assert.strictEqual(evolucao.length, 60);
    assert.deepStrictEqual(evolucao[0], { dia: "2026-01-06", nivel: "medio", melhor: 6 });
    assert.deepStrictEqual(evolucao[59], { dia: "2026-03-06", nivel: "medio", melhor: 65 });
    assert.strictEqual(historico.evolucao(ALUNO, "facil").length, 1);
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
