// Testa de ponta a ponta a atualização com um clique e o "O que mudou", como
// um aluno veria: um VS Code limpo com a versão anterior instalada abre o
// FlexBox Trainer, recebe o aviso da versão nova, clica em Atualizar e, ao
// abrir de novo, vê que foi atualizado.
//
// Uso: npm run test:e2e -- <.vsix da versão anterior> <versão nova>
// Precisa de rede: a versão nova vem das Releases do GitHub, então só vale
// depois de ela ser publicada com o .vsix anexado (o workflow Versão faz
// isso e roda este teste em seguida).
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  baixarVsCode,
  comVsCodeAberto,
  esperarAviso,
  instalarVsix,
  textoDoAviso,
} from "./vscode.mjs";

const [vsixAnterior, versaoNova] = process.argv.slice(2);
if (!vsixAnterior || !existsSync(vsixAnterior) || !/^\d+\.\d+\.\d+$/.test(versaoNova ?? "")) {
  console.error(
    "Uso: npm run test:e2e -- <.vsix da versão anterior> <versão nova, como 0.6.0>",
  );
  process.exit(2);
}

// As fotos de falha ficam aqui; no CI, a pasta vira um artefato.
const pasta =
  process.env.E2E_PASTA ?? mkdtempSync(join(tmpdir(), "flexbox-trainer-e2e-"));
console.log(`Perfil e fotos em ${pasta}`);

const executavel = await baixarVsCode();
instalarVsix(executavel, pasta, resolve(vsixAnterior));

// 1. A versão anterior avisa da nova; Atualizar baixa e instala.
await comVsCodeAberto(executavel, pasta, "atualizar", async (janela) => {
  const aviso = await esperarAviso(janela, "Versão nova do FlexBox Trainer");
  const texto = await textoDoAviso(aviso);
  console.log(`aviso: ${texto}`);
  if (!texto.includes(versaoNova)) {
    throw new Error(`o aviso não fala da versão ${versaoNova}: ${texto}`);
  }
  await aviso.getByRole("button", { name: "Atualizar" }).click();
  console.log(`depois: ${await textoDoAviso(await esperarAviso(janela, "instalad"))}`);
});

const instaladas = readdirSync(join(pasta, "extensoes"));
if (!instaladas.includes(`josebruno10.flexbox-trainer-${versaoNova}`)) {
  throw new Error(`a versão ${versaoNova} não foi instalada: ${instaladas.join(", ")}`);
}

// 2. Aberto de novo, o FlexBox Trainer conta que foi atualizado.
await comVsCodeAberto(executavel, pasta, "o-que-mudou", async (janela) => {
  const aviso = await esperarAviso(janela, "foi atualizado");
  const texto = await textoDoAviso(aviso);
  console.log(`aviso: ${texto}`);
  if (!texto.includes(versaoNova)) {
    throw new Error(`o aviso não fala da versão ${versaoNova}: ${texto}`);
  }
});

console.log(`A atualização para a ${versaoNova} funcionou de ponta a ponta.`);
