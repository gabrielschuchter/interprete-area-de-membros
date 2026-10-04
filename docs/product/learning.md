# Learning

## Status

`IN PROGRESS` — a fundação de aprendizagem está implementada; sua evolução
integrada segue as fases 4–6 e 8–11 do [roadmap operacional](../implementation/roadmap.md).

## Objetivo

O membro deve conseguir encontrar conteúdo publicado, abrir um curso, navegar por módulos e aulas, consumir uma aula e marcar sua conclusão. O progresso é persistido no PostgreSQL e pertence ao membro autenticado no Clerk.

## Escopo da primeira entrega

- trilhas com cursos ordenados;
- cursos com módulos ordenados;
- módulos com aulas ordenadas;
- aulas com documento estruturado e recursos externos;
- leitura somente de conteúdo `PUBLISHED`;
- enrollment criado de forma idempotente ao concluir uma aula;
- `LessonProgress` único por `(memberId, lessonId)`;
- progresso do curso derivado das aulas concluídas, sem porcentagem persistida;
- rotas de trilha, curso e aula protegidas pelo layout autenticado.

Autoria, atribuição, disponibilidade e curadoria reaproveitam os domínios
existentes e são detalhados nas fases integradas do roadmap. Esta página
preserva o contrato da fundação inicial; não representa uma segunda fila de
implementação independente.

## Modelo de dados

```text
LearningPath
  └── Course
        └── Module
              └── Lesson
                    └── LessonResource

Clerk member
  ├── Enrollment ── Course
  └── LessonProgress ── Lesson
```

### Decisões

- `ContentStatus` usa `DRAFT`, `PUBLISHED` e `ARCHIVED`. As queries de membro filtram cada nível da hierarquia para `PUBLISHED`.
- Slugs são únicos no nível de rota; módulos e aulas também têm slug único dentro do pai.
- Ordenação é persistida em `position` e protegida por constraints únicas dentro do pai.
- `Lesson.content` é `Json` para armazenar documento estruturado compatível com Tiptap/ProseMirror; o renderer aceita um conjunto seguro de nós e não injeta HTML.
- `LessonResource` é relacional para permitir tipo, ordem e evolução de autorização sem uma coluna JSON monolítica.
- Identidade é uma string `memberId` proveniente do Clerk; não foi criada uma tabela paralela de usuário.
- Progresso é derivado por contagem de `LessonProgress` concluídos sobre aulas publicadas disponíveis.
- A conclusão usa Server Action, consulta server-side da aula publicada, transaction e `upsert` protegido por constraint única.

## Rotas

| Rota | Responsabilidade |
| --- | --- |
| `/aprender` | trilhas e cursos publicados, com progresso do membro |
| `/aprender/trilhas/[slug]` | cursos publicados de uma trilha |
| `/aprender/cursos/[slug]` | módulos, aulas e progresso do curso |
| `/aprender/cursos/[slug]/[lessonSlug]` | conteúdo da aula, recursos, navegação e conclusão |

## Autorização

- A rota inteira permanece sob `apps/app/app/(authenticated)/layout.tsx`.
- A leitura obtém o `userId` pelo Clerk server-side antes da query.
- A conclusão nunca aceita `memberId` do formulário; ele é derivado de `auth()`.
- A mutação só aceita uma aula publicada ligada a curso e módulo publicados.
- O banco impede duplicidade de enrollment e progresso por membro.
- O member não recebe acesso a drafts/archived por filtro de query.

## Conteúdo estruturado

O renderer atual suporta documento, parágrafo, headings, listas, blockquote, separador, code block, hard break e marks básicos. URLs em marks e recursos aceitam somente `http`/`https`. O editor de autoria será decidido na Phase 2 após avaliação de [editorcn](https://github.com/shadcn-labs/editorcn); nenhum editor próprio foi criado nesta fase.

## Seed de desenvolvimento

`bun run db:seed` cria/atualiza uma trilha publicada mínima e duas aulas de desenvolvimento. Com `SEED_DEVELOPMENT_DATA=true`, cria também fixtures explicitamente identificadas para atividade, comunidade, encontro e biblioteca. O seed exige `DIRECT_URL` ou `DATABASE_URL`, é idempotente e identifica o autor como `seed:development`. Ele não é executado automaticamente em produção e não substitui conteúdo editorial real.

## Migration

`packages/database/prisma/migrations/20260924170000_learning_foundation/migration.sql` cria as tabelas da fundação inicial; `20260924220000_learning_foreign_key_indexes` cobre índices de FK; `20260924230000_product_domains/migration.sql` cria papéis, atividades, comunidade, encontros e biblioteca com RLS. Essas migrations constam no histórico aplicado. As migrations aditivas da reestruturação permanecem pendentes enquanto o Supabase reportar restrição de quota/Fair Use; não executar deploy durante esse bloqueio.

## Pendências da fase

- aplicar e validar as migrations aditivas da reestruturação quando o Supabase
  estiver operacional, preservando o histórico existente;
- validar persistência, idempotência e reload do progresso contra o banco
  oficial após a liberação da infraestrutura;
- validar E2E autenticado com Clerk;
- testar as larguras 375, 768, 1024 e 1440px em ambiente renderizado;
- concluir os gates do roadmap antes de iniciar Teacher/Admin.
