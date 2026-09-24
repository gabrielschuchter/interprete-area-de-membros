# Auditoria obrigatória da fundação

**Data:** 2026-09-24  
**Repositório:** `gabrielschuchter/interprete-area-de-membros`  
**Escopo original:** auditoria e estabilização da fundação. Nenhuma funcionalidade de produto foi implementada naquela execução.

> Registro histórico da auditoria da fundação antes do início da Phase 1. A partir da execução de Learning, o schema e a documentação de produto passam a registrar as entidades da primeira fase; os achados de credenciais e segurança deste documento continuam válidos até serem revalidados.

## Revalidação da fundação — 2026-09-24

Esta revalidação foi executada depois da configuração do Clerk e da entrada da Phase 1. O projeto Supabase `wkclodjbrynerfgufmyb` foi consultado diretamente pelo conector oficial e retornou `ACTIVE_HEALTHY`, região `sa-east-1`, PostgreSQL `17.6`. As migrations `learning_foundation` e `learning_foreign_key_indexes` foram aplicadas; existem sete tabelas públicas da aprendizagem, todas com RLS habilitado. Não foram criadas policies permissivas para `anon`/`authenticated`: o acesso de aplicação continua server-side via Prisma com Clerk.

O Clerk CLI foi autenticado e vinculado ao app de desenvolvimento informado. O servidor local comprovou `sign-in`/`sign-up`, redirect de visitante para o Clerk e, após verificação de dispositivo, carregamento autenticado do shell e da rota `/aprender`. A primeira abertura encontrou uma falha real do runtime (`pg-types` ausente no output externo do Turbopack); ela foi corrigida ao incluir `pg` em `transpilePackages` no next-config compartilhado, e o build voltou a passar.

A validação da query da aplicação permanece bloqueada: o processo local foi iniciado conscientemente com um placeholder de `DATABASE_URL` porque a senha PostgreSQL não está disponível no ambiente. Assim, o Supabase remoto está comprovado pelo conector, mas o caminho `apps/app -> @repo/database -> PrismaPg -> Supabase` ainda precisa de uma execução local com credencial real. O seed não foi inserido remotamente, pois o conector SQL disponível é read-only e não será convertido artificialmente em migration de produção.

## Escopo

Foram auditados:

