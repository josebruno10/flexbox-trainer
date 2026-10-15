// Barra lateral: tentativas, histórico, sequência e gráfico da evolução.
export const ESTILOS_BARRA_HISTORICO = `
    .historico {
      margin-top: 10px;
    }

    /* O código parece texto, mas é um botão: copia ao clicar. */
    button.valor-codigo {
      min-height: 0;
      padding: 0;
      border: 0;
      font-size: 12px;
      letter-spacing: 0.04em;
      color: var(--texto);
      background: transparent;
      cursor: copy;
    }

    button.valor-codigo:hover:not(:disabled) {
      box-shadow: none;
      transform: none;
      color: var(--acento);
    }

    button.valor-codigo.copiado {
      color: var(--acento);
    }

    .lista-historico {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .sequencia {
      margin-bottom: 6px;
    }

    button.relatar {
      margin-top: 6px;
    }

    /* A melhor nota de cada dia, de 0 a 100%: a linha sobe com o treino. */
    .evolucao {
      margin: 0 0 12px;
    }

    .evolucao figcaption,
    .evolucao .eixo {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-family: var(--fonte-mono);
      font-size: 10.5px;
      color: var(--texto-suave);
    }

    .evolucao figcaption {
      margin-bottom: 6px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .evolucao figcaption .valor {
      white-space: nowrap;
      font-size: 12px;
      letter-spacing: 0;
      text-transform: none;
      color: var(--texto);
    }

    .evolucao svg {
      display: block;
      width: 100%;
      height: 64px;
      overflow: visible;
    }

    .evolucao .guia {
      stroke: var(--linha-tracejada);
      stroke-dasharray: 2 3;
    }

    .evolucao polyline {
      fill: none;
      stroke: var(--acento);
      stroke-width: 1.5;
      stroke-linejoin: round;
    }

    .evolucao circle {
      fill: var(--acento);
    }

    .evolucao .eixo {
      margin-top: 4px;
    }

    .lista-historico li {
      display: grid;
      grid-template-columns: 1fr auto auto auto;
      align-items: center;
      gap: 10px;
      padding: 4px 0 4px 8px;
      border-bottom: 1px dashed var(--linha-tracejada);
      border-left: 2px solid transparent;
      font-family: var(--fonte-mono);
      font-size: 12px;
    }

    /* O desafio em andamento, se já estiver no histórico. */
    .lista-historico li.atual {
      border-left-color: var(--acento);
    }

    .lista-historico .tempo,
    .lista-historico .nivel {
      color: var(--texto-suave);
    }

    .lista-historico .nivel {
      font-size: 10.5px;
    }

    .lista-historico button {
      padding: 2px 6px;
      font-size: 13px;
    }

    .historico .atual {
      font-weight: 500;
      color: var(--texto);
    }

    .historico .anterior {
      color: var(--texto-suave);
    }
`;
