// Um VS Code desktop de verdade para os testes de ponta a ponta: baixado pelo
// @vscode/test-electron, com perfil e extensões numa pasta própria, e aberto
// como um aluno abriria (sem modo de teste), controlado pelo Playwright.
// O Playwright vem com o @vscode/test-web, como no `npx playwright` do CI.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  downloadAndUnzipVSCode,
  resolveCliPathFromVSCodeExecutablePath,
} from "@vscode/test-electron";
import { _electron } from "playwright";

const NO_CI = process.env.CI === "true";

export async function baixarVsCode() {
  return downloadAndUnzipVSCode();
}

function argumentosDoPerfil(pasta) {
  return [
    `--user-data-dir=${join(pasta, "perfil")}`,
    `--extensions-dir=${join(pasta, "extensoes")}`,
  ];
}

/** Instala um .vsix no perfil da pasta, pela linha de comando do VS Code. */
export function instalarVsix(executavel, pasta, vsix) {
  const cli = resolveCliPathFromVSCodeExecutablePath(executavel);
  const execucao = spawnSync(
    cli,
    [...argumentosDoPerfil(pasta), "--install-extension", vsix, "--force"],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  if (execucao.status !== 0) {
    throw new Error(
      `não foi possível instalar ${vsix}:\n${execucao.stderr || execucao.stdout}`,
    );
  }
}

/**
 * Abre o VS Code, ativa o FlexBox Trainer pela paleta e entrega a janela ao
 * roteiro. Fecha o VS Code no fim, com uma foto da tela se algo falhar.
 */
export async function comVsCodeAberto(executavel, pasta, nome, roteiro) {
  // Herdada de um terminal do VS Code, esta variável faz o VS Code agir como
  // Node e recusar as opções.
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({
    executablePath: executavel,
    env,
    timeout: 180_000,
    args: [
      ...argumentosDoPerfil(pasta),
      "--skip-welcome",
      "--skip-release-notes",
      "--disable-workspace-trust",
      "--new-window",
      // Sem chaveiro do sistema no CI, a sessão fica no armazenamento básico.
      "--password-store=basic",
      ...(NO_CI ? ["--no-sandbox", "--disable-gpu"] : []),
    ],
  });
  const janela = await app.firstWindow({ timeout: 180_000 });
  try {
    await janela.waitForSelector(".monaco-workbench", { timeout: 180_000 });
    // O VS Code ainda carrega as extensões depois de mostrar a janela.
    await janela.waitForTimeout(8000);
    await rodarComando(janela, "FlexBox Trainer: Guia de Primeiros Passos");
    await roteiro(janela);
  } catch (erro) {
    mkdirSync(pasta, { recursive: true });
    await janela
      .screenshot({ path: join(pasta, `falha-${nome}.png`) })
      .catch(() => {});
    throw erro;
  } finally {
    await app.close().catch(() => {});
  }
}

export async function rodarComando(janela, titulo) {
  await janela.keyboard.press("Control+Shift+P");
  await janela.waitForSelector(".quick-input-widget input", { timeout: 60_000 });
  await janela.keyboard.type(titulo, { delay: 20 });
  await janela.waitForTimeout(2000);
  await janela.keyboard.press("Enter");
}

/** O aviso (notificação) que contém o texto, quando aparecer. */
export async function esperarAviso(janela, texto, tempoMs = 300_000) {
  const aviso = janela
    .locator(".notification-toast", { hasText: texto })
    .first();
  await aviso.waitFor({ timeout: tempoMs });
  return aviso;
}

export async function textoDoAviso(aviso) {
  return (await aviso.innerText()).replace(/\s+/g, " ").trim();
}
