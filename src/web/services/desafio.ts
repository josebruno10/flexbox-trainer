import { Bloco, Desafio } from "../types";

// cria um desafio mínimo para estudo e evolução incremental.
export function criarDesafioBase(): Desafio {
  const seed = Math.floor(Math.random() * 1000000);

  // base mínima: dois blocos para visualizar o fluxo.
  const blocks: Bloco[] = [
    { id: 1, x: 16, y: 16, width: 608, height: 36, color: "#111" },
    { id: 2, x: 16, y: 72, width: 300, height: 120, color: "#4cba72" },
  ];

  return {
    // challengeId ajuda a identificar tentativas em logs e integração futura.
    challengeId: `challenge-${seed}`,
    seed,
    titulo: "Desafio base (simples)",
    width: 640,
    height: 360,
    blocks,
  };
}
