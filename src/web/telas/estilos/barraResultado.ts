// Barra lateral: as ações, o Verificar e a nota.
export const ESTILOS_BARRA_RESULTADO = `
    .acoes {
      display: grid;
      /* Dois botões por linha quando cabem sem quebrar o texto. */
      grid-template-columns: repeat(auto-fit, minmax(136px, 1fr));
      gap: 8px;
      margin-top: 12px;
    }

    .acoes > .largo {
      grid-column: 1 / -1;
    }

    .simbolo {
      display: inline-block;
      font-size: 14px;
      line-height: 1;
      transition: transform 250ms cubic-bezier(0.2, 0.7, 0.2, 1);
    }

    button:hover:not(:disabled) .simbolo.mais {
      transform: rotate(90deg);
    }

    /* O ✓ de Verificar pula quando a nota chega. */
    .simbolo.pulo {
      animation: pular 520ms cubic-bezier(0.2, 0.7, 0.2, 1);
    }

    @keyframes pular {
      40% {
        transform: translateY(-4px) scale(1.35);
      }
    }

    button.arquivos {
      text-transform: none;
      letter-spacing: 0.02em;
    }

    .linha {
      font-size: 12px;
      line-height: 1.5;
    }

    .nota {
      margin-bottom: 10px;
    }

    .nota.resultado {
      margin-top: 16px;
    }

    .linha {
      margin-top: 12px;
    }

    /* Escondida, a nota continua no HTML; só com ela à vista o texto sobe. */
    .nota.resultado:not([hidden]) + .linha {
      margin-top: 0;
    }

    .valor-nota {
      display: block;
      font-family: var(--fonte-titulo);
      font-size: 42px;
      font-weight: 700;
      letter-spacing: -0.045em;
      line-height: 1;
    }

    .valor-nota small {
      margin-left: 2px;
      font-size: 20px;
      letter-spacing: 0;
      color: var(--texto-suave);
    }

    .barra-nota {
      height: 6px;
      margin-top: 10px;
      background: var(--superficie);
    }

    .barra-nota span {
      display: block;
      width: 0;
      height: 100%;
      background: var(--degrade);
      /* Mesma duração e curva da contagem da nota. */
      transition: width 700ms cubic-bezier(0.33, 1, 0.68, 1);
    }
`;
