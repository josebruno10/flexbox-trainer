# Changelog

As mudanças de cada versão do FlexBox Trainer.

## [Não lançado]

### Desafios
- Cada desafio tem um código de 6 dígitos que gera sempre a mesma imagem: **Abrir por código** abre o desafio que o professor passar, e o código aparece nos dados do desafio (clique para copiar) e na aba do gabarito.
- **↻ Refazer**, depois de encerrar, começa o mesmo desafio do zero.
- Histórico com a melhor nota e o tempo de cada desafio verificado, guardado neste computador e separado por e-mail. Cada linha pode ser refeita, e ao refazer um desafio o Resultado mostra o recorde nele.
- **Desafio do dia**: o mesmo desafio para todos na mesma data, sem ninguém precisar passar um código.
- **Copiar resultado** copia o código, a melhor nota e o tempo dela (por exemplo, "Desafio 482 917: 87,42% em 12:34"), para colar no grupo da turma.
- Atalhos: `Ctrl+Alt+D` gera um novo desafio e `Ctrl+Alt+V` verifica, mesmo com a barra lateral fechada.

### Primeiro uso
- Guia de primeiros passos na tela de boas-vindas do VS Code, que abre uma vez, na primeira vez que a extensão roda, e marca o que o aluno já fez.

### Para quem desenvolve
- Testes automáticos no GitHub a cada envio, com o `.vsix` de cada execução para baixar; ao publicar uma versão, o `.vsix` é gerado e anexado sozinho.
- O `npm test` falha quando a suíte não chega a rodar, em vez de passar em silêncio.
- Selo dos testes no README.
- Mocha 12, que corrige as 3 vulnerabilidades que restavam nas ferramentas de teste (nenhuma ia para o `.vsix`).

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
- Gera desafios aleatórios de 800 × 800 px (porta do gerador de Vitor Maia), com retângulos, círculos, colunas e grades.
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
