// Monta a página do aluno dentro de um shadow root, no tamanho do gabarito.
// A barra lateral mede as formas nessa superfície para a correção, e a aba do
// gabarito a exibe para comparar; as duas precisam renderizar igual.
export function montarPaginaAluno(
  host: HTMLElement,
  htmlPreview: string,
  largura: number,
  altura: number,
): void {
  const documento = new DOMParser().parseFromString(htmlPreview, "text/html");
  documento.querySelectorAll("script, iframe, object, embed").forEach((elemento) =>
    elemento.remove(),
  );
  documento.querySelectorAll("*").forEach((elemento) => {
    Array.from(elemento.attributes).forEach((atributo) => {
      if (atributo.name.toLowerCase().startsWith("on")) {
        elemento.removeAttribute(atributo.name);
      }
    });
  });
  documento
    .querySelectorAll('meta[http-equiv="Content-Security-Policy" i]')
    .forEach((elemento) => elemento.remove());

  const raiz = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  raiz.replaceChildren();

  // Regras do documento externo vencem :host, então o tamanho da superfície
  // precisa ir no estilo inline do próprio host.
  host.style.width = `${largura}px`;
  host.style.height = `${altura}px`;

  // Mesmo reset com que a extensão oficial do torneio renderiza a página do
  // aluno antes de medir as formas.
  const estilo = document.createElement("style");
  estilo.textContent = `
    :host {
      display: block;
      overflow: hidden;
      background: #fff;
    }
    html, body {
      display: block;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #ffffff;
    }
    * { box-sizing: border-box; }
  `;

  documento.querySelectorAll("style").forEach((estiloOriginal) => {
    estilo.textContent += `\n${estiloOriginal.textContent || ""}`;
  });

  const htmlAluno = document.createElement("html");
  copiarAtributosPermitidos(documento.documentElement, htmlAluno);
  const bodyAluno = document.createElement("body");
  copiarAtributosPermitidos(documento.body, bodyAluno);

  Array.from(documento.body.childNodes).forEach((filho) => {
    if (!(filho instanceof HTMLStyleElement)) {
      bodyAluno.append(filho.cloneNode(true));
    }
  });
  htmlAluno.append(bodyAluno);
  raiz.append(estilo, htmlAluno);
}

function copiarAtributosPermitidos(origem: Element, destino: Element): void {
  Array.from(origem.attributes).forEach((atributo) => {
    if (!atributo.name.toLowerCase().startsWith("on")) {
      destino.setAttribute(atributo.name, atributo.value);
    }
  });
}
