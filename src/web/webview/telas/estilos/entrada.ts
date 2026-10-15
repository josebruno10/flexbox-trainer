// Tela de entrada: os botões de login e o aviso.
export const ESTILOS_ENTRADA = `
    body {
      padding: 0 14px 18px;
    }

    .faixa {
      margin: 0 -14px;
    }

    .entrada {
      max-width: 360px;
      padding-top: 22px;
    }

    h1 {
      margin: 10px 0 0;
      font-family: var(--fonte-titulo);
      font-size: 38px;
      font-weight: 700;
      letter-spacing: -0.05em;
      line-height: 0.92;
    }

    h1 span {
      display: block;
      width: fit-content;
      color: transparent;
      background: var(--degrade);
      -webkit-background-clip: text;
      background-clip: text;
    }

    /* No tema claro, o título usa a versão escura do degradê (a do botão),
       para ficar legível. */
    body.vscode-light h1 span {
      background: var(--degrade-botao);
      -webkit-background-clip: text;
      background-clip: text;
    }

    .descricao {
      margin: 14px 0 18px;
      color: var(--texto-suave);
    }

    .status {
      margin-bottom: 16px;
      padding: 9px 10px;
      border-left: 2px solid var(--acento);
      font-size: 12px;
      background: var(--superficie);
    }

    .acoes {
      display: grid;
      gap: 8px;
    }

    .provedor {
      justify-content: flex-start;
      gap: 10px;
      min-height: 38px;
      padding: 8px 12px;
      font-size: 11.5px;
    }

    .provedor svg {
      flex: 0 0 18px;
      width: 18px;
      height: 18px;
    }

    /* O G colorido precisa de fundo branco sobre o botão escuro. */
    .provedor .marca {
      display: grid;
      place-items: center;
      flex: 0 0 22px;
      width: 22px;
      height: 22px;
      margin: -2px 0 -2px -4px;
      background: #fff;
    }

    .provedor .marca svg {
      width: 15px;
      height: 15px;
    }

    #botaoSair {
      justify-self: start;
      margin-top: 2px;
    }

    .meta {
      margin: 18px 0 0;
      padding-top: 12px;
      border-top: 1px dashed var(--linha-tracejada);
      font-size: 11.5px;
      color: var(--texto-suave);
    }
`;
