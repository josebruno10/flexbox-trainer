// Barra lateral: o quadro do desafio, as vistas, os níveis e os dados do gabarito.
export const ESTILOS_BARRA_DESAFIO = `
    .bloco {
      padding: 16px 0;
      border-bottom: 1px solid var(--linha);
    }

    .bloco:last-of-type {
      border-bottom: 0;
    }

    .cabecalho {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-height: 22px;
      margin-bottom: 10px;
    }

    .selo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--fonte-mono);
      font-size: 10.5px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
      color: var(--texto-suave);
    }

    .selo::before {
      content: "";
      width: 7px;
      height: 7px;
      background: currentColor;
    }

    .selo[data-estado="andamento"] {
      color: var(--texto);
    }

    .selo[data-estado="andamento"]::before {
      background: var(--acento);
      animation: piscar 1.6s ease-in-out infinite;
    }

    @keyframes piscar {
      50% {
        opacity: 0.25;
      }
    }

    .canvas-desafio {
      position: relative;
      width: 100%;
      aspect-ratio: var(--proporcao-desafio, 16 / 9);
      overflow: hidden;
      border: 1px solid var(--linha);
      background: #fff;
    }

    .canvas-desafio canvas {
      display: block;
      width: 100%;
      height: 100%;
    }

    .canvas-anotacoes {
      position: absolute;
      inset: 0;
      background: transparent;
    }

    .canvas-anotacoes[data-sobre-componente] {
      cursor: pointer;
    }

    /* Gabarito e página do aluno dividem o mesmo quadro: alternar entre os
       dois, no mesmo lugar, mostra onde eles diferem. */
    .vistas {
      display: flex;
      gap: 6px;
      margin-bottom: 8px;
    }

    .vistas .modos {
      flex: 1 1 auto;
      display: flex;
    }

    .vistas .modo,
    .niveis .modo {
      flex: 1 1 0;
    }

    .niveis {
      display: flex;
    }

    /* A página já atualiza enquanto o aluno digita; o botão é para quando
       demorar. */
    button.atualizar {
      flex: 0 0 32px;
      padding: 0;
      font-size: 15px;
      letter-spacing: 0;
    }

    .canvas-desafio .preview {
      position: absolute;
      inset: 0;
      background: #fff;
      visibility: hidden;
    }

    .canvas-desafio[data-vista="pagina"] .preview {
      visibility: visible;
    }

    .canvas-desafio[data-vista="pagina"] .canvas-anotacoes {
      pointer-events: none;
    }

    .quadro-vazio {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      margin: 0;
      font-family: var(--fonte-mono);
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6c6066;
      pointer-events: none;
    }

    .dados-grade {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
      column-gap: 14px;
    }

    .preview-avaliacao {
      position: fixed;
      left: -10000px;
      top: 0;
      width: 960px;
      height: 540px;
      border: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: -1;
    }

    .detalhe {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      min-height: 34px;
      margin: 8px 0 4px;
      padding: 7px 9px;
      font-size: 12px;
      color: var(--texto-suave);
      background: var(--superficie);
    }

    .detalhe strong {
      font-family: var(--fonte-titulo);
      font-weight: 600;
      color: var(--texto);
    }

    .detalhe .medida {
      font-family: var(--fonte-mono);
      color: var(--texto);
    }

    .falta {
      margin: 0 0 4px;
      font-size: 12px;
      color: var(--erro);
    }
`;
