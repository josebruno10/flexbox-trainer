# Changelog

As mudanças de cada versão do FlexBox Trainer.

## [0.9.0] - 2026-11-22

### Desafios
- Gerador atualizado com a versão nova do Vitor: são 8 layouts primários, e não mais 3 (entram cabeçalho com duas colunas, faixa sobre três colunas, quatro quadrantes, coluna larga com duas partes ao lado e barra com menu lateral). Os códigos passam a gerar outras imagens, e o histórico recomeça; o gráfico da evolução continua.
- Formato da imagem, escolhido embaixo do nível: **Quadrado** (800 × 800 px, o de sempre), **Paisagem** (1280 × 720 px, como uma tela de computador), **Retrato** (450 × 800 px, como um celular em pé) ou **Livre**, com a largura (de 400 a 1800 px) e a altura (de 400 a 1200 px) que o aluno escolher antes de gerar; os limites são os que o professor indicou. Como o nível, o formato vem do código: quem abre o código de um colega treina no mesmo tamanho. No livre, o código também tem 4 letras e é único (a extensão só usa um que ainda não existe no servidor); o tamanho vai para o servidor no primeiro Verificar, com a imagem do desafio, e é de lá que outro computador o lê. As escolhas ficam guardadas e acompanham a Sincronização de Configurações.
- O tamanho do desafio aparece nos dados, embaixo do gabarito.
- Como no gerador do Vitor, o tamanho mínimo das partes, a margem dos elementos e as medidas dos círculos acompanham a imagem: assim, paisagem e retrato saem com mais ou menos a mesma quantidade de componentes que o quadrado. No 800 × 800, essas medidas não mudam.
- As cores dos componentes fogem mais do cinza, como na versão nova do Vitor: a regra que separa os canais de cor passou a valer para mais e para menos.
- Os círculos não saem mais 1 px mais largos que altos quando a região cai em fração de px.
- Treinar um tamanho e depois o mesmo tamanho virado (1000 × 600 e 600 × 1000) não trava mais o Verificar: o servidor não distingue os dois, e o gabarito da dinâmica de treino é substituído, como entre dois desafios do mesmo tamanho.

