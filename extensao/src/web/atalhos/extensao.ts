// Os atalhos de teclado da extensão. O package.json tem a mesma lista (um
// teste confere); daqui saem o atalho embaixo de cada botão e a aba Atalhos.
//
// Os atalhos não têm cláusula "when": antes de a extensão ativar, as chaves
// de contexto dela ainda não existem, e um atalho com "when" nem chegaria a
// ativá-la. Cada comando diz o que falta (entrar, gerar um desafio).
// Gerar é Ctrl+Alt+G, e não Ctrl+Alt+D: no Xfce (Xubuntu, Mint Xfce),
// Ctrl+Alt+D mostra a área de trabalho, e o VS Code nem recebe a tecla.
export type AtalhoDaExtensao = {
  comando: string;
  // Como no package.json: "ctrl+alt+g".
  teclas: string;
  acao: string;
};

export const ATALHOS_DA_EXTENSAO: readonly AtalhoDaExtensao[] = [
  {
    comando: "flexbox-trainer.verificar",
    teclas: "ctrl+alt+v",
    acao: "Verificar a sua página",
  },
  {
    comando: "flexbox-trainer.novoDesafio",
    teclas: "ctrl+alt+g",
    acao: "Gerar novo desafio",
  },
  {
    comando: "flexbox-trainer.abrirGabarito",
    teclas: "ctrl+alt+a",
    acao: "Abrir o gabarito em uma aba",
  },
  {
    comando: "flexbox-trainer.refazerDesafio",
    teclas: "ctrl+alt+shift+n",
    acao: "Refazer o desafio, do zero",
  },
  {
    comando: "flexbox-trainer.verHistorico",
    teclas: "ctrl+alt+h",
    acao: "Ver o histórico de desafios",
  },
];

/** As teclas do atalho de um comando, como no package.json. */
export function teclasDoComando(comando: string): string {
  const atalho = ATALHOS_DA_EXTENSAO.find((item) => item.comando === comando);
  if (!atalho) {
    throw new Error(`O comando ${comando} não tem atalho.`);
  }
  return atalho.teclas;
}
