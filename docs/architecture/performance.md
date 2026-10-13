# Performance architecture

Performance is a product requirement for every member-area change. Optimize
the work on the critical path first; use visual feedback and speculative work
to shorten perceived waits only after authorization, persistence, and delivery
are correct.

## Budgets

These are acceptance targets, not claims about current production. Measure on a
desktop and an intermediate Android device over 4G, and report p50/p75/p95 with
the deployment, member role, route, cache state, and whether navigation was
prefetched. Skeleton visibility does not count as usable content.

| Measure | Target |
| --- | ---: |
| Click, tap, or submit feedback | ≤ 100 ms, independent of the server |
| Local tab or local-only state change | ≤ 100 ms, with no request |
| Warm, prefetched section to usable content | p95 ≤ 300 ms |
| First section visit to usable content | p95 ≤ 1 s |
| Small persisted mutation | p95 ≤ 500 ms |
| Main member area after an established Clerk session | ≤ 1 s |
| LCP / INP / CLS | p75 ≤ 2.5 s / 200 ms / 0.1 |

Uploads, MFA, media providers, and other external dependencies have separate
progress and completion budgets. Do not treat an unavailable production
sample as a pass.

## Data and rendering

- Keep Clerk as identity authority, `Member.role` as the staff authorization
  authority, Prisma as the sole server-side database entry point, and Supabase
  PostgreSQL as the database. Preserve RLS and existing access predicates.
- Keep normal page reads in Server Components. Use small DTOs for interactive
  client components and parallelize only independent work after removing
  unnecessary queries and payloads.
- Deduplicate database reads within one render with `React.cache`. That cache is
  request-scoped; it is not permission to persistently cache identity, roles,
  revocation, grants, assignment windows, group membership, or personal data.
- Fetch the smallest projection for the surface. Paginate in SQL. Add an index
  only after an observed query plan and representative data show it helps more
  than it costs on writes.
- For menu availability and other booleans, use a bounded `findFirst`/`EXISTS`
  projection instead of loading the content tree. Preserve the same publication
  and access conditions as the destination page.
- Put Suspense boundaries around independent data sections where a fast shell
  can render first. Keep the loading state visually stable, and never animate
  already available route content from hidden to visible.
- Never broaden a cache across members. Personal in-memory caches must be
  keyed by member and cleared on logout/account switch. Shared editorial caches
  need explicit invalidation on publish, edit, and archive, plus a fresh access
  check before delivery.

### Library browse and bookmark path

`/biblioteca` resolves the member and category list in parallel, then streams
the result section behind a stable shell. The material page query and filtered
count run together with the same publication, search, filter, and linked-lesson
access predicates. Recent ordering reads 24 rows plus one look-ahead row in
PostgreSQL; relevance keeps the existing 500-candidate ceiling and 24-row
pages. The count describes the complete authorized filter result, even when a
relevance page uses that bounded candidate set.

Card titles open the internal detail route with viewport prefetch disabled.
The external open action is a native new-tab link to an authenticated GET
handler, so speculative navigation cannot increment views. The handler checks
current publication and lesson access, records the member view, then redirects
to the published URL or authorized asset. Personal bookmarks remain a
member-scoped projection across all five target types, filtered with current
publication and access rules; no personal result is cached across requests.

Bookmark writes are desired-state upserts/deletes behind the existing server
authorization and rate limit. The local toggle is reversible while the request
is pending, blocks duplicate submits, rolls back on failure, and reports a
successful toast only after the action commits. Undo is another desired-state
write, and all feedback actions revalidate the library, personal list, and
existing saved surfaces. The opt-in Library toast pauses its five-second timer
while focused or hovered; other toast variants retain their shared behavior.

### Profile badge artwork

The private and public profile routes query at most 100 member-scoped awards and
200 published definitions in parallel with their existing page reads. The
projections select only the card fields and award timestamp; awarded definition
IDs split the published catalog into earned and available items, with no
per-card lookup or persistent personal-data cache. Each criterion maps to one of
ten transparent 320 px WebP assets, totaling 271,496 bytes on disk. The 56 px
`next/image` renders load lazily, so badge art stays outside navigation and
initial JavaScript budgets. Both queries stay fresh per profile request, and
badge admin actions continue to revalidate profile paths when definitions
change.

### Profile overview and editing

`/perfil` is split into the overview, achievements, and edit routes. The shared
profile shell reads the authenticated `Member` snapshot and local `Profile`
projection; the three header counts are request-cached by member and queried
in parallel. Established members do not call Clerk Backend API on this path.
The overview selects at most 50 pending invitations, 100 member-scoped awards,
and 200 published badge definitions. The achievements route reads the same
bounded catalog and award projection, then calculates real criterion progress
for only the criteria represented in that catalog. No progress or awards are
cached across requests.

The edit action validates the profile on the server and commits the editorial
profile plus member avatar projection in one Prisma transaction. Username
uniqueness remains database-enforced. `showInDirectory` is a default-true
profile preference filtered in SQL by the member directory, its search API,
and global people results; direct profile URLs remain addressable. Inputs retain local values on a
validation response, and success is reported only after the transaction
commits. Profile links and the three profile tabs prefetch on deliberate
pointer or keyboard intent. The overview links at most 50 invitations, each
with one bounded page destination.

The route target remains first visit p95 <= 1 s and small persisted mutations
p95 <= 500 ms from the budgets above. These are targets; authenticated desktop
and mobile production measurements are still required before claiming they
pass. Avatar transfer is measured separately from the profile save.

## Exercises

Exercise pages keep member data request-fresh and use Prisma projections from
`apps/app/lib/exercises.ts`; no persistent cache is allowed for answers,
favorites, active attempts, or history. The general interaction target is
feedback within 100 ms, first usable content p95 <= 1 s, warmed prefetched
content p95 <= 300 ms, and small persisted mutations p95 <= 500 ms. These are
acceptance targets, not measured Exercises percentiles.

- `/exercicios` reads published lists and categories in bounded projections,
  then reads resumable list attempts and the six most recent completed
  sessions in parallel. Search/category predicates run in PostgreSQL; text
  search also matches published question categories and normalized topic tags.
  List/resume card links and the 20-item Favorites page use intent-only route
  prefetch through the shared per-route budget, avoiding viewport fan-out.
- `/exercicios/listas/[slug]` reads only a published list, its ordered question
  versions/options, and the member's active attempt. Session creation uses a
  PostgreSQL transaction-scoped advisory lock keyed by member/list, then reuses
  the existing active attempt or snapshots the published version IDs once.
- `/exercicios/sessoes/[sessionId]` scopes the attempt to `memberId` and reads
  ordered session questions with their pinned version, options, and saved
  answers. Draft selections live in `sessionStorage`, keyed by session and
  question, and never count as answers or progress.
- Answer submission verifies the member, session, question, and submitted
  option IDs on the server. One Serializable transaction inserts the unique
  answer, updates progress/completion, and applies the existing assignment and
  badge updates. The compact feedback DTO carries `sessionQuestionId`; the
  client renders it only while that exact question is active. Success follows
  the commit, and a duplicate submission reads back the saved answer. The
  transaction may be retried on serialization conflict.
- `/exercicios/historico` uses member-scoped keyset pagination ordered by
  `(completedAt, id)`, fetching seven rows for six visible results. The home
  page projection remains capped at six.
