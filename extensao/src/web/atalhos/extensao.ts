// Os atalhos de teclado da extensão. O package.json tem a mesma lista (um
// teste confere); daqui saem o atalho embaixo de cada botão e a aba Atalhos.
export type AtalhoDaExtensao = {
  comando: string;
  // Como no package.json: "ctrl+alt+d".
  teclas: string;
  // Quando o atalho vale (a cláusula "when" do package.json).
  quando: string;
  acao: string;
};

export const ATALHOS_DA_EXTENSAO: readonly AtalhoDaExtensao[] = [
  {
    comando: "flexbox-trainer.verificar",
    teclas: "ctrl+alt+v",
    quando: "flexboxTrainer.temDesafio",
    acao: "Verificar a sua página",
  },
  {
    comando: "flexbox-trainer.novoDesafio",
    teclas: "ctrl+alt+d",
    quando: "flexboxTrainer.autenticado",
    acao: "Gerar novo desafio",
  },
  {
    comando: "flexbox-trainer.desafioDoDia",
    teclas: "ctrl+alt+shift+d",
    quando: "flexboxTrainer.autenticado",
    acao: "Abrir o desafio do dia",
  },
  {
    comando: "flexbox-trainer.copiarResultado",
    teclas: "ctrl+alt+shift+v",
    quando: "flexboxTrainer.temDesafio",
    acao: "Copiar o resultado",
  },
  {
    comando: "flexbox-trainer.abrirGabarito",
    teclas: "ctrl+alt+a",
    quando: "flexboxTrainer.temDesafio",
    acao: "Abrir o gabarito em uma aba",
  },
  {
    comando: "flexbox-trainer.refazerDesafio",
    teclas: "ctrl+alt+shift+n",
    quando: "flexboxTrainer.temDesafio",
    acao: "Refazer o desafio, do zero",
  },
  {
    comando: "flexbox-trainer.verHistorico",
    teclas: "ctrl+alt+h",
    quando: "flexboxTrainer.autenticado",
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
