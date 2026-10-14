# Changelog

As mudanças de cada versão do FlexBox Trainer.

## [Não lançado]

### Login
- Pré-cadastro no torneio para quem entra com um e-mail que não está lá: a extensão pede nome, ano de ingresso, período, sede e nível, cria o usuário e coloca o aluno no time genérico. Fica desligado (`flexboxTrainer.preCadastro`) até as rotas serem confirmadas com a organização.

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
