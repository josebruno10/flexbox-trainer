# FlexBox Trainer

Extensão do VS Code para treinar a recriação de layouts com HTML e CSS, no formato do torneio Frontend Teams Cup. A cada clique, ela gera um desafio novo (uma imagem feita de retângulos e círculos), você o recria em `index.html` e `style.css`, e o servidor do torneio corrige a sua página e devolve a precisão oficial.

O treino segue as condições do torneio: a extensão mostra as medidas e as cores do gabarito, como no torneio, mas não dá dicas do que está errado, e o desafio tem que ser feito do começo ao fim no editor, sem IA. Quem descobre é você.

## O que ela faz

- Gera desafios aleatórios de 800 × 800 px, com cabeçalhos, colunas, grades de cartões e fileiras de círculos.
- Mostra o tamanho e a cor de cada componente do gabarito, na barra lateral ou em uma aba do editor.
- Atualiza a pré-visualização da sua página sempre que você salva os arquivos.
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

Por enquanto a extensão roda a partir do código. Você vai precisar de Git, Node.js 20 ou mais novo e VS Code.

```bash
git clone https://github.com/josebruno10/flexbox-trainer.git
cd flexbox-trainer
npm install
code .
```

No VS Code, abra **Executar e Depurar** (`Ctrl+Shift+D`), escolha **Run Extension (Desktop)** e aperte **F5**. Uma nova janela abre com a pasta `exemplo-treino`, que já tem um `index.html` e um `style.css` para começar.

