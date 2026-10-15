import * as assert from "assert";
import * as vscode from "vscode";
import {
  criarProvedorParaTeste,
  FORMAS,
  MensagemWebview,
  mockarConfiguracaoServidorValida,
  mockarServidor,
  OpcoesProvedorTeste,
  prepararVerificacao,
  ProvedorInterno,
  restaurarAoFim,
  ultimaMensagem,
} from "./auxiliares";

// O que invalida um desafio: extensões de IA e arquivos mudados fora do editor.
suite("Barra lateral: regras do treino", () => {
  restaurarAoFim();

  test("invalida o desafio quando há extensões de IA habilitadas na hora de verificar", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes = mockarServidor({});
    const mensagens: MensagemWebview[] = [];
    const provedor = criarProvedorParaTeste(mensagens, {
      extensoesIa: [
        { id: "anthropic.claude-code", nome: "Claude Code" },
        { id: "openai.chatgpt", nome: "Codex" },
      ],
    });
    const interno = prepararVerificacao(provedor, 240);

    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, FORMAS);

    assert.strictEqual(requisicoes.length, 0);
    assert.strictEqual(interno.avaliacaoAtual?.source, "desafio-invalidado");
    assert.match(
      interno.avaliacaoAtual?.error ?? "",
      /extensões de IA ficaram habilitadas durante ele \(Claude Code, Codex\)\./,
    );
    assert.deepStrictEqual(ultimaMensagem(mensagens, "extensoesIa")?.payload, [
      { id: "anthropic.claude-code", nome: "Claude Code" },
      { id: "openai.chatgpt", nome: "Codex" },
    ]);
  });

  test("não começa um desafio com extensões de IA habilitadas", async () => {
    const avisos: string[] = [];
    vscode.window.showWarningMessage = (async (mensagem: string) => {
      avisos.push(mensagem);
      return undefined;
    }) as unknown as typeof vscode.window.showWarningMessage;
    const mensagens: MensagemWebview[] = [];
    const provedor = criarProvedorParaTeste(mensagens, {
      extensoesIa: [{ id: "github.copilot-chat", nome: "GitHub Copilot" }],
    });
    const interno = provedor as unknown as ProvedorInterno;

    await provedor.iniciarNovoDesafio();

    assert.strictEqual(interno.desafioAtual, undefined);
    assert.strictEqual(ultimaMensagem(mensagens, "dadosDesafio"), undefined);
    assert.match(
      avisos[0] ?? "",
      /Desabilite as extensões de IA para começar: GitHub Copilot\./,
    );
  });

  test("continua invalidado o desafio em que a IA foi habilitada, mesmo depois de desabilitá-la", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes = mockarServidor({});
    const opcoes: OpcoesProvedorTeste = { extensoesIa: [] };
    const provedor = criarProvedorParaTeste([], opcoes);
    const interno = prepararVerificacao(provedor, 241);

    opcoes.extensoesIa = [{ id: "anthropic.claude-code", nome: "Claude Code" }];
    provedor.atualizarExtensoesIa();
    opcoes.extensoesIa = [];
    provedor.atualizarExtensoesIa();
    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, FORMAS);

    assert.strictEqual(requisicoes.length, 0);
    assert.strictEqual(interno.avaliacaoAtual?.source, "desafio-invalidado");
    assert.match(
      interno.avaliacaoAtual?.error ?? "",
      /uma extensão de IA ficou habilitada durante ele \(Claude Code\)\./,
    );
  });

  test("invalida o desafio quando um arquivo de treino muda fora do editor", async () => {
    mockarConfiguracaoServidorValida();
    const requisicoes = mockarServidor({});
    const provedor = criarProvedorParaTeste([]);
    const interno = prepararVerificacao(provedor, 242);
    // Sem pasta aberta nos testes: mantém os arquivos de treino preparados.
    provedor.atualizarPreviewWorkspace = async () => undefined;
    const agora = Date.now();

    // Outro arquivo com o mesmo nome e uma mudança de antes do desafio não contam.
    await provedor.registrarAlteracaoExterna({
      uri: vscode.Uri.file("/outro-projeto/style.css"),
      instante: agora,
    });
    await provedor.registrarAlteracaoExterna({
      uri: vscode.Uri.file("/projeto/style.css"),
      instante: interno.inicioTentativaMs - 1,
    });
    const avaliacaoAntes = interno.avaliacaoAtual;
    assert.strictEqual(avaliacaoAntes, undefined);

    await provedor.registrarAlteracaoExterna({
      uri: vscode.Uri.file("/projeto/style.css"),
      instante: agora,
    });
    await interno.verificarTentativaAtual(interno.desafioAtual!.challengeId, FORMAS);

    assert.strictEqual(requisicoes.length, 0);
    assert.strictEqual(interno.avaliacaoAtual?.source, "desafio-invalidado");
    assert.match(
      interno.avaliacaoAtual?.error ?? "",
      /o style\.css foi alterado fora do editor\./,
    );
  });
});
