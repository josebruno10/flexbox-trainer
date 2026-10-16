// Os atalhos embaixo do texto dos botões e a dica de digitação: discretos,
// para não competir com as ações.
export const ESTILOS_BARRA_ATALHOS = `
    .rotulo-botao {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
    }

    .atalho {
      font-family: var(--fonte-mono);
      font-size: 9.5px;
      font-weight: 400;
      letter-spacing: 0.02em;
      text-transform: none;
      opacity: 0.6;
    }

    button.principal .atalho {
      opacity: 0.75;
    }

    button.discreto .atalho {
      opacity: 0.75;
    }

    .dica {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px dashed var(--linha-tracejada);
    }

    .cabecalho-dica {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .dica p {
      margin: 4px 0 0;
      font-size: 11.5px;
      line-height: 1.5;
      color: var(--texto-suave);
    }

    .dica code {
      padding: 0 3px;
      font-family: var(--fonte-mono);
      font-size: 11px;
      color: var(--texto);
      background: var(--superficie);
      border-radius: 2px;
      overflow-wrap: anywhere;
    }
`;
