# Changelog

As mudanças de cada versão do FlexBox Trainer.

## [Não lançado]

### Desafios
- O fácil ficou mais fácil: tira 65% dos componentes (os menores), e não mais a metade. Um desafio fácil típico passa de 15 para 11 componentes (um médio tem 21). Os códigos do nível fácil passam a gerar a imagem com menos componentes.

### Sessão e histórico
- Ao abrir o VS Code, a sessão guardada aparece na hora: a barra lateral não fica mais em "Validando a sessão…" esperando o servidor. A confirmação continua em segundo plano; se o servidor recusar a sessão, ela é encerrada como antes.
- Com a Sincronização de Configurações do VS Code ligada, o histórico, o gráfico da evolução e o nível escolhido acompanham o aluno nos outros computadores. Só os do aluno da sessão.

### Removido
- O comentário com o tamanho do gabarito no `style.css` inicial. O manual explica o tamanho da área em **Como treinar**.
- **Dar opinião**, o questionário no GitHub e o pedido de opinião depois do terceiro desafio: a equipe vai colher as opiniões de outra forma.
- **Relatar problema**, o formulário no GitHub e o botão que aparecia abaixo dos erros do servidor.
- A contagem de dias seguidos do desafio do dia, no Histórico. O **Desafio do dia** continua.

### Para quem desenvolve
- A extensão inteira passou para a pasta `extensao/` do repositório, inclusive o `.gitignore` e a licença; na raiz ficam só a `.github/`, com os fluxos e o README curto, e a `.vscode/`, com as configurações do F5. Abra `flexbox-trainer` no VS Code; os comandos `npm` rodam em `extensao/`.
- Os arquivos de código passam a ter nomes em camelCase (`provider/barra-lateral/` virou `provider/barraLateral/`, por exemplo).
- Os arquivos grandes foram divididos por assunto: as telas (`telas/`), o script da barra lateral (`webview/barra/`), o da aba do gabarito (`webview/aba/`), a medição das formas (`webview/formas/`), o login (`auth/`), as rotas do servidor (`services/servidor/`), o gerador (`services/gerador/`), a verificação do provedor (`provider/barraLateral/verificacao.ts`) e os testes (`test/suite/auth/`, `test/suite/barraLateral/`).
- Ao publicar uma versão, um teste de ponta a ponta confere num VS Code de verdade que a versão anterior se atualiza para ela com um clique e mostra o que mudou (`npm run test:e2e`).

## [0.5.1] - 2026-10-15

### Opinião e problemas
- **Dar opinião** abre um questionário de usabilidade no GitHub: as dez perguntas do SUS e duas abertas.
- **Relatar problema** abre um formulário no GitHub já com a versão, o VS Code, o sistema e o código do desafio. Quem não tem conta no GitHub pode copiar essas informações e mandar à equipe.
- Quando uma verificação falha por um erro do servidor, **Relatar problema** aparece logo abaixo da mensagem, e o formulário já vem com ela.
- Depois do terceiro desafio verificado, a extensão pergunta uma única vez se o aluno pode responder ao questionário.

### Para quem desenvolve
- `node scripts/opinioes.mjs` junta as respostas do questionário e calcula a nota SUS de cada uma e a média.

## [0.5.0] - 2026-10-15

### Desafios
- Gerador atualizado com a versão nova do Vitor: os cortes do layout não aparecem mais (o fundo fica à vista entre os elementos), cada elemento fica a 15 px da borda da sua região, nenhuma parte fica menor que 70 px e toda fileira tem ao menos um círculo. Os códigos passaram a gerar outras imagens, e o histórico recomeça.
- Três níveis: fácil, médio e difícil, escolhidos logo acima de **Gerar novo desafio**. Nos mais fáceis saem os componentes menores (metade no fácil e 30% no médio), sempre um padrão inteiro por vez. O nível vem do código, e o desafio do dia é sempre médio.
- O título do desafio, o texto copiado, o histórico, a aba do gabarito e o gráfico da evolução mostram o nível.
- No Histórico, o gráfico **Melhor nota** mostra a evolução do aluno: a melhor nota de cada dia, de 0 a 100%.

