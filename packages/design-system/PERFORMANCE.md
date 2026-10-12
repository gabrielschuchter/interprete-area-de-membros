# Interaction and motion guidance

The design system supports the member area's 100 ms feedback target. Every
control communicates activation immediately, including when its result depends
on a server request.

## Controls and actions

- Use the shared `Button` and input primitives so focus, contrast, disabled, and
  touch-target behavior stay consistent. Prefer the default 44 px button height
  for touch actions; compact controls must remain keyboard reachable.
- For server-action forms, use `useFormStatus` or `useActionState` to render a
  specific pending label or status as soon as submission starts. Disable only
  controls that conflict with that operation, and prevent duplicate submits.
- Expose status with `aria-live="polite"` or an appropriate status role. Keep
  focus stable and keep entered values when a request fails so the member can
  retry.
- Show success only after the primary write commits. Optimistic updates are
  reserved for reversible local changes and include authoritative
  reconciliation, rollback, idempotency, and protection from out-of-order
  responses.
- The profile editor validates on the server, keeps entered values after a
  validation response, and returns to the overview only after the profile
  transaction commits. Avatar upload has an independent pending state and
  blocks saving while the image is still transferring.
- A loading placeholder matches the final content's dimensions and is marked
  busy at the containing region. Replace it as soon as data is ready; do not
  hold ready content for an animation or minimum spinner duration.
- Dynamic links inside search, autocomplete, feeds, learning rails, and large
  card lists disable viewport prefetch. Only destinations reached by pointer or
  keyboard intent may prefetch, through the shared per-route request budget and
  network-preference checks.

## Library bookmark feedback

- `toast.library` is opt-in and leaves the existing toast API, placement, and
  timing unchanged for every other route. Its Library variant provides
  post-commit save/removal feedback, undo and saved-list actions, and a retry
  action for failed writes.
- The Library timer is five seconds and pauses independently while the notice
  contains keyboard focus or the pointer. Keep every action target at least
  44 px high; place the notice at the lower left on desktop and above the safe
  area on mobile.
- The bookmark control may show a reversible pending state while the server
  action runs. A failed or rejected mutation restores the previous state and
  exposes retry; a success toast follows the authorized, idempotent write.

## Exercise answer controls

- Keep answer feedback tied to the immutable session-question ID. When a
  response arrives after quick navigation, render it only on its matching
  question; never let a stale form state expose another question's answer or
  explanation.
- Preserve unsubmitted selections per question in session storage so question
  navigation and retry do not discard the draft. Clear a draft only after its
  answer commits or the member confirms leaving the session.
- Disable only the submitted fieldset while the answer is pending. Keep answer
  success/error status announced and retain the selected options after a network
  failure. Server correction remains authoritative for both single- and
  multiple-choice questions.
- On mobile, reserve space for the fixed bottom action and safe area, and use
  `visualViewport` to keep the action above the virtual keyboard. Focus the new
  question heading after navigation; desktop confirmation stays in document
  flow.
- Favorite toggles may respond optimistically because the state is reversible;
  reconcile with the server and roll back on failure. Keep the shared toast's
  undo action tied to the persisted mutation and expire it after five seconds.

## Profile badge artwork

- Show the local criterion artwork in a reserved 56 px box with `next/image`,
  `sizes="56px"`, and lazy loading. The adjacent medal title makes the image
  decorative, so its alt text stays empty.
- Use the bounded set of ten transparent 320 px WebP files (271,496 bytes
  total) rather than a request per award. Keep the criterion-to-image mapping
  local so repeated awards share browser and optimizer cache entries.

## Motion

- Keep motion short and use the shared `--motion-duration-fast`,
  `--motion-duration-normal`, and easing tokens for interaction feedback.
- Do not start route content hidden, stagger essential information, or use an
  animation as a substitute for loading feedback.
- Keep the designed animations, transitions, smooth scrolling, and hover
  movement active across devices by default. Do not query animation preferences
  or add CSS/utility variants that disable motion. Consider a device-specific
  simplification only after repeatable performance evidence identifies devices
  that cannot sustain the animation.
- Check keyboard activation, screen-reader status, touch targets, and motion
  behavior when changing a shared control or motion utility.

## Planner and study tools

- Keep calendar data bounded to the visible date range. Read the authenticated
  member's personal records separately from published meetings and assigned
  learning content; external layers remain read-only and link to their source.
- Route activity deadlines through `resolveCalendar` and the request-fresh
  learner-feed authorization, applying the selected range in SQL and honoring
  `availableAt`. The current 200-row assignment/candidate caps have no
  continuation UI; keep that acceptance gap visible. Tokenized `.ics` data must
  not be shared-cached so membership or token revocation takes effect on fetch.
