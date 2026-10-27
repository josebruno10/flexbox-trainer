import * as http from "http";

// Um navegador de mentira para o servidor local do login: faz os pedidos
// HTTP direto, sem o fetch, que os testes do AuthService trocam.

export type Resposta = {
  status: number;
  cabecalhos: http.IncomingHttpHeaders;
  corpo: string;
};

export function pedir(
  endereco: string,
  opcoes: { metodo?: string; corpo?: string; cabecalhos?: Record<string, string> } = {},
): Promise<Resposta> {
  return new Promise((pronto, falhou) => {
    const pedido = http.request(
      endereco,
      { method: opcoes.metodo ?? "GET", headers: opcoes.cabecalhos },
      (resposta) => {
        const partes: Buffer[] = [];
        resposta.on("data", (parte: Buffer) => partes.push(parte));
        resposta.on("end", () =>
          pronto({
            status: resposta.statusCode ?? 0,
            cabecalhos: resposta.headers,
            corpo: Buffer.concat(partes).toString("utf8"),
          }),
        );
        resposta.on("error", falhou);
      },
    );
    pedido.on("error", falhou);
    pedido.end(opcoes.corpo);
  });
}

/**
 * O formulário que o site envia ao servidor local com o login. Com a página
 * em no-referrer, o navegador manda a origem como "null".
 */
export function enviarFormulario(
  enderecoDeRetorno: string,
  campos: Record<string, string>,
): Promise<Resposta> {
  return pedir(enderecoDeRetorno, {
    metodo: "POST",
    corpo: new URLSearchParams(campos).toString(),
    cabecalhos: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "null",
    },
  });
}

/** O POST da página de retorno (site antigo), com a query e o fragmento. */
export function postarRetorno(
  enderecoDeRetorno: string,
  retorno: { consulta?: string; fragmento?: string },
  origem = new URL(enderecoDeRetorno).origin,
): Promise<Resposta> {
  return pedir(enderecoDeRetorno, {
    metodo: "POST",
    corpo: new URLSearchParams({
      consulta: retorno.consulta ?? "",
      fragmento: retorno.fragmento ?? "",
    }).toString(),
    cabecalhos: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origem,
    },
  });
}
