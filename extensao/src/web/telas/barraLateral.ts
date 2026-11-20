import * as vscode from "vscode";
import { dicasDeDigitacao } from "../atalhos/dicas";
import { teclasDoComando } from "../atalhos/extensao";
import { Plataforma, plataformaAtual, teclasDaExtensao } from "../atalhos/plataforma";
import { lerTemaCores, NomeTema } from "./temas";
import { CREDITOS, escapeHtml } from "./comum";
import { ESTILOS_BARRA_ATALHOS } from "./estilos/barraAtalhos";
import { ESTILOS_BARRA_CONTA } from "./estilos/barraConta";
import { ESTILOS_BARRA_DESAFIO } from "./estilos/barraDesafio";
import { ESTILOS_BARRA_HISTORICO } from "./estilos/barraHistorico";
import { ESTILOS_BARRA_RESULTADO } from "./estilos/barraResultado";
import { estilosBase } from "./estilos/base";

// A barra lateral: a conta, o desafio, o resultado e o histórico.
export function obterHtmlWebview(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  nomeUsuario?: string,
  tema: NomeTema = lerTemaCores(),
  plataforma: Plataforma = plataformaAtual(),
): string {
  // O atalho do comando, pequeno, embaixo do texto do botão.
  const atalho = (comando: string) =>
    `<small class="atalho">${teclasDaExtensao(teclasDoComando(`flexbox-trainer.${comando}`), plataforma)}</small>`;
  const comAtalho = (texto: string, comando: string) =>
    `<span class="rotulo-botao"><span class="texto-botao">${texto}</span>${atalho(comando)}</span>`;
  // Nos botões pequenos, o atalho não cabe embaixo: vai na dica do mouse.
  const dicaComAtalho = (dica: string, comando: string) =>
    `${dica} · ${teclasDaExtensao(teclasDoComando(`flexbox-trainer.${comando}`), plataforma)}`;
  const dicas = escapeHtml(JSON.stringify(dicasDeDigitacao(plataforma)));
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "web", "webview", "app.js"),
  );
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    img-src ${webview.cspSource} https: http: data: blob:;
    font-src ${webview.cspSource};
    script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval';
    style-src ${webview.cspSource} 'unsafe-inline' https: http:;
    connect-src ${webview.cspSource} https: http: ws: wss:;
    frame-src 'self' https: http: data:;
  ">
  <title>FlexBox Trainer</title>
  <style>${estilosBase(webview, extensionUri, tema)}${ESTILOS_BARRA_CONTA}${ESTILOS_BARRA_DESAFIO}${ESTILOS_BARRA_RESULTADO}${ESTILOS_BARRA_HISTORICO}${ESTILOS_BARRA_ATALHOS}
  </style>
