// Roda a suíte no VS Code para navegador (vscode-test-web). Ele pode sair com
// sucesso sem rodar teste nenhum, por exemplo quando a rede falha ao baixar o
// VS Code; por isso o resultado vale pelo resumo do mocha na saída.
import { spawn } from "node:child_process";

const execucao = spawn(
  "npx",
  [
    "vscode-test-web",
    "--browserType=chromium",
    "--extensionDevelopmentPath=.",
    "--extensionTestsPath=dist/web/test/suite/index.js",
    ...process.argv.slice(2),
  ],
  { shell: process.platform === "win32" },
);

let saida = "";
for (const fluxo of [execucao.stdout, execucao.stderr]) {
  fluxo.on("data", (trecho) => {
    saida += trecho;
    process.stdout.write(trecho);
  });
}

execucao.on("close", (codigo) => {
  const passaram = /(\d+) passing/.exec(saida)?.[1];
  const falharam = /(\d+) failing/.exec(saida)?.[1];
  if (codigo !== 0 || !passaram || falharam) {
    console.error(
      passaram
        ? `\nTestes no navegador: ${falharam ?? 0} falharam.`
        : "\nTestes no navegador: a suíte não rodou (veja o erro acima).",
    );
    process.exitCode = 1;
  }
});
