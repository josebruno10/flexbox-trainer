import { Aleatorio, limitar } from "./sorteio";

export type Rgb = { r: number; g: number; b: number };

export function corAleatoria(aleatorio: Aleatorio): Rgb {
  return {
    r: Math.floor(aleatorio() * 256),
    g: Math.floor(aleatorio() * 256),
    b: Math.floor(aleatorio() * 256),
  };
}

// Cor do filho a partir da do pai: soma de 75 a 179 em cada canal e, se os
// canais ficarem próximos demais, desloca um deles para fugir do cinza. Como
// no original, o canal deslocado depende do canal mais forte do pai: com o
// vermelho, o verde ou o azul; com o verde, o azul; com o azul, o vermelho ou
// o verde.
export function corDerivada(aleatorio: Aleatorio, pai: Rgb): Rgb {
  const canal = (valor: number) =>
    Math.abs(Math.floor(aleatorio() * 105) + valor + 75) % 255;
  const cor = { r: canal(pai.r), g: canal(pai.g), b: canal(pai.b) };

  if (cor.r - cor.g < 40 && cor.r - cor.b < 40 && cor.g - cor.b < 40) {
    const sorteio =
      pai.r >= pai.b && pai.r >= pai.g
        ? aleatorio() * 2 + 1
        : pai.g >= pai.r && pai.g >= pai.b
          ? aleatorio() * 2 + 2
          : aleatorio() * 2;

    if (sorteio < 1) {
      cor.r = (cor.r + 100) % 255;
    } else if (sorteio < 2) {
      cor.g = (cor.g + 100) % 255;
    } else {
      cor.b = (cor.b + 100) % 255;
    }
  }

  return cor;
}

export function rgbParaHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((canal) => limitar(Math.round(canal), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}
