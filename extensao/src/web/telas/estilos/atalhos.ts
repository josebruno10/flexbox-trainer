// A aba Atalhos: colunas que se ajustam à largura, tabelas leves e o código
// na fonte mono.
export const ESTILOS_ATALHOS = `
    .atalhos {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 28px 40px;
      max-width: 1180px;
      padding: 24px 28px 40px;
    }

    .atalhos > header {
      grid-column: 1 / -1;
    }

    h1 {
      margin: 4px 0 6px;
      font-family: var(--fonte-titulo);
      font-size: 22px;
      font-weight: 600;
    }

    .intro,
    .nota {
      margin: 0;
      color: var(--texto-suave);
    }

    .nota {
      margin: 8px 0 12px;
      font-size: 12px;
    }

    h2.rotulo {
      margin: 0 0 8px;
    }

    table + h2.rotulo {
      margin-top: 24px;
    }

    h3 {
      margin: 16px 0 6px;
      font-family: var(--fonte-mono);
      font-size: 10.5px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--texto-suave);
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    td {
      padding: 6px 0;
      vertical-align: top;
      border-bottom: 1px dashed var(--linha-tracejada);
    }

    td:first-child {
      width: 1%;
      padding-right: 16px;
      white-space: nowrap;
    }

    kbd,
    code,
    pre {
      font-family: var(--fonte-mono);
      font-size: 11.5px;
    }

    kbd {
      padding: 1px 5px;
      border: 1px solid var(--linha-forte);
      border-radius: 3px;
      background: var(--superficie);
    }

    code {
      color: var(--texto);
    }

    /* A mesma coluna para as abreviações de todos os grupos. */
    table.css td:first-child {
      width: 96px;
    }

    table.css td:first-child code,
    .abreviacao .cabeca code {
      color: var(--acento);
    }

    .abreviacao {
      padding: 8px 0;
      border-bottom: 1px dashed var(--linha-tracejada);
    }

    .abreviacao .cabeca {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 12px;
    }

    .abreviacao .cabeca span {
      font-size: 12px;
      color: var(--texto-suave);
    }

    pre {
      margin: 6px 0 0;
      padding: 8px 10px;
      overflow-x: auto;
      color: var(--texto-suave);
      background: var(--superficie);
      border-radius: 2px;
    }
`;
