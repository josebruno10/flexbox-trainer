import type { Formato, FormatoFixo, Tamanho } from "./types";
import { NIVEIS, valorDoCodigo } from "./niveis";

// Os formatos da imagem do desafio, escolhidos na barra lateral ao lado do
// nível: três tamanhos prontos e o livre, em que o aluno escolhe a largura e
// a altura antes de gerar. O gerador do Vitor monta os layouts em frações da
// largura e da altura (a proporcaoImagem), e os tamanhos mínimos acompanham
// a imagem (veja services/gerador/medidas.ts): uma imagem maior sai como uma
// menor ampliada, sem muito mais componentes.
export const FORMATOS: readonly Formato[] = ["quadrado", "paisagem", "retrato", "livre"];
export const FORMATOS_FIXOS: readonly FormatoFixo[] = ["quadrado", "paisagem", "retrato"];

export const NOME_DO_FORMATO: Record<Formato, string> = {
  quadrado: "quadrado",
  paisagem: "paisagem",
  retrato: "retrato",
  livre: "livre",
};

// O servidor nomeia o gabarito pelo tamanho e não distingue 1280x720 de
// 720x1280 (veja services/servidor/gabaritos.ts): dois formatos prontos nunca
// podem ser o mesmo tamanho virado.
export const TAMANHO_DO_FORMATO: Record<FormatoFixo, Tamanho> = {
  // O de sempre.
  quadrado: { largura: 800, altura: 800 },
  // Uma tela de computador, em 16:9.
  paisagem: { largura: 1280, altura: 720 },
  // Uma tela de celular em pé, em 9:16.
  retrato: { largura: 450, altura: 800 },
};

// O tamanho livre: de 400x400 a 1800x1200, os limites que o Prof. Thiago
// indicou em 2026-11-22. O gerador do Vitor aceita qualquer tamanho e deixou
// os limites para a extensão.
export const TAMANHO_LIVRE_MINIMO = 400;
export const TAMANHO_LIVRE_MAXIMO: Tamanho = { largura: 1800, altura: 1200 };
export const TAMANHO_LIVRE_PADRAO: Tamanho = { largura: 1000, altura: 600 };

/**
 * Como o nível, o formato vem do próprio código: o nível é o resto da divisão
 * por 3, e o formato, o resto do quociente por 4. Quem abre o código de um
 * colega treina o mesmo desafio, no mesmo nível e no mesmo tamanho. No
 * formato livre, o tamanho não cabe nas 4 letras: ele fica com quem criou o
 * desafio e no gabarito da dinâmica do desafio, no servidor.
 */
export function formatoDoCodigo(codigo: string): Formato {
  return FORMATOS[Math.floor(valorDoCodigo(codigo) / NIVEIS.length) % FORMATOS.length];
}

export function ehFormato(valor: unknown): valor is Formato {
  return FORMATOS.includes(valor as Formato);
}

/**
 * Um tamanho livre aceito: px inteiros, de 400 a 1800 de largura e de 400 a
 * 1200 de altura.
 */
export function ehTamanhoLivre(valor: unknown): valor is Tamanho {
  const tamanho = valor as Partial<Tamanho> | null;
  const lado = (medida: unknown, maximo: number) =>
    typeof medida === "number" &&
    Number.isInteger(medida) &&
    medida >= TAMANHO_LIVRE_MINIMO &&
    medida <= maximo;
  return (
    typeof tamanho === "object" &&
    tamanho !== null &&
    lado(tamanho.largura, TAMANHO_LIVRE_MAXIMO.largura) &&
    lado(tamanho.altura, TAMANHO_LIVRE_MAXIMO.altura)
  );
}
