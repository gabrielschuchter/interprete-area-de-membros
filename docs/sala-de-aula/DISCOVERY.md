# Descoberta · Sala de Aula

Fase 0 do pacote em `docs/sala-de-aula/handoff/`. Retrato da main em 90aa250 mais o commit de renomeação Aprender → Cursos (2ce80da), em 23/10/2026. Nenhum código de produto da sala foi escrito nesta fase.

## 1. Infraestrutura

Monorepo next-forge com Bun e Turborepo. A área de membros é `apps/app` (Next.js 16, React 19, App Router); o design system é `packages/design-system` (shadcn: `sheet`, `checkbox`, `skeleton`, `sonner`, `popover`, `scroll-area`, `tooltip`, `drawer` já existem). Comandos: `bun run check` (ultracite/biome), `bun run typecheck`, `bun run test` (raiz; no app, `NODE_ENV=test vitest run`), `bun run build` (no app inclui `check:performance`, orçamento de 225 KiB gzip por rota em `apps/app/performance-budget.json`). Não há Playwright na main; a branch `codex/comunidade-v2` traz `playwright.community.config.ts` e as dependências. O E2E da sala espera essa branch entrar na main, para não disputar `package.json` e `bun.lock`.

Autenticação: Clerk via `apps/app/proxy.ts` (lista `protectedRoutePrefixes`, agora com `/cursos`). A Frontend API de Production usa CNAME Clerk direto, sem rota `/__clerk` ou proxy. O origin canônico, os redirects de aliases e a resolução própria de Preview estão em `docs/architecture/domain-architecture.md`. No servidor o membro vem de `requireMemberId()` (`lib/learning.ts`) ou `auth()` (`lib/auth.ts`); o id do Clerk é o `Member.id`. O acesso a dados é Prisma no servidor (RLS ligado nas tabelas, sem cliente Supabase no navegador). Feature flags são variáveis de ambiente lidas no servidor e repassadas por props, como `GESTAO_V2_ENABLED` em `apps/app/env.ts`. A flag da sala será `ROOM_V2_ENABLED`. `env.ts` também é alterado pela Comunidade V2, mas em linhas diferentes. Textos ficam inline, sem i18n. Não existe Content-Security-Policy no app, então nada de CSP muda. Source Serif 4 já aparece em `portal-b2.css` e `gestao.css` via `--font-display-family`. IBM Plex Mono precisa ser confirmada na Fase 3; o app usa `font-data` para o mono.

## 2. Dados

| Conceito do handoff | No repositório | Decisão |
|---|---|---|
| Curso, módulo, aula | `Course`, `Module`, `Lesson` (slug, `position`, `status`, `publishedAt`, `content` TipTap) | Reutilizar |
| Vídeo da aula | `LessonAsset` kind `VIDEO`, `mediaProvider` `STORAGE`/`YOUTUBE`/`EXTERNAL_URL`, `mediaExternalId`, `youtubeStartAtSeconds`/`EndAtSeconds`, `durationSeconds` | Reutilizar. A sala aceita Storage e YouTube; o handoff só previa YouTube |
| Verificação diária | `youtubeVerificationStatus`, `youtubePrivacyStatus`, `youtubeEmbeddable`, `youtubeCheckedAt` (`lib/youtube-verification.ts`) | Estender só no mapeamento para `VideoAvailability` (`ok`/`unchecked`/`broken`/`missing`) |
| Liberação por cronograma | `CohortLessonRelease`; `getLearningAccessScope` põe aulas futuras em `unavailableLessonIds` e `hasLessonAccess` as nega | Estender: a sala precisa distinguir "bloqueada por data" (200, `locked`) de "sem acesso" (403). Hoje as duas viram 404 |
| Acesso | `lib/content-access.ts` (`getLearningAccessScope`, `hasLessonAccess`, `getAccessibleRecording`, `getAccessiblePlaybackAsset`) | Reutilizar em toda leitura e mutação |
| Materiais | `LessonAsset` não-vídeo (PDF, imagem), `LessonResource` (links), `Activity`, `LibraryItem` | Reutilizar; a lista mínima de LD-07 agrega os quatro |
| Conclusão | `LessonProgress` (`status`, `completedAt`) via `completeLessonForMember` | Reutilizar e estender com desmarcar (hoje só conclui) |
| Posição do vídeo | `PlaybackProgress` por asset (`positionSeconds`, `durationSeconds`, `watchedIntervals`, `completedPlaybackAt`), rota `POST /api/learning/assets/[assetId]/progress` | Reutilizar. Nada de `room_progress` |
| Gravações | `ImportedRecordingGroup` → `ImportedRecording` → `LessonAsset` (sempre há asset; "sem vídeo" significa asset sem mídia utilizável) | Fase 6, adiada |
| Falhas de vídeo | Não existe tabela nem canal de alerta | Log estruturado (`mutationLog`). O texto "a equipe já foi avisada" fica fora até existir um canal |