- Use server projections and SQL pagination for notes. Return a short list
  preview, and fetch one TipTap document only after the member opens that note.
- Keep note edits local while typing, announce saving state, and report success
  only after the member-scoped write commits. Preserve the local draft and offer
  retry after a failed save.
- Render timer feedback immediately, then reconcile with server timestamps and
  session segments. Poll only while a timer is active and refresh on visibility
  changes; never advance elapsed time by counting interval callbacks.
- Keep one server-enforced active timer per member. A client timer is a display
  projection and must reconcile when another tab or device changes the session.
- Route calendar, notes, and timer transitions through the existing motion
  tokens; essential content stays visible without waiting for animation.

## Member shell and explicit stylesheet sources — 11/10/2026

- Keep the shell in a horizontal flex row with `min-w-0`; its desktop sidebar is sticky and viewport-height so content and the footer remain reachable.
- Both Tailwind entrypoints disable implicit recursive source discovery and retain explicit app/design-system sources. Local QA clones and build caches must not become CSS candidates.
- Portal transition hiding applies only to internal route containers. The portal itself remains visible while chrome is hidden. Keep the approved corridor timings and route-focus behavior.
- Notes and Community share TipTap state, serialization, links and media primitives while retaining their separate approved toolbars. Note-only extensions load on demand; TableKit supplies the complete table schema.
- The direct product decision removes reduced-motion branches; do not reintroduce them through upstream merges.

## Study composition and modal QA — 11/10/2026

- Estudar follows the handoff's next-step composition rather than metric cards. Keep its content narrow, its corridor illustration static, and authorized content visible immediately.
- Catalog and activity rows preserve database-driven availability, real progress and URL filters. Mobile catalog headings remain available to assistive technology.
- Sticky lesson/activity panels clear the full member header. Exercise subnavigation uses the same header height at all breakpoints.
- Fullscreen timer focus uses the shared Dialog with explicit zero translation; exit confirmation must appear above it and remain keyboard reachable. Keep focus mode available during an active session.
- Local viewport checks and bundle gates passed; device, full keyboard/screen-reader and percentile acceptance remain open.

- Dates rendered on both server and client must use an explicit member timezone and the same reference instant for relative labels. Never rely on the machine timezone for initial note rows or timer history.

- Drawer mode initialization must not undo user toggles. Save/restore the previous desktop preference on mode entry/exit, and test opening/reopening at portal and tablet breakpoints. Background browsers can pause CSS animation clocks; bring the QA browser to the foreground before measuring a settled frame instead of disabling motion.

- Hidden sidebar tooltips must not mount dismissable layers in expanded/mobile menus: they can intercept Escape from the drawer. Mount tooltips only on collapsed desktop menus; regression covers focused link and a single Escape.

- User-generated group headings must shrink inside flex layouts and wrap unbroken names/slugs at narrow widths. The 80-character boundary was verified in the isolated local database.

- Lifecycle disposal guards must reset during effect setup so React effect replay cannot silently disable autosave/publish. The composer regression uses StrictMode and checks both server actions.


## Gestão navigation and course surfaces

- The Gestão shell keeps its 264 px sidebar on wide desktop, a 72 px rail at
  intermediate desktop widths, and a mobile drawer. The active Ensino group
  exposes its five destination links; the course catalog uses database
  pagination and disables prefetch on each course editor destination.
- Catalog filters stay in the URL and are applied in SQL. Keep the result DTO
  limited to 25 courses, module/lesson counts, and three cohort labels at most.
  Do not add viewport prefetch to course cards or result rows.
- The new course form responds to validation locally, and its server action
  returns only after the existing authorized database write commits. Continue
  to measure first usable content, warmed navigation, and persisted mutation
  percentiles against the shared budgets; local and authenticated mobile
  measurements remain open.
- The Gestão course editor currently reuses the established course editor
  inside the new shell. Keep it behind the same server authorization and move
  its editor-specific controls into Gestão components before claiming visual
  acceptance.
- The Gestão exercise catalog pages 18 banks at a time and bounds nested list
  summaries to 20 per bank. A list detail pages 25 questions and applies text,
  category, and status filters in the database; category and reusable-question
  selectors are capped at 100 results. Keep all catalog and editor links
  without viewport prefetch. These are projection bounds, not measured latency
  evidence; local authenticated routes, large-catalog navigation, and database
  concurrency remain open acceptance checks.
