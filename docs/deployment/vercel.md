# Vercel — member app and API

## Projeto

- Projeto da área de membros: `interprete-area-de-membros`
  - Root Directory: `apps/app`
  - Framework: Next.js
  - Node: `24.x`
- Projeto: `interprete-area-de-membros-api`
- Root Directory: `apps/api`
- Framework: Next.js
- Node: `24.x`
- Package manager: Bun via `bun.lock`
- Build: Vercel/Turborepo detecta o pacote `api`
- Região: `iad1`

O deploy é acionado pelo branch `main`. O `.vercelignore` exclui estado local e artefatos gerados de deploys iniciados pela CLI.

## Variáveis

Os dois projetos possuem as credenciais Clerk de Preview e Production configuradas. As variáveis `DATABASE_URL` e `DIRECT_URL` ainda não foram preenchidas porque a senha PostgreSQL do projeto Supabase não é recuperável após a criação; não é seguro inventar uma string ou resetar a senha sem coordenar todos os consumidores.

As rotas Clerk são `/sign-in` e `/sign-up`, com retorno para `/`. `NEXT_PUBLIC_APP_URL` do app aponta para o alias estável do projeto da área de membros. O publishable key é público por natureza e fica como Config; segredos permanecem Secret.

Resend, Stripe, SVIX, Better Stack, PostHog e Google Analytics permanecem ausentes quando não há credencial válida; integrações opcionais não devem bloquear o build.

## Verificação

Após preencher o banco, aguardar um deployment `READY` e validar `/health?deep=1` no app e na API. Um build verde isolado não comprova conexão Prisma; o runtime deve ser verificado separadamente contra o projeto Supabase oficial.
