# Infrastructure environment inventory

This inventory documents names and ownership only. It deliberately contains no
secret values, connection strings with passwords, tokens, or webhook signing
secrets.

## Source of truth

- PostgreSQL: Supabase project `wkclodjbrynerfgufmyb`, ref
  `wkclodjbrynerfgufmyb`, region `sa-east-1`.
- Database access: `@repo/database` through Prisma and `@prisma/adapter-pg`.
  The app also uses `@supabase/supabase-js` only for Realtime; private Storage
  operations use server-side HTTP calls. It does not use Supabase Auth sessions.
- Authentication: a dedicated Clerk Development instance is required locally,
  and a separate Production instance is configured for the Interprete
  application. The embedded
  components use the `ptBR` localization from
  `@clerk/localizations` and the shared Interprete appearance from
  `@repo/auth/appearance`.
- Deployments: Vercel projects linked to
  `gabrielschuchter/interprete-area-de-membros`.

## Core variables

| Variable | Consumer | Local source | Preview / Production | Required | Obtain or rotate at |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | `apps/app`, `apps/api`, `@repo/database` runtime | `apps/*/.env.local` | Vercel project environments | Yes | Supabase Connect, transaction pooler (`6543`) |
| `DIRECT_URL` | Prisma CLI and migrations | `packages/database/.env` | Normally not set; add only where Prisma CLI runs | Yes for Prisma CLI | Supabase Connect, session pooler (`5432`) |
| `DATABASE_CA_CERT_PATH` | Prisma/PostgreSQL TLS verification | `packages/database/.env` when overriding the bundled certificate | Add only when the platform needs an explicit CA path | Optional | Supabase Database settings, CA certificate |
| `NEXT_PUBLIC_APP_URL` | Next config and metadata | app/API env file | Per Vercel environment | Yes | The current app origin for that environment |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser SDK | app/API env file | Development locally; Preview / Production in Vercel | Yes | Clerk Dashboard, matching instance API keys |
| `CLERK_SECRET_KEY` | Clerk server SDK | app/API env file | Development locally; Preview / Production in Vercel | Yes | Clerk Dashboard, matching instance API keys |
| `CLERK_WEBHOOK_SIGNING_SECRET` | API Clerk webhook route | API env file | Preview / Production when webhook is enabled | Feature | Clerk Dashboard webhook endpoint |
| `SUPABASE_URL` | Server-side Storage signing | `apps/app/.env.local` | Preview / Production when private assets are enabled | Feature | Supabase project API settings |
| `SUPABASE_STORAGE_BUCKET` | Server-side Storage signing | `apps/app/.env.local` | Preview / Production when private assets are enabled | Feature | The private bucket name; current default is `learning-assets` |
| `SUPABASE_PUBLISHABLE_KEY` | Clerk-authenticated Realtime configuration endpoint | `apps/app/.env.local` | Preview / Production when Realtime is enabled | Feature | Supabase API Keys; public key, never a service-role credential |
| `SUPABASE_SECRET_KEY` | Server-side private Storage signing | `apps/app/.env.local` | Preview / Production when private assets are enabled | Feature | Supabase API settings; never expose to the browser |
| `CRON_SECRET` | Scheduled routes in `apps/app` and `apps/api` | Each app's `.env.local` | Vercel Production environments | Feature | Generate at least 32 characters; keep the API value synchronized with Supabase Vault |

`DATABASE_URL` is the transaction pooler URL for serverless runtime. `DIRECT_URL`
is the session pooler URL used by `packages/database/prisma.config.ts` for
migrations and introspection. The database password is not recoverable from the
Supabase dashboard after creation; resetting it is a coordinated credential
rotation and is not performed automatically.

`prisma.config.ts` enforces `sslmode=verify-full` and the bundled Supabase CA
for Prisma CLI connections, even if a copied connection string contains a
weaker SSL mode. `@supabase/ssr` and `@supabase/server` are not required for the
current application: the Supabase quickstart's cookie/session middleware and
Supabase Auth examples would introduce a second authentication system. Clerk
remains the identity source; the Realtime client receives a Clerk session token
from the authenticated server route.

`packages/database/ssl.ts` uses the bundled Supabase CA certificate at
`packages/database/certs/supabase-prod-ca-2021.crt` by default. A
`DATABASE_CA_CERT_PATH` override is available for environments that mount the
certificate elsewhere. TLS verification is not disabled.

For local sign-in, configure the matching `pk_test_` and `sk_test_` keys from
the Clerk Development instance in both `apps/app/.env.local` and, when running
the local API, `apps/api/.env.local`. The app's local development setup uses
the Development Frontend API directly: leave `CLERK_PROXY_URL`,
`NEXT_PUBLIC_CLERK_PROXY_URL`, `CLERK_FAPI`, and `NEXT_PUBLIC_CLERK_FAPI`
unset. The local development guard rejects Production keys and environment
overrides that would route Development credentials through the Production
proxy. Production continues to use the same-origin `/__clerk` proxy.

The local `dev` scripts start Bun with `--use-system-ca`, so Windows uses its
trusted operating-system CA store for outbound Clerk requests. This preserves
certificate verification; it does not disable TLS. When invoking Next.js
outside these scripts on Windows, pass `--use-system-ca` to Bun or set
`BUN_OPTIONS=--use-system-ca` for that command.
An already-running Next.js/Bun process does not adopt changed startup flags;
after changing this configuration, stop and restart the local dev server, then
confirm the new Bun process was launched with system CA support.

