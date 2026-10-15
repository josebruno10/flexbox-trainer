import { desenharGabarito, normalizarHex } from "../desenhoGabarito";
import { NOME_DO_NIVEL } from "../../niveis";
import type { Nivel } from "../../types";
import { vscode } from "./api";
import {
  criarAmostra,
  desenharDestaques,
  esquecerComponentes,
  renderizarDetalheComponente,
  tirarPonteiro,
} from "./componentes";
import {
  botaoAbrirAba,
  botaoCodigo,
  botaoEncerrarDesafio,
  botaoNovoDesafio,
  botaoRefazer,
  botaoVerificar,
  botoesNivel,
  botoesVista,
  canvasAlvo,
  canvasAnotacoes,
  detalheComponente,
  metaDesafio,
  quadroDesafio,
  quadroVazio,
  seloDesafio,
  tituloDesafio,
  tituloEvolucao,
  valorComponentes,
  valorFundo,
  valorTempo,
  vistas,
} from "./elementos";
import { ALTURA_PADRAO, LARGURA_PADRAO, estado } from "./estado";
import { formatarCodigo, formatarTempo } from "./formatos";
import { mostrarMensagem } from "./resultado";
import { desenharMensagemPreview } from "./suaPagina";
import type { DesafioRecebido } from "./tipos";
import { esquecerVerificacao, verificacaoEmAndamento } from "./verificacao";

// O quadro do desafio: o gabarito, o cronômetro, o código e os dados.
let ultimoGabaritoEnviado = "";
let tempoBaseMs = 0;
let instanteTempoRecebido = Date.now();

function aplicarProporcaoDoDesafio(largura: number, altura: number): void {
  if (largura <= 0 || altura <= 0) {
    return;
  }

  document.documentElement.style.setProperty(
    "--proporcao-desafio",
    `${largura} / ${altura}`,
  );
}

export function marcarNivel(nivel: Nivel): void {
  for (const botao of botoesNivel) {
    botao.setAttribute("aria-pressed", String(botao.dataset.nivel === nivel));
  }
  // O gráfico da evolução é o do nível escolhido.
  tituloEvolucao.textContent = `Melhor nota · ${NOME_DO_NIVEL[nivel]}`;
}

export function definirVista(vista: "gabarito" | "pagina"): void {
  quadroDesafio.dataset.vista = vista;
  for (const botao of botoesVista) {
    botao.setAttribute("aria-pressed", String(botao.dataset.vista === vista));
  }
  if (vista === "pagina") {
    tirarPonteiro();
  }
}

export function desenharDesafio(desafio: DesafioRecebido): void {
  const mudouDesafio = estado.desafio?.challengeId !== desafio.challengeId;
  estado.desafio = desafio;
  tempoBaseMs = desafio.tempoAtualMs ?? 0;
  instanteTempoRecebido = Date.now();
  canvasAlvo.width = desafio.width;
  canvasAlvo.height = desafio.height;
  canvasAnotacoes.width = desafio.width;
  canvasAnotacoes.height = desafio.height;
  aplicarProporcaoDoDesafio(desafio.width, desafio.height);

  const contexto = canvasAlvo.getContext("2d");

  if (!contexto) {
    return;
  }

  desenharGabarito(contexto, desafio);
  mostrarItensDoDesafio(true);

  if (mudouDesafio) {
    // Um desafio novo começa mostrando o gabarito.
    definirVista("gabarito");
    esquecerComponentes();
    mostrarMensagem("Nenhuma verificação.");
    esquecerVerificacao();
  }

  // O cronômetro fica congelado ao encerrar, mas o aluno ainda pode
  // calcular o resultado final da tentativa. O estado é reenviado durante a
  // verificação, que mantém o botão desligado até terminar.
  botaoVerificar.disabled = verificacaoEmAndamento();
  botaoEncerrarDesafio.disabled = Boolean(desafio.encerrado);
  desenharDestaques();
  renderizarDetalheComponente();
  tituloDesafio.textContent =
    (desafio.doDia ? "Desafio do dia" : "Desafio") +
    (desafio.nivel ? ` · ${NOME_DO_NIVEL[desafio.nivel]}` : "");
  botaoCodigo.textContent = desafio.codigo ? formatarCodigo(desafio.codigo) : "--";
  botaoCodigo.disabled = !desafio.codigo;
  valorFundo.replaceChildren(
    criarAmostra(desafio.backgroundColor),
    normalizarHex(desafio.backgroundColor),
  );
  valorComponentes.textContent = String(desafio.blocks.length);

  if (ultimoGabaritoEnviado !== desafio.challengeId) {
    ultimoGabaritoEnviado = desafio.challengeId;
    vscode.postMessage({
      type: "gabaritoGerado",
      challengeId: desafio.challengeId,
      imagemDataUrl: canvasAlvo.toDataURL("image/png"),
      width: canvasAlvo.width,
      height: canvasAlvo.height,
    });
  }

  renderizarMetaDesafio();
}