Essa janela usa as extensões que você tem instaladas. Se alguma for de IA, você não consegue começar nem corrigir desafios até desabilitá-la (veja [Problemas comuns](#problemas-comuns)).

Se você já tinha o projeto, rode `git pull` e `npm install` antes.

## Primeiro uso

1. Na nova janela, clique no ícone do **FlexBox Trainer** na barra de atividades, à esquerda.
2. Entre com **Google**, **GitHub** ou **Microsoft**. Use a conta cujo e-mail está cadastrado no torneio. Se o e-mail não estiver cadastrado, a barra lateral avisa em amarelo e a correção não funciona.
3. Clique em **Gerar novo desafio**. Se a pasta aberta ainda não tiver `index.html` e `style.css`, a extensão os cria com uma base mínima e os abre. Sem pasta aberta, ela oferece **Abrir pasta**.
4. Na primeira vez que clicar em **Verificar**, a extensão pergunta se pode criar a sua **dinâmica de treino**: um espaço só seu no servidor, onde ela guarda a imagem do desafio para corrigir. Clique em **Criar dinâmica de treino** e confirme o código sugerido. Isso acontece uma única vez.

## Como treinar

1. **Gerar novo desafio** cria uma imagem nova. Gere quantas quiser até achar um desafio para treinar; o cronômetro recomeça a cada desafio.
2. Recrie a imagem em `index.html` e `style.css`. Pode usar flexbox, grid ou `position`: o que conta é o resultado na tela.
3. Para consultar medidas e cores, clique em um componente do gabarito na barra lateral, ou use **Abrir em uma aba** para ver todos de uma vez.
4. Salve os arquivos para atualizar a pré-visualização e a comparação.
5. Clique em **Verificar**. A barra lateral mostra as etapas e, no fim, a **precisão oficial do servidor**.
6. Ajuste e verifique de novo. Se a sua página não mudou desde a última verificação, a extensão não a reenvia: ela repete a nota e avisa.
7. **Encerrar desafio** congela o cronômetro quando você terminar.

Só contam elementos com cor de fundo sólida (`background` ou `background-color`). Texto, imagens, gradientes e sombras não são comparados.

## As regras do desafio

Como no torneio, o desafio é feito do começo ao fim no editor, sem IA:

- Não dá para começar um desafio com extensões de IA habilitadas no VS Code.
- Se uma extensão de IA for habilitada durante o desafio, ele é **invalidado**, mesmo que você a desabilite depois.
- Se o `index.html` ou o `style.css` forem alterados fora do editor durante o desafio, ele também é invalidado. Isso pega assistentes de IA que rodam no terminal e gravam direto nos arquivos, mas vale para qualquer programa ou comando (outra janela do VS Code, `git checkout`, um formatador rodado no terminal).
- Um desafio invalidado não pode mais ser corrigido: a barra lateral mostra o motivo, e é só gerar outro.

Salvar no editor, inclusive com formatação ao salvar, e criar os arquivos pelo botão da extensão não contam como alteração de fora.

## A barra lateral

| Botão | O que faz |
|---|---|
| Gerar novo desafio | Cria um desafio novo e reinicia o cronômetro |
| Encerrar desafio | Congela o cronômetro do desafio atual |
| Testar servidor | Confere se a sua sessão está valendo no servidor |
| Abrir em uma aba | Abre o gabarito, as medidas e a comparação em uma aba do editor |
| Atualizar preview | Relê `index.html` e `style.css` sem precisar salvar |
| Criar index.html e style.css | Aparece quando falta algum dos dois; cria só o que falta, sem sobrescrever nada |
| Ver extensões | Aparece no aviso de extensões de IA; abre a página delas para você desabilitar |
| Verificar | Mede a sua página e envia para a correção |
| Sair | Encerra a sua sessão |

## A aba do gabarito

Abra pelo botão **Abrir em uma aba**, pelo atalho **Abrir gabarito em uma aba** que aparece no topo do `index.html` e do `style.css`, ou pela paleta de comandos. A aba acompanha o desafio atual e tem três modos:

- **Gabarito**: a imagem grande e a lista de todos os componentes, com largura, altura (ou diâmetro) e cor. Clique em um componente, na imagem ou na lista, para destacá-lo por alguns segundos (Esc tira o destaque na hora); clique em um valor para copiá-lo.
- **Sobrepor à sua página**: o gabarito por cima da sua página. Arraste o controle entre "Sua página" e "Gabarito" para ver onde cada uma difere.
- **Lado a lado**: o gabarito e a sua página, um ao lado do outro.

A sua página aparece na aba exatamente como ela é medida para a correção, e é atualizada quando você salva os arquivos.

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

## Configurações

Em **Arquivo → Preferências → Configurações**, aba **Usuário**, busque por "flexboxTrainer".

| Configuração | Para que serve |
|---|---|
| `flexboxTrainer.eventoTreino` | Código da sua dinâmica de treino. É preenchido sozinho quando você cria a dinâmica |
| `flexboxTrainer.modoDesenvolvedor` | Mostra ferramentas de teste. Deixe desligado para treinar |
| `flexboxTrainer.apiBaseUrl`, `flexboxTrainer.authApiBaseUrl` | Endereço da API do torneio. Não precisa mudar |
| `flexboxTrainer.authSiteUrl`, `flexboxTrainer.googleClientId` | Site e cliente do login pelo Google. Não precisa mudar |
| `flexboxTrainer.apiToken` | Token manual, só para desenvolvimento |

## Problemas comuns

**A barra lateral avisa que há extensões de IA habilitadas.**
Como no torneio, você só começa e corrige desafios sem elas. Clique em **Ver extensões** no aviso (ou rode **FlexBox Trainer: Ver Extensões de IA Habilitadas**) e, na página de cada uma, clique em **Desabilitar**. Se o VS Code mostrar **Reiniciar Extensões**, clique: uma extensão que já estava rodando só sai depois disso. Então o aviso some. Isso vale também para o GitHub Copilot que vem com o VS Code, se você o tiver habilitado.

**O meu desafio foi invalidado.**
A barra lateral mostra o motivo: uma extensão de IA foi habilitada durante o desafio, ou o `index.html` ou o `style.css` foram alterados fora do editor. Veja [As regras do desafio](#as-regras-do-desafio). Gere um novo desafio e faça-o no editor, sem IA.

**A barra lateral avisa que o meu e-mail não está cadastrado no torneio.**
Você entrou com uma conta cujo e-mail não existe no torneio (é comum com GitHub ou Microsoft, quando o e-mail deles é outro). Clique em **Sair** e entre com a conta cadastrada, de preferência pelo Google.

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
```

Os testes simulam as respostas do servidor e não criam dados reais.

Com `flexboxTrainer.modoDesenvolvedor` ligado, o comando **FlexBox Trainer: Gerar Solução Exata do Desafio (teste)** grava em `index.html` e `style.css` uma página que reproduz o desafio pixel a pixel (com flexbox ou com posição absoluta), para testar se a correção chega a 100%. Ele entrega a resposta, então fica escondido para os alunos.

O servidor é o mesmo da competição. Nunca exclua dados nele e evite testar às terças à noite, quando ele está em uso.