### Atualizações
- No VS Code desktop, **Atualizar** baixa e instala sozinho a versão nova e oferece recarregar a janela. No navegador, **Baixar** continua abrindo a página da versão.
- Na primeira vez que uma versão nova abre, um aviso curto leva ao que mudou.

### Telas
- Créditos discretos no pé da barra lateral, da tela de entrada e da página de entrada no navegador.
- A aba do gabarito não repete mais as frases de ajuda nos modos Sobrepor e Lado a lado.
- O `index.html` base não traz mais o comentário no `<body>`.

## [0.4.0] - 2026-10-14

### Desafios
- Cada desafio tem um código de 6 dígitos que gera sempre a mesma imagem: **Abrir por código** abre o desafio que o professor passar, e o código aparece nos dados do desafio (clique para copiar) e na aba do gabarito.
- **↻ Refazer**, depois de encerrar, começa o mesmo desafio do zero.
- Histórico com a melhor nota e o tempo de cada desafio verificado, guardado neste computador e separado por e-mail. Cada linha pode ser refeita, e ao refazer um desafio o Resultado mostra o recorde nele.
- **Desafio do dia**: o mesmo desafio para todos na mesma data, sem ninguém precisar passar um código.
- No Histórico, os dias seguidos em que o aluno verificou o desafio do dia. A sequência vale até o fim do dia seguinte, e o desafio de ontem verificado depois da meia-noite ainda conta para ontem.
- **Copiar resultado** copia o código, a melhor nota e o tempo dela (por exemplo, "Desafio 482 917: 87,42% em 12:34"), para colar no grupo da turma.
- Atalhos: `Ctrl+Alt+D` gera um novo desafio e `Ctrl+Alt+V` verifica, mesmo com a barra lateral fechada.

### Primeiro uso
- Guia de primeiros passos na tela de boas-vindas do VS Code, que abre uma vez, na primeira vez que a extensão roda, e marca o que o aluno já fez.

### Atualizações
- Uma vez por dia, a extensão confere no GitHub se saiu uma versão nova e avisa, com o link para baixar. A consulta não envia nada do aluno.

### Para quem desenvolve
- Testes automáticos no GitHub a cada envio, com o `.vsix` de cada execução para baixar; ao publicar uma versão, o `.vsix` é gerado e anexado sozinho.
- O `npm test` falha quando a suíte não chega a rodar, em vez de passar em silêncio.
- Selo dos testes no README.
- Mocha 12, que corrige as 3 vulnerabilidades que restavam nas ferramentas de teste (nenhuma ia para o `.vsix`).
- O `.vsix` sai bem mais rápido: o build de produção deixa de fora a suíte de testes, que não vai no pacote (aqui, de uns 8 minutos para menos de 1).
- Os testes no GitHub rodam no Ubuntu 24.04, fixo, e o tempo limite de cada teste subiu para 10 s, para não falhar com a máquina carregada.

## [0.3.0] - 2026-10-14

### Telas
- O verde (Floresta) passa a ser a cor padrão da extensão.
- Mais cores de destaque: Campus (verde com toques de vermelho, que aparecem na ponta da faixa do topo, nos números das seções, no avatar e nos destaques), Noite (anil) e Grafite (cinzas).
- Ícone da extensão no verde do projeto, com o círculo vermelho, e a página de login no navegador também em verde.
- No tema claro, o título do login usa a versão escura do degradê, para ficar legível.
- Os círculos mostram largura e altura, como os retângulos, em vez do diâmetro: o aluno os faz com `border-radius` numa caixa. A amostra de cor deles é redonda também na barra lateral.

### Documentação
- O README ficou curto, com o essencial para quem vai instalar; o manual completo foi para `docs/MANUAL.md`.

