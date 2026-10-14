// Roda a mesma suíte de testes no host Node do VS Code desktop, onde ficam
// as extensões de IA (o host web não as enxerga).
import * as fs from "fs";
import * as path from "path";

const Mocha = require("mocha");

// O comando `code` não repassa a saída nem o resultado dos testes; o roteiro
// scripts/testes-desktop.mjs lê este arquivo.
export const ARQUIVO_RESULTADO = path.join(__dirname, "resultado-desktop.json");

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", timeout: 4000 });
  mocha.suite.emit("pre-require", globalThis, "suite", mocha);

  const contexto = require.context("./suite", true, /\.test\.ts$/);
  contexto.keys().forEach(contexto);

  const falhas: { teste: string; erro: string }[] = [];
  let passaram = 0;

  return new Promise((concluir) => {
    const execucao = mocha.run(() => {
      fs.writeFileSync(
        ARQUIVO_RESULTADO,
        JSON.stringify({ passaram, falhas }, null, 2),
      );
      concluir();
    });
    execucao.on("pass", () => passaram++);
    execucao.on("fail", (teste: { fullTitle(): string }, erro: Error) => {
      falhas.push({ teste: teste.fullTitle(), erro: erro.message });
    });
  });
}
