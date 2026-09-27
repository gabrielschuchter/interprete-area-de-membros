# Domínio do Interprete

## Limite desta etapa

O produto evolui por fases no [roadmap](../implementation/roadmap.md). O
Interprete é uma escola live-first: Learning, autoria protegida, atividades,
comunidade, encontros, gravações históricas, biblioteca, Collections e a Home
determinística possuem estrutura de domínio e UI; uma fase só é `DONE` após
validação contra o banco oficial.

## Navegação entregue

| Rota | Rótulo | Estado atual |
| --- | --- | --- |
| `/` | Início | Próximo passo determinístico a partir de dados reais |
| `/encontros` | Encontros | Próximos, passados, preparação e materiais |
| `/encontros/gravacoes` | Gravações | Arquivo autorizado de encontros históricos e playback |
| `/aprender` | Aprender | Conteúdo assíncrono publicado, quando habilitado |
| `/atividades` | Atividades | Lista, envio e leitura de feedback |
| `/comunidade` | Comunidade | Salas, posts, comentários e votos |
| `/biblioteca` | Biblioteca | Curadoria, busca e filtros simples |
| `/perfil` | Perfil | Identidade Clerk e métricas reais do membro |

Todas as rotas ficam sob o layout autenticado e compartilham o sidebar do Interprete. O sidebar não usa `OrganizationSwitcher`, projetos, billing, times, webhooks ou dados de demonstração. Professor/admin recebe uma entrada adicional somente depois de autorização server-side por `Member.role`.

As rotas de Learning são `/aprender`, `/aprender/trilhas/[slug]`,
`/aprender/cursos/[slug]` e `/aprender/cursos/[slug]/[lessonSlug]`. Elas só
exibem conteúdo assíncrono `PUBLISHED` e podem ficar ocultas pela configuração
editorial. `/aprender/minhas-gravacoes` é somente compatibilidade e redireciona
para `/encontros/gravacoes`.

Gravação histórica nunca é uma aula: seu acesso vem do vínculo explícito do
`ImportedRecordingGroup`, e sua posição usa `PlaybackProgress`. A conclusão de
uma aula assíncrona usa `LessonProgress`; uma não altera a outra.

## Fontes de verdade

- Identidade e sessão: Clerk.
- Conteúdo e progresso: Prisma/Supabase; conteúdo rico em JSON estruturado,
  `LessonProgress` para aprendizagem assíncrona e `PlaybackProgress` para
  retomada de gravações.
- Atividades: `Activity`, `ActivitySubmission` e `Feedback` em Prisma/Supabase.
- Comunidade: `CommunitySpace`, `CommunityPost`, `CommunityComment` e votos em Prisma/Supabase.
- Encontros: `Meeting` com links externos validados; não há videoconferência própria.
- Biblioteca: `LibraryItem` com links curados e assets privados resolvidos pelo
  servidor quando necessário.
- Curadoria: `ContentCollection` agrega aulas, gravações autorizadas e itens
  de biblioteca sem representar sequência curricular.
- Perfil: Clerk fornece identidade/sessão; `Member` e `Profile` são a fonte
  interna para papel e identidade editorial.
- Notificações: `Notification`, preferências e eventos estruturados são uma
  infraestrutura única para a área de membros.

## Não implementado deliberadamente

Ficam fora do produto atual videoconferência própria, chat/DM, karma/leaderboards,
IA, busca semântica, pagamentos, analytics de produto e CMS arbitrário. A busca
global diferencia gravações, aulas, cursos, atividades, comunidade, biblioteca
e membros, sempre respeitando a autorização server-side.

Quando essas capacidades forem priorizadas, cada uma deve receber uma decisão de domínio, fonte de verdade, autorização, persistência e testes próprios antes de entrar na interface.
