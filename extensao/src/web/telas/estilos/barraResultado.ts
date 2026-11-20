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

    /* Embaixo do Verificar: o aluno sabe que o trabalho fica salvo. */
    .salvamento {
      margin: 6px 0 0;
      font-family: var(--fonte-mono);
      font-size: 10.5px;
      letter-spacing: 0.02em;
      color: var(--texto-suave);
    }

    .salvamento[data-estado="salvo"] {
      color: var(--acento);
    }

    .salvamento[data-estado="falhou"] {
      color: var(--erro);
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

    /* O que corrigir: um componente por linha, dos que mais tiram pontos. */
    .correcoes {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px dashed var(--linha-tracejada);
    }

    .cabecalho-correcoes {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 2px 8px;
    }

    .resumo-correcoes {
      font-family: var(--fonte-mono);
      font-size: 10.5px;
      color: var(--texto-suave);
    }

    .lista-correcoes {
      margin: 6px 0 0;
      padding: 0;
      list-style: none;
    }

    .lista-correcoes li + li {
      margin-top: 2px;
    }

    .correcao {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: baseline;
      column-gap: 6px;
      row-gap: 0;
      justify-content: stretch;
      width: 100%;
      min-height: 0;
      padding: 4px 6px;
      border: 0;
      background: transparent;
      color: var(--texto);
      font: inherit;
      font-size: 11.5px;
      line-height: 1.4;
      text-align: left;
      text-transform: none;
      letter-spacing: 0;
    }

    button.correcao {
      cursor: pointer;
    }

    button.correcao:hover:not(:disabled) {
      box-shadow: none;
      transform: none;
      background: var(--superficie);
    }

    .correcao .amostra {
      grid-row: span 2;
      align-self: start;
      margin-top: 3px;
    }

    .correcao span:last-child {
      grid-column: 2;
      color: var(--texto-suave);
    }

    .lista-correcoes li[data-tipo="faltando"] .correcao span:last-child {
      color: var(--erro);
    }

    #botaoTodasCorrecoes {
      margin-top: 4px;
      padding: 2px 6px;
      text-transform: none;
      letter-spacing: 0;
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
