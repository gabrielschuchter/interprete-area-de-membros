# Vercel — member app and API

## Projetos

- Projeto da área de membros: `interprete-area-de-membros-app`
  - Project ID: `prj_bwG8vDd4x2flyPaRMq8HEvi7t5Lj`
  - Root Directory: `apps/app`
  - Framework: Next.js
  - Node: `24.x`
  - Production aliases: `interprete-area-de-membros.vercel.app` e
    `interprete-area-de-membros-app.vercel.app`
- Projeto da API: `interprete-area-de-membros-api`
  - Project ID: `prj_LzsMnY95oPtOdp6KUwUaPRQ5lfh6`
  - Root Directory: `apps/api`
  - Framework: Next.js
  - Node: `24.x`
- Package manager: Bun via `bun.lock`
- Build: Vercel/Turborepo detecta o pacote `api`
- Região efetiva das funções Production, conferida em 06/10/2026 pelo header
  `x-vercel-id`: app `iad1`, API `gru1`. Como o Supabase GREEN está em
  `sa-east-1`, `apps/app/vercel.json` agora fixa o app em `gru1`, mesma região
  do banco e da API; o deployment publicado continua em `iad1` até a próxima
  publicação. A mudança ainda precisa de verificação pelo header do alias após
  o release.

O deploy é acionado pelo branch `main`. O `.vercelignore` exclui estado local e artefatos gerados de deploys iniciados pela CLI.

## Variáveis

Os dois projetos possuem as credenciais Clerk de Preview e Production configuradas. O endpoint de webhook Clerk de Production aponta para `/webhooks/auth` no projeto API e `CLERK_WEBHOOK_SIGNING_SECRET` está configurado apenas no ambiente Production da API. O app Production também possui a configuração server-only do bucket privado do Supabase Storage.

`DATABASE_URL` e `DIRECT_URL` existem nos ambientes Production/Preview dos dois
projetos. Os valores são secrets/configs da Vercel e não são registrados nesta
documentação. A conexão oficial foi validada diretamente no PostgreSQL/Supabase
durante a auditoria live-first; não há placeholders de banco na produção.

As rotas Clerk são `/sign-in` e `/sign-up`, com retorno para `/`. `NEXT_PUBLIC_APP_URL` do app aponta para o alias estável do projeto da área de membros. O publishable key é público por natureza e fica como Config; segredos permanecem Secret.

Resend, Stripe, SVIX, Better Stack, PostHog e Google Analytics permanecem ausentes quando não há credencial válida; integrações opcionais não devem bloquear o build.

## Recuperação da fila de notificações

`apps/api` expõe `POST /cron/outbox`, protegido por `CRON_SECRET`. Configure
um segredo aleatório de pelo menos 32 caracteres no ambiente Production do
projeto `interprete-area-de-membros-api`. A rota de prazos existente em
`apps/app` usa o mesmo nome de variável no projeto da aplicação para a agenda
Vercel já configurada.

Para a recuperação durável do outbox, habilite `pg_cron` e `pg_net` no projeto
Supabase. No Vault, crie `interprete_member_outbox_url` com a URL HTTPS de
Production terminada em `/cron/outbox` e `interprete_member_outbox_secret` com o
mesmo valor de `CRON_SECRET` configurado na API. Execute
[`supabase-outbox-cron.sql`](supabase-outbox-cron.sql) no SQL Editor; o script
valida os pré-requisitos, substitui somente o job com nome
`interprete-member-outbox` e agenda a chamada a cada minuto. Ele lê os segredos
do Vault durante cada execução e não grava seus valores no comando agendado.

Depois da configuração, confirme `POST /cron/outbox` autenticado, a linha do
job em `cron.job`, o resultado HTTP correspondente em `net._http_response` e a
redução do backlog `PENDING`/`RETRY`. O SQL não foi aplicado ao projeto oficial
nesta execução por causa da restrição temporária de quota informada pelo
usuário.

## Verificação

O branch de produção é `main`. O projeto correto e o alias oficial foram
conferidos com a CLI da Vercel; o deployment de produção deve ser sempre
confirmado pelo `target=production`, pelo alias estável e pelo commit da
integração Git antes de ser considerado publicado. O lote de hardening foi
iniciado em `f09e28768eba9505ec87132f068301d22f3471be` (`main`); as correções
posteriores também devem ser promovidas pelo mesmo fluxo Git, sem deploy manual
fora do projeto. O alias estável `interprete-area-de-membros.vercel.app` e o
alias de projeto `interprete-area-de-membros-app.vercel.app` devem apontar para
o deployment Production correspondente ao HEAD publicado.

O endpoint público de saúde, páginas protegidas e redirects anônimos devem ser
testados separadamente: build verde não substitui autorização, persistência ou
QA autenticado.