- `/exercicios/favoritas` uses member-scoped keyset pagination ordered by
  `(createdAt, id)`, fetching one extra row for a 20-item page. The combined
  saved-content page reads a six-item preview and links to the full collection.
  A separate aggregate returns the published favorite count. Existing
  `ExerciseQuestionBookmark` uniqueness and member/date index are reused; no
  index or migration was added for pagination.
- Favorite reads filter unpublished questions, banks, and lists in SQL. Toggle
  and undo are server mutations with authoritative reconciliation, rollback on
  failure, a five-second undo toast, and revalidation of Exercises, Favorites,
  Community saved content, and the active session when relevant.

Reads remain dynamic and member-scoped; answer, favorite, and editor actions
revalidate their affected routes after a committed write. No SQL query plan or
representative-data latency sample was available for the new favorite count and
keyset query, so no index change or database latency claim is made. The latest
local production build measures Exercises at 188.5 KiB gzip across 13 chunks,
under its 225 KiB budget. This does not establish authenticated route latency,
mobile performance, or production persistence. Those still require isolated QA
accounts and a non-production database.

## Interaction and navigation

Shared control and motion behavior is specified in
[`packages/design-system/PERFORMANCE.md`](../../packages/design-system/PERFORMANCE.md)
and enforced by shared interaction tokens and component styles.

- Every actionable control acknowledges input immediately with pending,
  selected, saved, or progress feedback. Keyboard activation and assistive
  technology receive the same status as pointer input.
- Use optimistic UI only when the local result is reversible and the server can
  authoritatively reconcile it. Keep rollback, duplicate-submit protection,
  request ordering, and a clear retry path. Never invent an answer, permission,
  upload completion, or persisted success.
- For longer actions, retain the user's input, disable only conflicting
  controls, and show a specific progress or pending state. Do not block unrelated
  navigation or work.
- Prefetch on deliberate pointer or keyboard intent; avoid automatic sidebar
  fan-out. Keep speculative requests bounded, stop speculation under data-saver
  or constrained-network preferences, and ensure prefetch never performs a
  mutation or weakens server authorization.
- Search, autocomplete, feeds, learning rails, and large dynamic card lists
  must not viewport-prefetch every destination. Prefetch only destinations
  reached by pointer or keyboard intent through the shared per-route budget;
  treat fragment links as their underlying route and skip prefetch for the
  current route. Stop under data-saver or constrained-network preferences.
- Navigation feedback begins on primary activation and clears when the route
  changes, the activation is cancelled, or an explicit error is returned. A
  timeout is a final stale-state guard, not a completion signal.
- Keep transitions short and active. Do not query animation preferences or
  remove motion from interactions; never delay content merely to make a
  transition visible. Only consider a device-specific simplification after
  repeatable performance evidence identifies devices that cannot sustain it.

## Persistence and background work

- Confirm a success state only after the primary transaction commits. Keep the
  confirmation payload small and update only affected local state when safe.
- Write secondary work to the existing transactional outbox in the same
  transaction as its source event. Consumers must be idempotent, retryable,
  observable, and recoverable by a scheduled worker before the request path
  stops providing its current best-effort dispatch.
- `after()` can shorten response latency but is not durable queue storage.
  Never rely on a detached promise or post-response callback as the only retry
  mechanism.
- Keep the current Supabase transaction pooler and verified TLS. Compare pool
  sizes under representative concurrency before changing the runtime limit;
  do not trade queueing latency for connection exhaustion.

## Measurement and privacy

- Use the existing Sentry integration for sampled route transitions and
  server spans. Span names must be low-cardinality and exclude member IDs,
  titles, search text, signed URLs, tokens, request bodies, cookies, and
  authorization headers.
- Measure authentication, member snapshot, access checks, home sections,
  database operations, mutations, and background queue age separately when
  those stages are in the critical path. Record failures and cancellations as
  well as durations.
- For PostgreSQL investigations, capture actual SQL and compare
  `EXPLAIN (ANALYZE, BUFFERS)` using a read-only transaction and production-like
  row counts. Distinguish client-to-function, pool wait, database execution,
  and response/render time.
- Compare cold and warm requests, first visits and prefetched navigation, and
  member/teacher/admin authorization cases. Use sanitized data and sample
  enough events before drawing percentile conclusions.

## Change checklist

Every new route, section, or action documents:

1. Its critical path, target budget, and minimum data projection.
2. Pagination, cache ownership, and invalidation rules.
3. Immediate feedback, keyboard behavior, and whether optimistic state is safe.
4. The primary commit boundary and any durable secondary work.
5. Authorization, mobile performance, and before/after evidence.

Run `bun run check`, `bun run typecheck`, `bun run boundaries`, `bun run test`,
and `bun run build`. A local build or skeleton is not proof of authenticated
production behavior; preserve the role, mobile, cache-isolation, persistence,
and deployment checks in roadmap phase 10.

## Current evidence and open gates

