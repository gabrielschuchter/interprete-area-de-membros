# Fundação técnica

## Decisões

O Interprete é um monorepo Bun/Turborepo baseado no next-forge. A primeira entrega preserva a estrutura compartilhada do starter, mas deixa `apps/app` como a superfície principal da área de membros.

### Runtime

```text
Browser
  -> apps/app (Next.js, Clerk middleware, security headers)
  -> @repo/auth (Clerk)
  -> @repo/database (Prisma Client + PrismaPg)
  -> Supabase PostgreSQL
```

O cliente Prisma é criado com `@prisma/adapter-pg` e uma conexão por processo (`max: 1`) para evitar criar pools excessivos em ambientes serverless. A conexão exige `ssl.rejectUnauthorized: true`.

### Banco e Prisma

O projeto Supabase oficial é `wkclodjbrynerfgufmyb`, em `sa-east-1`.

- `DATABASE_URL`: pooler de transação Supavisor, porta `6543`, com `pgbouncer=true`, `connection_limit=1` e `sslmode=require`. É a URL para tráfego de runtime/serverless.
- `DIRECT_URL`: pooler de sessão Supavisor, porta `5432`, com `sslmode=require`. É usada pelo `prisma.config.ts` para migrações e introspecção.
- O schema Prisma usa o provider `postgresql` e declara Learning, autoria com `MemberRole`, atividades, comunidade, encontros e biblioteca.
- A migration `20260924170000_learning_foundation` contém o recorte inicial; `20260924220000_learning_foreign_key_indexes` cobre FKs; `20260924230000_product_domains` adiciona os domínios de produto e mantém RLS deny-by-default.
- Não há Supabase JS, SSR client ou Data API nesta fase; Prisma é a única abstração de acesso ao PostgreSQL.

Os exemplos de ambiente estão em `packages/database/.env.example`, `apps/app/.env.example` e `apps/api/.env.example`. O arquivo usado pelo Prisma CLI deve ser criado em `packages/database/.env` localmente.

### Identidade

Clerk permanece como autenticação inicial. O middleware em `apps/app/proxy.ts` compõe Clerk com os headers de segurança, e o layout `(authenticated)` mantém uma segunda guarda server-side antes de renderizar a área de membros. `Member.id` é o `userId` do Clerk e `Member.role` é consultado server-side para proteger autoria/moderação; não existe organização, workspace ou autorização baseada em e-mail.

### Segurança e observabilidade

Sentry/logging e o pacote de segurança permanecem como infraestrutura opcional. Arcjet só é usado quando `ARCJET_KEY` existe. Analytics não é configurado por padrão; seus hooks continuam neutros quando as chaves estão ausentes.

Nenhum segredo, senha do Supabase, chave Clerk ou token de provedor deve ser colocado em código ou commit.

## Pacotes mantidos

- `@repo/database`: Prisma + PostgreSQL Supabase.
- `@repo/auth`: Clerk.
- `@repo/design-system`: componentes e tema.
- `@repo/observability`: Sentry/logging opcional.
- `@repo/email`, `@repo/payments`, `@repo/webhooks` e `@repo/storage`: abstrações preservadas para decisões posteriores; nenhum provedor foi configurado pela área de membros.
- `apps/api`, `apps/email`, `apps/studio` e `apps/storybook`: superfícies de suporte mantidas sem ampliar o produto.

As consultas de Learning ficam em `apps/app/lib/learning.ts`; os demais domínios ficam em `lib/activities.ts`, `lib/community.ts`, `lib/meetings.ts` e `lib/library.ts`, sempre usando o client compartilhado. O progresso é derivado de `LessonProgress`; não há acesso client-side ao banco.

### Domínios de produto

```text
Clerk user
  ├── Learning: Enrollment / LessonProgress
  ├── Activities: Activity / ActivitySubmission / Feedback
  ├── Community: Space / Post / Comment / Vote
  ├── Meetings: Meeting + external URLs
  └── Library: curated LibraryItem + external URLs
```

Todas as leituras de membro filtram `ContentStatus.PUBLISHED`. Todas as mutações derivam o ator de `auth()` e repetem a autorização no servidor. Votos possuem constraint única por membro/alvo; posts e comentários usam soft delete.

Superfícies públicas do starter, CMS/BaseHub, Liveblocks, flags, Knock, i18n, rate limiting, IA e o CLI/documentação do template foram retirados desta base para evitar que parecessem parte do produto atual.

## Operação local

```powershell
bun install --frozen-lockfile
bun run check
bun run typecheck
bun run boundaries
bun run test
bun run build
```

O acesso real ao Supabase, migrações, seed, persistência e E2E só pode ser validado depois que `packages/database/.env` contenha uma senha válida e a CA necessária esteja confiável no ambiente local. A configuração não desabilita verificação TLS como atalho.
