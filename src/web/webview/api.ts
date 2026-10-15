declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

// Cada webview (barra lateral, aba do gabarito, entrada) só pode pedir a API
// do VS Code uma vez; os módulos dela usam esta.
export const vscode = acquireVsCodeApi();
