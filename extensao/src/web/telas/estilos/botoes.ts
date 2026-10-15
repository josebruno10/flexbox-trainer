// Botões: o comum, o secundário, o discreto, o principal e os de alternar.
export const ESTILOS_BOTOES = `
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 30px;
      padding: 6px 10px;
      border: 1px solid var(--tinta);
      border-radius: 2px;
      font-family: var(--fonte-mono);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.04em;
      line-height: 1.25;
      text-transform: uppercase;
      color: var(--sobre-tinta);
      background: var(--tinta);
      cursor: pointer;
      transition: box-shadow 120ms ease, transform 120ms ease, background 120ms ease, border-color 120ms ease;
    }

    /* A sombra na cor de destaque desloca o botão como uma impressão fora de
       registro. */
    button:hover:not(:disabled) {
      box-shadow: 3px 3px 0 var(--acento);
      transform: translate(-1px, -1px);
    }

    button:active:not(:disabled) {
      box-shadow: 1px 1px 0 var(--acento);
      transform: none;
    }

    button.secundario {
      color: var(--texto);
      background: transparent;
      border-color: var(--linha-forte);
    }

    button.discreto {
      min-height: 0;
      padding: 3px 6px;
      color: var(--texto-suave);
      background: transparent;
      border-color: transparent;
    }

    button.secundario:hover:not(:disabled),
    button.discreto:hover:not(:disabled) {
      box-shadow: none;
      transform: none;
      border-color: currentColor;
      background: var(--superficie);
    }

    /* A ação principal de cada momento: gerar o primeiro desafio, depois
       verificar. */
    button.principal {
      color: var(--sobre-botao);
      background: var(--degrade-botao);
      border-color: transparent;
    }

    button.principal:hover:not(:disabled) {
      box-shadow: 3px 3px 0 var(--tinta);
    }

    button.principal:active:not(:disabled) {
      box-shadow: 1px 1px 0 var(--tinta);
    }

    /* Desligado, o botão principal fica neutro: só uma ação chama atenção. */
    button.principal:disabled {
      color: var(--texto-suave);
      background: transparent;
      border-color: var(--linha);
      opacity: 1;
    }

    button.encerrar {
      color: var(--texto-suave);
      background: transparent;
      border-color: transparent;
    }

    button.encerrar:hover:not(:disabled) {
      box-shadow: none;
      transform: none;
      color: var(--erro);
      background: var(--superficie);
    }

    /* Botões de alternar, um ao lado do outro. */
    .modos {
      display: inline-flex;
    }

    .modo {
      color: var(--texto);
      background: transparent;
      border-color: var(--linha-forte);
    }

    .modo + .modo {
      border-left: 0;
    }

    .modo[aria-pressed="true"] {
      color: var(--sobre-tinta);
      background: var(--tinta);
      border-color: var(--tinta);
    }

    .modo:hover:not(:disabled) {
      box-shadow: none;
      transform: none;
      background: var(--superficie);
    }

    .modo[aria-pressed="true"]:hover:not(:disabled) {
      background: var(--tinta);
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }

    button:focus-visible,
    input:focus-visible {
      outline: 1px solid var(--foco);
      outline-offset: 2px;
    }
`;
