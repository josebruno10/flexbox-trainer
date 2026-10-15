declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

// A webview só pode pedir a API do VS Code uma vez; todos usam esta.
export const vscode = acquireVsCodeApi();