- The current `exercises` bundle entry measures the student `/exercicios` route,
  not `/gestao/ensino/exercicios`; add an explicit Gestão entry before treating
  that route's JavaScript budget as measured. The new-list selector is capped
  at 200 banks, bank cards show 20 lists, and reusable/category selectors return
  at most 100 results, so complete large-catalog navigation remains open.
- Reusing a question pins its current immutable version in the selected list.
  Saving an edited version advances that list item only, leaving other list
  bindings and existing session snapshots stable. Adjacent reordering uses a
  serializable swap and a temporary unique position; verify concurrent edits
  and persisted results in the isolated local QA database.

## Gestão activity catalog and editor

- Keep the activity catalog on the server, with SQL filters and 20 rows per
  page. Aggregate submission counts only for the current page and scope
  teacher-visible member results to their active cohorts.
- Bound course, cohort, and library options to 200. Search individual students
  on demand with 20 results per page and a 250 ms debounce; do not prefetch
  every visible activity row or member option.
- Keep the rubric editor and member picker as the only interactive editor
  islands. Preview reads persisted activity state without learner progress
  writes. Show a successful save only after the serializable write and outbox
  commit.
- Cohort access is resolved at request time. Do not cache membership, role,
  target, revocation, or end-of-cohort results across requests. Preserve direct
  recipient grants separately from cohort targets.
- `/gestao/ensino/atividades` measured 212.3 KiB gzip across 17 chunks in the
  local production build, under its 225 KiB budget. Add entries for other
  Gestión routes before treating their bundles as measured. Authenticated
  latency, learner progress initialization for
  dynamic cohort assignments, and notifications for later eligible joins
  remain acceptance work. Use the shared budgets of ≤100 ms visible feedback,
  ≤1 s first usable content p95, ≤500 ms committed small-mutation p95, and
  ≤300 ms warmed navigation p95 until local measurements exist.

## Gestão correction queue

- `/gestao/alunos/correcoes` and the activity-specific delivery route authorize
  each request and scope teacher-visible work to their current active cohorts.
  Filters, counts, and 30-row pagination run in PostgreSQL; queue links do not
  prefetch on viewport.
- The review form submits submission timestamps plus draft/feedback versions.
  Stale submissions or concurrent reviews return a conflict. Drafts persist
  separately from learner-visible feedback; sending validates the comment and
  rubric scores, updates review state, and adds the notification to the
  transactional outbox before reporting success.
- Both routes now have 225 KiB gzip budget entries. Authenticated route
  percentiles, the measured bundle, and persisted concurrent-review behavior
  remain open until local PostgreSQL QA is available.

## Gestão library catalog and editor

- `/gestao/ensino/biblioteca` applies filters in PostgreSQL and returns 24
  materials per page with a minimal list/grid projection. Status counts are
  grouped in SQL; category, language, and collection options are capped at
  100, 50, and 100. Catalog links do not prefetch on viewport.
- Bulk actions accept no more than 100 unique materials. Adding selected items
  to a collection is serializable and skips existing links; success follows the
  committed write. Library creates use idempotency keys and begin as drafts.
- The route measured 214.2 KiB gzip across 17 chunks, below 225 KiB. This does
  not establish authenticated latency or persisted behavior; local database,
  Storage, concurrency, and visual acceptance remain open.
- Mutations revalidate the Gestión catalog, legacy admin catalog, and learner
  library; bulk collection writes also refresh collection and Aprender routes.
  Keep role, identity, and private asset results out of shared caches. Use the
  shared p95 targets (≤1 s first content, ≤500 ms committed small mutation,
  ≤300 ms warmed navigation) and ≤100 ms visible feedback; no authenticated
  measurement is available for this route yet.

## Gestão collection catalog, editor, and preview

- `/gestao/ensino/colecoes` filters and paginates in PostgreSQL at 24 rows per
  page. Resource search returns at most 20 results per type; editor and preview
  read at most 100 collection items. Do not prefetch catalog/editor links on
  viewport. Preview must stay read-only with respect to learner progress.
- Mutations carry an idempotency key and optimistic version. Add/remove checks
  the versioned update count inside a serializable transaction; audit events
  commit with the collection change. Private cover reads require ownership for
  drafts or a currently published, audience-visible collection for members.
- The production build measured 213.9 KiB gzip / 17 chunks for the catalog,
  218.5 KiB / 17 for the editor, and 211.9 KiB / 16 for preview, all under the
  225 KiB budget. These figures do not establish authenticated latency or
  database/Storage persistence. QA p95 targets remain ≤1 s first content,
  ≤500 ms committed small mutation, ≤300 ms warmed navigation, and ≤100 ms
  visible feedback; no authenticated measurements exist yet.

