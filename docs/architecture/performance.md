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

## Interaction and navigation

Shared control and motion behavior is specified in
[`packages/design-system/PERFORMANCE.md`](../../packages/design-system/PERFORMANCE.md)
and enforced by the design system's reduced-motion stylesheet.

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
- Navigation feedback begins on primary activation and clears when the route
  changes, the activation is cancelled, or an explicit error is returned. A
  timeout is a final stale-state guard, not a completion signal.
- Keep transitions short and optional. Respect `prefers-reduced-motion`; never
  delay content merely to make a transition visible.

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
