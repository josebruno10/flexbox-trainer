import {
  Caixa,
  Forma,
  MINIMO_FRAGMENTO,
  area,
  caixasQuaseIguais,
  classificar,
  ehRetangular,
  intersectar,
  subtrairCaixas,
} from "./caixas";

// Um fundo coberto por outras formas vira só as faixas que continuam
// visíveis, como na imagem que o servidor compara.

export function recortarFundosCobertos(entrada: Forma[]): Forma[] {
  // Um elemento com a mesma caixa de outro desenhado depois fica escondido.
  const base = [...entrada]
    .sort((a, b) => a.ordem - b.ordem)
    .filter(
      (forma, _indice, lista) =>
        !lista.some((outra) => outra.ordem > forma.ordem && caixasQuaseIguais(outra, forma)),
    );
  const resultado: Forma[] = [];

  for (const forma of base) {
    if (!ehRetangular(forma) || area(forma) < 25) {
      resultado.push(forma);
      continue;
    }

    const cobertas = base
      .filter(
        (outra) =>
          outra !== forma &&
          outra.cor !== forma.cor &&
          area(outra) > 0 &&
          area(outra) < area(forma) * 0.98,
      )
      .flatMap((outra) => {
        const intersecao = intersectar(forma, outra);
        return intersecao &&
          area(intersecao) >= MINIMO_FRAGMENTO * MINIMO_FRAGMENTO &&
          area(intersecao) / Math.max(1, area(outra)) >= 0.75
          ? [intersecao]
          : [];
      });

    if (!deveRecortar(forma, cobertas)) {
      resultado.push(forma);
      continue;
    }

    const fragmentos = subtrairCaixas(
      forma,
      cobertas.sort((a, b) => area(b) - area(a)),
    ).filter((fragmento) => area(fragmento) >= MINIMO_FRAGMENTO * MINIMO_FRAGMENTO);

    fragmentos.forEach((fragmento, indice) => {
      resultado.push({
        ...forma,
        ...fragmento,
        raio: 0,
        tipo: classificar(fragmento.largura, fragmento.altura, 0),
        ordem: forma.ordem + (indice + 1) / 1000,
      });
    });
  }

  return resultado;
}

function deveRecortar(base: Caixa, cobertas: Caixa[]): boolean {
  if (cobertas.length === 0) {
    return false;
  }

  const tolerancia = 2;
  let tocaEsquerda = false;
  let tocaDireita = false;
  let tocaTopo = false;
  let tocaBaixo = false;
  let areaCoberta = 0;

  for (const coberta of cobertas) {
    if (
      coberta.largura >= base.largura - tolerancia ||
      coberta.altura >= base.altura - tolerancia
    ) {
      return true;
    }

    tocaEsquerda ||= coberta.x <= base.x + tolerancia;
    tocaDireita ||= coberta.x + coberta.largura >= base.x + base.largura - tolerancia;
    tocaTopo ||= coberta.y <= base.y + tolerancia;
    tocaBaixo ||= coberta.y + coberta.altura >= base.y + base.altura - tolerancia;
    areaCoberta += area(coberta);
  }

  return (
    ((tocaEsquerda && tocaDireita) || (tocaTopo && tocaBaixo)) &&
    Math.min(1, areaCoberta / Math.max(1, area(base))) >= 0.25
  );
}
