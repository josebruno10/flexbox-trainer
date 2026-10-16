import { ehNivel } from "../../niveis";
import {
  Desafio,
  FormaMedida,
  GabaritoGerado,
  MensagemRecebidaBarraLateral,
  Nivel,
} from "../../types";
import { sanitizarFormas } from "./formas";

/** O que a barra lateral pode pedir à extensão. */
export type ControladorDaBarra = {
  autenticado(): boolean;
  desafioAtual(): Desafio | undefined;
  aoCarregar(): void;
  abrirLogin(): void;
  entrarCom(provedor: "github" | "microsoft"): void;
  entrarComGoogle(): void;
  revalidarSessao(): void;
  sair(): void;
  receberGabarito(gabarito: GabaritoGerado): void;
  novoDesafio(): void;
  desafioDoDia(): void;
  definirNivel(nivel: Nivel): void;
  copiarResultado(): void;
  abrirPorCodigo(): void;
  refazer(codigo?: string): void;
  verHistorico(): void;
  verAtalhos(): void;
  copiarCodigo(): void;
  abrirPainelGabarito(): void;
  verExtensoesIa(): void;
  criarArquivos(): void;
  cadastrarNoTorneio(): void;
  encerrarDesafio(): void;
  atualizarPreview(): void;
  verificar(challengeId: string, formas: FormaMedida[], verificacaoId?: number): void;
};

/**
 * Leva cada mensagem da barra lateral à ação certa. Sem sessão, só valem as
 * do login e a do gabarito desenhado.
 */
export function rotearMensagem(
  mensagem: MensagemRecebidaBarraLateral,
  barra: ControladorDaBarra,
): void {
  switch (mensagem.type) {
    case "pronto":
      barra.aoCarregar();
      return;
    case "abrirLogin":
      barra.abrirLogin();
      return;
    case "loginGitHub":
      barra.entrarCom("github");
      return;
    case "loginMicrosoft":
      barra.entrarCom("microsoft");
      return;
    case "loginGoogle":
      barra.entrarComGoogle();
      return;
    case "revalidarSessao":
      barra.revalidarSessao();
      return;
    case "logout":
      barra.sair();
      return;
    case "gabaritoGerado":
      receberGabarito(mensagem, barra);
      return;
  }

  if (!barra.autenticado()) {
    return;
  }

  switch (mensagem.type) {
    case "novoDesafio":
      barra.novoDesafio();
      return;
    case "desafioDoDia":
      barra.desafioDoDia();
      return;
    case "definirNivel":
      if (ehNivel(mensagem.nivel)) {
        barra.definirNivel(mensagem.nivel);
      }
      return;
    case "copiarResultado":
      barra.copiarResultado();
      return;
    case "abrirPorCodigo":
      barra.abrirPorCodigo();
      return;
    case "refazer":
      barra.refazer(typeof mensagem.codigo === "string" ? mensagem.codigo : undefined);
      return;
    case "verHistorico":
      barra.verHistorico();
      return;
    case "verAtalhos":
      barra.verAtalhos();
      return;
    case "copiarCodigo":
      barra.copiarCodigo();
      return;
    case "abrirPainelGabarito":
      barra.abrirPainelGabarito();
      return;
    case "verExtensoesIa":
      barra.verExtensoesIa();
      return;
    case "criarArquivos":
      barra.criarArquivos();
      return;
    case "cadastrarNoTorneio":
      barra.cadastrarNoTorneio();
      return;
    case "encerrarDesafio":
      barra.encerrarDesafio();
      return;
    case "atualizarPreview":
      barra.atualizarPreview();
      return;
    case "solicitarVerificacao":
      // Um pedido de um desafio que já foi trocado não vale mais.
      if (mensagem.challengeId === barra.desafioAtual()?.challengeId) {
        barra.verificar(
          mensagem.challengeId,
          sanitizarFormas(mensagem.formas),
          typeof mensagem.verificacaoId === "number"
            ? mensagem.verificacaoId
            : undefined,
        );
      }
      return;
  }
}

// O PNG do gabarito, desenhado pela barra, só vale para o desafio atual.
function receberGabarito(
  mensagem: Extract<MensagemRecebidaBarraLateral, { type: "gabaritoGerado" }>,
  barra: ControladorDaBarra,
): void {
  const desafio = barra.desafioAtual();
  if (
    mensagem.challengeId === desafio?.challengeId &&
    mensagem.width === desafio.width &&
    mensagem.height === desafio.height &&
    mensagem.imagemDataUrl.startsWith("data:image/png;base64,")
  ) {
    barra.receberGabarito({
      challengeId: mensagem.challengeId,
      imagemDataUrl: mensagem.imagemDataUrl,
      width: mensagem.width,
      height: mensagem.height,
    });
  }
}
