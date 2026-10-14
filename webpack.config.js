/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check
"use strict";

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const path = require("path");
const webpack = require("webpack");

/** @type WebpackConfig */
const webExtensionConfig = {
  mode: "none", // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
  target: "webworker", // extensions run in a webworker context
  entry: {
    extension: "./src/web/extension.ts",
    "test/suite/index": "./src/web/test/suite/index.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "./dist/web"),
    libraryTarget: "commonjs",
    devtoolModuleFilenameTemplate: "../../[resource-path]",
  },
  resolve: {
    mainFields: ["browser", "module", "main"], // look for `browser` entry point in imported node modules
    extensions: [".ts", ".js"], // support ts-files and js-files
    alias: {
      // provides alternate implementation for node module and source files
    },
    fallback: {
      // Webpack 5 no longer polyfills Node.js core modules automatically.
      // see https://webpack.js.org/configuration/resolve/#resolvefallback
      // for the list of Node.js core module polyfills.
      assert: require.resolve("assert"),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
    ],
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1, // disable chunks by default since web extensions must be a single bundle
    }),
    new webpack.ProvidePlugin({
      process: "process/browser", // provide a shim for the global `process` variable
    }),
  ],
  externals: {
    vscode: "commonjs vscode", // ignored because it doesn't exist
  },
  performance: {
    hints: false,
  },
  devtool: "nosources-source-map", // create a source map that points to the original source file
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
};

/**
 * O mesmo código da extensão para o host Node do VS Code desktop. Cada host
 * só enxerga as próprias extensões, e as de IA (Copilot, Claude Code, Codex...)
 * rodam no Node; só daqui a extensão consegue detectá-las.
 * @type WebpackConfig
 */
const nodeExtensionConfig = {
  mode: "none",
  target: "node",
  entry: {
    extension: "./src/web/extension.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "./dist/node"),
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../../[resource-path]",
  },
  resolve: {
    mainFields: ["module", "main"],
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [{ loader: "ts-loader" }],
      },
    ],
  },
  externals: {
    vscode: "commonjs vscode",
  },
  performance: { hints: false },
  devtool: "nosources-source-map",
  infrastructureLogging: { level: "log" },
};

/** @type WebpackConfig */
const webviewAppConfig = {
  mode: "none", // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
  target: "web", // webview app runs in a browser context
  entry: {
    "webview/app": "./src/web/webview/app.ts",
    "webview/loginPage": "./src/web/webview/loginPage.ts",
    "webview/painelGabarito": "./src/web/webview/painelGabarito.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "./dist/web"),
    // Para Webviews, o ideal é não definir library se for apenas um script global
    // ou garantir que o formato seja estritamente para o navegador.
    scriptType: "text/javascript",
    devtoolModuleFilenameTemplate: "../../[resource-path]",
  },
  resolve: {
    mainFields: ["browser", "module", "main"],
    extensions: [".ts", ".js"],
    fallback: {
      assert: require.resolve("assert"),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [{ loader: "ts-loader" }],
      },
    ],
  },
  performance: { hints: false },
  devtool: "nosources-source-map",
  infrastructureLogging: { level: "log" },
};

/** Suíte de testes para o host Node do desktop (npm run test:desktop). */
/** @type WebpackConfig */
const desktopTestConfig = {
  ...nodeExtensionConfig,
  entry: { "test/desktop": "./src/web/test/desktop.ts" },
  externals: { vscode: "commonjs vscode", mocha: "commonjs mocha" },
};

// O pacote dos testes do desktop só é gerado quando pedido.
module.exports = (env = {}) =>
  env.testesDesktop
    ? [desktopTestConfig]
    : [webExtensionConfig, nodeExtensionConfig, webviewAppConfig];
