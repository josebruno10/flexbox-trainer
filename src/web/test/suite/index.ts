// Importa o mocha para o ambiente web e define o global `mocha`.
require("mocha/mocha");

export function run(): Promise<void> {
  return new Promise((concluir, falhar) => {
    mocha.setup({
      ui: "tdd",
      reporter: undefined,
    });

    // Inclui todos os arquivos da pasta que terminam com `.test`.
    const importarTodos = (contexto: __WebpackModuleApi.RequireContext) =>
      contexto.keys().forEach(contexto);
    importarTodos(require.context(".", true, /\.test$/));

    try {
      // Executa os testes.
      mocha.run((falhas: number) => {
        if (falhas > 0) {
          falhar(new Error(`${falhas} testes falharam.`));
        } else {
          concluir();
        }
      });
    } catch (err) {
      console.error(err);
      falhar(err);
    }
  });
}
