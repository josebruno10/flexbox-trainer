import { Aleatorio, inteiroAleatorio, itemAleatorio } from "./sorteio";

// Os padrões que preenchem uma região: um retângulo comum, um alinhado, uma
// sequência em grade ou uma fileira de círculos.

export type Retangulo = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Cada elemento fica a esta distância das bordas da região que o contém.
export const MARGEM = 15;
const ESPACO_SEQUENCIA = 10;
const ESPACO_MINIMO_CIRCULOS = 30;
const DIAMETRO_MINIMO = 20;

export function retanguloComum(aleatorio: Aleatorio, area: Retangulo): Retangulo {
  const width = inteiroAleatorio(aleatorio, area.width * 0.8, area.width);
  const height = inteiroAleatorio(aleatorio, area.height * 0.8, area.height);

  return {
    x: area.x + inteiroAleatorio(aleatorio, 0, area.width - width),
    y: area.y + inteiroAleatorio(aleatorio, 0, area.height - height),
    width,
    height,
  };
}

export function retanguloAlinhado(aleatorio: Aleatorio, area: Retangulo): Retangulo {
  const width = inteiroAleatorio(aleatorio, area.width * 0.7, area.width);
  const height = inteiroAleatorio(aleatorio, area.height * 0.7, area.height);
  const centroX = area.x + Math.floor((area.width - width) / 2);
  const centroY = area.y + Math.floor((area.height - height) / 2);
  let x = centroX;
  let y = centroY;

  // Centraliza em um eixo e escolhe início, centro ou fim no outro.
  if (aleatorio() < 0.5) {
    y = itemAleatorio(aleatorio, [
      area.y,
      centroY,
      area.y + area.height - height,
    ]);
  } else {
    x = itemAleatorio(aleatorio, [area.x, centroX, area.x + area.width - width]);
  }

  return { x, y, width, height };
}

// Grade de 2 a 6 itens iguais, preenchida no sentido do maior lado.
export function sequencia(aleatorio: Aleatorio, area: Retangulo): Retangulo[] {
  const W = area.width;
  const H = area.height;
  const horizontal = W >= H;
  const metadePerimetroUtil = (W - 10 + (H - 10)) / 2;
  const maximo = Math.min(6, metadePerimetroUtil / (horizontal ? 65 : 70));
  const total = Math.max(2, inteiroAleatorio(aleatorio, 2, maximo));
  const capacidade = (colunas: number, linhas: number) => ({
    colunas,
    linhas,
    largura: (W - (colunas + 1) * ESPACO_SEQUENCIA) / colunas,
    altura: (H - (linhas + 1) * ESPACO_SEQUENCIA) / linhas,
  });

  // Prefere o máximo de itens no sentido principal com o tamanho mínimo
  // desejado; sem isso, usa a grade com a maior área livre por item.
  let grade: ReturnType<typeof capacidade> | undefined;

  for (let principal = total; principal >= 1 && !grade; principal--) {
    const secundario = Math.ceil(total / principal);
    const candidata = horizontal
      ? capacidade(principal, secundario)
      : capacidade(secundario, principal);

    if (candidata.largura >= W * 0.5 && candidata.altura >= H * 0.5) {
      grade = candidata;
    }
  }

  if (!grade) {
    let maiorArea = 0;

    for (let colunas = 1; colunas <= total; colunas++) {
      const candidata = capacidade(colunas, Math.ceil(total / colunas));
      const areaItem = candidata.largura * candidata.altura;

      if (candidata.largura > 0 && candidata.altura > 0 && areaItem > maiorArea) {
        maiorArea = areaItem;
        grade = candidata;
      }
    }
  }

  if (!grade) {
    return [retanguloComum(aleatorio, area)];
  }

  const limiteLargura = Math.min(W, grade.largura);
  const limiteAltura = Math.min(H, grade.altura);
  const inicioLargura = Math.min(W * 0.5, limiteLargura);
  const inicioAltura = Math.min(H * 0.5, limiteAltura);
  const width = inicioLargura + aleatorio() * (limiteLargura - inicioLargura);
  const height = inicioAltura + aleatorio() * (limiteAltura - inicioAltura);
  // Espaços iguais nas bordas e entre itens deixam a grade centralizada.
  const espacoX = (W - width * grade.colunas) / (grade.colunas + 1);
  const espacoY = (H - height * grade.linhas) / (grade.linhas + 1);
  const areas: Retangulo[] = [];

  for (let indice = 0; indice < total; indice++) {
    const linha = horizontal
      ? Math.floor(indice / grade.colunas)
      : indice % grade.linhas;
    const coluna = horizontal
      ? indice % grade.colunas
      : Math.floor(indice / grade.linhas);

    areas.push({
      x: area.x + espacoX + coluna * (width + espacoX),
      y: area.y + espacoY + linha * (height + espacoY),
      width,
      height,
    });
  }

  return areas;
}

// Círculos enfileirados no maior lado, centralizados no outro. A fileira usa
// o comprimento inteiro da região, sem a margem, e tem ao menos um círculo.
export function circulos(aleatorio: Aleatorio, area: Retangulo): Retangulo[] {
  const menorLado = Math.min(area.width, area.height);
  const diametro = Math.max(
    inteiroAleatorio(aleatorio, menorLado * 0.9, menorLado),
    DIAMETRO_MINIMO,
  );
  const comprimento = Math.max(area.width, area.height) + MARGEM * 2;
  const quantidade = Math.max(
    1,
    Math.floor(
      (comprimento - ESPACO_MINIMO_CIRCULOS) / (diametro + ESPACO_MINIMO_CIRCULOS),
    ),
  );
  const espaco = (comprimento - quantidade * diametro) / (quantidade + 1);
  const areas: Retangulo[] = [];

  for (let indice = 0; indice < quantidade; indice++) {
    const deslocamento = espaco + indice * (diametro + espaco) - MARGEM;
    areas.push(
      area.width >= area.height
        ? {
            x: area.x + deslocamento,
            y: area.y + (area.height - diametro) / 2,
            width: diametro,
            height: diametro,
          }
        : {
            x: area.x + (area.width - diametro) / 2,
            y: area.y + deslocamento,
            width: diametro,
            height: diametro,
          },
    );
  }

  return areas;
}
