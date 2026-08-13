# Site de autenticação do FlexBox Trainer

Esta pasta é a página estática usada para obter uma credencial do Google
Identity Services e devolvê-la à extensão. Ela não cadastra usuários e não
armazena tokens.

O diretório inteiro deve ser publicado no endereço configurado em
`flexboxTrainer.authSiteUrl`, inclusive `auth-flow.json`. A extensão confere esse
manifesto antes de abrir o navegador e recusa versões antigas.

No Google Cloud Console, o Client ID configurado em
`flexboxTrainer.googleClientId` precisa autorizar a origem HTTPS onde estes
arquivos forem publicados. Para o endereço padrão atual, a origem é:

```text
https://kevyngreenn.github.io
```

Depois da publicação, estes comandos devem encontrar o fluxo novo:

```bash
curl -s https://kevyngreenn.github.io/authserviceflexbox/auth-flow.json
curl -s https://kevyngreenn.github.io/authserviceflexbox/app.js | rg 'google_token|flowVersion|state'
```
