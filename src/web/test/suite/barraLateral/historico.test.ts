import * as assert from "assert";
import { codigoDoDia } from "../../../services/codigoDesafio";
import {
  criarProvedorParaTeste,
  criarRegistroFalso,
  FORMAS,
  json,
  MensagemWebview,
  mockarConfiguracaoServidorValida,
  mockarServidor,
  prepararCodigo,
  restaurarAoFim,
  ultimaMensagem,
} from "./auxiliares";

function historicoEnviado(mensagens: MensagemWebview[]) {
  return ultimaMensagem(mensagens, "historicoDesafios")?.payload as {
    registros: { codigo: string; melhor: number }[];
    total: number;
    recorde: number | null;
    sequencia: { dias: number; feitoHoje: boolean } | null;
    evolucao: { dia: string; nivel: string; melhor: number }[];
  };
}

// O histórico do aluno: notas, recorde, sequência, gráfico e o resultado copiado.
suite("Barra lateral: histórico", () => {
  restaurarAoFim();

  test("grava cada nota no histórico e mostra o recorde quando o desafio é refeito", async () => {
    mockarConfiguracaoServidorValida();
    const notas = [42.5, 80];
    mockarServidor({
      "POST /tipo-dinamica/treino/corrigir-formas": () =>
        json({ pontuacao: notas.shift() }),
    });
    const registro = criarRegistroFalso();
    const mensagens: MensagemWebview[] = [];
    const provedor = criarProvedorParaTeste(mensagens, { registro });
    const interno = await prepararCodigo(provedor, registro, "482917");

    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, FORMAS);

    assert.deepStrictEqual(
      historicoEnviado(mensagens).registros.map(({ codigo, melhor }) => [codigo, melhor]),
      [["482917", 42.5]],
    );
    // Na primeira vez, o recorde é a própria nota: não aparece.
    assert.strictEqual(historicoEnviado(mensagens).recorde, null);

    // Refeito, o desafio mostra o recorde da vez anterior como a nota a bater.
    await prepararCodigo(provedor, registro, "482917");
    interno.enviarEstado();
    assert.strictEqual(historicoEnviado(mensagens).recorde, 42.5);

    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, [
      { ...FORMAS[0], cor: "#123456" },
      FORMAS[1],
    ]);

    const depois = historicoEnviado(mensagens);
    assert.deepStrictEqual(depois.registros.map(({ melhor }) => melhor), [80]);
    assert.strictEqual(depois.recorde, 80);
    assert.strictEqual(depois.total, 1);
  });

  test("monta o resultado para copiar com a melhor nota e o tempo dela", async () => {
    mockarConfiguracaoServidorValida();
    const notas = [42.5, 30];
    mockarServidor({
      "POST /tipo-dinamica/treino/corrigir-formas": () =>
        json({ pontuacao: notas.shift() }),
    });
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste([], { registro });
    const interno = await prepararCodigo(provedor, registro, "482917");
    interno.inicioTentativaMs = 0;
    const outroDia = new Date(2026, 0, 1);

    assert.strictEqual(provedor.textoDoResultado(outroDia), undefined);

    Date.now = () => 754_000;
    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, FORMAS);
    // Uma nota pior depois não muda o resultado.
    Date.now = () => 900_000;
    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, [
      { ...FORMAS[0], cor: "#123456" },
      FORMAS[1],
    ]);

    assert.strictEqual(
      provedor.textoDoResultado(outroDia),
      "Desafio médio 482 917: 42,50% em 12:34",
    );

    // O desafio do dia diz a data, para o grupo da turma saber qual é.
    const dia = new Date(2026, 9, 14, 10, 0);
    interno.desafioAtual = { ...interno.desafioAtual!, codigo: codigoDoDia(dia) };
    assert.strictEqual(
      provedor.textoDoResultado(dia),
      "Desafio do dia 14/10 (071 881): 42,50% em 12:34",
    );
  });

  test("conta o desafio do dia na sequência e a mostra no histórico", async () => {
    mockarConfiguracaoServidorValida();
    mockarServidor({
      "POST /tipo-dinamica/treino/corrigir-formas": () => json({ pontuacao: 64 }),
    });
    const mensagens: MensagemWebview[] = [];
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste(mensagens, { registro });
    const verificar = async (codigo: string, instante: Date) => {
      const interno = await prepararCodigo(provedor, registro, codigo);
      Date.now = () => instante.getTime();
      await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, FORMAS);
    };

    // Outro desafio não conta.
    await verificar("482917", new Date(2026, 9, 13, 22, 0));
    assert.strictEqual(historicoEnviado(mensagens).sequencia, null);

    // O de ontem, terminado depois da meia-noite, conta para ontem...
    await verificar(codigoDoDia(new Date(2026, 9, 13)), new Date(2026, 9, 14, 0, 10));
    assert.deepStrictEqual(historicoEnviado(mensagens).sequencia, {
      dias: 1,
      feitoHoje: false,
    });

    // ...e o de hoje continua a sequência.
    await verificar(codigoDoDia(new Date(2026, 9, 14)), new Date(2026, 9, 14, 9, 0));
    assert.deepStrictEqual(historicoEnviado(mensagens).sequencia, {
      dias: 2,
      feitoHoje: true,
    });
  });

  test("manda ao histórico a melhor nota de cada dia, para o gráfico", async () => {
    mockarConfiguracaoServidorValida();
    const notas = [40, 64, 52];
    mockarServidor({
      "POST /tipo-dinamica/treino/corrigir-formas": () =>
        json({ pontuacao: notas.shift() }),
    });
    const mensagens: MensagemWebview[] = [];
    const registro = criarRegistroFalso();
    const provedor = criarProvedorParaTeste(mensagens, { registro });
    const verificacoes: [string, Date][] = [
      ["482917", new Date(2026, 9, 13, 10)],
      ["305114", new Date(2026, 9, 14, 9)],
      ["771208", new Date(2026, 9, 14, 11)],
    ];

    for (const [codigo, instante] of verificacoes) {
      const interno = await prepararCodigo(provedor, registro, codigo);
      Date.now = () => instante.getTime();
      await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, FORMAS);
    }

    // O gráfico é o do nível escolhido (o médio); o 305 114 é difícil.
    assert.deepStrictEqual(historicoEnviado(mensagens).evolucao, [
      { dia: "2026-10-13", nivel: "medio", melhor: 40 },
      { dia: "2026-10-14", nivel: "medio", melhor: 52 },
    ]);
    await provedor.definirNivel("dificil");
    assert.deepStrictEqual(historicoEnviado(mensagens).evolucao, [
      { dia: "2026-10-14", nivel: "dificil", melhor: 64 },
    ]);
  });
});
