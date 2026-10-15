// Barra lateral: a conta no topo e os avisos de cadastro e de IA.
export const ESTILOS_BARRA_CONTA = `
    body {
      padding: 0 14px 18px;
    }

    .faixa {
      margin: 0 -14px;
    }

    .conta {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 0;
      border-bottom: 1px solid var(--linha);
    }

    .status-auth-texto {
      flex: 1 1 auto;
      min-width: 0;
      font-size: 12px;
      color: var(--texto-suave);
    }

    .status-auth-texto strong {
      display: block;
      overflow: hidden;
      font-family: var(--fonte-titulo);
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.01em;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--texto);
    }

    .aviso-cadastro {
      display: block;
      color: var(--aviso);
    }

    .avatar-usuario,
    .avatar-fallback {
      flex: 0 0 32px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
    }

    .avatar-fallback {
      display: grid;
      place-items: center;
      font-family: var(--fonte-titulo);
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      background: var(--avatar);
    }

    .aviso-ia {
      margin-top: 12px;
      padding: 10px 10px 10px 12px;
      border: 1px solid var(--aviso);
      border-left-width: 3px;
      font-size: 12px;
      background: color-mix(in srgb, var(--aviso) 10%, transparent);
    }

    .aviso-ia .rotulo {
      margin-bottom: 4px;
      color: var(--aviso);
    }
`;
