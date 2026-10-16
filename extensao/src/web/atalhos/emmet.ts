// Abreviações Emmet, que já vêm no VS Code: digita-se a abreviação e aperta-se
// Tab (ou Enter) na sugestão "Emmet Abbreviation". Cada uma foi digitada num
// VS Code 1.142 de verdade, e o resultado é o que ele escreveu. Cuidado ao
// acrescentar: "fdc", "fww" e "jcsa" parecem óbvias e não fazem o esperado.

export type AbreviacaoHtml = {
  abreviacao: string;
  // O que a abreviação faz, curto, para a dica da barra lateral.
  explicacao: string;
  resultado: string;
};

export type AbreviacaoCss = {
  abreviacao: string;
  resultado: string;
};

export type GrupoCss = {
  nome: string;
  abreviacoes: readonly AbreviacaoCss[];
};

export const EMMET_HTML: readonly AbreviacaoHtml[] = [
  {
    abreviacao: ".caixa",
    explicacao: "uma div com a classe caixa",
    resultado: '<div class="caixa"></div>',
  },
  {
    abreviacao: "#topo",
    explicacao: "uma div com o id topo",
    resultado: '<div id="topo"></div>',
  },
  {
    abreviacao: "section.cartao",
    explicacao: "outra tag, com classe",
    resultado: '<section class="cartao"></section>',
  },
  {
    abreviacao: "div.a.b",
    explicacao: "duas classes no mesmo elemento",
    resultado: '<div class="a b"></div>',
  },
  {
    abreviacao: ".linha>.item*3",
    explicacao: "> põe dentro, *3 repete: uma .linha com 3 .item",
    resultado:
      '<div class="linha">\n    <div class="item"></div>\n    <div class="item"></div>\n    <div class="item"></div>\n</div>',
  },
  {
    abreviacao: "header+main+footer",
    explicacao: "+ põe ao lado",
    resultado: "<header></header>\n<main></main>\n<footer></footer>",
  },
  {
    abreviacao: ".item$*3",
    explicacao: "$ numera: item1, item2 e item3",
    resultado:
      '<div class="item1"></div>\n<div class="item2"></div>\n<div class="item3"></div>',
  },
  {
    abreviacao: ".a>.b^.c",
    explicacao: "^ sobe um nível: a .c fica ao lado da .a",
    resultado: '<div class="a">\n    <div class="b"></div>\n</div>\n<div class="c"></div>',
  },
  {
    abreviacao: "(.topo>.logo)+.corpo",
    explicacao: "parênteses agrupam",
    resultado:
      '<div class="topo">\n    <div class="logo"></div>\n</div>\n<div class="corpo"></div>',
  },
  {
    abreviacao: "!",
    explicacao: "a estrutura de uma página: doctype, head e body",
    resultado:
      '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    ...\n</head>\n<body>\n    \n</body>\n</html>',
  },
];

export const EMMET_CSS: readonly GrupoCss[] = [
  {
    nome: "Flexbox",
    abreviacoes: [
      { abreviacao: "df", resultado: "display: flex;" },
      { abreviacao: "dg", resultado: "display: grid;" },
      { abreviacao: "fxdc", resultado: "flex-direction: column;" },
      { abreviacao: "fxww", resultado: "flex-wrap: wrap;" },
      { abreviacao: "jcc", resultado: "justify-content: center;" },
      { abreviacao: "jcsb", resultado: "justify-content: space-between;" },
      { abreviacao: "jcfe", resultado: "justify-content: flex-end;" },
      { abreviacao: "aic", resultado: "align-items: center;" },
      { abreviacao: "aifs", resultado: "align-items: flex-start;" },
      { abreviacao: "fx1", resultado: "flex: 1;" },
      { abreviacao: "gap10", resultado: "gap: 10px;" },
    ],
  },
  {
    nome: "Tamanho e espaço",
    abreviacoes: [
      { abreviacao: "w100", resultado: "width: 100px;" },
      { abreviacao: "w100p", resultado: "width: 100%;" },
      { abreviacao: "h50p", resultado: "height: 50%;" },
      { abreviacao: "m0", resultado: "margin: 0;" },
      { abreviacao: "m10-20", resultado: "margin: 10px 20px;" },
      { abreviacao: "m0-a", resultado: "margin: 0 auto;" },
      { abreviacao: "mt10", resultado: "margin-top: 10px;" },
      { abreviacao: "p10", resultado: "padding: 10px;" },
      { abreviacao: "bxz", resultado: "box-sizing: border-box;" },
    ],
  },
  {
    nome: "Cor, borda e forma",
    abreviacoes: [
      { abreviacao: "bgc#f00", resultado: "background-color: #f00;" },
      { abreviacao: "c#fff", resultado: "color: #fff;" },
      { abreviacao: "bdrs50p", resultado: "border-radius: 50%;" },
      { abreviacao: "bdrs10", resultado: "border-radius: 10px;" },
      { abreviacao: "bd1-s-#000", resultado: "border: 1px solid #000;" },
      { abreviacao: "ovh", resultado: "overflow: hidden;" },
    ],
  },
  {
    nome: "Posição",
    abreviacoes: [
      { abreviacao: "posr", resultado: "position: relative;" },
      { abreviacao: "posa", resultado: "position: absolute;" },
      { abreviacao: "t0", resultado: "top: 0;" },
      { abreviacao: "l0", resultado: "left: 0;" },
    ],
  },
];
