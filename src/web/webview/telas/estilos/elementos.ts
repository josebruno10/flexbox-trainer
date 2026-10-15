// O que vale para tudo: reset, faixa do topo, animações de entrada e rótulos.
export const ESTILOS_ELEMENTOS = `
    [hidden] {
      display: none !important;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: var(--fonte-texto);
      font-size: 13px;
      line-height: 1.45;
      color: var(--texto);
      background: var(--fundo);
    }

    .faixa {
      position: relative;
      height: 3px;
      background: var(--degrade);
      background-size: 200% 100%;
      animation: correr 9s ease-in-out infinite alternate;
    }

    /* Ponta da faixa numa segunda cor, nos conjuntos que têm uma. */
    .faixa::after {
      content: "";
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 18%;
      background: var(--ponta);
    }

    @keyframes correr {
      to {
        background-position: 100% 0;
      }
    }

    /* As partes da tela surgem uma depois da outra ao abrir. */
    .surge {
      animation: surgir 420ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
      animation-delay: calc(var(--ordem, 0) * 60ms);
    }

    @keyframes surgir {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
      }
    }

    .rotulo {
      margin: 0;
      font-family: var(--fonte-mono);
      font-size: 10.5px;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--texto-suave);
    }

    /* Misturado à cor do texto, o número continua legível no tema claro e
       no escuro (contraste acima de 4,5). */
    .rotulo .numero {
      color: color-mix(in srgb, var(--numero) 70%, var(--texto));
    }
`;
