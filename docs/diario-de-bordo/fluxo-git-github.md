# Fluxo de Git e GitHub - FlexBox Trainer

Este guia mostra como o trio deve trabalhar no projeto sem misturar as tarefas e sem bagunçar o histórico.

## Regra Principal

- ninguém trabalha direto na `main`;
- cada tarefa vai para uma branch própria;
- cada branch vira um pull request;
- só entra na `main` depois de revisão.

## Função de Cada Integrante

### Vitor

Responsável pela lógica e pelo algoritmo do desafio.

Ele deve mexer principalmente em:

- [src/web/services/desafio.ts](../../src/web/services/desafio.ts)
- [src/web/services/avaliacao.ts](../../src/web/services/avaliacao.ts)

Tarefas dele:

- gerar desafios;
- melhorar a regra de avaliação;
- ajustar score e precisão;
- manter a lógica do desafio organizada.

### Kevyn

Responsável pela parte visual da extensão.

Ele deve mexer principalmente em:

- [src/web/webview/html.ts](../../src/web/webview/html.ts)

Tarefas dele:

- organizar layout e cores;
- melhorar espaçamento e leitura;
- deixar a sidebar mais clara;
- ajustar a apresentação da webview.

### José

Responsável pela integração geral e pela organização do projeto.

Você deve mexer principalmente em:

- [src/web/extension.ts](../../src/web/extension.ts)
- [src/web/provider/provedor-barra-lateral.ts](../../src/web/provider/provedor-barra-lateral.ts)
- [src/web/services/workspace.ts](../../src/web/services/workspace.ts)
- [src/web/types.ts](../../src/web/types.ts)

Tarefas suas:

- fazer as partes conversarem entre si;
- manter a leitura do workspace;
- garantir que o preview funcione;
- organizar a documentação;
- revisar integrações.

## Fluxo de Trabalho

1. Definir a tarefa no diário de bordo ou em uma issue.
2. Criar uma branch a partir da `main`.
3. Trabalhar só na sua parte.
4. Fazer commits pequenos e claros.
5. Abrir pull request.
6. Outro colega revisar.
7. Fazer merge na `main`.
8. Rodar `git pull` localmente.

## Nome das Branches

Sugestões simples:

- `feature/desafio-algoritmo`
- `feature/layout-sidebar`
- `feature/integracao-workspace`
- `docs/atualizar-readme`

## Mensagens de Commit

Use mensagens curtas e objetivas:

- `feat: melhorar cálculo do desafio`
- `fix: ajustar leitura de index.html`
- `style: reorganizar sidebar`
- `docs: atualizar documentação`

## O que Colocar no Pull Request

- o que foi feito;
- por que foi feito;
- como testar;
- se existe algum ponto pendente.

## Ordem Recomendada

Para reduzir conflito, o melhor é seguir esta sequência:

1. Vitor fecha a lógica do desafio.
2. Kevyn ajusta a interface para mostrar os dados.
3. José integra tudo e valida o fluxo completo.

Essa ordem ajuda a evitar retrabalho.

## Regras Simples

- não misturar lógica com estilo sem necessidade;
- não mexer no arquivo do colega sem avisar;
- não abrir PR gigante;
- não esquecer de atualizar a branch antes de finalizar.

## Resumo Rápido

Branch própria + commit claro + pull request + revisão + merge.

## Observação

Se vocês seguirem esse fluxo, cada um sabe exatamente no que mexer e fica mais fácil manter o projeto organizado.
