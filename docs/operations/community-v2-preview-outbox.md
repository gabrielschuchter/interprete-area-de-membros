# Preview outbox scheduler

This workflow recovers only the namespaced Community V2 Preview queue. It does not change or call the Production cron. The previously recorded no-parallel-scheduler rule was explicitly revised by the user on 2026-10-15 to allow this separately scoped GitHub Actions scheduler; the GREEN Production cron remains in place for the legacy Production queue.

## Scope and guards

- Schedule: every five minutes, offset from the top of the hour. GitHub Actions schedules are best-effort and can be delayed or dropped, so this workflow must not be treated as a precise timer.
- Trigger: `schedule` only, on `main`; the job repeats those checks at runtime.
- Target: the current `codex/comunidade-v2` API Preview branch alias only, at `/cron/outbox`. The hostname is pinned in the workflow and fails closed if changed. Verify the branch alias after each new API Preview deployment before changing it.
- Vercel protection remains enabled. The workflow presents a short-lived GitHub OIDC token to Trusted Sources and the route's existing Bearer secret as separate checks.
- Job execution is serialized and limited to two minutes; no checkout, third-party action, repository write permission, response body, or OIDC token is logged.

## Required configuration before enabling

1. Create the GitHub Actions environment `community-v2-preview`, restrict deployments to the `main` branch, and add `PREVIEW_OUTBOX_CRON_SECRET` with the value already configured as `CRON_SECRET` for the Community V2 API Preview only. Do not use a Production secret.
2. In the API Vercel project's **Settings → Deployment Protection → Trusted Sources → External Services**, add GitHub Actions for account `gabrielschuchter` and repository `gabrielschuchter/interprete-area-de-membros`. Use raw claims to require all of:

   - `aud`: `https://github.com/gabrielschuchter`
   - `repository`: `gabrielschuchter/interprete-area-de-membros`
   - `ref`: `refs/heads/main`
   - `event_name`: `schedule`
   - `environment`: `community-v2-preview`
   - `workflow_ref`: `gabrielschuchter/interprete-area-de-membros/.github/workflows/community-v2-preview-outbox.yml@refs/heads/main`

   Apply the rule to the Vercel **Preview** environment only. Keep Vercel Authentication enabled for human access and leave Production outside this rule.
3. Merge the reviewed workflow before expecting scheduled runs. After the first run, verify the GitHub job is successful, the API request reached the branch Preview, and only `preview.*` outbox jobs were claimed. Observe repeated runs and a recovery case before using the scheduler as a Stage 01 gate.

To revoke this path, remove the GitHub Actions entry from the API project's Trusted Sources. Do not disable Vercel Authentication or change the Production cron as a workaround.

GitHub may automatically disable scheduled workflows in public repositories after 60 days without repository activity; monitor Actions status and re-enable through the repository settings if that occurs.
