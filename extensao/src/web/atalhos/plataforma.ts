// Os atalhos mudam com o sistema: no Mac, Ctrl vira ⌘ (no editor) ou ⌃
// (nos atalhos da extensão), e o Linux tem algumas teclas próprias.
export type Plataforma = "windows" | "linux" | "mac";

/**
 * O sistema de quem usa. No desktop vem do Node; no VS Code pelo navegador,
 * onde o process é um substituto com plataforma "browser", vem do navegador.
 */
export function plataformaAtual(): Plataforma {
  const doNode =
    typeof process !== "undefined" && process.platform !== ("browser" as string)
      ? process.platform
      : undefined;
  return plataformaDe(doNode ?? globalThis.navigator?.userAgent ?? "");
}

/** "darwin", "win32", "linux" ou o userAgent de um navegador. */
export function plataformaDe(nome: string): Plataforma {
  // "darwin" contém "win": o Mac vem antes.
  if (/darwin|mac/i.test(nome)) {
    return "mac";
  }
  return /win/i.test(nome) ? "windows" : "linux";
}

/**
 * "ctrl+alt+shift+d", como no package.json, em "Ctrl+Alt+Shift+D" ou, no
 * Mac, "⌃⌥⇧D". Nos atalhos da extensão, ctrl é Control também no Mac.
 */
export function teclasDaExtensao(teclas: string, plataforma: Plataforma): string {
  const partes = teclas.split("+");
  const tecla = partes.pop()?.toUpperCase() ?? "";
  if (plataforma === "mac") {
    const simbolos: Record<string, string> = { ctrl: "⌃", alt: "⌥", shift: "⇧" };
    return partes.map((parte) => simbolos[parte] ?? parte).join("") + tecla;
  }
  const nomes: Record<string, string> = { ctrl: "Ctrl", alt: "Alt", shift: "Shift" };
  return [...partes.map((parte) => nomes[parte] ?? parte), tecla].join("+");
}
