import * as assert from "assert";
import { RetornoLocal } from "../../../auth/retornoLocal";
import { enviarFormulario, pedir, postarRetorno } from "./navegadorFalso";

const SITE = "https://site.example/login/?callback=x&state=abc";

// O servidor local do login com Google, que só existe no desktop.
suite("Servidor local do login", function () {
  suiteSetup(function () {
    if (!RetornoLocal.disponivel()) {
      this.skip();
    }
  });

  test("leva o navegador ao site e recebe o login pelo formulário do site", async () => {
    const retorno = await RetornoLocal.abrir();
    const entrada = retorno.entrada(SITE, "estado-1");
    assert.match(entrada, /^http:\/\/127\.0\.0\.1:\d+\/entrar\?c=[a-f0-9]{32}$/);

    const ida = await pedir(entrada);
    assert.strictEqual(ida.status, 302);
    assert.strictEqual(ida.cabecalhos.location, SITE);

    // No corpo do POST, o token não fica no histórico do navegador.
    const fim = enviarFormulario(retorno.enderecoDeRetorno, {
      server_token: "abc",
      remember: "1",
      state: "estado-1",
    });
    assert.deepStrictEqual(await retorno.recebido, {
      query: "",
      fragment: "server_token=abc&remember=1&state=estado-1",
    });
    retorno.concluir({ ok: true, nome: "Ana" });
    const pagina = await fim;
    assert.strictEqual(pagina.status, 200);
    assert.match(String(pagina.cabecalhos["content-type"]), /text\/html/);
    assert.match(pagina.corpo, /Pronto!/);
    assert.match(pagina.corpo, /Você entrou como Ana\./);

    // Concluído, o servidor fecha.
    await assert.rejects(pedir(entrada));
  });

  test("um site antigo manda o token no fragmento, e a página de retorno o envia", async () => {
    const retorno = await RetornoLocal.abrir();
    retorno.entrada(SITE, "estado-1");

    const pagina = await pedir(retorno.enderecoDeRetorno);
    assert.strictEqual(pagina.status, 200);
    const nonce = /'nonce-([a-f0-9]+)'/.exec(
      String(pagina.cabecalhos["content-security-policy"]),
    )?.[1];
    assert.ok(nonce && pagina.corpo.includes(`<script nonce="${nonce}">`));
    assert.match(pagina.corpo, /history\.replaceState/);

    const fim = postarRetorno(retorno.enderecoDeRetorno, {
      consulta: "a=1",
      fragmento: "server_token=abc&state=estado-1",
    });
    assert.deepStrictEqual(await retorno.recebido, {
      query: "a=1",
      fragment: "server_token=abc&state=estado-1",
    });
    retorno.concluir({ ok: false, mensagem: "O servidor recusou" });
    const dados = JSON.parse((await fim).corpo) as Record<string, string>;
    assert.strictEqual(dados.estado, "erro");
    assert.strictEqual(dados.titulo, "Não deu para entrar");
    assert.strictEqual(dados.texto, "O servidor recusou. Volte ao VS Code e tente de novo.");
  });

  test("um retorno de outro login ou de outro site não encerra a espera", async () => {
    const retorno = await RetornoLocal.abrir();
    retorno.entrada(SITE, "estado-certo");

    const outroState = await enviarFormulario(retorno.enderecoDeRetorno, {
      server_token: "x",
      state: "outro",
    });
    assert.strictEqual(outroState.status, 400);
    assert.match(outroState.corpo, /não é do login em andamento/);
    assert.strictEqual((await enviarFormulario(retorno.enderecoDeRetorno, {})).status, 400);
    // O script da página de retorno só vale da própria página.
    const outroSite = await postarRetorno(
      retorno.enderecoDeRetorno,
      { fragmento: "state=estado-certo" },
      "https://outro.example",
    );
    assert.strictEqual(outroSite.status, 403);

    const certo = enviarFormulario(retorno.enderecoDeRetorno, {
      server_token: "y",
      state: "estado-certo",
    });
    assert.strictEqual((await retorno.recebido).fragment, "server_token=y&state=estado-certo");
    // Reenviar o formulário (recarregando a página) não manda o login de novo.
    const repetido = await enviarFormulario(retorno.enderecoDeRetorno, {
      server_token: "z",
      state: "estado-certo",
    });
    assert.strictEqual(repetido.status, 409);
    assert.match(repetido.corpo, /Login já recebido/);

    retorno.concluir({ ok: true });
    assert.match((await certo).corpo, /Você entrou\. Pode fechar/);
  });

  test("a ida só vale com o código do login, e por outro nome de host não passa", async () => {
    const retorno = await RetornoLocal.abrir();
    const entrada = retorno.entrada(SITE, "e");

    const errado = await pedir(entrada.replace(/c=[a-f0-9]+/, "c=000"));
    assert.strictEqual(errado.status, 404);
    assert.match(errado.corpo, /Este login não vale mais/);
    // Um site que aponta o próprio nome para 127.0.0.1 (DNS rebinding).
    const outroHost = await pedir(entrada, { cabecalhos: { Host: "evil.example" } });
    assert.strictEqual(outroHost.status, 400);
    retorno.fechar();
  });

  test("a página não espera para sempre, e fechar encerra a espera", async () => {
    const retorno = await RetornoLocal.abrir(20);
    retorno.entrada(SITE, "e");
    const resposta = await enviarFormulario(retorno.enderecoDeRetorno, { state: "e" });
    assert.match(resposta.corpo, /Quase lá/);
    retorno.fechar();

    const outro = await RetornoLocal.abrir();
    outro.entrada(SITE, "e");
    outro.fechar();
    await assert.rejects(outro.recebido, /encerrado/);
  });
});
