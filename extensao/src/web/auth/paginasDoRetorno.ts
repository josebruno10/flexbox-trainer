import type { RespostaDaPagina } from "./retornoLocal";

// As páginas do servidor local do login (retornoLocal.ts), no visual da
// extensão: o resultado do login e os avisos de endereços que não valem.

type Textos = { titulo: string; texto: string; classe: "" | "ok" | "erro" };

const ESTILO = `
  :root { color-scheme: light dark; --fundo: #f7f7f5; --texto: #1c1c1c; --suave: #5f6368; --linha: #d9d9d4; --acento: #15803d; --erro: #b42318; }
  @media (prefers-color-scheme: dark) {
    :root { --fundo: #181818; --texto: #e6e6e6; --suave: #a0a0a0; --linha: #2e2e2e; --acento: #4ade80; --erro: #f97066; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; font: 15px/1.5 system-ui, "Segoe UI", Ubuntu, sans-serif; color: var(--texto); background: var(--fundo); }
  body::before { content: ""; position: fixed; inset: 0 0 auto; height: 3px; background: linear-gradient(90deg, #4d7c0f, #15803d, #047857); }
  main { width: min(440px, 100%); padding: 28px; border: 1px solid var(--linha); border-radius: 4px; }
  .rotulo { margin: 0 0 6px; font: 500 11px/1 ui-monospace, "DM Mono", monospace; letter-spacing: 0.1em; text-transform: uppercase; color: var(--suave); }
  h1 { margin: 0 0 8px; font-size: 22px; font-weight: 600; }
  p { margin: 0; color: var(--suave); }
  body.ok main { border-color: var(--acento); }
  body.ok h1 { color: var(--acento); }
  body.erro main { border-color: var(--erro); }
  body.erro h1 { color: var(--erro); }
`;

/** O que a página diz em cada fim do login. */
export function textosDoResultado(dados: RespostaDaPagina): Textos {
  switch (dados.estado) {
    case "ok":
      return {
        titulo: "Pronto!",
        texto:
          (dados.nome ? `Você entrou como ${dados.nome}. ` : "Você entrou. ") +
          "Pode fechar esta aba: o VS Code já está com a sua conta.",
        classe: "ok",
      };
    case "erro":
      return {
        titulo: "Não deu para entrar",
        texto: `${comPonto(dados.mensagem)} Volte ao VS Code e tente de novo.`,
        classe: "erro",
      };
    case "repetido":
      return { titulo: "Login já recebido", texto: "Pode fechar esta aba.", classe: "" };
    default:
      return {
        titulo: "Quase lá",
        texto: "Volte ao VS Code para ver se o login terminou.",
        classe: "",
      };
  }
}

function documento(textos: Textos, script = ""): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <title>Entrar | FlexBox Trainer</title>
  <style>${ESTILO}</style>
</head>
<body class="${textos.classe}">
  <main>
    <p class="rotulo">FlexBox Trainer</p>
    <h1 id="titulo">${escaparHtml(textos.titulo)}</h1>
    <p id="texto">${escaparHtml(textos.texto)}</p>
  </main>
  ${script}
</body>
</html>`;
}

/** Uma página só com um aviso, para endereços que não valem mais. */
export function paginaDeAviso(titulo: string, texto: string): string {
  return documento({ titulo, texto, classe: "" });
}

/** O fim do login, para quem enviou o formulário do site. */
export function paginaDoResultado(dados: RespostaDaPagina): string {
  return documento(textosDoResultado(dados));
}

/**
 * A página para onde um site mais antigo manda o login no fragmento: o
 * script (com o nonce da CSP) o envia ao servidor e mostra o resultado.
 */
export function paginaDoRetorno(nonce: string): string {
  return documento(
    { titulo: "Concluindo o login…", texto: "O VS Code está conferindo a sua conta.", classe: "" },
    `<script nonce="${nonce}">
  (function () {
    var consulta = location.search.slice(1);
    var fragmento = location.hash.slice(1);
    // Tira o token da barra de endereço.
    history.replaceState(null, "", location.pathname);
    function mostrar(titulo, texto, classe) {
      document.getElementById("titulo").textContent = titulo;
      document.getElementById("texto").textContent = texto;
      document.body.className = classe || "";
    }
    fetch("/retorno", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ consulta: consulta, fragmento: fragmento }).toString()
    })
      .then(function (resposta) { return resposta.json(); })
      .then(function (dados) { mostrar(dados.titulo, dados.texto, dados.classe); })
      .catch(function () {
        mostrar("Sem resposta do VS Code", "Volte a ele e tente entrar de novo.", "erro");
      });
  })();
  </script>`,
  );
}

function comPonto(texto: string): string {
  return /[.!?…]$/.test(texto) ? texto : `${texto}.`;
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
