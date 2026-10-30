# Vercel — área de membros e API

## Projetos

- Área de membros: `interprete-area-de-membros-app`, projeto
  `prj_bwG8vDd4x2flyPaRMq8HEvi7t5Lj`, root `apps/app`, Next.js, Node `24.x`.
- API: `interprete-area-de-membros-api`, projeto
  `prj_LzsMnY95oPtOdp6KUwUaPRQ5lfh6`, root `apps/api`, Next.js, Node `24.x`.
- A instalação usa Bun via `bun.lock` e Turborepo.
- O app Production atende `membros.escolainterprete.com.br`. Os aliases
  `interprete-area-de-membros.vercel.app` e
  `interprete-area-de-membros-app.vercel.app` são mantidos apenas como entradas
  de redirect para links históricos.
- A API mantém seu domínio Vercel próprio. Webhooks Clerk Production continuam
  em `/webhooks/auth` nesse projeto; nenhuma URL de webhook deve apontar ao app.

## Origins e variáveis

- `NEXT_PUBLIC_APP_URL` no app Production é
  `https://membros.escolainterprete.com.br`.
- O app resolve Preview em runtime/build pelo `VERCEL_BRANCH_URL`, com
  `VERCEL_URL` como fallback. A URL Production configurada não é usada para
  emitir links de Preview. Um Preview sem origin HTTPS próprio falha fechado.
- A metadata da API usa o hostname Production do próprio projeto e, em Preview,
  o branch/deployment Vercel da API; não usa o hostname Production como base de
  páginas Preview.
- O Clerk Production usa DNS/CNAME direto para sua Frontend API. O registro
  `clerk.membros` aponta para o target publicado pelo Clerk (`frontend-api.clerk.services`).
  Não configure proxy `/__clerk` ou variáveis `CLERK_PROXY_URL`,
  `NEXT_PUBLIC_CLERK_PROXY_URL`, `CLERK_FAPI` ou `NEXT_PUBLIC_CLERK_FAPI`.
- O Clerk Development local usa o par `pk_test_`/`sk_test_` e o Frontend API
  `accounts.dev` diretamente. Não copie chaves Production para local ou Preview.
- `PREVIEW_OUTBOX_RECOVERY_URL` é server-only no projeto API Production quando
  a recuperação Preview está habilitada. Deve apontar ao alias de Preview
  verificado do endpoint `/cron/outbox`; o código recusa HTTP, domínio que não
  seja `*.vercel.app`, host sem marcador de branch Vercel ou path diferente.

`DATABASE_URL` e `DIRECT_URL` permanecem configuradas como secrets/configs da
Vercel e não são registrados aqui. O runtime continua no pooler de transação do
Supabase; migrations usam o pooler de sessão. Chaves, secrets, webhook URLs e
tokens não devem ser copiados para esta documentação.

## Host guard e publicação

A regra de host guard `Community V2 compatible release hosts` continua ativa e
em prioridade 0. Ela aceita somente hostnames conferidos para o deployment
Production selecionado e para o Preview da mesma revisão quando necessário.
Não desabilite a regra para destravar um domínio. Use
`scripts/ops/community-release-host-guard.mjs`: dry-run, inspeção do digest,
stage e ativação com o digest exato. O CNAME `membros` da Vercel e os aliases
históricos precisam resolver para o deployment que contém os redirects.

O branch `main` é a referência de release. A promoção deve registrar o SHA do
código, deployment `READY`, aliases verificados e digest do firewall. Para
rollback, reatribua os aliases ao deployment Production anterior e restaure a
configuração Clerk correspondente antes de restaurar os redirects da Hostinger.

## Integração do site institucional

O site institucional está em `https://escolainterprete.com.br`, hospedado na
Hostinger. O projeto Git local não é a fonte da página publicada e o painel
Hostinger não tem repositório conectado. Os atalhos publicados ficam no bloco
`@atalhos-inicio` / `@atalhos-fim` de `public_html/.htaccess`:

| Entrada | Destino |
| --- | --- |
| `/entrar` | `https://membros.escolainterprete.com.br/sign-in` |
| `/criar-conta` | `https://membros.escolainterprete.com.br/sign-up` |
| `/membros` | `https://membros.escolainterprete.com.br/` |
| `/login` | `https://membros.escolainterprete.com.br/sign-in` |

Mantenha o status `302` desses atalhos enquanto o destino do app estiver sob
validação. Após o cutover, `301`/`308` pode ser aplicado se desejado; os redirects
de Vercel antigos para o origin canônico já são `308`. Preserve todo o restante
do `.htaccess`, inclusive CSP, regras do site e newsletter.

## Verificação de Production

Registre cada gate após a publicação:

1. DNS `membros` → target Vercel e certificado HTTPS do app válidos.
2. DNS Clerk `clerk.membros` → target Clerk; domínio FAPI e certificado SSL
   Clerk verificados antes de alterar o domínio primário da instância.
3. Chave pública Clerk Production emitida para o domínio novo no env Production;
   par `pk_live_`/`sk_live_` compatível; novo deployment `READY`.
4. `GET /health`, `/sign-in`, `/sign-up`, rota protegida anônima e redirects dos
   aliases Vercel; nenhum destino público novo deve usar `vercel.app`.
5. Site institucional `/entrar`, `/criar-conta`, `/membros`, `/login` em desktop
   e viewport móvel; sessão real, recuperação de senha e retorno após
   autenticação precisam de um usuário de teste autorizado.
6. Host guard ativo com o SHA e aliases verificados. Nenhuma alteração de banco
   é necessária para este rollout.

O deployment anterior e o domínio Clerk antigo são mantidos durante a
validação para rollback. A troca de origin pode pedir aos usuários que entrem
novamente no próximo acesso por causa do escopo dos cookies; isso não altera a
identidade nem os dados persistidos.