## [0.2.0] - 2026-10-14

### Login
- Pré-cadastro no torneio para quem entra com um e-mail que não está lá: a extensão pede nome, ano de ingresso, período, sede e nível, cria o usuário e coloca o aluno no time genérico. Fica desligado (`flexboxTrainer.preCadastro`) até as rotas serem confirmadas com a organização.

### Desafios
- Cada desafio começa do zero: ao gerar um novo, o `index.html` e o `style.css` voltam à base (HTML mínimo e o reset do CSS). Se o aluno escreveu algo, a extensão pergunta antes de limpar.

### Telas
- Barra lateral mais curta: o gabarito e a sua página dividem o mesmo quadro, com **Gabarito | Sua página** para alternar, e os dados ficam em duas colunas. O **Verificar** aparece sem rolar.
- Uma ação principal por vez, em degradê: **Gerar novo desafio** antes do primeiro desafio, **Verificar** depois. **Encerrar desafio** ficou discreto.
- Abaixo da nota, as últimas tentativas do desafio e a melhor delas.
- A barra de status mostra o tempo e a última precisão; clicar nela abre a barra lateral.
- Antes do primeiro desafio, o quadro diz como começar.
- A sua página atualiza enquanto você digita, sem precisar salvar. O **Atualizar preview** virou o ↻ ao lado de **Sua página**, para quando demorar, e as linhas dos arquivos deram lugar a um aviso que só aparece quando falta o `index.html` ou o `style.css`.
- Na aba do gabarito, um componente por linha (a amostra é redonda nos círculos), e o botão **Componentes** esconde a lista; no modo Lado a lado ela começa escondida.
- Escolha das cores de destaque (Magenta, a padrão, Oceano, Floresta, Violeta, Pôr do sol ou as do tema do VS Code), pelo ícone de paleta no topo da barra lateral ou por `flexboxTrainer.temaCores`.
- **Testar servidor** saiu da barra lateral e virou comando, no menu ⋯ dela; o teste automático só aparece se der erro.
- O botão **Componentes** da aba diz o que faz ("Mostrar componentes (71)" ou "Esconder componentes") e tem a cor de destaque.
- Ícone novo na barra de atividades, no formato do ícone da extensão, e o ícone colorido na aba do gabarito.

### Documentação
- Imagens das telas no README e na página da versão.

### Para quem desenvolve
- `npm run test:desktop` roda a suíte no host Node do VS Code desktop, e `npm run typecheck` confere os tipos e o código sem uso.
- Ferramentas de build e teste atualizadas, com 10 das 13 vulnerabilidades corrigidas (nenhuma ia para o `.vsix`).

## [0.1.0] - 2026-10-14

Primeira versão para instalar pelo arquivo `.vsix`.

### Desafios
- Gera desafios aleatórios de 800 × 800 px (porta do gerador de Vitor Costa), com retângulos, círculos, colunas e grades.
- Mostra o tamanho e a cor de cada componente na barra lateral e numa aba do gabarito, que compara o gabarito com a sua página (sobrepostos ou lado a lado).
- Cria `index.html` e `style.css` quando a pasta ainda não os tem e marca o tempo de cada tentativa.

### Correção
- Corrige a página pelo servidor do Frontend Teams Cup (`corrigir-formas`), numa dinâmica de treino própria de cada aluno, sem salvar pontuação. A solução exata chega a 100%.
- Como no torneio, não dá dicas: mostra só a precisão.
- Não começa nem corrige com extensões de IA habilitadas e invalida o desafio se uma delas for habilitada ou se `index.html` ou `style.css` forem alterados fora do editor.

### Login
- Entrada com Google, GitHub ou Microsoft. O aluno é identificado no torneio pelo e-mail; a busca tenta todos os e-mails verificados da conta.

### Telas
- Barra lateral, login e aba do gabarito com a identidade do projeto, nos temas claro e escuro do VS Code, e animações discretas que respeitam a opção de reduzir movimento.
