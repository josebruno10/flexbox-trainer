// Abreviações Emmet, que já vêm no VS Code: digita-se a abreviação e aperta-se
// Tab (ou Enter) na sugestão "Emmet Abbreviation". As da primeira lista foram
// digitadas num VS Code 1.142 de verdade, e o resultado é o que ele escreveu;
// as que entraram depois passaram pelo mesmo Emmet do VS Code
// (@vscode/emmet-helper 2.11, que dá os mesmos resultados nas antigas).
// Cuidado ao acrescentar: "fdc", "fww", "jcsa", "jcse", "ais", "ord1" e
// "zi1" parecem óbvias e não fazem o esperado.

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
    abreviacao: ".pai>.filho",
    explicacao: "> põe dentro: a .filho dentro da .pai",
    resultado: '<div class="pai">\n    <div class="filho"></div>\n</div>',
  },
  {
    abreviacao: ".item*3",
    explicacao: "*3 repete: três .item, um depois do outro",
    resultado: '<div class="item"></div>\n<div class="item"></div>\n<div class="item"></div>',
  },
  {
    abreviacao: ".item$*3",
    explicacao: "$ numera: item1, item2 e item3",
    resultado:
      '<div class="item1"></div>\n<div class="item2"></div>\n<div class="item3"></div>',
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
    explicacao: "> e * juntos: uma .linha com 3 .item dentro",
    resultado:
      '<div class="linha">\n    <div class="item"></div>\n    <div class="item"></div>\n    <div class="item"></div>\n</div>',
  },
  {
    abreviacao: "header+main+footer",
    explicacao: "+ põe ao lado",
    resultado: "<header></header>\n<main></main>\n<footer></footer>",
  },
  {
    abreviacao: ".caixa*2>.item*2",
    explicacao: "cada .caixa repetida ganha os seus 2 .item",
    resultado:
      '<div class="caixa">\n    <div class="item"></div>\n    <div class="item"></div>\n</div>\n<div class="caixa">\n    <div class="item"></div>\n    <div class="item"></div>\n</div>',
  },
  {
    abreviacao: ".item$$*3",
    explicacao: "$$ numera com dois dígitos: item01, item02 e item03",
    resultado:
      '<div class="item01"></div>\n<div class="item02"></div>\n<div class="item03"></div>',
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
      { abreviacao: "fxdr", resultado: "flex-direction: row;" },
      { abreviacao: "fxww", resultado: "flex-wrap: wrap;" },
      { abreviacao: "jcc", resultado: "justify-content: center;" },
      { abreviacao: "jcsb", resultado: "justify-content: space-between;" },
      { abreviacao: "jcfe", resultado: "justify-content: flex-end;" },
      { abreviacao: "jcspar", resultado: "justify-content: space-around;" },
      { abreviacao: "jcsev", resultado: "justify-content: space-evenly;" },
      { abreviacao: "aic", resultado: "align-items: center;" },
      { abreviacao: "aifs", resultado: "align-items: flex-start;" },
      { abreviacao: "aife", resultado: "align-items: flex-end;" },
      { abreviacao: "asc", resultado: "align-self: center;" },
      { abreviacao: "acc", resultado: "align-content: center;" },
      { abreviacao: "fx1", resultado: "flex: 1;" },
      { abreviacao: "fxg1", resultado: "flex-grow: 1;" },
      { abreviacao: "fxs0", resultado: "flex-shrink: 0;" },
      { abreviacao: "fxb200", resultado: "flex-basis: 200px;" },
      { abreviacao: "gap10", resultado: "gap: 10px;" },
      { abreviacao: "gap10-20", resultado: "gap: 10px 20px;" },
    ],
  },
  {
    nome: "Tamanho e espaço",
    abreviacoes: [
      { abreviacao: "w100", resultado: "width: 100px;" },
      { abreviacao: "w100p", resultado: "width: 100%;" },
      { abreviacao: "h50p", resultado: "height: 50%;" },
      { abreviacao: "maw100", resultado: "max-width: 100px;" },
      { abreviacao: "m0", resultado: "margin: 0;" },
      { abreviacao: "m10-20", resultado: "margin: 10px 20px;" },
      { abreviacao: "m0-a", resultado: "margin: 0 auto;" },
      { abreviacao: "mt10", resultado: "margin-top: 10px;" },
      { abreviacao: "mla", resultado: "margin-left: auto;" },
      { abreviacao: "p10", resultado: "padding: 10px;" },
      { abreviacao: "bxz", resultado: "box-sizing: border-box;" },
    ],
  },
  {
    nome: "Cor, borda e forma",
    abreviacoes: [
      { abreviacao: "bgc#f00", resultado: "background-color: #f00;" },
      { abreviacao: "bg#fff", resultado: "background: #fff;" },
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
      { abreviacao: "r0", resultado: "right: 0;" },
      { abreviacao: "b0", resultado: "bottom: 0;" },
      { abreviacao: "l0", resultado: "left: 0;" },
      { abreviacao: "z1", resultado: "z-index: 1;" },
    ],
  },
];
