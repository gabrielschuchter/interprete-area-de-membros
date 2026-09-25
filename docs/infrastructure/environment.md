# Infrastructure environment inventory

This inventory documents names and ownership only. It deliberately contains no
secret values, connection strings with passwords, tokens, or webhook signing
secrets.

## Source of truth

- PostgreSQL: Supabase project `wkclodjbrynerfgufmyb`, ref
  `wkclodjbrynerfgufmyb`, region `sa-east-1`.
- Runtime database access: `@repo/database` through Prisma and
  `@prisma/adapter-pg`; no Supabase client is required by the application.
- Authentication: Clerk development is used locally and a separate production
  instance is configured for the Interprete application. The embedded
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
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser SDK | app/API env file | Preview / Production | Yes | Clerk Dashboard, API keys |
| `CLERK_SECRET_KEY` | Clerk server SDK | app/API env file | Preview / Production | Yes | Clerk Dashboard, API keys |
| `CLERK_WEBHOOK_SIGNING_SECRET` | API Clerk webhook route | API env file | Preview / Production when webhook is enabled | Feature | Clerk Dashboard webhook endpoint |
| `SUPABASE_URL` | Server-side Storage signing | `apps/app/.env.local` | Preview / Production when private assets are enabled | Feature | Supabase project API settings |
| `SUPABASE_STORAGE_BUCKET` | Server-side Storage signing | `apps/app/.env.local` | Preview / Production when private assets are enabled | Feature | The private bucket name; current default is `learning-assets` |
| `SUPABASE_SECRET_KEY` | Server-side private Storage signing | `apps/app/.env.local` | Preview / Production when private assets are enabled | Feature | Supabase API settings; never expose to the browser |

`DATABASE_URL` is the transaction pooler URL for serverless runtime. `DIRECT_URL`
is the session pooler URL used by `packages/database/prisma.config.ts` for
migrations and introspection. The database password is not recoverable from the
Supabase dashboard after creation; resetting it is a coordinated credential
rotation and is not performed automatically.

`packages/database/ssl.ts` uses the bundled Supabase CA certificate at
`packages/database/certs/supabase-prod-ca-2021.crt` by default. A
`DATABASE_CA_CERT_PATH` override is available for environments that mount the
certificate elsewhere. TLS verification is not disabled.

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

The local runtime files do not use `SKIP_ENV_VALIDATION`; missing core values
must remain visible instead of being hidden by a build bypass. In the current
checkout, `apps/app/.env.local` and `packages/database/.env` contain database
placeholders, while `apps/api/.env.local` has no `DATABASE_URL`. The health
check and production build therefore correctly report the database as
unavailable until the official Supabase password is coordinated in all three
consumers. Private asset delivery additionally needs the server-only
`SUPABASE_SECRET_KEY`; the production app environment has the server-only
Storage configuration, but the secret is intentionally not present in the
repository. No Clerk secret, database value, Storage secret, or signed URL is
recorded here.

## Vercel projects

The existing API project is `interprete-area-de-membros-api` with root
directory `apps/api`. The member application should use a separate Vercel
project rooted at `apps/app`. Both projects must be linked to the same GitHub
repository and receive only the variables consumed by that root.

The API project is connected to the repository and the member-app project
exists with the correct `apps/app` root directory. Manual Production deploys
were attempted for both projects during the final checkpoint; neither reached
`READY` because Vercel correctly stops at the missing `DATABASE_URL` validation
gate. The production Clerk webhook endpoint is registered at the API route and
its signing secret is configured only in the API Production environment. No
Preview database is configured, intentionally avoiding accidental use of the
production database from preview builds.

Never create Vercel-native variables such as `VERCEL_URL` manually. Vercel
provides those automatically. Do not place database passwords, Clerk secrets,
service-role keys, or webhook secrets in Git, documentation, browser code, or
client-visible variables.