## Gestão lesson editor and publication

- Keep the lesson edit form and YouTube verification result local while the
  server checks the current video. Use explicit pending and error states; do
  not report a successful save or publication before the database commit.
- The editor preview must use the shared player with learner progress writes
  disabled. The publication action revalidates YouTube privacy and embedding
  on the server, checks the lesson version, and uses an idempotency key.
- Preserve the page's one-video projection and omit private Storage paths from
  client props. The route measured 218.1 KiB gzip across 17 initial chunks,
  under its 225 KiB budget. A passing bundle check does not prove authenticated
  latency or persistence.
- Provide specific pending labels and an announced publication error so the
  action responds immediately while the remote verification and write finish.

## Gestão YouTube playlist import

- The playlist dialog keeps the URL, current page, selection, target module,
  title choice, and publication state local. Default selection stops at 200
  importable videos per transaction; the user can deselect earlier items to
  choose later pages. Private or missing videos remain disabled, and selected
  public videos show a visibility warning.
- Let the dialog's focus management move focus to the first input and restore
  it to the trigger when closed. Keep row checkboxes, pagination, and both
  footer actions keyboard reachable, and announce pending, error, and
  post-commit success states.
- The server rechecks selected video metadata immediately before a write. A
  published import requires a published course and module and embeddable
  videos; a draft can preserve a public/unlisted video whose embedding is
  disabled. Lesson creation, audit, and published-lesson notifications commit
  atomically. The same idempotency key only replays the same import intent.
- The course editor measured 216.5 KiB gzip across 17 initial chunks in the
  local production build, below its 225 KiB route budget. Target ≤100 ms
  visible feedback and ≤500 ms small persisted mutation p95. Neither local
  authenticated latency nor YouTube/database-backed persistence and mobile
  visual acceptance has been measured yet.

## Learner video playback progress

- Keep `GET` and `PUT /api/learning/assets/[assetId]/progress` private and
  uncached, with current asset authorization on every request. The database
  projection is one member/asset progress row; persist only resume position,
  merged watched intervals, per-tab checkpoints, duration, and timestamps.
- Sample at player start, every 15 seconds, pause, and end. Use server receipt
  time and the reported playback rate (capped at 2x), reset a tab checkpoint
  after play/seek, reject jumps, and credit no more than the elapsed playback
  interval. Merge overlaps transactionally so simultaneous tabs cannot
  double-count. Never accept a client completion flag or position threshold.
- Clamp the 90% coverage denominator to verified asset/clip metadata when
  present. The player duration is currently the fallback when asset metadata
  is absent; completion remains a progress event and never grants access.
- Keep pending feedback immediate and report success only after the serializable
  write commits. The shared targets remain ≤100 ms visible feedback and
  ≤500 ms committed small-mutation p95. Neither authenticated latency nor
  database concurrency has been measured without the local QA database.
- The student `learning` route measured 208.6 KiB gzip across 16 initial
  chunks, below the 225 KiB budget. The additive progress migration is
  versioned but unapplied; persisted playback, two-tab database behavior, and
  device/visual acceptance remain open.

## Aprender activity feed: direct and cohort sources

- Keep the server projection private to the current member. Resolve only
  published activity cards reached by a current individual assignment or an
  active cohort target; apply `ALL_ACTIVE`/`FROM_JOIN`, cohort dates, assignment
  expiry, persisted submission status, deduplication, earliest deadline, and
  latest individual note before rendering.
- A page read must not create progress or mark an assignment complete. Feed
  cards should not prefetch every destination on viewport. Future individual
  assignments retain their disabled-until-available state.
- The current first tranche reads at most 100 individual activity assignments
  and 200 candidate activities. It has no visible continuation control, so
  larger-feed pagination remains acceptance work. Do not treat this cap as
  proof that every learner sees a complete feed.
- The route measured 208.6 KiB gzip across 16 initial chunks, below 225 KiB.
  Authenticated query latency and visual/mobile acceptance remain unmeasured;
  retain the shared targets of ≤100 ms visible feedback, ≤1 s first usable
  content p95, ≤500 ms committed small mutation p95, and ≤300 ms warmed
  navigation p95.

## Student calendar: activity deadlines and lesson releases

- Use the shared request-scoped `resolveCalendar` projection for the planner
  and private `.ics` feed. Resolve the member's active cohorts first, then
  query only their published lesson releases within the requested interval;
  recheck course access at release time and deduplicate a lesson across cohorts.
