# Vercel — API deployment

## Projeto

- Projeto: `interprete-area-de-membros-api`
- Root Directory: `apps/api`
- Framework: Next.js
- Node: `24.x`
- Package manager: Bun via `bun.lock`
- Build: Vercel/Turborepo detecta o pacote `api`
- Região: `iad1`

O deploy é acionado pelo branch `main`. O `.vercelignore` exclui estado local e artefatos gerados de deploys iniciados pela CLI.

## Variáveis

Production e Preview possuem as URLs do Supabase (`DATABASE_URL` e `DIRECT_URL`) e as credenciais Clerk configuradas como variáveis da Vercel. O publishable key é público por natureza e fica como Config; segredos permanecem Secret.

As rotas Clerk são `/sign-in` e `/sign-up`, com retorno para `/`. `NEXT_PUBLIC_APP_URL` aponta para o alias estável do projeto API.

Resend, Stripe, SVIX, Better Stack, PostHog e Google Analytics permanecem ausentes quando não há credencial válida; integrações opcionais não devem bloquear o build.

## Verificação

Após qualquer mudança de ambiente, aguardar um deployment `READY` e validar o endpoint `/health`. Um build verde isolado não comprova conexão Prisma; o runtime deve ser verificado separadamente com as credenciais PostgreSQL do Supabase oficial.