</head>
<body>
  <div class="faixa" aria-hidden="true"></div>
  <header class="conta surge" style="--ordem: 0">
    <img id="avatarUsuario" class="avatar-usuario" alt="Foto do usuário" hidden>
    <div id="avatarFallback" class="avatar-fallback">${escapeHtml((nomeUsuario || "U").trim().charAt(0).toUpperCase() || "U")}</div>
    <div class="status-auth-texto" id="statusAutenticacao"><strong>${escapeHtml(nomeUsuario || "Conectado")}</strong></div>
    <button id="botaoSair" class="discreto">Sair</button>
  </header>


  <div class="aviso-ia" id="avisoIa" role="alert" hidden>
    <p class="rotulo">IA habilitada</p>
    <span id="textoAvisoIa"></span>
    <div class="acoes">
      <button id="botaoVerExtensoesIa" class="secundario">Ver extensões</button>
    </div>
  </div>

  <section class="bloco surge" style="--ordem: 1" aria-label="Desafio">
    <div class="cabecalho">
      <h2 class="rotulo"><span class="numero">01</span> / <span id="tituloDesafio">Desafio</span></h2>
      <span class="selo" id="seloDesafio" data-estado="vazio">Sem desafio</span>
    </div>
    <div class="vistas" id="vistas" hidden>
      <div class="modos" role="group" aria-label="O que mostrar no quadro">
        <button type="button" class="modo" data-vista="gabarito" aria-pressed="true">Gabarito</button>
        <button type="button" class="modo" id="botaoVistaPagina" data-vista="pagina" aria-pressed="false">Sua página</button>
      </div>
      <button type="button" id="botaoAbrirAba" class="secundario icone" title="${dicaComAtalho("Abrir em uma aba: o gabarito e as medidas no editor", "abrirGabarito")}" aria-label="Abrir em uma aba" hidden>⧉</button>
      <button type="button" id="botaoAtualizarPreview" class="secundario icone" title="Atualizar a sua página agora. Ela já atualiza sozinha enquanto você digita." aria-label="Atualizar a sua página">↻</button>
    </div>
    <div class="canvas-desafio" id="quadroDesafio" data-vista="gabarito">
      <canvas id="canvasAlvo" width="960" height="540"></canvas>
      <canvas id="canvasAnotacoes" class="canvas-anotacoes" width="960" height="540"></canvas>
      <canvas id="canvasPreviewAluno" class="preview" width="960" height="540"></canvas>
      <p class="quadro-vazio" id="quadroVazio">Gere um desafio para começar</p>
    </div>
    <div class="detalhe" id="detalheComponente" hidden></div>
    <dl class="dados dados-grade" id="metaDesafio" hidden>
      <div><dt>Código</dt><dd><button type="button" id="botaoCodigo" class="valor-codigo" title="Copiar o código: com ele, outra pessoa abre este mesmo desafio">--</button></dd></div>
      <div><dt>Tempo</dt><dd class="tempo-desafio"><span id="valorTempo">--:--</span><button type="button" id="botaoEncerrarDesafio" class="encerrar pequeno" title="Encerrar desafio: para o cronômetro" aria-label="Encerrar desafio" disabled hidden>⏹</button><button type="button" id="botaoRefazer" class="encerrar pequeno" title="${dicaComAtalho("Refazer: começa este mesmo desafio de novo, do zero", "refazerDesafio")}" aria-label="Refazer o desafio, do zero" hidden>↻</button></dd></div>
      <div><dt>Fundo</dt><dd><button type="button" id="valorFundo" class="valor-copiavel" title="Copiar a cor do fundo" disabled>--</button></dd></div>
      <div><dt>Componentes</dt><dd id="valorComponentes">--</dd></div>
    </dl>
    <div class="acoes">
      <div class="modos niveis largo" id="niveis" role="group" aria-label="Nível dos desafios novos">
        <button type="button" class="modo" data-nivel="facil" aria-pressed="false" title="Desafios novos com menos componentes">Fácil</button>
        <button type="button" class="modo" data-nivel="medio" aria-pressed="true" title="Desafios novos no nível do meio">Médio</button>
        <button type="button" class="modo" data-nivel="dificil" aria-pressed="false" title="Desafios novos com todos os componentes">Difícil</button>
      </div>
      <button id="botaoNovoDesafio" class="largo principal"><span class="simbolo mais" aria-hidden="true">+</span>${comAtalho("Gerar novo desafio", "novoDesafio")}</button>
      <button type="button" id="botaoPorCodigo" class="largo secundario" title="Abrir o desafio de um código de 4 letras, como o que o professor ou um colega passar">Abrir por código</button>
    </div>
    <div class="dica" id="dicaDigitacao" data-dicas="${dicas}" hidden>
      <div class="cabecalho-dica">
        <span class="rotulo">Dica</span>
        <button type="button" id="botaoVerAtalhos" class="discreto" title="Os atalhos da extensão e do editor e as abreviações Emmet, numa aba">Ver atalhos</button>
      </div>
      <p id="textoDica"></p>
    </div>
  </section>

  <section class="bloco surge" style="--ordem: 2" aria-label="Resultado">
    <div class="cabecalho">
      <h2 class="rotulo"><span class="numero">02</span> / Resultado</h2>
    </div>
    <div id="avisoArquivos" hidden>
      <p class="falta" id="textoArquivos"></p>
      <div class="acoes">
        <button id="botaoCriarArquivos" class="largo secundario arquivos">Criar index.html e style.css</button>
      </div>
    </div>
    <div
      id="quadroAvaliacao"
      class="preview-avaliacao"
      aria-hidden="true"
    ></div>
    <div class="acoes">
      <button id="botaoVerificar" class="largo principal" disabled><span class="simbolo" id="simboloVerificar" aria-hidden="true">✓</span>${comAtalho("Verificar", "verificar")}</button>
    </div>
    <p class="salvamento" id="avisoSalvamento" data-estado="aguardando" role="status" hidden>Cada verificação salva o seu progresso no servidor.</p>
    <div class="nota resultado" id="notaResultado" hidden>
      <strong class="valor-nota" id="valorNota"></strong>
      <div class="barra-nota" aria-hidden="true"><span id="barraNota"></span></div>
    </div>
    <div class="linha" id="caixaResultado" role="status">Nenhuma verificação.</div>
    <div class="correcoes" id="caixaCorrecoes" hidden>
      <div class="cabecalho-correcoes">
        <span class="rotulo">O que corrigir</span>
        <span class="resumo-correcoes" id="resumoCorrecoes"></span>
      </div>
      <ul class="lista-correcoes" id="listaCorrecoes"></ul>
      <button type="button" id="botaoTodasCorrecoes" class="discreto" title="A lista de todos os componentes, com o que corrigir em cada um, na aba do gabarito" hidden></button>
    </div>
    <dl class="dados historico" id="historicoNotas" hidden>
      <div id="linhaTentativas"><dt>Tentativas</dt><dd id="valorTentativas"></dd></div>
      <div id="linhaMelhor"><dt>Melhor</dt><dd id="valorMelhor"></dd></div>
      <div id="linhaRecorde" title="A melhor nota que você já tirou neste desafio"><dt>Recorde</dt><dd id="valorRecorde"></dd></div>
    </dl>
  </section>

  <section class="bloco surge" style="--ordem: 3" aria-label="Histórico" id="secaoHistorico">
    <div class="cabecalho">
      <h2 class="rotulo"><span class="numero">03</span> / Histórico</h2>
      <div class="acoes-cabecalho">
        <button type="button" id="botaoPuxarProgresso" class="discreto" title="Continuar um desafio salvo no servidor: escolha na lista ou digite o código" hidden>⤓ Continuar…</button>
        <button id="botaoVerHistorico" class="discreto" title="${dicaComAtalho("Todos os desafios que você já verificou", "verHistorico")}" hidden><span class="texto-botao">Ver todos</span></button>
      </div>
    </div>
    <p class="historico-vazio" id="historicoVazio">Os desafios que você verificar aparecem aqui.</p>
    <figure class="evolucao" id="evolucao" hidden>
      <figcaption><span id="tituloEvolucao">Melhor nota</span><span class="valor" id="resumoEvolucao"></span></figcaption>
      <svg id="graficoEvolucao" role="img"></svg>
      <div class="eixo" aria-hidden="true"><span id="inicioEvolucao"></span><span id="fimEvolucao"></span></div>
    </figure>
    <ol class="lista-historico" id="listaHistorico" aria-label="Os desafios mais recentes, com a melhor nota e o tempo"></ol>
  </section>

  <p class="creditos">${CREDITOS}</p>

  <script src="${scriptUri}"></script>
</body>
</html>`;
}
