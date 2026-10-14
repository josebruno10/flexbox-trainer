# Manual do FlexBox Trainer

Tudo sobre a extensão: instalação, uso, regras, comandos, configurações, problemas comuns e desenvolvimento. O resumo está no [README](../README.md).

<p align="center">
  <img src="imagens/barra-lateral.png" alt="Barra lateral com um desafio, as medidas de um componente, a página do aluno e a precisão de 87,42%" width="300">
  &nbsp;&nbsp;
  <img src="imagens/login.png" alt="Tela de login com Google, GitHub e Microsoft" width="300">
</p>

<p align="center">
  <img src="imagens/aba-lado-a-lado.png" alt="Aba do gabarito com o gabarito e a página do aluno lado a lado e a lista de componentes com as medidas" width="900">
</p>

## O que ela faz

- Gera desafios aleatórios de 800 × 800 px, com cabeçalhos, colunas, grades de cartões e fileiras de círculos.
- Mostra o tamanho e a cor de cada componente do gabarito, na barra lateral ou em uma aba do editor.
- Atualiza a pré-visualização da sua página enquanto você digita, sem precisar salvar.
- Compara o gabarito com a sua página, sobrepostos ou lado a lado.
- Envia a sua página para o servidor do torneio corrigir e mostra a precisão oficial. As correções de treino não entram no ranking.
- Como a extensão oficial do torneio, não aceita IA durante o desafio: não deixa começar nem corrigir com extensões de IA habilitadas (Copilot, Claude Code, Codex, Continue, Cline e outras) e invalida o desafio se uma delas for habilitada ou se o código for alterado fora do editor (veja [As regras do desafio](#as-regras-do-desafio)).
- Cria o `index.html` e o `style.css` quando a pasta ainda não os tem.
- Marca o tempo de cada tentativa.

## Requisitos

- VS Code 1.110 ou mais novo.
- Uma conta cadastrada no Frontend Teams Cup, com o mesmo e-mail que você vai usar para entrar (de preferência pelo Google).
- Internet: a extensão valida a sua conta no servidor do torneio ao abrir, e a correção também é feita lá.

## Instalar e abrir

### Pelo arquivo `.vsix` (para treinar)

1. Baixe o arquivo `.vsix` da versão mais nova, em [Releases](https://github.com/josebruno10/flexbox-trainer/releases/latest) (em **Assets**).
2. No VS Code, abra **Extensões** (`Ctrl+Shift+X`), clique nos **⋯** do topo do painel e escolha **Instalar do VSIX...**. Ou, no terminal: `code --install-extension flexbox-trainer-0.3.0.vsix`.
3. Abra uma pasta para treinar (**Arquivo → Abrir Pasta**). Pode ser uma pasta vazia: a extensão cria o `index.html` e o `style.css`.

Para atualizar, instale o `.vsix` novo do mesmo jeito.

### Pelo código (para desenvolver)

Você vai precisar de Git, Node.js 20 ou mais novo e VS Code.

```bash
git clone https://github.com/josebruno10/flexbox-trainer.git
cd flexbox-trainer
npm install
code .
```

No VS Code, abra **Executar e Depurar** (`Ctrl+Shift+D`), escolha **Run Extension (Desktop)** e aperte **F5**. Uma nova janela abre com a pasta `exemplo-treino`, que já tem um `index.html` e um `style.css` de exemplo. O primeiro desafio pergunta se pode limpá-los; depois, `git restore exemplo-treino` traz o exemplo de volta.

Essa janela usa as extensões que você tem instaladas. Se alguma for de IA, você não consegue começar nem corrigir desafios até desabilitá-la (veja [Problemas comuns](#problemas-comuns)).

Se você já tinha o projeto, rode `git pull` e `npm install` antes. Para gerar o `.vsix`, rode `npx @vscode/vsce package`.

## Primeiro uso

1. Clique no ícone do **FlexBox Trainer** na barra de atividades, à esquerda.
2. Entre com **Google**, **GitHub** ou **Microsoft**. Use a conta cujo e-mail está cadastrado no torneio. Se o e-mail não estiver cadastrado, a barra lateral avisa em amarelo e a correção não funciona.
3. Clique em **Gerar novo desafio**. Se a pasta aberta ainda não tiver `index.html` e `style.css`, a extensão os cria com uma base mínima e os abre. Sem pasta aberta, ela oferece **Abrir pasta**.
4. Na primeira vez que clicar em **Verificar**, a extensão pergunta se pode criar a sua **dinâmica de treino**: um espaço só seu no servidor, onde ela guarda a imagem do desafio para corrigir. Clique em **Criar dinâmica de treino** e confirme o código sugerido. Isso acontece uma única vez.

## Como treinar

1. **Gerar novo desafio** cria uma imagem nova e deixa o `index.html` e o `style.css` só com a base. Gere quantas quiser até achar um desafio para treinar; o cronômetro recomeça a cada desafio.
2. Recrie a imagem em `index.html` e `style.css`. Pode usar flexbox, grid ou `position`: o que conta é o resultado na tela.
3. Para consultar medidas e cores, clique em um componente do gabarito na barra lateral, ou use **Abrir em uma aba** para ver todos de uma vez.
4. A pré-visualização e a comparação acompanham o que você digita, sem precisar salvar. Na barra lateral, **Gabarito | Sua página** alterna os dois no mesmo quadro, o que deixa à vista onde eles diferem.
5. Clique em **Verificar**. A barra lateral mostra as etapas e, no fim, a **precisão oficial do servidor**.
6. Ajuste e verifique de novo. Abaixo da nota ficam as últimas tentativas do desafio e a melhor delas. Se a sua página não mudou desde a última verificação, a extensão não a reenvia: ela repete a nota e avisa.
7. **Encerrar desafio** congela o cronômetro quando você terminar.

Só contam elementos com cor de fundo sólida (`background` ou `background-color`). Texto, imagens, gradientes e sombras não são comparados.

## As regras do desafio

Como no torneio, o desafio é feito do começo ao fim no editor, sem IA:

- Não dá para começar um desafio com extensões de IA habilitadas no VS Code.
- Se uma extensão de IA for habilitada durante o desafio, ele é **invalidado**, mesmo que você a desabilite depois.
- Se o `index.html` ou o `style.css` forem alterados fora do editor durante o desafio, ele também é invalidado. Isso pega assistentes de IA que rodam no terminal e gravam direto nos arquivos, mas vale para qualquer programa ou comando (outra janela do VS Code, `git checkout`, um formatador rodado no terminal).
- Um desafio invalidado não pode mais ser corrigido: a barra lateral mostra o motivo, e é só gerar outro.
- Cada desafio começa do zero. Ao gerar um desafio novo, o `index.html` e o `style.css` voltam à base (o HTML mínimo e o reset do CSS: `box-sizing`, `margin` e `padding`), para nada do desafio anterior ser reaproveitado e o tempo contar o desafio inteiro. Se você escreveu algo, a extensão pergunta antes de limpar; com o arquivo aberto, `Ctrl+Z` no editor desfaz a limpeza.

Salvar no editor, inclusive com formatação ao salvar, e criar ou limpar os arquivos pela extensão não contam como alteração de fora.

## A barra lateral

A barra lateral tem duas partes: **Desafio** (o quadro, que alterna entre o gabarito e a sua página, as medidas e os dados do gabarito) e **Resultado** (o **Verificar**, a precisão e as tentativas). Se faltar o `index.html` ou o `style.css` na pasta aberta, o Resultado avisa e oferece criá-los. O caminho dos arquivos usados aparece ao parar o mouse sobre **Sua página**.

| Botão | O que faz |
|---|---|
| Gabarito, Sua página | Alternam o que o quadro mostra: o gabarito ou a sua página |
| Gerar novo desafio | Cria um desafio novo e reinicia o cronômetro |
| Encerrar desafio | Congela o cronômetro do desafio atual |
| Abrir em uma aba | Abre o gabarito, as medidas e a comparação em uma aba do editor |
| ↻ (ao lado de Sua página) | Atualiza a sua página na hora. Ela já atualiza sozinha enquanto você digita; use se demorar |
| Criar index.html e style.css | Aparece quando falta algum dos dois; cria só o que falta, sem sobrescrever nada |
| Ver extensões | Aparece no aviso de extensões de IA; abre a página delas para você desabilitar |
| Verificar | Mede a sua página e envia para a correção |
| Sair | Encerra a sua sessão |

Enquanto há um desafio, a barra de status, embaixo da janela, mostra o tempo e a última precisão, mesmo com a barra lateral fechada. Clique nela para abrir a barra lateral.

No topo da barra lateral, o ícone de paleta escolhe as cores de destaque da extensão (veja [Configurações](#configurações)), e o menu **⋯** tem o **Testar Servidor**, que confere se a sua sessão está valendo. A extensão já testa o servidor sozinha a cada desafio novo e só avisa se der erro.

## A aba do gabarito

Abra pelo botão **Abrir em uma aba**, pelo atalho **Abrir gabarito em uma aba** que aparece no topo do `index.html` e do `style.css`, ou pela paleta de comandos. A aba acompanha o desafio atual e tem três modos:

- **Gabarito**: a imagem grande e a lista de todos os componentes, um por linha, com largura, altura e cor. Os círculos também aparecem em largura e altura, como você os faz com `border-radius`, e têm a amostra redonda. Clique em um componente, na imagem ou na lista, para destacá-lo por alguns segundos (Esc tira o destaque na hora); clique em um valor para copiá-lo.
- **Sobrepor à sua página**: o gabarito por cima da sua página. Arraste o controle entre "Sua página" e "Gabarito" para ver onde cada uma difere.
- **Lado a lado**: o gabarito e a sua página, um ao lado do outro. A lista começa escondida, para as imagens ficarem maiores.

O botão **Componentes** mostra ou esconde a lista em qualquer modo.

A sua página aparece na aba exatamente como ela é medida para a correção, e acompanha o que você digita.

<p align="center">
  <img src="imagens/aba-gabarito.png" alt="Aba do gabarito no modo Gabarito, com a lista de componentes e as medidas de cada um" width="900">
</p>

## Comandos

Abra a paleta com `Ctrl+Shift+P` e digite "FlexBox Trainer".

| Comando | O que faz |
|---|---|
| FlexBox Trainer: Fazer Login | Abre o login pelo Google no navegador |
| FlexBox Trainer: Sair | Encerra a sessão |
| FlexBox Trainer: Iniciar | Abre a barra lateral (e o login, se precisar) |
| FlexBox Trainer: Abrir Gabarito em uma Aba | Abre a aba do gabarito |
| FlexBox Trainer: Criar index.html e style.css | Cria na pasta aberta os arquivos que faltarem |
| FlexBox Trainer: Ver Extensões de IA Habilitadas | Mostra as extensões de IA que impedem começar e corrigir desafios e abre a página delas |
| FlexBox Trainer: Criar Dinâmica de Treino | Cria a sua dinâmica de treino, se você não a criou no primeiro Verificar |
| FlexBox Trainer: Testar Servidor | Confere se a sua sessão está valendo no servidor |
| FlexBox Trainer: Escolher Cores | Troca as cores de destaque da extensão |

## Configurações

Em **Arquivo → Preferências → Configurações**, aba **Usuário**, busque por "flexboxTrainer".

| Configuração | Para que serve |
|---|---|
| `flexboxTrainer.eventoTreino` | Código da sua dinâmica de treino. É preenchido sozinho quando você cria a dinâmica |
| `flexboxTrainer.modoDesenvolvedor` | Mostra ferramentas de teste. Deixe desligado para treinar |
| `flexboxTrainer.temaCores` | Cores de destaque: Floresta (a padrão, em verdes), Campus (verde com toques de vermelho), Oceano, Noite, Violeta, Magenta, Pôr do sol, Grafite ou as do tema do VS Code. Muda só o degradê, o botão principal e os destaques; o resto segue o tema do VS Code |
| `flexboxTrainer.preCadastro` | Oferece cadastrar no torneio quem entra com um e-mail que não está lá. Ainda desligado: espera a organização confirmar as rotas de cadastro |
| `flexboxTrainer.apiBaseUrl`, `flexboxTrainer.authApiBaseUrl` | Endereço da API do torneio. Não precisa mudar |
| `flexboxTrainer.authSiteUrl`, `flexboxTrainer.googleClientId` | Site e cliente do login pelo Google. Não precisa mudar |
| `flexboxTrainer.apiToken` | Token manual, só para desenvolvimento |

## Problemas comuns

**A barra lateral avisa que há extensões de IA habilitadas.**
Como no torneio, você só começa e corrige desafios sem elas. Clique em **Ver extensões** no aviso (ou rode **FlexBox Trainer: Ver Extensões de IA Habilitadas**) e, na página de cada uma, clique em **Desabilitar**. Se o VS Code mostrar **Reiniciar Extensões**, clique: uma extensão que já estava rodando só sai depois disso. Então o aviso some. Isso vale também para o GitHub Copilot que vem com o VS Code, se você o tiver habilitado.

**O meu desafio foi invalidado.**
A barra lateral mostra o motivo: uma extensão de IA foi habilitada durante o desafio, ou o `index.html` ou o `style.css` foram alterados fora do editor. Veja [As regras do desafio](#as-regras-do-desafio). Gere um novo desafio e faça-o no editor, sem IA.

**A barra lateral avisa que o meu e-mail não está cadastrado no torneio.**
Você entrou com uma conta cujo e-mail não existe no torneio (é comum com GitHub ou Microsoft, quando o e-mail deles é outro). A extensão procura o aluno por todos os e-mails verificados da conta; no GitHub, dá para adicionar e confirmar o e-mail do torneio em github.com/settings/emails e entrar de novo. Senão, clique em **Sair** e entre com a conta cadastrada, de preferência pelo Google. Com `flexboxTrainer.preCadastro` ligado, aparece o botão **Cadastrar no torneio**: ele pede nome, ano de ingresso, período, sede e nível, cadastra o e-mail da conta e coloca você no time genérico.

**Ao apertar F5, apareceu "Select debugger" ou a tela "Run and Debug".**
O VS Code não abriu a pasta certa. Use **Arquivo → Abrir Pasta** e escolha a pasta `flexbox-trainer`, a que tem `package.json`, `src` e `.vscode` dentro. Se aparecer o aviso de confiança, responda que confia nos autores.

**A tarefa terminou com o código de saída 127.**
O VS Code não encontrou o `npm`. Acontece quando o Node foi instalado pelo nvm e o VS Code foi aberto pelo menu. Abra o VS Code pelo terminal, de dentro da pasta do projeto, com `code .`.

**O login do GitHub ou da Microsoft não abre.**
Feche a janela de teste e abra de novo. Se continuar, confira em **Extensões** (busque `@builtin GitHub Authentication` ou `Microsoft Authentication`) se a extensão de login embutida está habilitada. No VS Code pelo navegador, o login da Microsoft não está disponível.

**A minha página parece igual ao gabarito, mas a nota está baixa.**
Confira se todos os elementos usam cor de fundo sólida e se as medidas batem exatamente; use o modo **Sobrepor à sua página** da aba do gabarito para ver as diferenças.

**O código da dinâmica de treino foi recusado.**
O servidor aceita no máximo 4 caracteres (letras minúsculas e números). Se o código sugerido já existir, escolha outro.

## Para quem desenvolve

O código fica em `src/web` (a extensão roda no extension host web do VS Code):

| Pasta | Conteúdo |
|---|---|
| `auth/` | Login pelo Google (site externo), GitHub e Microsoft, e a sessão com o servidor |
| `provider/` | A barra lateral e a aba do gabarito |
| `services/` | Gerador de desafios, correção, dinâmica de treino, chamadas ao servidor e leitura dos arquivos |
| `webview/` | O que roda dentro da barra lateral e da aba: desenho do gabarito, página do aluno e medição das formas |
| `test/suite/` | Testes automatizados |

No desktop, a extensão roda no host Node do VS Code (`dist/node`), o mesmo das outras extensões; é de lá que ela consegue ver as extensões de IA. No VS Code pelo navegador, roda no host web (`dist/web`). O código é o mesmo para os dois.

Há duas configurações de execução:

- **Run Extension (Desktop)**: igual à instalação dos alunos, com as suas extensões. As de IA impedem começar e corrigir desafios.
- **Run Extension (Desktop, sem outras extensões)**: abre a janela de teste sem as suas extensões instaladas (as embutidas do VS Code continuam). Use para testar a correção se você desenvolve com Copilot, Claude Code ou outra extensão de IA.

```bash
npm run compile-web   # compila
npm run watch-web     # compila a cada alteração
npm run lint          # verifica o estilo do código
npm test              # roda os testes em um VS Code no Chromium
npm run test:desktop  # roda os mesmos testes no VS Code desktop (precisa do comando `code`)
npm run typecheck     # confere os tipos e acusa código sem uso
```

Os testes simulam as respostas do servidor e não criam dados reais.

Com `flexboxTrainer.modoDesenvolvedor` ligado, o comando **FlexBox Trainer: Gerar Solução Exata do Desafio (teste)** grava em `index.html` e `style.css` uma página que reproduz o desafio pixel a pixel (com flexbox ou com posição absoluta), para testar se a correção chega a 100%. Ele entrega a resposta, então fica escondido para os alunos.

O servidor é o mesmo da competição. Nunca exclua dados nele e evite testar às terças à noite, quando ele está em uso.

## Licença

MIT (veja [LICENSE](../LICENSE)). As fontes Space Grotesk e DM Mono, em `media/fontes`, seguem a licença SIL Open Font License 1.1, com os textos ao lado delas.
