// Aba do gabarito: a lista de componentes com as medidas.
export const ESTILOS_PAINEL_COMPONENTES = `
    /* Quebra na largura da imagem, sem alargar a coluna dela. */
    .ajuda {
      width: 0;
      min-width: 100%;
      font-size: 12px;
      color: var(--texto-suave);
    }

    /* Ao lado da imagem, a lista fica com o resto da largura e vai até o pé
       da aba (o script calcula a altura), rolando por dentro. Com espaço, os
       componentes se dividem em colunas, cada um numa linha só, com as
       medidas e a cor à vista. */
    .lista {
      flex: 1 1 0;
      min-width: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 370px), 1fr));
      align-content: start;
      column-gap: 16px;
      list-style: none;
      margin: 0;
      padding: 0 4px 0 0;
      overflow-y: auto;
      border-top: 1px solid var(--linha);
    }

    .componente {
      /* Segura o nome escondido para leitores de tela dentro da linha:
         solto, ele ficava fora da rolagem da lista e alongava a aba. */
      position: relative;
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

    /* O que corrigir em cada componente, pela última nota. */
    .correcao {
      margin-left: auto;
      padding: 1px 6px;
      border-radius: 999px;
      font-family: var(--fonte-mono);
      font-size: 10px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
      /* Contorno na cor do aviso: legível no tema claro e no escuro. */
      color: var(--aviso);
      border: 1px solid currentColor;
    }

    .correcao[data-tipo="certo"] {
      color: var(--acento);
      border-color: transparent;
      font-size: 12px;
    }

    .correcao[data-tipo="faltando"] {
      color: var(--erro);
    }

    dd .correcao {
      margin-left: 8px;
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

    /* Numa aba estreita, a lista vai para baixo da imagem e aparece inteira:
       quem rola é a aba (mesmo limite do script, em aba/modos.ts). */
    @media (max-width: 680px) {
      .corpo {
        flex-direction: column;
        align-items: stretch;
      }

      .lista {
        flex: none;
      }
    }
`;
