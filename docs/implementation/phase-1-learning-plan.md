# Phase 1 — Learning implementation plan

## Goal

- Entregar a primeira fatia funcional do produto: conteúdo publicado é navegável pelo membro e a conclusão de aulas persiste por usuário.

## Assumptions / constraints

- A fundação next-forge, Bun, Clerk, Prisma, Supabase e `@repo/design-system` permanecem.
- Esta execução não cria Teacher/Admin, Activities, Community, Meetings, Library ou Smart Home.
- A autoria será Phase 2; Phase 1 usa conteúdo provisionado por seed de desenvolvimento explícito para validar consumo.
- O banco relacional continua em Prisma/PostgreSQL/Supabase; não usar MySQL, PlanetScale, Neon ou Supabase client espalhado.
- Conteúdo da aula será JSON estruturado compatível com Tiptap/ProseMirror, renderizado sem HTML arbitrário.
- Sem credenciais Supabase/Clerk disponíveis, a implementação pode ser preparada, mas conexão, migration deploy e E2E real ficam bloqueados.

## Research (current state)

- Modules/subprojects involved:
  - `apps/app` — shell autenticado e novas rotas de Learning.
  - `packages/database` — schema Prisma, client e migration.
  - `packages/design-system` — cards, badges, buttons, progress e layout.
  - `packages/auth` — Clerk server auth.
- Key files/paths:
  - `apps/app/app/(authenticated)/aprender/page.tsx` — empty state atual.
  - `apps/app/app/(authenticated)/layout.tsx` — proteção server-side existente.
  - `packages/database/prisma/schema.prisma` — schema atual vazio.
  - `packages/database/index.ts` — PrismaPg/Supabase server-only.
  - `docs/implementation/roadmap.md` — gate operacional das fases.
- Entrypoints (API/UI/CLI/Jobs):
  - páginas App Router server-side;
  - Server Action para concluir aula;
  - `bun run migrate:deploy` para migration quando houver credencial;
  - `bun run db:seed` para conteúdo de desenvolvimento explícito.
- Related configs/flags:
  - `DATABASE_URL` runtime pooler;
  - `DIRECT_URL` Prisma CLI;
  - `SKIP_ENV_VALIDATION` somente para build sem credenciais.
- Data models/storage touched:
  - `LearningPath`, `Course`, `Module`, `Lesson`, `LessonResource`, `Enrollment`, `LessonProgress`.
  - URLs de recursos ficam preparadas; Supabase Storage fica fora desta fase.
- Interfaces/contracts (APIs/events/IPC):
  - Server Action recebe somente `lessonId` validado e deriva o membro do Clerk;
  - queries de membro filtram status `PUBLISHED` em todos os níveis;
  - progresso usa unique `(memberId, lessonId)` e upsert idempotente.
- Existing patterns to follow:
  - Server Components por padrão;
  - `import "server-only"` para acesso ao banco;
  - componentes do `@repo/design-system`;
  - empty/error states do shell existente;
  - boundaries e scripts Turbo da raiz.

Referências externas foram usadas seletivamente: o [learning-management-system](https://github.com/lilflvme/learning-management-system) confirma padrões de curso/capítulo/progresso, mas usa MySQL e não será copiado; o [editorcn](https://github.com/shadcn-labs/editorcn) será avaliado para a Phase 2, pois fornece editor React/Tiptap MIT reutilizável.

## Analysis

### Options

1. Criar um modelo mínimo de `Course`/`Lesson` e guardar o restante em JSON.
2. Criar entidades relacionais para trilha, curso, módulo, aula, recursos, enrollment e progresso, mantendo o documento rico em JSON.
3. Copiar o schema do repositório LMS externo e adaptar somente o provider.

### Decision

- Chosen: opção 2.
- Why: mantém invariantes e ordenação no PostgreSQL, evita JSON monolítico para relações, suporta o consumo atual e deixa a autoria futura possível sem copiar MySQL, pagamentos, vídeo ou dependências do doador.

### Risks / edge cases

- conteúdo draft/archived pode vazar se algum nível da consulta não filtrar `PUBLISHED`;
- progresso duplicado ou de outro usuário se a mutação não usar Clerk server-side e constraint única;
- JSON de aula pode conter nós desconhecidos; o renderer deve degradar sem `dangerouslySetInnerHTML`;
- curso sem módulos/aulas precisa de estado vazio claro;
- build precisa permanecer possível sem executar queries externas;
- `DATABASE_URL` ausente impede runtime, mas não deve impedir typecheck/build com a convenção atual.

### Open questions

- Nenhuma decisão bloqueante para esta fase. Provider de vídeo, editor de autoria, roles e storage ficam registrados como pendências da Phase 2.

## Q&A results (captured after the session)

- Outcome/acceptance criteria:
  - consumo publicado, conclusão idempotente e progresso isolado por membro.
- Scope boundaries:
  - somente Learning/member consumption nesta execução; autoria/admin fica para a fase seguinte.
- Constraints/non-goals:
  - preservar stack; não criar integrações externas; não implementar os outros domínios.
- Known modules/paths/subprojects:
  - `apps/app`, `packages/database`, `packages/design-system`, `packages/auth`.
- Decisions made in Q&A:
  - schema relacional com rich content JSON e Server Action para conclusão.
- Remaining open questions (if any):
  - credenciais externas para validação ponta a ponta.

## Implementation plan

1. Modelar schema Prisma, migration e seed dev explícito; gerar o client.
2. Criar queries server-only para paths, courses, lessons e progresso publicado.
3. Implementar rotas de trilha, curso e aula com estados claros e navegação responsiva.
4. Implementar renderer seguro de documento estruturado e Server Action idempotente de conclusão.
5. Atualizar documentação de domínio/roadmap e validar fase sem iniciar a Phase 2.

## Tests to run

- `bun run check`
- `bun run boundaries`
- `bun x turbo typecheck`
- `bun run test`
- `bun run build` com `SKIP_ENV_VALIDATION=true` quando credenciais não estiverem disponíveis
- `bun x prisma validate` e `bun x prisma format --check`
- teste unitário do renderer e da regra de progresso;
- E2E autenticado contra Supabase/Clerk quando as credenciais forem disponibilizadas.