- estrutura do monorepo, Turborepo, Bun, workspace e comparação estrutural com o [next-forge upstream](https://github.com/vercel/next-forge);
- apps, packages, imports, boundaries, design system, scripts e dependências;
- Git, lockfiles, `.gitignore`, arquivos de ambiente, artefatos gerados e busca de segredos;
- `@repo/database`, Prisma, estratégia Supabase, geração/validação do schema e migrations;
- `@repo/auth`, Clerk, middleware/proxy, guarda server-side e comportamento sem credenciais;
- shell autenticado, rotas vazias, navegação, ausência de dados demo e uso do design system;
- route handlers, webhooks assinados, limites server/client, headers e configuração de segurança;
- lint, typecheck, boundaries, testes, build, servidor de desenvolvimento e auditoria de dependências.

As referências atuais utilizadas para a decisão de banco foram a [documentação do Supabase para Prisma](https://supabase.com/docs/guides/database/prisma), a [documentação de conexão PostgreSQL do Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres), a documentação do [Prisma para PostgreSQL](https://docs.prisma.io/docs/orm/core-concepts/supported-databases/postgresql) e a orientação do [Prisma para PgBouncer](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/pgbouncer).

## Estado encontrado

### Next-forge e monorepo

As decisões estruturais importantes do next-forge estão presentes: monorepo com `apps/*` e `packages/*`, Bun, Turborepo, Next.js, React, TypeScript, pacotes `@repo/*`, boundaries, configuração compartilhada, `@repo/auth`, `@repo/database`, `@repo/design-system`, segurança e observabilidade.

Os apps atuais são:

| App | Propósito | Estado |
| --- | --- | --- |
| `apps/app` | área de membros, Clerk e shell autenticado | build e typecheck passam |
| `apps/api` | health check e webhooks de infraestrutura | build, typecheck e teste passam |
| `apps/email` | exportação dos templates de e-mail | exportação passa |
| `apps/storybook` | catálogo do design system | build passa, com warnings de tamanho de assets |
| `apps/studio` | Prisma Studio local | script de desenvolvimento preservado |

`apps/web`, `apps/docs` e superfícies opcionais do starter não estão presentes. Isso é uma divergência deliberada de escopo, não uma reconstrução manual do starter: o repositório é da área de membros e mantém as superfícies necessárias para ela.

A divergência técnica mais importante é intencional: o caminho original baseado em Neon foi substituído por `@prisma/adapter-pg` e PostgreSQL Supabase, conforme a decisão do projeto. Não há dependência ativa de `neon`, `@neondatabase`, `@prisma/adapter-neon` ou `NEON_`; a única ocorrência em código/configuração é a proibição documentada em `AGENTS.md` (há matches textuais não funcionais no próprio relatório e em metadata/hash do lockfile).

### Git e artefatos

- Há um único `.git` no repositório auditado e não há repositório nested dentro de `apps` ou `packages`.
- O repositório local ainda não possui commits (`git rev-list --count --all` retornou `0`); portanto, a auditoria de segredos no histórico recente não é verificável.
- Há somente `bun.lock`; não existem `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` ou `bun.lockb`.
- `.env`, `.env.local`, `.next`, `node_modules`, `dist`, `coverage`, `.turbo`, `storybook-static` e `packages/database/generated` estão ignorados. Os únicos arquivos de ambiente encontrados são exemplos.
- O diretório externo `C:\Users\gabsc\Documents\Codex\next-forge-scaffold` contém apenas um `.git` incompleto. Ele está fora deste repositório; a remoção pontual foi recusada pela política de execução e permanece como pendência de higiene externa, sem efeito sobre o workspace auditado.

### Dependências

`bun install --frozen-lockfile` concluiu sem alterações ou erros de resolução. Não foram feitos upgrades indiscriminados.

`bun audit --json` encontrou **0 críticas, 3 altas, 18 moderadas e 8 baixas**. As três altas são indiretas e de tooling/CLI:

- `@babel/plugin-transform-modules-systemjs`, via Storybook;
- `deepmerge-ts`, via `prisma`/`@prisma/config`;
- `mysql2`, via `prisma` CLI.

Não há finding atual para Next.js, Clerk, Vitest, Turbo, Vite ou `sharp` após as atualizações direcionadas. Os findings restantes não foram mascarados com `audit fix`; precisam de atualização upstream ou decisão de substituição do tooling antes de declarar uma superfície de dependências sem findings.

### Banco e Prisma

O caminho de código está coerente:

```text
apps/*
  -> @repo/database
  -> Prisma Client 7 + PrismaPg
  -> PostgreSQL Supabase
```

`packages/database/index.ts` é `server-only`, usa `PrismaPg`, limita o pool por processo e exige verificação de certificado (`rejectUnauthorized: true`). `DATABASE_URL` é a URL de runtime do pooler Supavisor em `sa-east-1:6543`; `DIRECT_URL` é a URL do pooler de sessão `aws-0-sa-east-1.pooler.supabase.com:5432` usada pelo Prisma CLI. Os exemplos usam `sslmode=require` e não contêm senha real.

O schema Prisma usa `provider = "postgresql"`, foi validado e formatado, e o client foi gerado durante o build. Não há modelos de domínio nem diretório de migrations: isso é consistente com a decisão de não iniciar o domínio de LMS nesta execução.

O que não pôde ser comprovado:

- conexão real, query simples, introspecção e `prisma migrate status`: **BLOCKED_BY_CREDENTIALS**;
- saúde privilegiada do projeto Supabase, migration history, drift, RLS, grants e policies: **BLOCKED_BY_CREDENTIALS**;
- security/performance advisors do Supabase: **BLOCKED_BY_CREDENTIALS** e sem MCP/CLI disponível.

O hostname oficial respondeu `404` na raiz e `401` no endpoint REST sem autenticação. Isso comprova somente que o endpoint informado existe e exige credencial; não é prova de conexão PostgreSQL nem de saúde do schema.

### Auth e proteção de rotas

Clerk permanece encapsulado em `@repo/auth`. `apps/app/proxy.ts` compõe Clerk middleware com os headers de segurança, e `app/(authenticated)/layout.tsx` executa `currentUser()` e `redirectToSignIn()` no servidor antes de renderizar o shell.

A proteção server-side foi comprovada por inspeção do código e o build inclui o proxy e as rotas autenticadas. O teste HTTP direto do servidor local sem chaves Clerk produziu erro `@clerk/nextjs: Clerk keys are missing from your environment`; por isso, o fluxo real visitante → redirect e o fluxo usuário autenticado → shell permanecem **BLOCKED_BY_CREDENTIALS**, não PASS.

Não há `OrganizationSwitcher`, workspace, teams, seats ou billing na UI do membro. Os tipos e handlers de organização herdados do starter permanecem somente como infraestrutura opcional e não são usados pelo shell.

### Shell e limites de produto

As rotas existentes são `/`, `/aprender`, `/atividades`, `/comunidade`, `/biblioteca`, `/encontros` e `/perfil`, todas sob o layout autenticado e com empty states. Não foram implementados cursos, aulas, progresso, atividades persistidas, comunidade, posts, comentários, votos, encontros, biblioteca real, home inteligente, gamificação ou notificações.

O shell importa componentes de `@repo/design-system`; não foram encontrados Button/Input/Dialog/Card fundamentais duplicados em `apps/app`. Também não foram encontrados dados demo de revenue, usuários, completion, charts ou analytics SaaS na experiência do membro.

A inspeção estática não encontrou vazamento de secrets para o cliente, uso de queries sensíveis em Client Components ou Server Actions sem autorização. O teste visual/interativo nos widths 375/768/1024/1440 não foi declarado PASS porque a aplicação não renderiza sem as credenciais Clerk.

### Segurança

- A busca global fora de dependências e artefatos gerados encontrou apenas placeholders em `.env.example` e nomes/validadores de variáveis; não foi encontrado segredo real versionado.
- Não há histórico de commits para auditar.
- Webhooks Clerk e Stripe agora verificam o corpo bruto, retornam `503` quando não configurados e não registram nem devolvem o payload assinado.
- `server-only` está presente no cliente de banco e as integrações opcionais falham fechadas quando não configuradas.
- Os headers Nosecone estão ativos, mas CSP está explicitamente desabilitada até que os domínios efetivos do Clerk sejam conhecidos e allowlisted. Isso é uma pendência de hardening, não foi transformado em configuração permissiva especulativa.

## Correções realizadas

- Atualizadas versões direcionadas de Next.js, Clerk, Prisma, Vitest, Turbo e transitive overrides com impacto de segurança identificado.
- Trocado o caminho de banco ativo para `@prisma/adapter-pg` + `pg`, removendo dependência ativa de Neon.
- Corrigida a API `appearance` do `ClerkProvider` para a versão atual do Clerk.
- Removido o `concurrently` do dev padrão de `apps/api`; Stripe continua opcional e não impede o desenvolvimento normal.
- Corrigida a verificação dos webhooks para usar o corpo bruto e removido o logging/echo de payloads.
- Ajustados os status de configuração ausente dos webhooks para `503`.
- Corrigidos os exemplos `DATABASE_URL`/`DIRECT_URL` para o projeto Supabase oficial, poolers de transação/sessão e SSL.
- Removidos junctions locais obsoletos de `@repo/*` que apontavam para packages eliminados.
- Formatado e validado `packages/database/prisma/schema.prisma`.
- Mantido o shell somente como navegação e empty states, sem iniciar o roadmap de produto.
- Aplicado o schema da Phase 1 no Supabase oficial, com RLS deny-by-default nas sete tabelas e migration de índices para as FKs apontadas pelo advisor.
- Corrigido o empacotamento do `pg` no next-config compartilhado para evitar que Turbopack copie o pacote sem suas dependências isoladas do Bun.
- Configurado e verificado o Clerk CLI no app de desenvolvimento, incluindo o matcher de proxy e a guarda server-side já existente.

## Checks

| Check | Status |
| --- | --- |
| install | **PASS** — `bun install --frozen-lockfile`, sem mudanças |
| lint | **PASS** — `bun run check`, 193 arquivos |
| typecheck | **PASS** — Turbo, 15 tasks bem-sucedidas |
| boundaries | **PASS** — 193 arquivos em 18 packages, sem issues |
| tests | **PASS** — API 1 teste e app 2 testes |
| Prisma validate/format | **PASS** |
| build | **PASS** — 7 tasks; executado com `SKIP_ENV_VALIDATION=true`, sem prova de runtime externo |
| dev server | **PASS PARCIAL** — Next iniciou em 601 ms; requests falharam sem chaves Clerk |
| database connection | **BLOCKED_BY_CREDENTIALS** |
| auth protection E2E | **BLOCKED_BY_CREDENTIALS**; guarda server-side **PASS por inspeção** |
| security audit | **FINDINGS** — 0 critical, 3 high indiretas, 18 moderate, 8 low; CSP pendente |
| Supabase advisors | **BLOCKED_BY_CREDENTIALS** |

## Pendências

1. Fornecer `DATABASE_URL`/`DIRECT_URL` com senha do projeto oficial para executar conexão, query segura, introspecção, migration status e advisors.
2. Fornecer as chaves Clerk de desenvolvimento para validar visitante não autenticado, redirect, login e navegação autenticada nos quatro widths solicitados.
3. Definir e aplicar uma CSP compatível com os domínios Clerk reais antes de uma publicação endurecida.
4. Resolver ou aceitar formalmente os três advisories altos indiretos de Storybook/Prisma CLI.
5. Remover o scaffold externo residual `next-forge-scaffold`, que está fora deste repositório e não pôde ser removido pela política da execução.

## Veredito técnico

FOUNDATION_NOT_READY

O veredito histórico permanece `FOUNDATION_NOT_READY`. A migration, RLS e advisors do Supabase agora foram comprovados, e o login/guard do Clerk foi exercitado; ainda falta executar o Prisma da aplicação com a credencial PostgreSQL real, validar query/persistência do seed e concluir o E2E de progresso. Os findings do advisor `rls_enabled_no_policy` são intencionais neste estágio deny-by-default; os dois warnings de `public.rls_auto_enable()` pertencem a função gerenciada existente e não foram alterados.

## Revalidação operacional atual — 24/09/2026

Esta seção substitui qualquer afirmação anterior de runtime que não tenha sido repetida neste checkpoint.

### Env e processo

`@repo/database` carrega `dotenv/config` em `packages/database/prisma.config.ts` para o Prisma CLI. O runtime do client lê `process.env.DATABASE_URL` em `packages/database/index.ts`; o Prisma CLI usa `process.env.DIRECT_URL`. Os arquivos efetivamente presentes são `packages/database/.env` para o CLI e `apps/app/.env.local` para o processo Next. A inspeção mostrou as duas variáveis presentes, mas com placeholder de senha; nenhum valor foi registrado neste documento.

### Checks atuais

| Check | Status |
| --- | --- |
| install | PASS — Bun lockfile e resolução já validados |
| check/lint | PASS — `bun run check` |
| typecheck | PASS — workspace completo |
| boundaries | PASS — 235 arquivos em 18 packages |
| tests | PASS — API e app, sem testes de integração externa |
| build | PASS — 7 tasks; warnings não bloqueantes |
| Prisma validate/format/generate | PASS |
| database connection | BLOCKED_BY_CREDENTIALS — TLS `self signed certificate in certificate chain` |
| `prisma migrate status` | BLOCKED_BY_CREDENTIALS — schema engine não abriu conexão |
| seed de desenvolvimento | BLOCKED_BY_CREDENTIALS — primeira operação Prisma falhou no TLS |
| LessonProgress persistência/idempotência/reload | BLOCKED_BY_CREDENTIALS — código usa constraint única e upsert, mas falta prova contra banco real |
| auth protection | PARTIAL — Clerk e guard server-side foram exercitados; shell autenticado falha ao consultar o banco |
| responsive visual E2E | NOT VERIFIED — consultas autenticadas não renderizam |
| security/advisors | PARTIAL — RLS deny-by-default e ausência de secrets versionadas revisados; advisors da nova migration não foram consultados neste bloqueio |

### Correção desta revalidação

Foi corrigida a fronteira de execução do tema no design system: o wrapper deixou de injetar o `<script>` do `next-themes`, que gerava erro no renderer de desenvolvimento do Next 16. O produto continua explicitamente em tema claro, conforme a direção de marca; não foi criada uma nova integração ou alterada a autenticação.

### Veredito atual

`FOUNDATION_NOT_READY`

O bloqueio restante é externo ao código: substituir o placeholder por credenciais válidas do PostgreSQL Supabase oficial e disponibilizar uma cadeia CA confiável para o processo local. Sem isso não é possível marcar `DONE` a Phase 1 nem declarar persistência, migration status, seed, E2E autenticado ou QA visual como PASS.
