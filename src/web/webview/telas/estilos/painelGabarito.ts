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
