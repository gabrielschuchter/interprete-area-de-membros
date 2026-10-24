# Preview outbox scheduler

This workflow recovers only the namespaced Community V2 Preview queue. It does not change or call the Production cron. The previously recorded no-parallel-scheduler rule was explicitly revised by the user on 2026-10-15 to allow this separately scoped GitHub Actions scheduler; the GREEN Production cron remains in place for the legacy Production queue.

## Scope and guards

- Schedule: every five minutes, offset from the top of the hour. GitHub Actions schedules are best-effort and can be delayed or dropped, so this workflow must not be treated as a precise timer.
- Trigger: `schedule` only, on `main`; the job repeats those checks at runtime.
- Target: the current `codex/comunidade-v2` API Preview branch alias only, at `/cron/outbox`. The hostname is pinned in the workflow and fails closed if changed. Verify the branch alias after each new API Preview deployment before changing it.
- Vercel protection remains enabled. The workflow presents a short-lived GitHub OIDC token to Trusted Sources and the route's existing Bearer secret as separate checks.
- Job execution is serialized and limited to two minutes; no checkout, third-party action, repository write permission, response body, or OIDC token is logged.

## Configuration applied — 2026-10-15

- The GitHub Actions environment `community-v2-preview` exists and permits exactly the `main` branch (one branch, no tags). Its environment secret `PREVIEW_OUTBOX_CRON_SECRET` was populated from `CRON_SECRET` configured only for the API Preview branch `codex/comunidade-v2`; the value is not recorded here. Production secrets and environments were not changed.
- The Vercel API project `interprete-area-de-membros-api` now trusts the GitHub OIDC issuer with `aud`, `repository`, `ref`, `event_name`, `workflow_ref`, `environment`, and `sub` restricted to this repository, `main`, `schedule`, this workflow file, and `community-v2-preview`. The rule grants access to Vercel Preview only. Vercel Authentication (`Require Log In`) remains enabled.
- Settings were verified in the GitHub environment page and the Vercel Deployment Protection page. The workflow PR is still separate from `main`; no scheduled run has occurred yet.

## Activation and acceptance

Merge the reviewed workflow to `main` before expecting scheduled runs. After integration, verify a successful GitHub job, that the API request reached the branch Preview, and that it claims only `preview.*` outbox jobs. Observe repeated runs and a real recovery case before using the scheduler as a Stage 01 gate. GitHub schedules are best-effort and may be delayed or dropped.

To revoke this path, remove the GitHub Actions entry from the API project Trusted Sources. Do not disable Vercel Authentication or change the Production cron as a workaround.

GitHub may automatically disable scheduled workflows in public repositories after 60 days without repository activity; monitor Actions status and re-enable through the repository settings if that occurs.