- The planner lets learners hide or show the “Aulas liberadas” layer. The
  `.ics` endpoint stays `private, no-store` so later fetches observe revoked
  membership and token changes.
- Published `CohortEvent` rows now join the member's active cohort calendar
  projection, subject to join policy and the cohort read window. Drafts and
  archived events remain private. All-day items preserve the São Paulo date in
  the private `.ics` feed, with an exclusive `DTEND`; management loads the
  visible 42-day range in database pages of 50. Cohort meetings still need
  cohort targets and recurrence integration.
- Activity deadlines, lesson releases, and student cohort events are still
  capped at 200 per source without continuation UI. The planner measured
  223.9 KiB gzip across 17 initial chunks, under its 225 KiB budget; multi-day
  events now appear on every day in the visible range. The management calendar
  route has a 225 KiB budget and measured 217.0 KiB across 17 chunks. This does
  not establish latency: authenticated query behavior, ≤1 s first usable
  content p95, visual/mobile QA, and the shared ≤100 ms feedback, ≤500 ms
  committed mutation, and ≤300 ms warmed navigation budgets remain unverified
  without local PostgreSQL QA.

## Gestão learning paths

- Keep path editing inside `/gestao`; every read and write requires fresh
  `content.manage` authorization. The catalog uses 24 SQL rows and an
  aggregate course count; the detail page reads one path and one 25-course SQL
  page with module/lesson counts, then queries only the adjacent course at a
  page boundary.
- Reorder adjacent courses with expected path/course versions, transactionally
  verified adjacency, a temporary unique position, an actor-scoped idempotency
  key, and an audit event in the same serializable transaction. Published path
  metadata, order, and status changes require explicit confirmation.
- The create and editor routes each have a 225 KiB gzip JavaScript budget.
  The current production build measures the editor at 215.5 KiB and create at
  215.4 KiB across 17 chunks each. The association picker pages 8 candidates
  from SQL; attach/detach recheck scope and versions in the write transaction,
  and published-path removal requires explicit confirmation, and submit buttons expose pending state while the transaction runs. Local PostgreSQL
  QA verified add/reload/remove/reload persistence using a development-only
  test session. Real Clerk behavior, latency percentiles, representative-data
  concurrency, and visual/mobile acceptance remain open gates.

## Gestão exercise bank lists

- The exercise catalog keeps its bank page at 18 rows and previews at most
  20 lists per bank. Every bank now has a staff-only detail route that searches
  and pages all its lists in PostgreSQL at 20 rows per page. List creation
  starts with a specific bank, so no capped global bank selector hides older
  records; after commit it returns to the page containing the appended list.
- The catalog, existing list editor, and bank-list route each have a 225 KiB
  gzip JavaScript budget. The current production build measures all three at
  212.4 KiB across 17 chunks. Authenticated query latency, persisted creation,
  large-catalog navigation, and visual/mobile comparison remain open until
  the isolated PostgreSQL QA environment is available.

## Gestão cohort calendar

- Month navigation, layer toggles and pending mutation controls give immediate
  feedback. Layer buttons expose `aria-pressed` within a named fieldset;
  filtering is local over the already authorized bounded projection.
- The month grid uses complete weeks (28, 35 or 42 cells). The month controls
  fit 320 px; local browser checks found no horizontal overflow at 320, 390
  and 1440 px. Native confirmation dialogs retain keyboard focus.
- Calendar initial JavaScript is 220.9 KiB gzip across 17 chunks, below the
  225 KiB budget. Planner is 224.0 KiB across 17 chunks. Saved local captures
  and functional QA are documented in PROGRESS.md; the complete width/role
  matrix, reduced-motion checks and visual acceptance remain open.

- The member sidebar separates its Clerk hook from the local QA view. The
  server chooses QA only in the guarded development runtime; local sign-out
  explains the server-controlled session without simulating successful logout.
  This fixes the observed QA render error; it is not real Clerk-flow evidence.
- After this change, the production bundle measures calendar at 221.0 KiB and
  planner at 224.1 KiB gzip (17 chunks each, 225 KiB budget). Restored admin QA
  captures at 1440 and 320 px show no document overflow; content truncation,
  layout differences and full keyboard acceptance remain open.
- Calendar-day meeting creation uses a local dropdown and native modal with
  title autofocus, pending controls and server-confirmed success. Twelve local
  captures cover six widths with normal/reduced motion; preset dates and Escape
  worked without document overflow. Full keyboard/focus-return and visual
  reference acceptance remain open. Final bundle numbers are in PROGRESS.md.
