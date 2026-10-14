// Abre um VS Code desktop limpo (perfil e extensões temporários) com esta
// extensão e roda a suíte no host Node. Precisa do comando `code` no PATH.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const projeto = resolve(import.meta.dirname, "..");
const pastaTestes = join(projeto, "dist", "node", "test");
const arquivoResultado = join(pastaTestes, "resultado-desktop.json");
const temporaria = mkdtempSync(join(tmpdir(), "flexbox-trainer-testes-"));
rmSync(arquivoResultado, { force: true });

try {
  const execucao = spawnSync(
    "code",
    [
      `--user-data-dir=${join(temporaria, "perfil")}`,
      `--extensions-dir=${join(temporaria, "extensoes")}`,
      "--disable-workspace-trust",
      "--skip-welcome",
      "--skip-release-notes",
      `--extensionDevelopmentPath=${projeto}`,
      `--extensionTestsPath=${join(pastaTestes, "desktop.js")}`,
      "--wait",
    ],
    { stdio: "ignore", shell: process.platform === "win32" },
  );

  if (execucao.error) {
    throw new Error(`não foi possível abrir o VS Code (\`code\`): ${execucao.error.message}`);
  }
  if (!existsSync(arquivoResultado)) {
    throw new Error("o VS Code fechou sem rodar os testes.");
  }

  const { passaram, falhas } = JSON.parse(readFileSync(arquivoResultado, "utf8"));
  for (const falha of falhas) {
    console.error(`✗ ${falha.teste}\n  ${falha.erro}`);
  }
  console.log(`${passaram} passaram, ${falhas.length} falharam (VS Code desktop, host Node).`);
  process.exitCode = falhas.length > 0 ? 1 : 0;
} catch (erro) {
  console.error(`Testes no desktop: ${erro.message}`);
  process.exitCode = 1;
} finally {
  rmSync(temporaria, { recursive: true, force: true });
}
