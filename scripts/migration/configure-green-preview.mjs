import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { writeProtectedJson } from "./green-qa-ledger.mjs";
import { greenLocalEnvironment } from "./run-green-local.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const BRANCH = "codex/interprete-member-area-release-2026-10-04";
const TEAM = "team_CCjIuZlYnLPF0Bjgc74lGy9H";
const PROJECTS = {
  app: "prj_bwG8vDd4x2flyPaRMq8HEvi7t5Lj",
  api: "prj_LzsMnY95oPtOdp6KUwUaPRQ5lfh6",
};
const KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_CA_CERT",
  "DATABASE_CA_CERT_PATH",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_STORAGE_BUCKET",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_WEBHOOK_SIGNING_SECRET",
  "CLERK_PROXY_URL",
  "NEXT_PUBLIC_CLERK_PROXY_URL",
  "CLERK_FAPI",
  "NEXT_PUBLIC_CLERK_FAPI",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_API_URL",
  "CRON_SECRET",
  "RESEND_TOKEN",
  "RESEND_FROM",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SVIX_TOKEN",
  "SENTRY_AUTH_TOKEN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "BETTERSTACK_API_KEY",
  "ARCJET_KEY",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_GA_MEASUREMENT_ID",
  "SKIP_ENV_VALIDATION",
  "SEED_DEVELOPMENT_DATA",
];
const auth = JSON.parse(
  fs.readFileSync(
    path.join(process.env.APPDATA, "com.vercel.cli/Data/auth.json")
  )
);
const api = async (route, method, body) => {
  const response = await fetch(
    `https://api.vercel.com${route}${route.includes("?") ? "&" : "?"}teamId=${TEAM}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  );
  if (!response.ok) {
    const data = await response.json();
    const detail = String(data.error?.message ?? "")
      .replaceAll(body?.value || "__not_present__", "[value redacted]")
      .replace(/postgres(?:ql)?:\/\/\S+/gi, "[URI redacted]")
      .replace(/(?:sb_secret_|sk_test_|whsec_)[\w-]+/g, "[key redacted]");
    throw new Error(
      `Vercel ${method} ${body?.key ?? ""} failed HTTP ${response.status}, code ${data.error?.code ?? "unknown"}: ${detail.slice(0, 500)}`
    );
  }
  return response.json();
};
const fingerprint = (envs) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        envs
          .filter((e) => e.target.includes("production"))
          .sort((a, b) => a.id.localeCompare(b.id))
      )
    )
    .digest("hex");

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Each scoped env mutation and both Production invariants are intentionally checked in sequence.
const main = async () => {
  if (
    execFileSync("git", ["branch", "--show-current"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim() !== BRANCH
  ) {
    throw new Error("Wrong Preview branch.");
  }
  const projectData = {};
  for (const [name, id] of Object.entries(PROJECTS)) {
    const project = await api(`/v9/projects/${id}`);
    const { envs } = await api(`/v9/projects/${id}/env`);
    if (
      project.name !== `interprete-area-de-membros-${name}` ||
      project.rootDirectory !== `apps/${name}` ||
      project.targets.preview.meta.githubCommitRef !== BRANCH
    ) {
      throw new Error("Project ownership, root or Preview branch differs.");
    }
    projectData[name] = {
      project,
      envs,
      productionFingerprint: fingerprint(envs),
    };
  }
  const secure = path.join(
    process.env.LOCALAPPDATA,
    "Codex/migrations/interprete-supabase"
  );
  const before = path.join(secure, `vercel-preview-before-${Date.now()}.dpapi`);
  writeProtectedJson(before, projectData);
  const summaries = [];
  for (const [name, id] of Object.entries(PROJECTS)) {
    const data = projectData[name];
    const { env } = greenLocalEnvironment(name);
    env.DATABASE_CA_CERT = fs.readFileSync(env.DATABASE_CA_CERT_PATH, "utf8");
    env.DATABASE_CA_CERT_PATH = "";
    env.CLERK_WEBHOOK_SIGNING_SECRET = "";
    env.SEED_DEVELOPMENT_DATA = "false";
    env.NEXT_PUBLIC_APP_URL = `https://${projectData.app.project.targets.preview.meta.branchAlias}`;
    env.NEXT_PUBLIC_API_URL = `https://${projectData.api.project.targets.preview.meta.branchAlias}`;
    let changed = 0;
    for (const key of KEYS) {
      const value = env[key] ?? "";
      const existing = data.envs.filter(
        (e) => e.key === key && e.gitBranch === BRANCH
      );
      if (
        existing.length > 1 ||
        existing.some((e) => e.target.length !== 1 || e.target[0] !== "preview")
      ) {
        throw new Error("Unsafe env record scope.");
      }
      const payload = {
        key,
        value,
        type: "encrypted",
        target: ["preview"],
        gitBranch: BRANCH,
      };
      if (existing.length) {
        payload.type = existing[0].type;
      }
      if (process.argv.includes("--apply")) {
        if (existing.length) {
          await api(`/v9/projects/${id}/env/${existing[0].id}`, "PATCH", {
            value,
          });
        } else {
          await api(`/v10/projects/${id}/env`, "POST", payload);
        }
        changed++;
      }
    }
    const after = await api(`/v9/projects/${id}`);
    const { envs } = await api(`/v9/projects/${id}/env`);
    if (
      fingerprint(envs) !== data.productionFingerprint ||
      after.targets.production.id !== data.project.targets.production.id
    ) {
      throw new Error("Production invariant unexpectedly changed; stop.");
    }
    summaries.push({
      project: name,
      branch: BRANCH,
      plannedKeys: KEYS,
      changed,
      productionUnchanged: true,
      productionDeployment: after.targets.production.id,
    });
  }
  process.stdout.write(
    `${JSON.stringify({ ok: true, apply: process.argv.includes("--apply"), summaries, rollbackArtifact: before })}\n`
  );
};
main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ ok: false, error: error.message })}\n`
  );
  process.exitCode = 2;
});
