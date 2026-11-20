import * as vscode from "vscode";
import { AuthService } from "../../auth/authService";
import { LoginProvider } from "../../auth/loginProvider";
import { log } from "../../services/logger";
import { GabaritoGerado } from "../../types";
import type { ProvedorBarraLateralFlexBox } from "../provedorBarraLateral";
import { mostrarFalhaAoAbrirLogin } from "./conexao";
import { ControladorDaBarra } from "./mensagens";

/** O que o controlador usa do provedor além dos comandos públicos dele. */
export type PartesDoControlador = {
  provedor: ProvedorBarraLateralFlexBox;
  authService: AuthService;
  loginProvider: LoginProvider;
  aoCarregar: () => void;
  receberGabarito: (gabarito: GabaritoGerado) => void;
  encerrarDesafio: () => void;
  verificar: ControladorDaBarra["verificar"];
  desafioAtual: ControladorDaBarra["desafioAtual"];
};

/** O que cada pedido da barra lateral faz (veja mensagens.ts). */
export function criarControlador(partes: PartesDoControlador): ControladorDaBarra {
  const { provedor, authService, loginProvider } = partes;
  return {
    autenticado: () => authService.isAutenticado(),
    desafioAtual: partes.desafioAtual,
    aoCarregar: partes.aoCarregar,
    abrirLogin: () => void loginProvider.abrirLogin().catch(mostrarFalhaAoAbrirLogin),
    entrarCom: (provedorDeLogin) => void authService.loginComProvedorVSCode(provedorDeLogin),
    entrarComGoogle: () =>
      void authService.abrirLoginGoogle().catch(mostrarFalhaAoAbrirLogin),
    revalidarSessao: () => void loginProvider.revalidarSessao(),
    sair: () => void loginProvider.sair(),
    receberGabarito: (gabarito) => {
      partes.receberGabarito(gabarito);
      log.info(
        `Gabarito PNG gerado: ${gabarito.challengeId} (${gabarito.width}x${gabarito.height})`,
      );
    },
    novoDesafio: () => {
      void provedor.iniciarNovoDesafio();
      void provedor.atualizarPreviewWorkspace();
    },
    definirNivel: (nivel) => void provedor.definirNivel(nivel),
    abrirPorCodigo: () => void provedor.abrirDesafioPorCodigo(),
    refazer: (codigo) => void provedor.refazerDesafio(codigo),
    verHistorico: () => void provedor.verHistorico(),
    verAtalhos: () => void vscode.commands.executeCommand("flexbox-trainer.verAtalhos"),
    copiarCodigo: () => void provedor.copiarCodigo(),
    copiar: (texto) => void vscode.env.clipboard.writeText(texto),
    puxarProgresso: (codigo) => void provedor.puxarProgresso(codigo),
    abrirPainelGabarito: () => provedor.abrirPainelGabarito(),
    verExtensoesIa: () => void provedor.verExtensoesIa(),
    criarArquivos: () => void provedor.criarArquivosDeTreino(),
    encerrarDesafio: partes.encerrarDesafio,
    atualizarPreview: () => void provedor.atualizarPreviewWorkspace(),
    verificar: partes.verificar,
  };
}
