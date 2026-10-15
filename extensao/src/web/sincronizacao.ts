import { chavesDoAluno } from "./services/historico";

// Com a Sincronização de Configurações do VS Code ligada, o histórico e o
// gráfico da evolução do aluno vão com ele para os outros computadores,
// junto com o nível escolhido.
// Só os do aluno da sessão: num laboratório, os dos outros ficam onde estão.
// O guia de primeiros passos não vai: num computador novo, ele faria a
// instalação parecer uma atualização.

// O nível dos desafios novos, escolhido na barra lateral.
export const CHAVE_NIVEL = "flexboxTrainer.nivel";

type EstadoSincronizavel = {
  setKeysForSync(chaves: readonly string[]): void;
};

export function chavesSincronizadas(email?: string): string[] {
  return [
    CHAVE_NIVEL,
    ...(email ? chavesDoAluno(email) : []),
  ];
}

/** A lista vale por inteiro: o aluno anterior sai dela. */
export function sincronizarComOutrosComputadores(
  estado: EstadoSincronizavel,
  email: string | undefined,
): void {
  estado.setKeysForSync(chavesSincronizadas(email));
}
