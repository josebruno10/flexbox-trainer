# Changelog

As mudanças de cada versão do FlexBox Trainer.

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
