import * as vscode from "vscode";
import { TAMANHO_LIVRE_PADRAO, ehFormato, ehTamanhoLivre } from "../../formatos";
import { ehNivel } from "../../niveis";
import { CHAVE_FORMATO, CHAVE_NIVEL, CHAVE_TAMANHO_LIVRE } from "../../sincronizacao";
import { Formato, Nivel, Tamanho } from "../../types";

/**
 * O nível, o formato e o tamanho livre dos desafios novos, escolhidos na
 * barra lateral. O desafio aberto não muda: o nível e o formato dele vêm do
 * código, e o tamanho, de quando ele foi gerado.
 */
export class PreferenciasDoDesafio {
  public constructor(private readonly armazenamento: vscode.Memento) {}

  /** O médio, se o aluno ainda não escolheu. */
  public nivel(): Nivel {
    const nivel = this.armazenamento.get<unknown>(CHAVE_NIVEL);
    return ehNivel(nivel) ? nivel : "medio";
  }

  /** O quadrado, o de sempre, se o aluno ainda não escolheu. */
  public formato(): Formato {
    const formato = this.armazenamento.get<unknown>(CHAVE_FORMATO);
    return ehFormato(formato) ? formato : "quadrado";
  }

  /** A largura e a altura do formato livre; 1000x600, se o aluno ainda não escolheu. */
  public tamanhoLivre(): Tamanho {
    const tamanho = this.armazenamento.get<unknown>(CHAVE_TAMANHO_LIVRE);
    return ehTamanhoLivre(tamanho) ? tamanho : TAMANHO_LIVRE_PADRAO;
  }

  public async definirNivel(nivel: Nivel): Promise<void> {
    await this.armazenamento.update(CHAVE_NIVEL, nivel);
  }

  public async definirFormato(formato: Formato): Promise<void> {
    await this.armazenamento.update(CHAVE_FORMATO, formato);
  }

  public async definirTamanhoLivre(tamanho: Tamanho): Promise<void> {
    await this.armazenamento.update(CHAVE_TAMANHO_LIVRE, tamanho);
  }
}
