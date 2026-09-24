# Domínio inicial do Interprete

## Limite desta etapa

O produto evolui por fases no [roadmap](../implementation/roadmap.md). Learning, autoria protegida, atividades, comunidade, encontros, biblioteca e a Home determinística já possuem estrutura de domínio e UI; uma fase só é `DONE` após validação contra o banco oficial.

## Navegação entregue

| Rota | Rótulo | Estado atual |
| --- | --- | --- |
| `/` | Início | Próximo passo determinístico a partir de dados reais |
| `/aprender` | Aprender | Trilhas e cursos publicados com progresso do membro |
| `/atividades` | Atividades | Lista, envio e leitura de feedback |
| `/comunidade` | Comunidade | Salas, posts, comentários e votos |
| `/biblioteca` | Biblioteca | Curadoria, busca e filtros simples |
| `/encontros` | Encontros | Próximos, passados e links externos |
| `/perfil` | Perfil | Identidade Clerk e métricas reais do membro |

Todas as rotas ficam sob o layout autenticado e compartilham o sidebar do Interprete. O sidebar não usa `OrganizationSwitcher`, projetos, billing, times, webhooks ou dados de demonstração. Professor/admin recebe uma entrada adicional somente depois de autorização server-side por `Member.role`.

As rotas de Learning são `/aprender`, `/aprender/trilhas/[slug]`, `/aprender/cursos/[slug]` e `/aprender/cursos/[slug]/[lessonSlug]`. O member só lê hierarquias `PUBLISHED`; conclusão e progresso usam o Clerk server-side e constraints únicas no PostgreSQL.

## Fontes de verdade

- Identidade e sessão: Clerk.
- Conteúdo e progresso: Prisma/Supabase para as entidades da Phase 1; conteúdo rico em JSON estruturado e progresso por membro.
- Atividades: `Activity`, `ActivitySubmission` e `Feedback` em Prisma/Supabase.
- Comunidade: `CommunitySpace`, `CommunityPost`, `CommunityComment` e votos em Prisma/Supabase.
- Encontros: `Meeting` com links externos validados; não há videoconferência própria.
- Biblioteca: `LibraryItem` com links curados; upload/Storage só entra com necessidade e policy explícitas.
- Perfil: Clerk para identidade e Prisma para papel/métricas complementares.

## Não implementado deliberadamente

Ficam fora do produto atual videoconferência própria, chat/DM, karma/leaderboards, IA, busca semântica, uploads não validados, pagamentos, analytics de produto, notificações de produto, CMS e colaboração em tempo real. A leitura/progresso de Learning está documentada em `docs/product/learning.md`; a validação de cada fase permanece registrada no roadmap e na auditoria de fundação.

Quando essas capacidades forem priorizadas, cada uma deve receber uma decisão de domínio, fonte de verdade, autorização, persistência e testes próprios antes de entrar na interface.