### Atalhos
- A aba Atalhos começa pelas abreviações de HTML e de CSS; os atalhos do editor e os da extensão vêm depois.
- Mais atalhos do próprio VS Code na aba Atalhos e nas dicas, agora em grupos: vários cursores, andar e selecionar (palavra a palavra com `Ctrl+Shift+→`, aumentar a seleção com `Shift+Alt+→`), linhas (copiar para cima ou para baixo, recortar a linha, abrir linha em cima, recuo), desfazer e refazer (`Ctrl+Z`) e arquivos (`Ctrl+Tab` entre o HTML e o CSS, `Ctrl+\` para dividir o editor).
- Mais abreviações Emmet: no HTML, `.pai>.filho`, `.item*3`, `.caixa*2>.item*2` e `.item$$*3`; no CSS, `fxdr`, `jcspar` (`space-around`), `jcsev` (`space-evenly`), `aife`, `asc`, `acc`, `fxg1`, `fxs0`, `fxb200`, `gap10-20`, `maw100`, `mla`, `bg#fff`, `r0`, `b0` e `z1`.

### Para quem desenvolve
- O provedor da barra lateral (`provider/provedorBarraLateral.ts`) foi dividido: o começo do desafio e a restauração de cópias foram para `provider/barraLateral/inicioDoDesafio.ts`, o salvamento no servidor para `salvamentoAutomatico.ts`, a regra da alteração fora do editor para `regras.ts` e a montagem da verificação para `verificacao.ts`. O gerador ganhou `services/gerador/layouts.ts` (os layouts primários) e `medidas.ts` (os tamanhos que acompanham a imagem).

## [0.8.0] - 2026-11-20

### Barra lateral
- **O que corrigir**, embaixo da nota: pela correção do servidor, os componentes que mais tiram pontos e o que está diferente em cada um (falta na página, cor, tamanho, lugar em px ou forma), além das formas a mais. Clicar num deles o destaca no gabarito. Nem a extensão oficial mostra isso: o servidor já mandava o detalhe de cada forma, e ele era ignorado.
- Menos botões embaixo de **Gerar novo desafio**: fica só **Abrir por código**; **Abrir em uma aba** virou o **⧉** ao lado de **Sua página**; **Encerrar** e **Refazer** viraram **⏹** e **↻**, ao lado do tempo; **Salvar progresso** saiu (agora é automático) e **Puxar progresso** virou **⤓ Continuar** no Histórico.
- **Copiar resultado** saiu da barra lateral e do menu **⋯**, e perdeu o atalho `Ctrl+Alt+Shift+V`. O comando continua na paleta.
- Clique para copiar: o código no Histórico, a cor do fundo e a largura, a altura e a cor de cada componente (as medidas já com `px`).
- O Histórico aparece desde o começo e tem, em cada linha, **⤓** para continuar o desafio com os arquivos salvos e **↻** para refazê-lo do zero. **⤓ Continuar…**, no topo dele, continua um desafio que não está na lista. "Puxar" virou "Continuar" em todo lugar, inclusive no comando **FlexBox Trainer: Continuar Desafio Salvo**.
- O **Desafio do dia** saiu, com o comando e o atalho `Ctrl+Alt+Shift+D`: para treinar o mesmo desafio que outra pessoa, basta abrir o código dela.

### Aba do gabarito
- Cada componente da lista, e o fundo, ganha uma marca pela última verificação: **✓** ou o que falta acertar (**falta**, **cor**, **tamanho**, **lugar**, **forma**), com os valores na dica do mouse.
- **Verificar** no topo da aba (`Ctrl+Alt+V`), com a última nota, a melhor e quantas verificações você fez, como na extensão oficial do torneio. A barra lateral, onde a página é medida, se abre se estiver fechada, e a aba mostra as etapas até a nota chegar.
- Modo **Comparar**, como na extensão oficial do torneio, ao lado de **Sobrepor à sua página**: o gabarito e a sua página na mesma imagem, divididos por uma linha. Arraste a linha, de qualquer ponto da imagem, ou use as setas do teclado (com `Shift`, ela anda mais rápido).
- O código do desafio aparece inteiro no topo da aba (`MESA`), e não mais separado como `MES A`, uma sobra dos códigos de 6 dígitos.

### Correções
- O `Ctrl+Alt+V` parava de verificar logo depois de abrir o VS Code, quando o servidor confirmava a sessão: a barra lateral era redesenhada com o mesmo HTML, o VS Code não a recarregava, e a extensão ficava esperando um aviso de "carregada" que nunca vinha. O botão da barra continuava funcionando. O mesmo prendia o **Verificar** da aba do gabarito.

### Atalhos
- Os atalhos funcionam mesmo antes de a extensão ativar (por exemplo, com a barra lateral fechada ao abrir o VS Code): antes, eles só valiam depois de a barra lateral carregar. Sem sessão ou sem desafio, o comando diz o que falta.
- **Gerar novo desafio** passou de `Ctrl+Alt+D` para `Ctrl+Alt+G`: no Xfce (Xubuntu, Mint Xfce), `Ctrl+Alt+D` mostra a área de trabalho, e o VS Code nem recebia a tecla.

### Progresso
- Cópias de segurança, como o "Restaurar Backup Local Seguro" da extensão oficial: antes de apagar ou substituir o `index.html` e o `style.css` (num desafio novo, ao continuar um desafio salvo ou ao restaurar uma cópia), a extensão guarda o que você tinha escrito. **FlexBox Trainer: Restaurar Cópia de Segurança**, também no menu **⋯**, abre o desafio da cópia com os arquivos dela. Ficam as 10 mais recentes, neste computador e separadas por aluno.
- Para quem está no torneio, cada **Verificar** também salva o progresso do desafio no servidor, sem perguntar; a linha embaixo do botão diz que salva e mostra quando salvou ("Salvo no servidor às 14:32."). Se não der para salvar, a extensão não insiste naquele desafio. **Salvar Progresso no Servidor**, no menu **⋯**, continua salvando na hora.
- O progresso fica salvo por desafio, como o professor pediu: cada desafio tem a própria dinâmica no servidor, com o mesmo código (o `MESA` fica na dinâmica `mesa`), criada pela extensão no primeiro salvamento. Salvar um desafio não apaga o progresso dos outros.
- A imagem do desafio vai como gabarito da dinâmica dele antes de salvar: sem gabarito, o servidor não guardava o HTML e o CSS. Uma dinâmica sua que tenha ficado sem gabarito recebe a imagem no próximo salvamento; um gabarito que já exista nunca é substituído.
- **Continuar** pergunta qual desafio: lista os que você salvou (a lista acompanha a Sincronização de Configurações) ou deixa digitar o código, e puxa o que está no servidor para ele.
- A extensão só salva numa dinâmica que ela criou para o aluno: se já existir uma com o código do desafio, criada por outra pessoa, ela pode ser do torneio, e o salvamento é recusado.

### Instalação
- A extensão está na loja do VS Code: o README e o manual ensinam a instalar por lá, procurando **FlexBox Trainer** em **Extensões**. O `.vsix` das Releases continua como alternativa para quem não tem acesso à loja.
- Instalada pela loja, a extensão não confere mais as versões no GitHub nem mostra o aviso de versão nova: o próprio VS Code a atualiza. Antes, quem instalava pela loja podia receber dois avisos da mesma versão. Instalada pelo `.vsix`, tudo continua como antes.

## [0.7.0] - 2026-11-19

### Desafios
- O código do desafio passa a ter 4 letras (como `MESA`), como os códigos do servidor, e não mais 6 dígitos. Os códigos de 6 dígitos deixam de valer em todo lugar: **Abrir por código** não os aceita, e os desafios com eles saem do histórico. O gráfico da evolução continua.
- O desafio do dia também ganha um código de 4 letras: alunos com a 0.6.2 e com esta versão veem desafios do dia diferentes.
- O fácil ficou mais fácil de novo: tira 75% dos componentes (os menores), e não mais 65%, sem nunca deixar menos de 8. Um desafio fácil típico passa de 11 para 8 componentes, e o maior, de 20 para 14 (um médio tem 21).

### Progresso
- **Salvar progresso** e **Puxar progresso**, na seção Desafio: o desafio, o `index.html` e o `style.css` vão para uma pasta sua no servidor e voltam em outro computador, pelas rotas `criar-pasta`, `salvar-conteudo` e `obter-conteudo`, as mesmas da extensão oficial. Ao puxar, a extensão abre o mesmo desafio com os arquivos salvos e pergunta antes de substituir o que já estiver escrito.
- Num computador novo, sem dinâmica de treino, a extensão oferece **Já tenho uma**, além de criar uma: o aluno informa o código da dinâmica que já criou, e ela é conferida no servidor sem ser alterada. Também pelo comando **FlexBox Trainer: Usar Minha Dinâmica de Treino**.

## [0.6.2] - 2026-10-29

### Compatibilidade
- A extensão funciona no VS Code 1.82 (agosto de 2023) ou mais novo, e não mais só a partir da 1.110: dá para usar nos computadores de laboratório com um VS Code antigo. Antes da 1.110, ao fim do login no navegador, o VS Code não vem sozinho para a frente.

### Conta
- Quem entra com um e-mail que não está no torneio vê um aviso mais claro: só quem está no Frontend Teams Cup consegue corrigir; quem se inscreveu deve entrar com a conta do e-mail inscrito.
- Sai o pré-cadastro no torneio (a configuração `flexboxTrainer.preCadastro`, que nunca foi ligada, e o botão **Cadastrar no torneio**): a organização não vai liberar as rotas de cadastro, e a extensão não cadastra ninguém.

## [0.6.1] - 2026-10-27

### Login
- Entrar com Google ficou direto: o VS Code abre o navegador sem o aviso "Deseja que Code abra o site externo?", que mostrava o endereço inteiro e ficava esticado. No fim do login, o VS Code volta sozinho para a frente, sem o navegador pedir para abrir o VS Code; a aba mostra **Pronto!**. No VS Code pelo navegador, a volta continua pelo `vscode://`.
- O login não é mais recusado como "não iniciado por esta extensão" quando o comando de login é o que liga a extensão (por exemplo, logo depois de abrir o VS Code).

## [0.6.0] - 2026-10-15

### Desafios
- O fácil ficou mais fácil: tira 65% dos componentes (os menores), e não mais a metade. Um desafio fácil típico passa de 15 para 11 componentes (um médio tem 21). Os códigos do nível fácil passam a gerar a imagem com menos componentes.

### Atalhos
- Novos atalhos: `Ctrl+Alt+Shift+D` (desafio do dia), `Ctrl+Alt+Shift+V` (copiar resultado), `Ctrl+Alt+A` (gabarito em uma aba), `Ctrl+Alt+Shift+N` (refazer o desafio) e `Ctrl+Alt+H` (histórico), além dos que já existiam. Cada botão da barra lateral mostra o seu atalho, pequeno, embaixo do texto.
- Uma dica de digitação no fim da seção Desafio, trocada a cada desafio: um atalho do editor ou uma abreviação Emmet de HTML ou CSS (como `jcc` + Tab, que vira `justify-content: center;`). **Ver atalhos** abre uma aba com todos.

### Sessão e histórico
- O gráfico da evolução aparece desde o primeiro dia de treino no nível, como um ponto; a linha surge no segundo dia.
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
