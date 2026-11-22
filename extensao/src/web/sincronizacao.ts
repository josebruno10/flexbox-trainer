import { chavesDoAluno } from "./services/historico";
import { chaveDosProgressos } from "./services/progressosSalvos";
import { chaveDosTamanhosLivres } from "./services/tamanhosLivres";

// Com a Sincronização de Configurações do VS Code ligada, o histórico, o
// gráfico da evolução, a lista dos progressos salvos e os tamanhos dos
// desafios livres do aluno vão com ele para os outros computadores, junto
// com o nível, o formato e o tamanho livre escolhidos.
// Só os do aluno da sessão: num laboratório, os dos outros ficam onde estão.
// O guia de primeiros passos não vai: num computador novo, ele faria a
// instalação parecer uma atualização.

// O nível dos desafios novos, escolhido na barra lateral.
export const CHAVE_NIVEL = "flexboxTrainer.nivel";
// O formato da imagem dos desafios novos (quadrado, paisagem, retrato ou
// livre) e, no livre, a largura e a altura.
export const CHAVE_FORMATO = "flexboxTrainer.formato";
export const CHAVE_TAMANHO_LIVRE = "flexboxTrainer.tamanhoLivre";

type EstadoSincronizavel = {
  setKeysForSync(chaves: readonly string[]): void;
};

export function chavesSincronizadas(email?: string): string[] {
  return [
    CHAVE_NIVEL,
    CHAVE_FORMATO,
    CHAVE_TAMANHO_LIVRE,
    ...(email
      ? [...chavesDoAluno(email), chaveDosProgressos(email), chaveDosTamanhosLivres(email)]
      : []),
  ];
}

/** A lista vale por inteiro: o aluno anterior sai dela. */
export function sincronizarComOutrosComputadores(
  estado: EstadoSincronizavel,
  email: string | undefined,
): void {
  estado.setKeysForSync(chavesSincronizadas(email));
}
