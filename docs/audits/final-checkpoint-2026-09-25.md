# Final checkpoint — 2026-09-25

## Escopo

Auditoria de fechamento da área de membros: GitHub, monorepo/Bun, build,
Prisma, Supabase/PostgreSQL, Clerk, Vercel, Storage, webhooks, rotas HTTP e
runtime local. Nenhum segredo ou valor de conexão é registrado neste arquivo.

## Evidências

| Check | Status | Evidência |
| --- | --- | --- |
| GitHub | PASS | `main` limpo e alinhado a `origin/main` no início do checkpoint; arquivos de ambiente reais não são rastreados. |
| Install | PASS | `bun install --frozen-lockfile`, sem alterações de resolução. |
| Check/lint | PASS | `bun run check`, 284 arquivos. |
| Typecheck | PASS | Turbo, 15 tarefas bem-sucedidas. |
| Boundaries | PASS | 278 arquivos em 18 packages, sem issues. |
| Tests | PASS | App: 5 arquivos/7 testes; API: 1 arquivo/1 teste. |
| Prisma validate/generate | PASS | Schema válido e client 7.10.0 gerado. |
| Prisma migrate status | BLOCKED_BY_CREDENTIALS | Schema engine não autentica com o placeholder local. |
| Supabase project | PASS | `wkclodjbrynerfgufmyb`, `ACTIVE_HEALTHY`, `sa-east-1`, PostgreSQL 17.6. |
| Supabase migrations | PASS | 16 migrations aplicadas; sem alteração destrutiva executada. |
| Supabase Storage | PASS PARCIAL | Bucket privado `learning-assets` existe; 0 objetos. |
| Supabase advisors | FINDINGS INFO | RLS deny-by-default sem policies públicas; índices sem uso em banco recém-criado. Não são correções permissivas necessárias. |
| Local API protection | PASS | `/api/search` e `/api/notifications` retornam 401 sem sessão. |
| Local health | BLOCKED_BY_CREDENTIALS | `/health` retorna 503 com `auth=configured` e `database=error`. |
| Local authenticated runtime | FAIL | Shell chega ao guard Clerk, mas query Prisma falha com credencial PostgreSQL inválida. |
| App build | PASS ISOLATED | Build de `apps/app` passa localmente com env placeholder presente. |
| Full build | FAIL | `api#build` para na validação de `DATABASE_URL` ausente em `apps/api`. |
| Vercel API Production | NOT READY | Deploy tentado; após corrigir o webhook, o único erro restante é `DATABASE_URL` ausente. |
| Vercel app Production | NOT READY | Deploy tentado; único erro do build é `DATABASE_URL` ausente. |
| Clerk Production | PASS CONFIGURATION | Instância Production, chaves nos projetos Vercel e webhook de usuários registrado. Runtime ainda não testável sem deploy verde. |
| E2E membro/professor/admin | NOT RUN | Depende do runtime Prisma e de dados persistidos. |

## Estado real do banco

O banco oficial possui 1 trilha, 1 curso, 14 módulos e 99 aulas. Não possui,
no momento da consulta, membros, perfis, matrículas, progresso, atividades,
comunidade, encontros, biblioteca, notificações ou objetos Storage. A
hierarquia Kiwify está inventariada, mas a migração de vídeos, anexos e acesso
individual não está concluída.

## Correções/configurações realizadas

- Registrado webhook Production do Clerk para `user.created`, `user.updated` e
  `user.deleted` em `/webhooks/auth`.
- Configuradas as chaves Production do Clerk nos projetos Vercel app e API.
- Configurado o secret do webhook na API Production.
- Configurado no app Production o bucket privado Supabase Storage e a URL do
  projeto; a chave de Storage permanece server-only.
- Confirmado que os deploys não usam `SKIP_ENV_VALIDATION`, ignoram TypeScript
  ou mascaram falhas de build.
- Atualizada a documentação de ambiente, deploy e roadmap para refletir o
  estado comprovado.

## Hardening após o checkpoint

Depois do checkpoint, a auditoria estática encontrou e corrigiu três falhas
de autorização/sincronização, todas enviadas para `main`:

- `5774992`: conclusão de aula exige entitlement existente e não cria
  `Enrollment` como efeito colateral; atividades publicadas e submissões
  respeitam o escopo de acesso do membro.
- `c4090df`: `user.deleted` do Clerk remove o `Member` interno de forma
  idempotente, preservando conteúdo histórico sem perfil público.
- `f33998c`: encontros vinculados a curso são filtrados por entitlement na
  listagem, Home e rota de detalhe; encontros globais continuam disponíveis.

Após essas correções: check, typecheck, testes, boundaries e build isolado de
`apps/app` passaram. Isso não substitui o teste runtime: ainda não há senha
PostgreSQL válida para o Prisma da aplicação.

## Bloqueio externo único

A senha PostgreSQL do projeto Supabase não está disponível no ambiente local,
não é recuperável no Dashboard após a criação e a sessão de inspeção disponível
não tem permissão para resetá-la. Sem ela não é possível preencher com
segurança `DATABASE_URL`/`DIRECT_URL`, executar o Prisma da aplicação, concluir
seed/persistência/E2E, ou obter um deployment `READY` no Vercel.

## Veredito

`FOUNDATION_NOT_READY` / `NOT_READY`