export function renderizarMetaDesafio(): void {
  const desafio = estado.desafio;
  if (!desafio) {
    return;
  }

  const tempoDecorrido =
    tempoBaseMs +
    (desafio.encerrado ? 0 : Date.now() - instanteTempoRecebido);
  valorTempo.textContent = formatarTempo(tempoDecorrido);
  const situacao = desafio.encerrado ? "encerrado" : "andamento";
  // Encerrado, a ação seguinte é refazer o mesmo desafio.
  botaoEncerrarDesafio.hidden = Boolean(desafio.encerrado);
  botaoRefazer.hidden = !desafio.encerrado || !desafio.codigo;
  if (seloDesafio.dataset.estado !== situacao) {
    seloDesafio.dataset.estado = situacao;
    seloDesafio.textContent = desafio.encerrado
      ? "Encerrado"
      : "Em andamento";
  }
}

export function desenharEstadoInicial(): void {
  canvasAlvo.width = LARGURA_PADRAO;
  canvasAlvo.height = ALTURA_PADRAO;
  aplicarProporcaoDoDesafio(LARGURA_PADRAO, ALTURA_PADRAO);
  const contexto = canvasAlvo.getContext("2d");

  if (!contexto) {
    return;
  }

  desenharGrade(contexto, LARGURA_PADRAO, ALTURA_PADRAO);
  seloDesafio.dataset.estado = "vazio";
  seloDesafio.textContent = "Sem desafio";
  tituloDesafio.textContent = "Desafio";
  mostrarItensDoDesafio(false);
  canvasAnotacoes.width = LARGURA_PADRAO;
  canvasAnotacoes.height = ALTURA_PADRAO;
  canvasAnotacoes
    .getContext("2d")
    ?.clearRect(0, 0, LARGURA_PADRAO, ALTURA_PADRAO);
  desenharMensagemPreview("");
  botaoVerificar.disabled = true;
  botaoEncerrarDesafio.disabled = true;
}

// Detalhe, dados e as ações sobre o desafio só existem depois de gerar um.
// Até lá, gerar o desafio é a ação principal; depois, é verificar.
function mostrarItensDoDesafio(visiveis: boolean): void {
  for (const item of [
    vistas,
    detalheComponente,
    metaDesafio,
    botaoAbrirAba,
    botaoEncerrarDesafio,
  ]) {
    item.hidden = !visiveis;
  }
  if (!visiveis) {
    botaoRefazer.hidden = true;
  }
  quadroVazio.hidden = visiveis;
  botaoNovoDesafio.classList.toggle("principal", !visiveis);
  botaoNovoDesafio.classList.toggle("secundario", visiveis);
}

// Grade de 100 px no quadro vazio, antes do primeiro desafio.
function desenharGrade(
  contexto: CanvasRenderingContext2D,
  largura: number,
  altura: number,
): void {
  contexto.fillStyle = "#faf7f5";
  contexto.fillRect(0, 0, largura, altura);
  contexto.strokeStyle = "rgba(21, 18, 24, 0.08)";
  contexto.lineWidth = 2;
  contexto.beginPath();
  for (let x = 100; x < largura; x += 100) {
    contexto.moveTo(x, 0);
    contexto.lineTo(x, altura);
  }
  for (let y = 100; y < altura; y += 100) {
    contexto.moveTo(0, y);
    contexto.lineTo(largura, y);
  }
  contexto.stroke();
}