The 06/10/2026 baseline investigation found the app's effective function region
`iad1` while Supabase GREEN and the API run in `gru1`. Five authenticated route
changes ranged from 1.43 s to 3.82 s, including browser automation and DOM
confirmation; they are diagnostic timings, not INP or production percentiles.
Simple SQL round trips were 13–15 ms in the available sample, and no ten-second
stall was reproduced. Historical Vercel percentiles and full hydration traces
were unavailable. Two app Previews built successfully and returned HTTP 200
from `/health`, with the database check passing. The Preview deployed with
`--regions gru1` returned `X-Vercel-Id: gru1::gru1`; a second deployment from
the repository root without that CLI flag returned `gru1::iad1`, indicating a
GRU1 request region and IAD1 function execution. The Vercel project default
also reports `serverlessFunctionRegion: iad1`, although
`apps/app/vercel.json` declares `regions: ["gru1"]`. Vercel documents function
region configuration through `vercel.json` or the deployment setting
([Function Regions](https://vercel.com/docs/functions/configuring-functions/region),
[request region header](https://vercel.com/docs/headers/request-headers)).
The checked-in setting therefore has not yet been proven effective in the
repository-root deployment path. Changing the project default was blocked by
the automatic tool policy and remains an operational gate; Production was not
changed.

The authenticated shell now reuses the member snapshot for role and onboarding,
avoids Clerk `currentUser()` for a provisioned profile, and checks learning-menu
availability with one access-scoped existence query. Home now reads only the
enabled blocks. Continue-watching filters eligible playback in SQL and caps
results at six instead of transferring up to 1,000 recording IDs. Exercise
answers now return confirmed correction DTOs to the current screen. These code
changes require the mandatory checks and authenticated QA before any
performance target can be marked met. The local production artifact measured
186.5–190.2 KiB gzip of initial JavaScript across Home, Community, Learn,
Library, and Exercises; both app Previews measured 188.8–192.7 KiB. The active
per-route CI ceiling is 225 KiB gzip.

### Continuation evidence — 06/10/2026

The latest app Preview (`dpl_8HoLnYVJyujisiYhUG7KrvFR7yuj`) contains the
complete current workspace. `vercel inspect` lists the Next.js functions in
`gru1`; `/health` returned HTTP 200 and `X-Vercel-Id: gru1::gru1`. This was
reproduced without a CLI region override by explicitly loading the checked-in
app configuration: `vercel deploy --local-config apps/app/vercel.json --yes`.
A root deploy without that config had returned `gru1::iad1`. The Vercel
project default remains `iad1`; use the explicit local-config command for app
Preview and release deployments. The direct remote-default change was blocked
by automatic tool policy. Production and its aliases were not changed; the
build machine's `iad1` location is separate from runtime.

The continuation streams Community, Library, and Admin sections independently;
starts Learn progress as soon as its required course IDs are known; provides
immediate pending feedback for filters, task forms, and material opening; and
removes the full Admin recordings-page refresh after thumbnail changes already
reconciled locally. Those were the only `router.refresh()` calls under the
authenticated app. Local production-artifact budgets are 186.5–190.2 KiB gzip;
the latest Preview is 188.8–192.7 KiB under the 225 KiB per-route ceiling.

Global Search retains its eleven authorized queries and result limits, but now
records a fixed low-cardinality Sentry span for each result type inside the
existing fan-out span. This adds no database round trips or dynamic query/member
data to telemetry and is intended to identify the slow branch before changing
SQL, indexes, or result semantics. The Preview has a Sentry DSN configured;
authenticated trace ingestion has not yet been verified.

The authenticated Production route timings recorded above predate this code.
The current Preview uses Clerk Development; unauthenticated `/comunidade`
returned the Clerk `dev-browser-missing` handshake, and no QA session was
available. Thus this build has no authenticated before/after route timings,
mutation persistence proof, role matrix, mobile-device proof, or runtime p95.
Component tests and earlier Production observations are not a fresh authenticated
measurement. The build had no `SENTRY_AUTH_TOKEN`, so release creation and
source-map upload did not run. Runtime trace ingestion remains unverified.
The performance initiative and roadmap phase 10 remain open.

### Production region and authenticated comparison — 06/10/2026

The status above is historical and is superseded for Production by this entry.
The user changed the Vercel app's default Function region to `gru1`. Redeploying
the existing deployment (`dpl_HNMPCCNc5BQcLZALWH8RcgtMjZ3t`) still produced
functions in `iad1`, even though its manifest listed `gru1`. A fresh Production
build of the same source commit (`523ff17`) from a clean detached worktree,
using `apps/app/vercel.json`, produced deployment
`dpl_H3q2X7appwqC3iiczKRrzxu85nAZ`. `vercel inspect` lists the Next.js page and
API functions in `gru1`. The automatic `...-app.vercel.app` alias redirects to
the canonical host; that canonical alias was explicitly pointed to the new
deployment after inspection showed it still referenced the old deployment.
Both a protected-deployment health request and the canonical Production
`/health` response returned HTTP 200 with `X-Vercel-Id: gru1::gru1`. This proves
the live health function now executes in São Paulo; the build machine's `iad1`
location is unrelated. The `_middleware` artifact lists multiple regions,
including `iad1`, but the page/API functions are deployed to `gru1` and the
live request path returned `gru1::gru1`. Vercel documents that `vercel.json` `regions` overrides
the project setting and that `x-vercel-id` includes function execution region
([region configuration](https://vercel.com/docs/project-configuration/vercel-json),
[request headers](https://vercel.com/docs/headers/request-headers)).

Using the same signed-in Edge session, `TEACHER` role, canonical Production
host, query and DOM readiness markers, the original baseline sample and five
post-change samples per flow were:

| Flow | Before, n=1 | After median, n=5 | After range, n=5 | Directional change |
| --- | ---: | ---: | ---: | ---: |
| Community | 3,730 ms | 705 ms | 553–992 ms | −81% |
| Library | 3,805 ms | 711 ms | 666–944 ms | −81% |
| Teacher overview | 2,131 ms | 639 ms | 556–1,401 ms | −70% |
| Global search (`causalidade`, 1 result) | 3,005 ms | 534 ms | 397–624 ms | −82% |

The Search input value updated in a median of 18 ms (17–42 ms). Additional
post-change samples were 867 ms for Home, 802 ms for Exercises, and 573 ms for
Learn after that route had already been visited. At a 390 × 844 responsive
viewport, Community, Library, and Home reached usable content in 1,048 ms,
647 ms, and 703 ms; document width matched the viewport on each route. This is
desktop-browser emulation only, with no network throttling or physical Android
device. The teacher submenu wraps across several rows at this width, so a
compact mobile disclosure is a candidate for separate usability validation.
The route timings include
browser automation dispatch and DOM polling. They compare one pre-change sample
with five post-change samples; the percentage is directional and is not a
before/after percentile comparison. Some warmed navigations finished before
the pending live-region text was observed at click return, so the ≤100 ms
feedback budget is not yet demonstrated. This small desktop sample does not
prove the p95 navigation budgets.

Seven sequential canonical `/health` checks returned HTTP 200 and
`gru1::gru1`: the first measured 393 ms and the six warm requests measured
117–127 ms (median 121 ms). The earlier same-endpoint warm median was 312 ms;
this small sample is a 61% lower median, not a user-page latency percentile.
Observability Plus was not enabled. Production p50/p75/p95, authenticated
`MEMBER`/`ADMIN` comparisons, physical Android/4G, hydration/INP, and mutation
latency remain unverified. A local follow-up fixes the navigation live region
being cleared when Next intercepts an internal link; it passed the monorepo
gates but still needs an authenticated deployment measurement before release.
Phase 10 and this initiative remain `IN PROGRESS`.

### Repeated warm Production navigation sample — 06/10/2026

After the region rollout, I repeated authenticated warm navigations in the same
Edge `TEACHER` session using a fresh browser screenshot before every physical
pointer click, then recorded click dispatch, route commit, route structure, and
a route-specific usable-content marker separately. With that calibrated method,
click dispatch took 29–40 ms and route commit took approximately 67–93 ms. Five
warm samples reached usable content in:

| Flow | Median, n=5 | Range, n=5 | Structure median |
| --- | ---: | ---: | ---: |
| Community | 437 ms | 422–445 ms | 424 ms |
| Library | 445 ms | 416–468 ms | 433 ms |
| Teacher overview | 438 ms | 420–596 ms | 424 ms |
| Learn | 439 ms | 431–495 ms | 85 ms |
| Exercises | 428 ms | 424–438 ms | 414 ms |

These warmed route samples are below the 1-second first-visit goal but remain
above the 300-ms warmed/prefetched goal. The Learn shell is visible much sooner
than its usable course content. They are five samples, not p95 evidence, and
include browser automation/DOM polling; they are not field INP. A prior uncalibrated
measurement occasionally added about 800 ms because Windows coordinate clicks
were mapped from a stale screenshot; those readings are excluded from this
sample and must not be compared as an apples-to-apples baseline.

The old global navigation progress indicator was observed in only 2 of 25
calibrated attempts, at 115 ms and 118 ms from the automation's click start;
route commit could clear it before it was visible. A follow-up now flushes the
pending state during the capture event and retains it for at least 150 ms while
content proceeds independently. Its focused regression test and all five
monorepo gates pass locally. This follow-up is not included in the currently
published `c92d87a` deployment and still needs Production QA. The indicator
observation is not proof of the <=100-ms feedback budget.

The Production deployment `dpl_2vqLQfcQhaV29V7tGcmE2rbkfohH`, built from
`c92d87a`, lists the Next page/API functions in `gru1`; canonical `/health`
returns HTTP 200 and `X-Vercel-Id: gru1::gru1::...`. Five calibrated samples
from the same signed-in TEACHER session cover Community, Library, teacher
overview, Learn, and Exercises. Search was tested read-only in the preceding
sample, with 1 result and 397–624 ms content readiness. No production mutation
was submitted. MEMBER/ADMIN sessions, physical Android/4G, throttled network,
real-user percentiles, hydration/INP, and persistence/rollback mutation tests
remain open. Observability Plus was not enabled.

### Post-feedback Production verification — 06/10/2026

Commit `083b862` was pushed to
`codex/interprete-member-area-release-2026-10-04` and deployed as Production
`dpl_7amD4bgH6iiiyveApJ4rKjJNtebR`. Vercel lists the Next page/API Functions in
`gru1`; the canonical alias was assigned to this deployment. A fresh canonical
`/health` returned HTTP 200, database `ok`, GREEN project ref
`qffqhilydtnrggbcnogh`, and `X-Vercel-Id: gru1::gru1::hf94z-...`. The latest
build ran 254 app tests and passed the 225 KiB route bundle budget
(188.8–192.7 KiB gzip). Build logs note that Better Stack has no runtime
observability environment variables and sends Web Vitals to `/dev/null`; no
Observability Plus was enabled.

Authenticated Production QA used the existing signed-in TEACHER account in Edge
at the canonical host. On a normal desktop viewport without network throttling,
the pending announcement was observed 130–164 ms from the automation's click
start. The capture handler now calls `flushSync` before Next handles the link,
but this automation interval is not an event-to-paint measurement and does not
prove the <=100-ms budget. The minimum visible interval avoids a vanishing
indicator; it does not delay navigation.

For navigation, each click followed a fresh screenshot and a calibrated sidebar
pointer target. On repeat, warmed route transitions reached structure/content
at 478–479 ms for Library and 476–477 ms for Community; route URL commits were
77–83 ms. One initial Library visit after a production reload took 945 ms to
structure and 1,188 ms to its first material heading. Teacher overview reached
its first content heading in 622 ms (URL commit 270 ms). These are individual
samples, not percentiles. A Community reload shortly after alias cutover took
3,238 ms to the post content; subsequent authenticated Teacher
overview reloads took 1,044 ms and 779 ms. This is evidence that startup/cache
state matters, not enough data to estimate cold-start frequency or p95.

Global Search remained responsive while its API fan-out completed: typing
`epidemiologia` was acknowledged in 43 ms and the results list (8 items) appeared
in 500 ms. A prior Production query for `causalidade` returned one result in
397–624 ms. Search did not mutate data. No exercise submission, bookmark, post,
or other production write was used for this verification.

The deployment confirms the region and keeps warmed Library/Community below
500 ms, but the 300-ms warmed-route budget remains unmet in this interaction
method. The single cold/reload result above 3 seconds and the 0.78–1.19-second
warm/cold spread deserve repeated measurement across ordinary sessions. Search
results met the 1-second goal in the observed sample. These results do not prove
p75/p95, mobile/4G, MEMBER/ADMIN behavior, hydration/INP, or mutation persistence
and rollback. Phase 10 and the performance initiative remain `IN PROGRESS`.

### Intent-prefetch trial and Admin Library baseline — 06/10/2026

Commit `9f4ba71` deployed as `dpl_FY48LbuwQm8reiSvcDfBMZoLifVf`. The page and
API Functions were listed in `gru1`; the canonical `/health` returned HTTP 200
with database `ok`, the same GREEN project ref, and
`X-Vercel-Id: gru1::gru1::wz2fj-...`.

Using the same authenticated TEACHER session in Edge, keyboard focus initiated
route prefetch and was held for 600 ms before Enter. Community → Library reached
the Library structure marker in 233 ms and its first material heading in 235
ms; Library → Community reached its structure marker in 167 ms and first post
heading in 170 ms. Neither sample displayed `[data-route-loading]`. Compared
with the prior 411–412 ms Community sample after the same focus dwell, the
observed content interval fell by about 59%. Teacher overview reached its
confirmed dashboard card in 159 ms (URL commit 85 ms). Samples are single-run
browser automation timings, not field INP or percentiles; feedback observations
(159–229 ms) include automation transport and do not measure event-to-paint.

The same session exposed a remaining Gestão outlier. After a clean authenticated
Admin overview reload and 600 ms focus on Admin Library, its unique page title
appeared at 1,166 ms, the catalog heading at 1,182 ms, and the first catalog
item at 1,201 ms. The rendered page showed 110 catalog items. Before the next
tranche, `getStaffLibraryItems()` fetched every item and the page waited for the
full list before returning its header; no loading fallback was observed. This
sample missed the 300-ms intent-warmed route target and motivated SQL-backed
pagination plus a route-specific loading shell. No Production mutation was
submitted.

### Global Search prefetch fan-out — 06/10/2026

In the authenticated TEACHER Production session on deployment
`dpl_BzJ9PgULRXLwicTrdrqzEtUeEsiG`, the query `epidemiologia` returned eight
visible results. The same read-only search produced `GET /api/search` 200 and
Vercel request logs for all eight matching `/biblioteca/<id>` detail routes in
the following second. The search rendered ordinary Next `<Link>` components
without a `prefetch` limit. Next's documented default prefetches links as they
enter the viewport, while `prefetch={false}` disables viewport and hover work
([Next.js Link API](https://nextjs.org/docs/app/api-reference/components/link)).
The IDs in the route logs matched the visible results, confirming unnecessary
detail-page work concurrent with the search for destinations the member had
not selected. Vercel's free request logs expose paths/status but no duration.

Commit `1712599` deployed as `dpl_Fkk4434chk7btKDA1iy3zSeQRSMG`. Repeating the
same read-only query with the same authenticated TEACHER session returned eight
results and `GET /api/search` 200, while only the active first result's unique
detail route appeared in the Vercel request logs. That route returned 200 and
opened the matching item. The two observed samples therefore show eight to one
unique destination paths (87.5% fewer); they do not establish a latency gain or
a production percentile. Vercel's free request logs expose paths/status but
not function duration, and paid Observability Plus is unavailable and will not
be enabled for this initiative.

## Planejamento and Ferramentas — local implementation

`/planejamento` keeps its member-scoped Prisma reads request-fresh. The initial
dashboard projects at most 200 top-level tasks, 500 personal events and 200
published meetings; recurrence expansion uses the requested date range, which
is capped at 400 days. The calendar asks for only the visible range, while
weekly and monthly study totals use database aggregates. Calendar activity
deadlines pass through `resolveCalendar` and the member's current
`resolveStudentFeed` projection, including eligible individual assignments and
dynamic cohort targets. Due-date predicates are applied in the database and
future assignments remain hidden until `availableAt`; the read creates no
progress. Assignment and activity candidate queries each cap at 200 rows today,
so pagination/continuation is still required before the calendar is complete.
Study sessions are capped at 300 rows; durations are grouped by session in the
database. Goal markers are derived from the existing weekly/monthly goal
periods. Personal planner records and resolved cohort identity are not stored
in a shared persistent cache. The tokenized `.ics` response is private and
`no-store` so current membership and token revocation are checked on fetch.
Lesson releases and cohort events are not yet projected, and meeting access
still follows the legacy participant query; database latency is unmeasured.

`/ferramentas` reads at most 30 timer-history rows alongside the active session
and user settings. Timer timestamps and persisted segments are authoritative;
the visible clock refreshes while open and refreshes immediately when the page
becomes visible. The server enforces one open timer session per member. These
polls do not establish real-time cross-device latency. Manual stops remain
pending until the member adds an optional note and registers or discards the
session; study intervals are written only after registration. Lesson links can
be added or removed while a session is active.

The Notes list runs title/content/tag search in PostgreSQL, scopes every query
to the authenticated member, and returns at most 100 rows with a 320-character
preview. The TipTap JSON is fetched through a separate member-scoped query only
when a note is opened. The list never transfers the full document for every
row. Writes revalidate `/ferramentas` and `/`; editor changes debounce for
700 ms and show saved status only after the action returns successfully.

Both routes have a 225 KiB gzip initial JavaScript budget. Local build and
bundle results are recorded in the dated roadmap entry; authenticated route
percentiles, mobile measurements, database concurrency, and cross-device
reconciliation remain acceptance gates, not inferred passes.

### First-access and runtime consolidation — 11/10/2026

Planner/tools authorization reuses the request-cached identity snapshot and requires completed onboarding before domain reads. Dashboard reads never create preferences or columns: absent rows resolve to virtual defaults, and explicit edits persist them. Layout/page parallel rendering cannot trigger a preferences FK write during a read. Timer/feed API guards likewise reuse the fresh snapshot; capability-based calendar feeds check the current member status. Concurrent timer starts reconcile unique/serialization conflicts as HTTP 409, with one active session enforced in PostgreSQL.

The authenticated local PostgreSQL/Chrome trial verified persisted planner edits, timer segments and notes after reload. Twelve viewport/route combinations (320/390/768/1440 px; Planner/Timer/Notes) had no horizontal overflow. These observations are functional/responsive evidence, not latency percentiles or physical-device proof. Windows prerender is capped at two workers to fit concurrent QA servers/Chrome; Linux deployment worker defaults remain unchanged. Tailwind uses explicit source lists rather than recursively scanning runtime clones and build caches.

The final consolidation gates passed with 398 app tests. Initial JavaScript was
220.8 KiB gzip for Planner and 219.8 KiB for Tools, each below 225 KiB. The local
concurrent timer start returned 200/409 with one active session; confirmed search
history survived reload and its explicit delete. Occurrence/series deletion and
undo were exercised independently. A due reminder crossed the durable outbox
and appeared in the existing notification panel. QA database SQL sessions were
aligned to UTC, matching GREEN, while member-facing timezone remains editable.
Production percentiles and physical-device acceptance remain open.

### Visual QA cycle — 11/10/2026

Estudar now reads the onboarded identity and bounded authorized learning/activity/resume projections in parallel; it no longer loads the metrics dashboard, provisions a profile or reads full progress trees. Aprender keeps its existing authorized catalog projection; activity filters use URL state and the existing member-scoped server query. Submission feedback acknowledges persistence only after the transaction; a client lock prevents duplicate submits. The timer focus dialog uses the shared modal primitives for focus trapping and Escape, with explicit viewport positioning and a confirmation above it. No shared identity cache or reduced-motion branch was added.

All six root gates passed after these changes: 406 app tests, 17 domain, 9 API and 30 script tests. Gzip initial JS: learning 206.5 KiB, planner 220.9 KiB, tools 219.9 KiB, within 225 KiB. Build exited 0; the existing external-cache BUILD_ID warning remains. Local Chrome tested the three priority routes at six widths (320/390/768/820/1024/1440), plus 22 member routes at three widths: no horizontal overflow or JavaScript exceptions in those visits. Persisted lesson completion, course bookmark, activity text submission and filter reload were exercised. These visits are not an exhaustive interaction/role matrix, latency percentiles, physical-device evidence or pixel-perfect acceptance.

### Timezone hydration follow-up — 11/10/2026

Authenticated production QA exposed React hydration error 418 and a three-hour timestamp shift in Tools: locale formatting implicitly used the server timezone and then the browser timezone. Timer history now explicitly uses the member setting. Notes fetch only the timezone column from member preferences in parallel with their existing list queries and return a single reference timestamp, so relative dates are identical during SSR/hydration, including calendar-day boundaries. No identity call, write, shared cache or full note payload is added. Four regression cases cover Sao Paulo midnight, yesterday, custom UTC history and invalid dates. Production timer and note autosave both survived reload using private controlled QA records.

Gates da correção de fuso: check/typecheck/boundaries/test/build/performance:check e diff --check passaram; 410 testes app em 104 arquivos, 17 domínio, 9 API, 30 scripts. Tools 220,3 KiB gzip / 225 KiB; aviso BUILD_ID persistente. Chrome local em 390 px recarregou Notas com data estável e zero pageerror novo. O cache do runtime isolado criado nesta sessão foi preservado por renomeação antes de regenerar chunks; dados e servidor original não foram removidos.

### Portal/sidebar interaction regression — 11/10/2026

The drawer synchronization effect now collapses only on entering portal/tablet drawer mode. Previously its sidebarOpen dependency made it immediately undo each menu click. Three component regressions cover sustained opening, reopening, tablet opening and desktop restoration. All six gates pass with 413 app tests. Local bundle results remain Planner 220.9 KiB and Tools 220.3 KiB. The actual Linux Production build of f83f521 measured Planner 223.9 KiB and Tools 223.3 KiB, still within 225 KiB but with less headroom than Windows; do not substitute local sizes for deployment sizes. Production note reload after the timezone fix kept the same 17:50 label and produced no new hydration exception in the captured log window.

### Escape no drawer mobile — 11/10/2026

O componente compartilhado montava TooltipContent com hidden em menus expandidos/mobile. Ao focar um link, a camada invisível consumia o primeiro Escape e deixava o drawer aberto. Reproduzido no Chrome local: tooltip hidden=true/instant-open, drawer open antes e depois de Escape. O novo teste falhou antes (estado true em vez de false) e passou depois. Tooltips agora só montam no desktop recolhido, sem mudar a aparência dos menus abertos. Chrome local em 390 px confirmou fechamento com um Escape após reload e foco no link. Não há nova consulta, cache, persistência ou payload de dados no caminho crítico.

Gates finais do ajuste de Escape: check, typecheck, boundaries, test, build, performance:check e diff --check passaram. 414 testes app, 17 domínio, 9 API e 30 scripts. Planner 220,9 KiB e Tools 220,3 KiB gzip locais, abaixo de 225 KiB; aviso externo BUILD_ID persiste. Mais 20 visitas locais em 390/820 px (grupos, criação, biblioteca pessoal, tarefas, trilha/curso/aula e páginas públicas): HTTP 200, sem overflow ou pageerror. Busca e filtros de notificações publicados responderam e navegaram; nenhum conteúdo público de QA foi criado.

### Grupos: nome longo e retorno — 11/10/2026

QA local criou grupos privados controlados pelo formulário e confirmou persistência após reload. Um nome válido de 80 caracteres sem espaços causava scrollWidth 2289 em viewport 390, mesmo após estabilizar. O cabeçalho agora admite quebra de palavras longas e encolhimento do item flex, sem alterar o layout de nomes comuns. Após correção: scrollWidth 375/viewport 390, sem overflow. O link Todos os grupos agora retorna a /comunidade/grupos, validado no navegador. Sem mudança de schema, consultas, cache ou dados em produção. Novos gates em execução; fases 9/10 abertas.

Gates finais dos grupos: os seis checks obrigatórios e diff --check passaram (414 testes app). Nove combinações de grupo normal/nome de 80 caracteres/lista em 390, 820 e 1440 px sem overflow. O cluster local ficou indisponível durante o ensaio seguinte de reload do rascunho; isso interrompeu a prévia e não constitui aceite desse fluxo.

### Editor: ciclo de montagem e autosave — 11/10/2026

No runtime local com StrictMode, o cleanup marcava disposedRef=true, mas o setup não restaurava false. Isso bloqueava scheduleSave/flushSave/handlePublish silenciosamente; o teste novo falhou com zero chamadas ao autosave antes da correção e passou depois. O setup agora reativa o componente. Após corrigir, Chrome local confirmou POST 200 de autosave, título e corpo persistidos no reload e prévia com conteúdo correto no grupo privado de QA. Não houve escrita pública em produção. Nenhuma query/cache/schema adicional; a fila e a prevenção de publicação duplicada permanecem. O cluster local existente foi reiniciado após interrupção e verify-local-tls confirmou interprete_member_qa2/TLS validado.

Gates finais do editor: check/typecheck/boundaries/test/build/performance:check e diff --check passaram; 415 testes app em 106 arquivos, 17 domínio, 9 API, 30 scripts. Chrome local confirmou corpo e título após autosave/reload, prévia e publicação privada controlada com reload. Medição estabilizada em 390 px: scrollWidth 375, sem overflow. A medição imediata durante a transição não é usada como aceite. Nenhum conteúdo foi publicado remotamente nesse ensaio.


### Gestão course catalog and editing path

/gestao/ensino/cursos is a staff-only Server Component path. It resolves
content.manage on each request and keeps search, state, learning-path filters,
pagination, and totals in PostgreSQL. The catalog page size is 25; the search
string is bounded to 120 characters, path IDs to 255 characters, and the course
projection selects only title/state/timestamps, path label, module and lesson
counts, and at most three authorized cohort labels plus active member counts.
Cohort labels and counts are scoped to the current teacher's cohorts.

The route currently performs independent status counts and path options in
parallel with the page count, followed by the selected page query. Filters and
ordering are database-side, with stable tie-breakers; viewport links from the
course rows do not prefetch editor trees. No identity or permission result is
persistently cached. Creating a course uses the existing authorized action,
commits the course first, then invalidates the Gestão catalog and learner
surface before redirecting to the editor.

The editor is shared with the existing course domain and includes the existing
nested course/module/lesson authoring fields. That editor projection, its
mutation audit/outbox coverage, and the new route's authenticated latency have
not yet passed the Gestão acceptance gate. Until local QA has a database and
staff fixtures, the budgets above remain targets rather than measured results.

### Gestão exercise bank and list surfaces

The exercise bank catalog authorizes `content.manage` on each request. Search
and bank status filters run in PostgreSQL; bank pages return at most 18 banks,
with up to 20 list summaries per bank. List detail returns 25 question versions
per page, with question search, category, and status filters applied in SQL.
The page also bounds category options to 100 and reusable questions to 100.
These limits keep the initial projection bounded; navigation through very
large catalogs and the authenticated route latency remain part of local QA.
The new-list bank selector is limited to 200 non-archived banks, and the bank
cards show up to 20 lists each; these are known large-catalog navigation gaps.

Question reuse is constrained to the same bank and pins the current immutable
version into the destination list. Editing a reused question creates a new
version and advances only the list item being edited; other list bindings and
existing student session snapshots keep their selected versions. List ordering
uses one adjacent swap in a serializable transaction and a temporary unique
position, rather than loading the full list. These server actions invalidate
the affected Gestão and learner routes after the database commit. No
identity/permission result is persistently cached. Database concurrency,
authenticated mutation latency, and student-session preservation still need
runtime verification against the local QA database.

The current bundle-budget script reports the member-facing `/exercicios` route
at 208.1 KiB gzip. It does not separately measure `/gestao/ensino/exercicios`;
the Gestión route's initial JavaScript budget still needs an explicit entry
and measurement before its performance gate can be accepted.

### Gestão activity authoring and cohort delivery

`/gestao/ensino/atividades` authorizes `content.manage` per request and pages
the PostgreSQL catalog in groups of 20. Search, status, course, and due-date
filters run in the database. Submission and direct-assignment counts are
grouped only for the current page; teacher-visible rows are scoped to active
members of the teacher's active cohorts. Cohort, course, and library selectors
are capped at 200 options, and direct student search pages 8 results at a
time. Activity details select at most 200 direct recipients and the current
rubric version. The Gestão preview reads saved content without updating
learner progress.

Create and update mutations validate the actor's current cohort/member scope
again inside the serializable transaction, use activity versions for conflict
detection, and commit the content, audience targets, rubric version, and
notification outbox together. The member picker is the only new audience
search client path and requests its next page after a 250 ms debounce; catalog
and editor destinations do not prefetch on viewport. No role, identity,
recipient, or cohort result is persistently cached.

Learner activity reads now include eligible active cohort targets. Eligibility
is checked at request time against membership, cohort start/end, the 90-day
read window, and `ALL_ACTIVE`/`FROM_JOIN`. Direct assignment access remains
independent. Notification delivery is queued for currently eligible members
when an activity is published or a published audience is expanded. Progress
rows for dynamically eligible cohort members and notices on later `ALL_ACTIVE`
joins remain part of the student-feed/outbox work; they have not passed the
acceptance gate. The performance budget now has a dedicated entry for
`/gestao/ensino/atividades`; its local production build measured 212.3 KiB gzip
across 17 chunks, below the 225 KiB route limit. There is no authenticated
local database measurement for this tranche. The targets remain first usable
content p95 ≤1 s, small committed
mutation p95 ≤500 ms, warmed navigation p95 ≤300 ms, and visible feedback ≤100
ms; authenticated percentiles and client-bundle measurement remain open.

### Gestão correction queue and feedback

The `/gestao/alunos/correcoes` and activity-specific delivery routes authorize
`assignments.manage` on each request and scope teacher rows through current,
active students in their active cohorts. Counts and 30-row pages use the same
SQL filters for status, cohort, and search. The selected delivery is fetched
with its current versioned rubric, saved draft, and sent feedback; no member
identity or correction result is cached across requests. Both queue destinations
disable viewport prefetch.

Saving a draft and sending feedback are separate serializable writes. The form
carries the submission timestamps and feedback/draft versions so a stale tab
returns a conflict instead of overwriting a newer submission or review. Sending
requires a comment and all published criteria scores, marks the submission
reviewed, replaces only the learner-visible feedback, removes the draft, and
enqueues an idempotent notification in the same transaction. The notification
dispatcher runs only after commit. These routes have explicit JavaScript budget
entries at 225 KiB gzip each; bundle sizes, authenticated latency, concurrent
review behavior, and persisted QA are still unmeasured until a local database
and staff/student fixtures are available.

### Gestão library catalog and editor

`/gestao/ensino/biblioteca` checks `content.manage` on every request, applies
search and filters in PostgreSQL, returns 24 materials per page, and selects
only the columns needed by the active list/grid. Status counts are grouped in
the database; category, language, and collection selectors are capped at 100,
50, and 100 rows. Catalog links do not prefetch on viewport. Bulk submission
accepts at most 100 unique IDs; collection additions use a serializable
transaction and avoid duplicate links. Success is shown only after the write
commits and the server action returns. Mutations revalidate the Gestão catalog,
the legacy admin catalog, and the learner library; bulk collection updates also
revalidate the collection and Aprender surfaces. No role, identity, or private
asset result is persistently cached.

The route measured 214.2 KiB gzip across 17 chunks against its 225 KiB budget.
This is a bundle check, not a latency measurement: authenticated PostgreSQL
percentiles, Storage behavior, concurrent bulk mutation, and visual/runtime QA
remain open until the isolated local QA services and fixtures are available.
The shared targets remain ≤100 ms visible feedback, first usable content p95
≤1 s, committed small-mutation p95 ≤500 ms, and warmed navigation p95 ≤300 ms;
none has been measured for this route in authenticated QA.

### Gestão collection catalog, editor, and preview

`/gestao/ensino/colecoes` checks `content.manage` per request and pages the
catalog in PostgreSQL at 24 collections per page. Search and status filters run
in SQL. The editor bounds its resource selectors to 20 results per type and
loads at most 100 collection items for editing or preview. The preview reads
the saved collection without writing learner progress. Catalog destinations do
not prefetch on viewport.

Collection mutations use idempotency keys and optimistic versions; resource
add/remove operations check the affected-row count inside a serializable
transaction so a stale concurrent edit rolls back. Domain changes and audit
events commit together, and successful feedback follows the committed server
action. Cover uploads use the existing private Storage flow. Asset reads check
ownership while editing and, for other members, a currently published and
visible collection. Identity, role, audience, and private asset decisions are
not persistently cached.

The local production build measured the catalog at 213.9 KiB gzip across 17
chunks, the editor at 218.5 KiB across 17 chunks, and preview at 211.9 KiB
across 16 chunks; each is under 225 KiB. These are bundle measurements only.
No authenticated PostgreSQL/Storage runtime, persistence, concurrency latency,
or visual comparison has been measured. The shared budgets remain ≤100 ms
visible feedback, ≤1 s first usable content p95, ≤500 ms committed small
mutation p95, and ≤300 ms warmed navigation p95 until QA measurements exist.

### Gestão lesson editor and publication

`/gestao/ensino/cursos/[id]/aulas/[lessonId]` requires `content.manage` on
every request. Its server projection reads one lesson, its module/course
labels, the first video asset, and the ordered resources used by the editor;
the video DTO omits private Storage paths. Saving uses an optimistic lesson
version and a fresh idempotency key, then revalidates the course, lesson editor,
and learner surface after commit. Publishing rechecks current YouTube metadata
on the server, allows only embeddable public/unlisted videos, and stores the
verification with the versioned publication write. The transaction records the
Gestão status event; notification delivery remains the existing post-commit
path and needs conversion to the durable outbox in the cross-cutting phase.

The local production build measured `gestao-lesson-editor` at 218.1 KiB gzip
across 17 initial chunks, under its 225 KiB budget. The rich-text editor and
YouTube player load in separate chunks; the player mounts only when an
instructor opens the preview. This is bundle evidence only: no authenticated
runtime or PostgreSQL QA service is available here. API-key verification,
Storage uploads, playback persistence, latency percentiles, and visual
comparison remain unverified.

The Gestão course editor now includes the playlist-import dialog as a local
client island. It fetches one YouTube Data API playlist page at a time, selects
up to 200 videos per transaction, and shows an immediate pending state while
the server rechecks current metadata. Playlist rows and signed selection tokens
are returned as a bounded page; neither the API key nor unpublished member
data crosses the server boundary. Replaying an idempotency key with changed
selection or options is rejected. Published imports write lessons, assets,
audit, and notification outbox rows in one serializable transaction; draft
imports do not notify learners. The `gestao-course-editor` bundle now has its
own 225 KiB gzip gate and measured 216.5 KiB across 17 initial chunks in the
local production build. The local QA database, YouTube key, authenticated
latency, transaction concurrency, and visual/device comparison are not
available here, so this describes code paths rather than runtime acceptance.

### Learner playback progress

`GET` and `PUT /api/learning/assets/[assetId]/progress` re-check current asset
access on every request and return private, uncached progress. Both the stored
video player and YouTube player send a stable per-tab session ID and sampled
media position. The server timestamps samples, rejects implausible jumps,
resets the checkpoint on play/seek, clamps coverage to the configured clip,
and merges intervals as a union in a serializable transaction with up to three
attempts. The browser's `completed` flag and absolute playback position alone
cannot complete a lesson. The denominator prefers saved asset duration and clip
metadata; player duration is a fallback where that metadata is absent. At 90%
union coverage, the existing lesson-completion path and eligible asset or
recording assignments are updated. Completion never creates access.

The player writes a baseline on play, samples every 15 seconds, and flushes on
pause/end; feedback is shown before the request and success only after the
write. The `learning` route measured 208.6 KiB gzip across 16 initial chunks,
below the 225 KiB budget. This does not establish latency: the ≤100 ms visible
feedback target and ≤500 ms committed mutation p95 remain unmeasured because
local PostgreSQL QA is unavailable. Migration
`20261012143000_playback_watch_intervals` is additive and remains unapplied;
runtime persistence, simultaneous-tab database races, real playback and the
visual acceptance frames still need local QA.

### Learner feed: direct and cohort activity delivery

`/aprender` keeps identity request-scoped and reads its feed on every dynamic
request. The activity projection reads the member's active cohort memberships
and up to 100 direct activity assignments in parallel, then loads at most 200
published candidate activities with only the due date, active cohort targets,
and this member's submission status. SQL scopes candidates to the member's
direct assignment IDs or current cohorts; domain resolution applies the exact
join timestamp, cohort period, expiry, completion, deduplication, earliest due
date, and latest individual note. Loading the page does not create progress.
The first tranche has fixed result caps and no visible continuation control;
complete feed pagination remains open.

The route's existing client bundle measured 208.6 KiB gzip across 16 chunks,
under 225 KiB. That is bundle evidence only. Authenticated query latency,
database persistence, multi-user authorization, visual/mobile comparison, and
the ≤1 s first-content p95 remain unverified because local PostgreSQL QA is
unavailable. The shared ≤100 ms interaction-feedback, ≤500 ms committed small
mutation, and ≤300 ms warmed navigation budgets remain in force.

### Student calendar: activity deadlines and cohort lesson releases

`resolveCalendar` is request-scoped and shared by the planner and its private
`.ics` feed. It selects activity deadlines through the learner feed, then
loads the current member's active cohort memberships before querying lesson
releases, so the release query is bounded to those cohort IDs and the requested
time range. The projection includes only published lessons/courses, rechecks
course access at release time, applies membership and read-window rules, and
deduplicates a lesson offered by multiple cohorts. The `.ics` response is
`private, no-store` so a later fetch observes token and membership changes.

The projection now includes published `CohortEvent` rows from the member's
active cohorts, bounded to the requested interval and checked against the
membership's join policy and read window. Drafts and archived events stay out
of both the planner and private `.ics` feed. All-day cohort events retain their
São Paulo calendar dates; the `.ics` serializer converts the inclusive end date
to the required exclusive `DTEND`. Management reads the 42-day visible grid in
database pages of 50. The management calendar route has its own 225 KiB
initial-JavaScript budget and measured 217.0 KiB gzip across 17 chunks. Cohort
meetings still need their own cohort-target and recurrence integration.

Activity deadlines, lesson releases, and student cohort events are currently
capped at 200 results per source without visible continuation; complete
pagination remains open. Multi-day events are projected across each day in the
visible planner range. With that layer included, the planner measured 223.9 KiB
gzip across 17 initial chunks against its 225 KiB budget. This is
bundle evidence only: authenticated database behavior, query latency, the ≤1 s
first-content p95, visual comparison, and mobile acceptance remain unverified
while local PostgreSQL QA is unavailable. Keep the shared ≤100 ms
interaction-feedback, ≤500 ms committed small-mutation, and ≤300 ms warmed
navigation budgets in force.

### Gestão: learning-path editor

`/gestao/ensino/cursos/percursos/[pathId]` rechecks `content.manage` on every
request and projects the path plus one 25-course page with module/lesson counts.
The path catalog uses a 24-row SQL page and an aggregate course count rather
than loading every associated course. Course count and the detail page are read
in SQL; adjacent courses at page boundaries are fetched by indexed position.
Moving a course revalidates the path, both
course versions, and adjacency inside one serializable transaction. The swap
uses a temporary position that cannot collide with the path's current minimum.
Writes use actor-scoped idempotency keys and record a `DomainEvent` in the same
transaction. Publishing, archiving, unpublishing, editing published metadata,
and reordering a published path require explicit confirmation in the UI and
are rechecked server-side. No schema migration is needed; existing
`LearningPath`, `Course.position`, and content authorization remain canonical.

The create and edit routes each have an explicit 225 KiB initial-JavaScript
budget. The production build measures the editor at 215.5 KiB gzip and the
create page at 215.4 KiB across 17 initial chunks each. The detail page now
offers eight candidates per SQL page; attach and detach reuse
the existing path/course models and verify versions, authorization, published
path confirmation, and idempotency in the write transaction. An isolated local
PostgreSQL QA session verified add, reload, confirmed removal, and reload with
the original association preserved. This does not establish real Clerk
behavior, authenticated latency percentiles, concurrency under representative
data, or visual/mobile acceptance; those gates remain open.

### Gestão exercise bank lists

The exercise bank catalog still reads 18 banks per SQL page and shows at most
20 list summaries on each card. The staff-only
`/gestao/ensino/exercicios/bancos/[bankId]` route provides the complete list
view with title/status filters, a 20-row database page, and aggregate counts.
Creating a list starts from its bank context, so the prior 200-bank
`<select>` cap is removed; after the transaction commits, the action counts
the bank's lists and returns to the last page containing the appended list.
Search, counts, and pagination remain server-side, and every request rechecks
`content.manage`.

The catalog, existing list editor, and bank-list detail route each have an
explicit 225 KiB initial-JavaScript budget. The local production build measured
all three at 212.4 KiB gzip across 17 chunks. This is bundle evidence only:
authenticated database latency, creation persistence, large-catalog QA,
concurrency, and visual/mobile comparison remain unverified.

### Gestão cohort calendar projections

The critical path rechecks the actor and cohort scope on the server, then
reads bounded projections for cohort events, targeted meetings, activity
deadlines and lesson releases. Calendar source reads cap at 501 rows per type
and expose a limit warning; the event editor list pages 50 rows in SQL.
Copy-source options are bounded and scoped. No persistent cache stores role,
membership or feed authorization. Calendar writes invalidate the cohort
calendar and planner after commit; pending controls respond immediately and
success is shown only after persistence.

Revocable ICS subscriptions store a token hash and recheck current member and
cohort access on every request, with private/no-store responses. Export caps
each source at 1001 rows and fails instead of silently exporting an incomplete
source. Agenda copy uses a serializable transaction, expected destination
version and an actor-scoped idempotency key. It copies at most 500 rows per
source and does not grant course access to copy lesson releases.

The production build measures the calendar at 220.9 KiB gzip and planner at
224.0 KiB, each across 17 chunks under the 225 KiB budget. Local QA confirmed
layer filtering and no horizontal overflow at 320, 390 and 1440 px. These
measurements do not establish database percentiles, representative-data
concurrency, real Clerk authentication or final visual acceptance.

Meeting reads now project publication/assignment dates and current cohort
membership metadata to enforce entry policy consistently in details, recordings,
planner occurrences and member ICS feeds. Planner reads the small membership
projection in parallel with its existing queries; it does not load lesson trees
or progress. Its candidate meeting cap remains 200 and filtering happens before
serialization. Authorization metadata is request-local. Publication invalidates
Encontros and Planejamento after commit; the feed remains private/no-store.
The refreshed production build measures calendar at 221.0 KiB and planner at
224.1 KiB gzip, each across 17 chunks below the 225 KiB budget. This does not
establish latency percentiles or representative concurrency.

Creating a meeting from a calendar day performs fresh actor/cohort checks,
then a serializable transaction with a cohort version check, canonical Meeting,
target and audit event. Replay reads a single actor/key candidate and its
cohort target plus audit fingerprint. No new list query or persistent cache
is added. Calendar/planner and Encontros invalidate after persistence.
The menu responds locally; the form disables immediately on submit and only
shows success after the committed response. The calendar retains its 225 KiB
gzip budget; final measurements are recorded in PROGRESS.md.

Gestão shell navigation opens rail submenus and the mobile drawer using local
state and existing design-system primitives. Its critical path adds no database
query, identity call, persistent cache or mutation. The authorized actor remains
the server layout's projection; destination routes/actions still authorize
independently. Rail destination links disable automatic prefetch. Lists retain
their existing SQL pagination; navigation itself has a fixed number of items.
Opening a menu does not invalidate data. Route navigation uses the existing
App Router behavior, and preserves the safe member return path. Local feedback
is immediate; drawer motion uses opacity/transform for 200 ms with reduced
motion supported. The shared 225 KiB route budget still applies.

Environment navigation shares the persistent shell controller. Its critical
path adds no identity/database request, persistent authorization cache or list
query. Native View Transitions snapshot the existing DOM; no duplicate React
tree runs effects or loads data. Only opacity/transform animate (400 ms entry,
300 ms return, 120 ms reduced; sidebar fade 240 ms). Unsupported snapshots use
CSS arrival. Feedback is local and does not wait for the route payload. A
12-second watchdog releases a stalled transition and exposes retry; successful
arrival is determined by the committed route, then the rendered heading.
The bounded navigation has no pagination or invalidation; destination data
keeps its existing projections, authorization and invalidation. The sanitized
return path is browser-tab session state keyed per actor. Local feedback/CLS
measurements are in the N2/N3 harness; they are not production percentiles.
