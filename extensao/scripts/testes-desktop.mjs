// Abre um VS Code desktop limpo (perfil e extensões temporários) com esta
// extensão e roda a suíte no host Node. Usa o `code` instalado; no GitHub,
// onde ele não existe (ou com VSCODE_TESTE_BAIXAR=1), baixa um VS Code com o
// @vscode/test-electron. VSCODE_TESTE_VERSAO=1.82.0 baixa essa versão, para
// conferir a mais antiga que o engines do package.json aceita.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const projeto = resolve(import.meta.dirname, "..");
const pastaTestes = join(projeto, "dist", "node", "test");
const arquivoTestes = join(pastaTestes, "desktop.js");
const arquivoResultado = join(pastaTestes, "resultado-desktop.json");
const temporaria = mkdtempSync(join(tmpdir(), "flexbox-trainer-testes-"));
const versao = process.env.VSCODE_TESTE_VERSAO || undefined;
const baixarVsCode =
  process.env.CI === "true" ||
  process.env.VSCODE_TESTE_BAIXAR === "1" ||
  versao !== undefined;
const argumentos = [
  `--user-data-dir=${join(temporaria, "perfil")}`,
  `--extensions-dir=${join(temporaria, "extensoes")}`,
  "--disable-workspace-trust",
  "--skip-welcome",
  "--skip-release-notes",
];
rmSync(arquivoResultado, { force: true });

try {
  if (baixarVsCode) {
    // Herdada de um terminal do VS Code, esta variável faz o VS Code baixado
    // agir como Node e recusar as opções.
    delete process.env.ELECTRON_RUN_AS_NODE;
    const { runTests } = await import("@vscode/test-electron");
    await runTests({
      version: versao,
      extensionDevelopmentPath: projeto,
      extensionTestsPath: arquivoTestes,
      // As máquinas Ubuntu do GitHub bloqueiam o sandbox do Electron; ali o
      // VS Code é descartável e só roda os testes.
      launchArgs: [
        ...argumentos,
        "--disable-gpu",
        ...(process.env.CI === "true" ? ["--no-sandbox"] : []),
      ],
    });
  } else {
    const execucao = spawnSync(
      "code",
      [
        ...argumentos,
        `--extensionDevelopmentPath=${projeto}`,
        `--extensionTestsPath=${arquivoTestes}`,
        "--wait",
      ],
      { stdio: "ignore", shell: process.platform === "win32" },
    );
    if (execucao.error) {
      throw new Error(
        `não foi possível abrir o VS Code (\`code\`): ${execucao.error.message}`,
      );
    }
  }

  // O VS Code não repassa o resultado dos testes: a suíte o grava num arquivo.
  if (!existsSync(arquivoResultado)) {
    throw new Error("o VS Code fechou sem rodar os testes.");
  }

  const { passaram, falhas } = JSON.parse(readFileSync(arquivoResultado, "utf8"));
  for (const falha of falhas) {
    console.error(`✗ ${falha.teste}\n  ${falha.erro}`);
  }
  console.log(
    `${passaram} passaram, ${falhas.length} falharam (VS Code ${versao ?? "desktop"}, host Node).`,
  );
  process.exitCode = falhas.length > 0 ? 1 : 0;
} catch (erro) {
  console.error(`Testes no desktop: ${erro.message}`);
  process.exitCode = 1;
} finally {
  rmSync(temporaria, { recursive: true, force: true });
}
