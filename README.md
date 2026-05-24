# FlexBox Trainer

Extensão do VS Code criada para treinar recriação de layouts com Flexbox. O objetivo do projeto é permitir que o aluno edite arquivos normais da workspace, veja um preview imediato e receba uma avaliação da tentativa pela interface lateral da extensão.

## Visão Geral

O projeto foi pensado para ser estudado e evoluído em grupo. A base atual já separa a responsabilidade entre entrada da extensão, provider da sidebar, serviços de domínio, montagem da webview e tipos compartilhados.

Em termos simples, o fluxo é este:

1. A extensão ativa no VS Code.
2. A barra lateral é registrada como uma Webview View.
3. A webview mostra o desafio, lê o workspace e exibe o preview.
4. O usuário edita `index.html` e `style.css` no editor normal.
5. A extensão lê esses arquivos, monta o preview e envia os dados para a sidebar.
6. A tentativa é enviada para a avaliação local ou, quando configurada, para o servidor oficial do torneio.

## Arquitetura

A estrutura foi dividida em camadas para deixar o código mais fácil de entender e manter.

### 1. Entrada da extensão

[src/web/extension.ts](src/web/extension.ts) é o ponto de entrada. Ele registra a sidebar, observa salvamentos de arquivos de treino e expõe o comando principal da extensão.

### 2. Provider da sidebar

[src/web/provider/provedor-barra-lateral.ts](src/web/provider/provedor-barra-lateral.ts) concentra o estado da tela lateral. Ele:

- cria novos desafios;
- escuta mensagens vindas da webview;
- lê o estado atual da workspace;
- dispara a avaliação da tentativa;
- envia dados de volta para a interface.

### 3. Serviços de domínio

Os serviços ficam em [src/web/services](src/web/services) e isolam regras específicas:

- [desafio.ts](src/web/services/desafio.ts): cria o desafio base e define os blocos alvo.
- [workspace.ts](src/web/services/workspace.ts): encontra `index.html` e `style.css`, lê os arquivos e monta o HTML de preview.
- [avaliacao.ts](src/web/services/avaliacao.ts): avalia a tentativa usando mock local ou API externa.
- [servidor.ts](src/web/services/servidor.ts): lê a configuração do servidor e faz as chamadas `POST /pasta` e `POST /salvarConteudo`.

### 4. Webview

[src/web/webview/html.ts](src/web/webview/html.ts) monta o HTML da barra lateral. Ele define a interface, o canvas do desafio, o iframe do preview e a comunicação com a extensão via `postMessage`.

### 5. Tipos compartilhados

[src/web/types.ts](src/web/types.ts) define os tipos usados entre a extensão, os serviços e a webview. Isso evita duplicação de estrutura e deixa os contratos mais claros.

### 6. Testes

[src/web/test/suite/index.ts](src/web/test/suite/index.ts) e [src/web/test/suite/extension.test.ts](src/web/test/suite/extension.test.ts) preparam a execução dos testes automatizados da extensão.

## Estrutura de Arquivos

### Arquivos principais do projeto

- [package.json](package.json): define nome, scripts, dependências, comando da extensão e configuração exposta no VS Code.
- [webpack.config.js](webpack.config.js): empacota o código da extensão para web.
- [tsconfig.json](tsconfig.json): configura o TypeScript do projeto.
- [eslint.config.mjs](eslint.config.mjs): regras de lint.
- [CHANGELOG.md](CHANGELOG.md): histórico de mudanças.
- [.vscode/](.vscode): configuração de desenvolvimento do workspace.
- [resources/](resources): ícones e recursos visuais da extensão.

### Código da extensão

- [src/web/extension.ts](src/web/extension.ts): inicialização da extensão e registro dos eventos principais.
- [src/web/provider/provedor-barra-lateral.ts](src/web/provider/provedor-barra-lateral.ts): orquestra o estado da sidebar.
- [src/web/services/desafio.ts](src/web/services/desafio.ts): cria desafios iniciais.
- [src/web/services/workspace.ts](src/web/services/workspace.ts): lê arquivos do aluno e cria o preview.
- [src/web/services/avaliacao.ts](src/web/services/avaliacao.ts): calcula a avaliação local ou chama a API.
- [src/web/services/servidor.ts](src/web/services/servidor.ts): integra com as rotas oficiais do torneio.
- [src/web/webview/html.ts](src/web/webview/html.ts): gera a interface da webview.
- [src/web/webview/app.ts](src/web/webview/app.ts): controla a interface do lado do navegador e captura a imagem do preview.
- [src/web/types.ts](src/web/types.ts): tipos compartilhados.

