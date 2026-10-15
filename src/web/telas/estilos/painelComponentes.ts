// Aba do gabarito: a lista de componentes com as medidas.
export const ESTILOS_PAINEL_COMPONENTES = `
    .ajuda {
      max-width: 640px;
      font-size: 12px;
      color: var(--texto-suave);
    }

    .lista {
      flex: 1 1 300px;
      min-width: 250px;
      max-width: 340px;
      max-height: calc(100vh - 35px);
      list-style: none;
      margin: 0;
      padding: 0 4px 0 0;
      overflow-y: auto;
      border-top: 1px solid var(--linha);
    }

    .componente {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 8px 5px 10px;
      border-bottom: 1px dashed var(--linha-tracejada);
      border-left: 2px solid transparent;
      cursor: pointer;
    }

    .componente:hover {
      background: var(--superficie);
    }

    .componente.selecionado {
      border-left-color: var(--acento);
      background: var(--superficie);
    }

    .componente .amostra {
      width: 16px;
      height: 16px;
    }

    .componente .numero-componente {
      min-width: 3.2ch;
      font-family: var(--fonte-mono);
      font-size: 11px;
      font-weight: 500;
      color: var(--texto-suave);
    }

    .valores {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    /* Só para leitores de tela. */
    .so-leitor {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    .valor {
      min-height: 0;
      padding: 1px 5px;
      font-size: 11px;
      letter-spacing: 0;
      text-transform: none;
      color: var(--texto);
      background: transparent;
      border-color: var(--linha);
      cursor: copy;
    }

    .valor:hover:not(:disabled) {
      box-shadow: none;
      transform: none;
      border-color: var(--texto);
    }

    .valor.copiado {
      color: var(--sobre-tinta);
      background: var(--tinta);
      border-color: var(--tinta);
    }

    .vazio {
      color: var(--texto-suave);
    }

    /* Em uma aba estreita, a lista vai para baixo da imagem. */
    @media (max-width: 680px) {
      .conteudo {
        flex-direction: column;
      }

      .lista {
        max-width: none;
        max-height: none;
        width: 100%;
      }
    }
`;
