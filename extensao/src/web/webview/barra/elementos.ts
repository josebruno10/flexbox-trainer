// Os elementos da barra lateral (src/web/telas/barraLateral.ts), por parte.

// A conta.
export const statusAutenticacao = document.getElementById(
  "statusAutenticacao",
) as HTMLDivElement;
export const avatarUsuario = document.getElementById(
  "avatarUsuario",
) as HTMLImageElement;
export const avatarFallback = document.getElementById(
  "avatarFallback",
) as HTMLDivElement;
export const botaoSair = document.getElementById("botaoSair");
export const cadastroTorneio = document.getElementById(
  "cadastroTorneio",
) as HTMLDivElement;
export const botaoCadastrar = document.getElementById(
  "botaoCadastrar",
) as HTMLButtonElement;
export const avisoIa = document.getElementById("avisoIa") as HTMLDivElement;
export const textoAvisoIa = document.getElementById(
  "textoAvisoIa",
) as HTMLSpanElement;
export const botaoVerExtensoesIa = document.getElementById(
  "botaoVerExtensoesIa",
);

// O desafio.
export const tituloDesafio = document.getElementById(
  "tituloDesafio",
) as HTMLElement;
export const botoesNivel = Array.from(
  document.querySelectorAll<HTMLButtonElement>("#niveis [data-nivel]"),
);
export const canvasAlvo = document.getElementById(
  "canvasAlvo",
) as HTMLCanvasElement;
export const canvasAnotacoes = document.getElementById(
  "canvasAnotacoes",
) as HTMLCanvasElement;
export const seloDesafio = document.getElementById(
  "seloDesafio",
) as HTMLSpanElement;
export const metaDesafio = document.getElementById("metaDesafio") as HTMLElement;
export const valorTempo = document.getElementById("valorTempo") as HTMLElement;
export const botaoCodigo = document.getElementById(
  "botaoCodigo",
) as HTMLButtonElement;
export const valorFundo = document.getElementById("valorFundo") as HTMLElement;
export const valorComponentes = document.getElementById(
  "valorComponentes",
) as HTMLElement;
export const detalheComponente = document.getElementById(
  "detalheComponente",
) as HTMLDivElement;
export const quadroDesafio = document.getElementById(
  "quadroDesafio",
) as HTMLDivElement;
export const quadroVazio = document.getElementById("quadroVazio") as HTMLElement;
export const vistas = document.getElementById("vistas") as HTMLDivElement;
export const botoesVista = Array.from(
  vistas.querySelectorAll<HTMLButtonElement>("[data-vista]"),
);
export const botaoNovoDesafio = document.getElementById(
  "botaoNovoDesafio",
) as HTMLButtonElement;
export const botaoEncerrarDesafio = document.getElementById(
  "botaoEncerrarDesafio",
) as HTMLButtonElement;
export const botaoRefazer = document.getElementById(
  "botaoRefazer",
) as HTMLButtonElement;
export const botaoPorCodigo = document.getElementById(
  "botaoPorCodigo",
) as HTMLButtonElement;
export const botaoDesafioDia = document.getElementById(
  "botaoDesafioDia",
) as HTMLButtonElement;
export const botaoAbrirAba = document.getElementById(
  "botaoAbrirAba",
) as HTMLButtonElement;

// A página do aluno.
export const avisoArquivos = document.getElementById(
  "avisoArquivos",
) as HTMLElement;
export const textoArquivos = document.getElementById(
  "textoArquivos",
) as HTMLElement;
export const botaoCriarArquivos = document.getElementById(
  "botaoCriarArquivos",
) as HTMLButtonElement;
export const botaoVistaPagina = document.getElementById(
  "botaoVistaPagina",
) as HTMLButtonElement;
export const canvasPreviewAluno = document.getElementById(
  "canvasPreviewAluno",
) as HTMLCanvasElement;
export const quadroAvaliacao = document.getElementById(
  "quadroAvaliacao",
) as HTMLDivElement;
export const botaoAtualizarPreview = document.getElementById(
  "botaoAtualizarPreview",
);

// O resultado.
export const botaoVerificar = document.getElementById(
  "botaoVerificar",
) as HTMLButtonElement;
export const simboloVerificar = document.getElementById(
  "simboloVerificar",
) as HTMLSpanElement;
export const caixaResultado = document.getElementById(
  "caixaResultado",
) as HTMLDivElement;
export const notaResultado = document.getElementById(
  "notaResultado",
) as HTMLDivElement;
export const valorNota = document.getElementById("valorNota") as HTMLElement;
export const barraNota = document.getElementById("barraNota") as HTMLSpanElement;
export const botaoCopiarResultado = document.getElementById(
  "botaoCopiarResultado",
) as HTMLButtonElement;

// As tentativas e o histórico.
export const historicoNotas = document.getElementById(
  "historicoNotas",
) as HTMLElement;
export const valorTentativas = document.getElementById(
  "valorTentativas",
) as HTMLElement;
export const valorMelhor = document.getElementById("valorMelhor") as HTMLElement;
export const linhaTentativas = document.getElementById(
  "linhaTentativas",
) as HTMLElement;
export const linhaMelhor = document.getElementById("linhaMelhor") as HTMLElement;
export const linhaRecorde = document.getElementById(
  "linhaRecorde",
) as HTMLElement;
export const valorRecorde = document.getElementById(
  "valorRecorde",
) as HTMLElement;
export const secaoHistorico = document.getElementById(
  "secaoHistorico",
) as HTMLElement;
export const listaHistorico = document.getElementById(
  "listaHistorico",
) as HTMLElement;
export const botaoVerHistorico = document.getElementById(
  "botaoVerHistorico",
) as HTMLButtonElement;

// O gráfico da evolução.
export const tituloEvolucao = document.getElementById(
  "tituloEvolucao",
) as HTMLElement;
export const evolucao = document.getElementById("evolucao") as HTMLElement;
export const graficoEvolucao = document.getElementById(
  "graficoEvolucao",
) as unknown as SVGSVGElement;
export const resumoEvolucao = document.getElementById(
  "resumoEvolucao",
) as HTMLElement;
export const inicioEvolucao = document.getElementById(
  "inicioEvolucao",
) as HTMLElement;
export const fimEvolucao = document.getElementById("fimEvolucao") as HTMLElement;
export const dicaDigitacao = document.getElementById("dicaDigitacao") as HTMLElement;
export const textoDica = document.getElementById("textoDica") as HTMLElement;
export const botaoVerAtalhos = document.getElementById(
  "botaoVerAtalhos",
) as HTMLButtonElement;

/** O texto do botão, sem o atalho que fica embaixo (ou ao lado) dele. */
export function textoDoBotao(botao: HTMLElement): HTMLElement {
  return botao.querySelector<HTMLElement>(".texto-botao") ?? botao;
}
