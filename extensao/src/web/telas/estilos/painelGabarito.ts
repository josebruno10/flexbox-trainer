// Aba do gabarito: o resumo, os modos e os quadros do gabarito e da página.
export const ESTILOS_PAINEL_GABARITO = `
    :root {
      --fundo: var(--vscode-editor-background);
    }

    body {
      padding: 0 16px 16px;
    }

    .faixa {
      margin: 0 -16px 16px;
    }

    .conteudo {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .imagem {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .resumo {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 8px 22px;
    }

    .titulo-tela {
      display: block;
      margin-top: 2px;
      font-family: var(--fonte-titulo);
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.1;
    }

    .resumo .dados {
      display: flex;
      gap: 18px;
    }

    .resumo .dados > div {
      gap: 8px;
      padding: 0 0 2px;
      border-bottom: 0;
    }

    .barra {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 16px;
    }

    /* Destacado, para não parecer um rótulo: cor de destaque, ícone e o mesmo
       deslocamento dos outros botões ao passar o mouse. */
    .botao-lista {
      color: var(--acento);
      background: color-mix(in srgb, var(--acento) 10%, transparent);
      border-color: var(--acento);
    }

    .botao-lista:hover:not(:disabled) {
      background: color-mix(in srgb, var(--acento) 18%, transparent);
      box-shadow: 3px 3px 0 var(--acento);
    }

    .icone-lista {
      font-size: 13px;
      line-height: 1;
    }

    .opacidade {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: var(--fonte-mono);
      font-size: 11px;
      color: var(--texto-suave);
    }

    .opacidade strong {
      min-width: 4ch;
      font-weight: 500;
      color: var(--texto);
    }

    .opacidade input {
      accent-color: var(--acento);
    }

    /* O Verificar e a nota, como na barra lateral, sem trocar de tela. */
    .verificacao-aba {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 14px;
      margin-bottom: 12px;
      /* A nota quebra na largura da imagem, sem alargar a coluna e
         empurrar a lista de componentes para fora da aba. */
      width: 0;
      min-width: 100%;
    }

    .verificacao-aba button {
      flex: 0 0 auto;
      min-width: 132px;
    }

    .nota-aba {
      font-family: var(--fonte-mono);
      font-size: 12px;
      color: var(--texto-suave);
    }

    .nota-aba strong {
      color: var(--texto);
      font-weight: 500;
    }

    .palco {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .palco[data-modo="gabarito"] #quadroAluno {
      display: none;
    }

    /* Sobreposto: os dois quadros na mesma célula, o gabarito por cima. */
    .palco[data-modo="sobreposto"] {
      display: grid;
    }

    .palco[data-modo="sobreposto"] .quadro {
      grid-area: 1 / 1;
    }

    .palco[data-modo="sobreposto"] #quadroGabarito {
      position: relative;
      z-index: 1;
    }

    .palco[data-modo="sobreposto"] #telaGabarito {
      background: transparent;
    }

    .palco[data-modo="sobreposto"] #canvasGabarito {
      opacity: var(--opacidade-gabarito, 0.5);
    }

    /* Comparar: os dois quadros na mesma célula, o gabarito por cima,
       recortado à esquerda da linha. A linha se arrasta de qualquer ponto. */
    .palco[data-modo="comparar"] {
      position: relative;
      display: grid;
      width: fit-content;
      cursor: ew-resize;
      touch-action: none;
    }

    .palco[data-modo="comparar"] .quadro {
      grid-area: 1 / 1;
      pointer-events: none;
    }

    .palco[data-modo="comparar"] #quadroGabarito {
      position: relative;
      z-index: 1;
      clip-path: inset(0 calc(100% - var(--corte, 50%)) 0 0);
    }

    .palco:not([data-modo="comparar"]) .linha-comparacao,
    .palco:not([data-modo="comparar"]) .lado-comparacao {
      display: none;
    }

    .linha-comparacao {
      position: absolute;
      top: 0;
      bottom: 0;
      left: var(--corte, 50%);
      z-index: 2;
      width: 2px;
      margin-left: -1px;
      background: #fff;
      box-shadow: 0 0 0 1px rgba(21, 18, 24, 0.55);
      outline: none;
    }

    /* A alça no meio da linha, para mostrar que ela se arrasta. */
    .linha-comparacao::after {
      content: "⇔";
      position: absolute;
      top: 50%;
      left: 50%;
      display: grid;
      place-items: center;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      background: #fff;
      box-shadow: 0 0 0 1px rgba(21, 18, 24, 0.55), 0 2px 6px rgba(21, 18, 24, 0.3);
      color: #151218;
      font-size: 14px;
      line-height: 1;
    }

    .linha-comparacao:focus-visible::after {
      box-shadow: 0 0 0 2px var(--foco), 0 2px 6px rgba(21, 18, 24, 0.3);
    }

    /* De que lado fica cada imagem. */
    .lado-comparacao {
      position: absolute;
      bottom: 6px;
      z-index: 2;
      padding: 2px 6px;
      background: rgba(21, 18, 24, 0.7);
      color: #fff;
      font-family: var(--fonte-mono);
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      pointer-events: none;
    }

    .lado-comparacao.esquerda {
      left: 6px;
    }

    .lado-comparacao.direita {
      right: 6px;
    }

    .quadro {
      margin: 0;
    }

    .quadro figcaption {
      display: none;
      margin-bottom: 6px;
    }

    .palco[data-modo="lado"] figcaption {
      display: block;
    }

    .tela {
      position: relative;
      overflow: hidden;
      background: #fff;
      outline: 1px solid var(--linha);
    }

    .tela canvas {
      display: block;
      width: 100%;
      height: 100%;
    }

    #canvasDestaque {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    #superficieAluno {
      position: absolute;
      left: 0;
      top: 0;
      transform-origin: 0 0;
    }

    .sem-pagina {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      text-align: center;
      color: #52606d;
      background: #fff;
    }
`;
