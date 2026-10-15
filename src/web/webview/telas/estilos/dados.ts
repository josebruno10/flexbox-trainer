// Linhas de dados (rótulo e valor), amostras de cor e créditos.
export const ESTILOS_DADOS = `
    .dados {
      margin: 0;
    }

    .dados > div {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 0;
      border-bottom: 1px dashed var(--linha-tracejada);
    }

    .dados dt {
      flex: 0 0 auto;
      font-family: var(--fonte-mono);
      font-size: 10.5px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--texto-suave);
    }

    .dados dd {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      min-width: 0;
      margin: 0;
      font-family: var(--fonte-mono);
      font-size: 12px;
    }

    .amostra {
      flex: 0 0 auto;
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 1px solid var(--linha-forte);
    }

    /* A forma da amostra diz se o componente é um círculo. */
    .amostra.circulo {
      border-radius: 50%;
    }

    .creditos {
      margin: 28px 0 0;
      font-size: 10.5px;
      text-align: center;
      color: var(--texto-suave);
      opacity: 0.75;
    }
`;
