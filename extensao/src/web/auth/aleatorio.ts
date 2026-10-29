import * as cryptoDoNode from "crypto";

// O VS Code 1.82 a 1.89 roda as extensões no Node 18, que não tem o crypto
// global; ali ele vem do módulo crypto. No navegador, o módulo fica vazio e
// vale o crypto global.

/** Bytes de uma fonte criptográfica segura, em hexadecimal. */
export function hexAleatorio(bytes: number): string {
  const fonte = globalThis.crypto ?? cryptoDoNode.webcrypto;
  if (typeof fonte?.getRandomValues !== "function") {
    throw new Error(
      "O ambiente não disponibilizou geração criptográfica segura para iniciar o login.",
    );
  }

  const valores = new Uint8Array(bytes);
  fonte.getRandomValues(valores);
  return Array.from(valores, (valor) => valor.toString(16).padStart(2, "0")).join("");
}
