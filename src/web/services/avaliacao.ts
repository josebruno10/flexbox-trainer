import * as vscode from "vscode";
import { ResultadoAvaliacao, TentativaPayload } from "../types";

// avalia tentativa usando mock local ou api externa.
export async function avaliarTentativa(
  payload: TentativaPayload,
): Promise<ResultadoAvaliacao> {
  const config = vscode.workspace.getConfiguration("flexboxTrainer");
  const apiBaseUrl = config.get<string>("apiBaseUrl", "").trim();

  // sem api: retorno local para não bloquear estudo/desenvolvimento.
  if (!apiBaseUrl) {
    return {
      precision: criarPrecisaoMock(payload.html, payload.css),
      score: 0,
      source: "mock-local",
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      precision: number;
      score: number;
    };

    return {
      precision: data.precision,
      score: data.score,
      source: "api",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return { precision: 0, score: 0, source: "api-error", error: message };
  }
}

// gera precisão simulada simples baseada no tamanho do conteúdo.
function criarPrecisaoMock(html: string, css: string): number {
  const texto = `${html.trim()}|${css.trim()}`;
  if (!texto.trim()) {
    return 0;
  }

  const base = Math.min(100, Math.max(10, texto.length / 20));
  return Number(base.toFixed(2));
}
