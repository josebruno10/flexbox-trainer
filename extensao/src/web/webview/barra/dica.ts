import { vscode } from "../api";
import { botaoVerAtalhos, dicaDigitacao, textoDica } from "./elementos";

// A dica de digitação no fim da seção Desafio: um atalho do editor ou uma
// abreviação Emmet por vez, trocada a cada desafio novo. As dicas vêm prontas
// da extensão, já com as teclas do sistema de quem usa.
type ParteDaDica = { texto?: string; codigo?: string };

let dicas: ParteDaDica[][] = [];
let atual = 0;

export function ligarDica(): void {
  try {
    const lidas: unknown = JSON.parse(dicaDigitacao.dataset.dicas ?? "[]");
    dicas = Array.isArray(lidas) ? (lidas as ParteDaDica[][]) : [];
  } catch {
    dicas = [];
  }
  // Cada vez que a barra abre, começa de uma dica diferente.
  atual = Math.floor(Math.random() * Math.max(1, dicas.length));
  mostrarDica();
  botaoVerAtalhos.addEventListener("click", () => {
    vscode.postMessage({ type: "verAtalhos" });
  });
}

export function proximaDica(): void {
  atual = (atual + 1) % Math.max(1, dicas.length);
  mostrarDica();
}

function mostrarDica(): void {
  const dica = dicas[atual];
  dicaDigitacao.hidden = !dica;
  if (!dica) {
    return;
  }
  textoDica.replaceChildren(
    ...dica.map((parte) => {
      if (parte.codigo === undefined) {
        return parte.texto ?? "";
      }
      const codigo = document.createElement("code");
      codigo.textContent = parte.codigo;
      return codigo;
    }),
  );
}