### Testes

- [src/web/test/suite/index.ts](src/web/test/suite/index.ts): bootstrap do conjunto de testes.
- [src/web/test/suite/extension.test.ts](src/web/test/suite/extension.test.ts): testes iniciais do comportamento da extensão.

### Documentação

- [README.md](README.md): documentação geral do projeto.
- [docs/diario-de-bordo.md](docs/diario-de-bordo.md): modelo do diário de bordo da equipe.
- [docs/diario-de-bordo/fluxo-git-github.md](docs/diario-de-bordo/fluxo-git-github.md): fluxo de trabalho do trio com Git e GitHub.

## Como o Fluxo Funciona

1. O usuário executa o comando da extensão ou abre a aba lateral.
2. A sidebar é renderizada por um provider do VS Code.
3. O provider injeta o HTML da webview.
4. A webview pede o estado atual com uma mensagem `pronto`.
5. A extensão lê os arquivos `index.html` e `style.css` da workspace.
6. O preview é montado e enviado para o iframe da interface.
7. A extensão cria a pasta do aluno na dinâmica usando `POST /pasta`.
8. O usuário clica em verificar.
9. A webview captura o preview com `html2canvas` nas dimensões configuradas.
10. A imagem é enviada ao servidor com `POST /salvarConteudo`.
11. A nota volta e aparece na lateral.

## Arquivos que o Aluno Deve Editar

O projeto foi pensado para que o aluno trabalhe em arquivos normais da workspace, principalmente:

- `index.html`
- `style.css`

O preview da webview usa esses arquivos como base para simular o resultado visual do layout em construção.

## Configuração

### Requisito

- VS Code 1.110.0 ou superior.

### Configuração da API

A extensão lê as configurações `flexboxTrainer.apiBaseUrl`, `flexboxTrainer.apiToken`, `flexboxTrainer.dinamicaId`, `flexboxTrainer.userId`, `flexboxTrainer.teamId`, `flexboxTrainer.captureWidth` e `flexboxTrainer.captureHeight`.

- Se estiver vazia, a avaliação usa mock local.
- Se receber a URL e os dados mínimos, a extensão cria a pasta do aluno em `POST /pasta`.
- Depois, ao verificar, envia a imagem do preview para `POST /salvarConteudo`.
- O tamanho padrão de captura usado no projeto é `960x540`.

## Scripts

- `npm run compile-web`: compila a extensão.
- `npm run watch-web`: compila em modo observação.
- `npm test`: executa os testes da extensão.
- `npm run run-in-browser`: abre a extensão no navegador para desenvolvimento.
- `npm run lint`: executa o lint do projeto.

## Papel de Cada Parte

- Entrada da extensão: inicia tudo e registra eventos do VS Code.
- Provider: segura estado e coordena mensagens.
- Serviços: concentram regras de negócio e acesso à workspace.
- Webview: desenha a interface e conversa com a extensão.
- Tipos: padronizam os dados trafegados entre as camadas.

## Evolução Prevista

O projeto já está organizado para crescer com segurança. As próximas evoluções naturais são:

- desafio procedural mais completo;
- integração real com a API do torneio;
- captura visual da solução do aluno;
- testes mais específicos para cada serviço.

## Resumo Rápido

Se você quiser entender o projeto na ordem mais fácil, leia assim:

1. [package.json](package.json)
2. [src/web/extension.ts](src/web/extension.ts)
3. [src/web/provider/provedor-barra-lateral.ts](src/web/provider/provedor-barra-lateral.ts)
4. [src/web/types.ts](src/web/types.ts)
5. [src/web/services/desafio.ts](src/web/services/desafio.ts)
6. [src/web/services/workspace.ts](src/web/services/workspace.ts)
7. [src/web/services/avaliacao.ts](src/web/services/avaliacao.ts)
8. [src/web/webview/html.ts](src/web/webview/html.ts)
9. [src/web/test/suite/index.ts](src/web/test/suite/index.ts)
10. [src/web/test/suite/extension.test.ts](src/web/test/suite/extension.test.ts)

## Observação

Este README foi escrito para servir como guia de estudo do projeto e também como documentação para novos integrantes da equipe.
