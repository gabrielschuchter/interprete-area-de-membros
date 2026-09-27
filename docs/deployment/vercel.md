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
- Região: `iad1`

O deploy é acionado pelo branch `main`. O `.vercelignore` exclui estado local e artefatos gerados de deploys iniciados pela CLI.

## Variáveis

Os dois projetos possuem as credenciais Clerk de Preview e Production configuradas. O endpoint de webhook Clerk de Production aponta para `/webhooks/auth` no projeto API e `CLERK_WEBHOOK_SIGNING_SECRET` está configurado apenas no ambiente Production da API. O app Production também possui a configuração server-only do bucket privado do Supabase Storage.

`DATABASE_URL` e `DIRECT_URL` existem nos ambientes Production/Preview dos dois
projetos. Os valores são secrets/configs da Vercel e não são registrados nesta
documentação. A conexão oficial foi validada diretamente no PostgreSQL/Supabase
durante a auditoria live-first; não há placeholders de banco na produção.

As rotas Clerk são `/sign-in` e `/sign-up`, com retorno para `/`. `NEXT_PUBLIC_APP_URL` do app aponta para o alias estável do projeto da área de membros. O publishable key é público por natureza e fica como Config; segredos permanecem Secret.

Resend, Stripe, SVIX, Better Stack, PostHog e Google Analytics permanecem ausentes quando não há credencial válida; integrações opcionais não devem bloquear o build.

## Verificação

O branch de produção é `main`. O projeto correto e o alias oficial foram
conferidos com a CLI da Vercel; o deployment de produção deve ser sempre
confirmado pelo `target=production`, pelo alias estável e pelo commit da
integração Git antes de ser considerado publicado. O deployment de auditoria
`dpl_6fQj6DrGosMpkk4dcwHG3aoCwKD3` estava `READY` e servindo os aliases oficiais.

O endpoint público de saúde, páginas protegidas e redirects anônimos devem ser
testados separadamente: build verde não substitui autorização, persistência ou
QA autenticado.
