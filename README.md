# FlexBox Trainer

[![Testes](https://github.com/josebruno10/flexbox-trainer/actions/workflows/testes.yml/badge.svg)](https://github.com/josebruno10/flexbox-trainer/actions/workflows/testes.yml)

Treino de recriação de layouts em HTML e CSS, no formato do torneio Frontend Teams Cup. A extensão gera um desafio (uma imagem feita de retângulos e círculos), você o recria em `index.html` e `style.css`, e o servidor do torneio corrige a sua página e devolve a precisão.

<p align="center">
  <img src="docs/imagens/barra-lateral.png" alt="Barra lateral com um desafio, as medidas de um componente e a precisão de 87,42%" width="300">
  &nbsp;&nbsp;
  <img src="docs/imagens/aba-lado-a-lado.png" alt="Aba do gabarito com o gabarito e a página do aluno lado a lado" width="560">
</p>

## Como começar

1. Abra uma pasta para treinar (**Arquivo → Abrir Pasta**). Pode ser vazia: a extensão cria o `index.html` e o `style.css`.
2. Clique no ícone do **FlexBox Trainer**, na barra de atividades, e entre com **Google**, **GitHub** ou **Microsoft**, usando a conta cujo e-mail está cadastrado no torneio.
3. Clique em **Gerar novo desafio** e recrie a imagem. Para treinar o mesmo desafio que a turma, use **Desafio do dia**, igual para todos na mesma data, ou **Abrir por código**, com o código que o professor passar. Clique num componente do gabarito para ver as medidas e a cor; **Abrir em uma aba** mostra todos de uma vez.
4. Clique em **Verificar** (ou aperte `Ctrl+Alt+V`) para receber a precisão. Na primeira vez, a extensão pede para criar a sua dinâmica de treino no servidor.

O guia de primeiros passos, que abre na primeira vez, mostra cada passo. O histórico guarda a sua melhor nota em cada desafio, e dá para refazer um para bater o recorde. **Copiar resultado** copia a nota e o tempo, para mandar à turma.

## As regras, como no torneio

- Sem IA: com uma extensão de IA habilitada, não dá para começar nem corrigir. Habilitar uma durante o desafio, ou alterar os arquivos fora do editor, invalida o desafio.
- Cada desafio começa do zero: ao gerar um novo, o `index.html` e o `style.css` voltam à base.
- A extensão não dá dicas: mostra só a precisão.

## Requisitos

- VS Code 1.110 ou mais novo, com internet.
- Uma conta no Frontend Teams Cup.

## Mais

- [Manual completo](docs/MANUAL.md): a barra lateral, a aba do gabarito, os comandos, as configurações e os problemas comuns.
- [Versões para instalar](https://github.com/josebruno10/flexbox-trainer/releases/latest) e [o que mudou em cada uma](CHANGELOG.md).

Licença MIT.