## Optional or dormant variables

| Group | Variables | Status | Reason |
| --- | --- | --- | --- |
| Analytics | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Optional | The adapters are present but no provider is required for member-area operation. |
| Observability | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `BETTERSTACK_API_KEY`, `BETTERSTACK_URL` | Optional | The integrations are safe when configured, but absent values do not block the product. |
| Security | `ARCJET_KEY` | Optional | Arcjet protection is conditional; the app remains functional without a key. |
| Email | `RESEND_TOKEN`, `RESEND_FROM` | Dormant | No current member-area flow sends email. |
| Storage | `BLOB_READ_WRITE_TOKEN` | Dormant | Kiwify learning assets use the private Supabase Storage bucket instead; no current flow uses Vercel Blob uploads. |
| Payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Dormant | The payments webhook is retained as starter infrastructure, not an active product flow. |
| Legacy webhook | `CLERK_WEBHOOK_SECRET` | Removed | The application uses the canonical `CLERK_WEBHOOK_SIGNING_SECRET` name. |
| Legacy Clerk alias | `CLERK_PUBLISHABLE_KEY` | Unused | The application consumes `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. |

## Local files

- `apps/app/.env.local`: member-area Next.js runtime.
- `apps/api/.env.local`: API/webhook Next.js runtime.
- `packages/database/.env`: Prisma CLI configuration loaded by
  `prisma.config.ts` via `dotenv/config`; this is the only local source for
  `DIRECT_URL`.
- Root `.env.local` is not a supported application source and should not be
  used for new variables.

Run `bun env:check` to check names, prefixes, URL syntax, and placeholders
without printing values. The command intentionally cannot prove a remote
connection; use Prisma commands for that.

The durable notification worker reads the API project's `CRON_SECRET`. Store
the same value as the Supabase Vault secret `interprete_member_outbox_secret`
and store the production API `/cron/outbox` URL as
`interprete_member_outbox_url`. The idempotent schedule setup is in
`docs/deployment/supabase-outbox-cron.sql`; it contains secret names only.

The local runtime files do not use `SKIP_ENV_VALIDATION`; missing core values
must remain visible instead of being hidden by a build bypass. At the latest
local checkpoint, `bun run env:check` reports the app, API and database URLs as
present and syntactically valid without printing values. A read-only
`prisma migrate status` connected through the configured `DIRECT_URL`, proving
that the local Prisma CLI can reach the official PostgreSQL endpoint. The API's
read-only deep health check also returned `database: ok` after `SELECT 1` through
the runtime URL. This proves basic SQL reachability only, not feature reads,
write safety or release readiness. Supabase currently reports all services
restricted under quota/Fair Use and may return HTTP 402. Do not apply migrations,
seeds or product writes until that restriction is cleared and the environment
is rechecked. Private asset delivery additionally needs the server-only
`SUPABASE_SECRET_KEY`; no Clerk secret, database value, Storage secret, or
signed URL is recorded here.

The local app and API `.env.local` files previously contained Production
Clerk API keys. A legacy `pk_test_`/`sk_test_` pair in the workspace-root
`.env.local` was checked with read-only Clerk API requests: the secret belongs
to a Development instance, the public key's encoded FAPI matches that
instance's domain, and the instance is in the same Clerk workspace as the
Interprete Production instance. That matched pair was copied into the supported
app/API environment files. No key values are recorded here. The app-local
`NEXT_PUBLIC_CLERK_PROXY_URL` that pointed to the Production Vercel origin was
removed because Clerk Next.js uses it as a fallback when no `proxyUrl` prop is
passed. Local development now refuses Production keys, mismatched environment
prefixes, and FAPI/proxy overrides with Development keys.

The local 502 was reproduced at `GET /__clerk/npm/@clerk/clerk-js@6/dist/clerk.browser.js`.
The Next.js proxy returned `502 proxy_request_failed` with the upstream TLS
error `unable to verify the first certificate`; the request failed during
certificate verification, before an upstream HTTP response existed. A direct
Bun request to Clerk's public Frontend API reproduces the same TLS error by
default and succeeds with `bun --use-system-ca`. Clerk middleware did not emit
a separate server log line, so the sanitized 502 body was the available error
detail. The dev scripts now enable the system CA without disabling TLS. With
the verified Development pair, the browser loads ClerkJS directly from the
`accounts.dev` Frontend API and the sign-in/sign-up surfaces render without a
proxy 502. Protected `/aprender` redirects to sign-in with its return URL.
Authenticated database flows remain unavailable while Supabase is under the
reported quota/Fair Use restriction.

## Vercel projects

The existing API project is `interprete-area-de-membros-api` with root
directory `apps/api`. The member application should use a separate Vercel
project rooted at `apps/app`. Both projects must be linked to the same GitHub
repository and receive only the variables consumed by that root.

The API project is connected to the repository and the member-app project
exists with the correct `apps/app` root directory. Earlier Production deploy
attempts stopped at environment validation; the current Vercel environment and
deployment status were not rechecked in this local-only run. Do not infer that
the current blocker is a missing database URL from that historical result. The
production Clerk webhook endpoint was previously registered at the API route;
no Preview database is configured, avoiding accidental use of production data
from preview builds.

Never create Vercel-native variables such as `VERCEL_URL` manually. Vercel
provides those automatically. Do not place database passwords, Clerk secrets,
service-role keys, or webhook secrets in Git, documentation, browser code, or
client-visible variables.