Achado que afeta a decisão de conclusão: na página atual da aula, `LessonPlayer` recebe `persistProgress` só quando o asset é gravação importada. Para aulas de curso, a posição não é salva e a conclusão automática aos 90% (`hasWatchedNinetyPercent` → `completeLessonForMember`) nunca dispara a partir da página do aluno. Ao ligar "salvar posição" (D-02) na sala nova, os 90% passam a valer de fato para aulas. Isso está de acordo com a decisão de 23/10 (manter os 90% e somar a caixa), mas é uma mudança de comportamento observável, e a Gestão vai ver mais conclusões.

## 3. Ferramentas

Notas: `PlannerNote` com `linkedResourceType`/`linkedResourceId`, `pinnedAt`, `deletedAt` (lixeira) e `lib/planner-notes.ts` (`createPlannerNote`, `savePlannerNote`, `togglePlannerNotePin`, `movePlannerNoteToTrash`, `restorePlannerNote`). O schema de entrada aceita só `linkedResourceType: "LESSON"`. Falta o carimbo de tempo: a única migração aditiva da sala é `PlannerNote.videoTimeSeconds Int?`. O editor e o workspace estão em `app/(authenticated)/ferramentas/notes-workspace.tsx`, e "Abrir em Notas" aponta para `/ferramentas` com a nota selecionada.

Tempo: `FocusTimerSession` no servidor, com `linkedResourceType`/`linkedResourceId`, e `lib/focus-timer.ts` (`startFocusTimer`, `pause`, `resume`, `stop`, `linkFocusTimer`, `claimFocusTimer`, `getActiveFocusTimerState`). Os modos vêm de `FocusTimerMode`. O estado vive no servidor, então o adaptador do painel Tempo chama as ações existentes e não cria persistência.

`components/learning/lesson-tools-drawer.tsx` (838 linhas) já junta cronômetro e notas da aula numa `Sheet`. É a base a extrair para os painéis Notas e Tempo, sem duplicar a lógica.

## 4. Interface existente

A página da aula é `app/(authenticated)/cursos/[slug]/[lessonSlug]/page.tsx`. Ela tem trilha lateral, documento TipTap, materiais, atividades, "Concluir aula" (`complete-lesson-button.tsx`), anterior/próxima e `StudyHeartbeat`. LD-05 remove vários desses elementos na sala nova. Com a flag desligada, a página continua idêntica. Barra lateral e cabeçalho: `components/member-area-sidebar.tsx`, `sidebar.tsx` e `member-section.ts` (crumb). A sala não altera esses arquivos (LD-04), porque são compartilhados com a Comunidade V2. A página do curso é `cursos/[slug]/page.tsx` e o catálogo é `cursos/page.tsx`.

## 5. Rotas atuais e rotas do handoff

| Handoff | Repositório |
|---|---|
| `/estudar/aprender` | `/cursos` |
| `/estudar/aprender/[cursoSlug]` | `/cursos/[slug]` |
| `/estudar/aprender/[cursoSlug]/aulas/[aulaId]` | `/cursos/[slug]/[lessonSlug]` (slug, não uuid) |
| `/estudar/aprender/[cursoSlug]/continuar` | `/cursos/[slug]/continuar` (novo). `continuar` vira slug reservado de aula, como `trilhas` e `atribuicoes` para curso |
| `/gravacoes/[id]` | `/encontros/gravacoes/[id]` (Fase 6) |
| `/ferramentas/notas`, `/ferramentas/foco` | `/ferramentas` com `view` |

Os `/aprender/*` antigos respondem 308 para o equivalente (`app/aprender/[[...path]]/route.ts`).

## 6. Lacunas e riscos

A Comunidade V2 reescreveu Minhas gravações (`encontros/gravacoes/page.tsx` virou reexportação de `components/meetings/recording-library-page-content.tsx`), então a Fase 6 só começa depois que ela entrar na main. Aulas bloqueadas hoje viram 404, e mostrar o estado `locked` exige separar "futura" de "sem acesso" no escopo de acesso. Gravações não podem gravar conclusão em `LessonProgress`. O alerta à equipe sobre vídeo quebrado não tem canal. Ligar a posição salva ativa os 90% para aulas.

## 7. Plano de migração mínimo

Uma migração aditiva e idempotente: `ALTER TABLE "PlannerNote" ADD COLUMN IF NOT EXISTS "videoTimeSeconds" integer` com `CHECK ("videoTimeSeconds" IS NULL OR "videoTimeSeconds" >= 0)`, e reversão comentada. Ela é criada e testada só em Postgres local, com timestamp posterior às 7 migrations da Comunidade V2 (20/10 a 22/10/2026). Nenhuma relação nova em `Member`.
