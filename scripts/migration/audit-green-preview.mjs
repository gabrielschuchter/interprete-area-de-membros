import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readProtectedJson, writeProtectedJson } from "./green-qa-ledger.mjs";

const TEAM = "team_CCjIuZlYnLPF0Bjgc74lGy9H";
const BRANCH = "codex/interprete-member-area-release-2026-10-04";
const BASELINE_FILE = /^vercel-preview-before-\d+\.dpapi$/;
const PROJECTS = {
  app: ["prj_bwG8vDd4x2flyPaRMq8HEvi7t5Lj", "dpl_Bga3GrvXeDF6UpFqvi7sCs9wcwLU"],
  api: ["prj_LzsMnY95oPtOdp6KUwUaPRQ5lfh6", "dpl_9EbMWZA5Ecm6C7KJzEvqMnAxeDup"],
};
const secure = path.join(
  process.env.LOCALAPPDATA,
  "Codex/migrations/interprete-supabase"
);
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
const auth = JSON.parse(
  fs.readFileSync(
    path.join(process.env.APPDATA, "com.vercel.cli/Data/auth.json")
  )
);
const get = async (route) => {
  const response = await fetch(
    `https://api.vercel.com${route}?teamId=${TEAM}`,
    { headers: { Authorization: `Bearer ${auth.token}` } }
  );
  if (!response.ok) {
    throw new Error(`Read-only Vercel audit failed HTTP ${response.status}.`);
  }
  return response.json();
};

const main = async () => {
  const files = fs
    .readdirSync(secure)
    .filter((file) => BASELINE_FILE.test(file))
    .sort();
  if (!files.length) {
    throw new Error("Protected Production baseline is absent.");
  }
  const before = readProtectedJson(path.join(secure, files[0]));
  const projects = [];
  for (const [name, [id, deploymentId]] of Object.entries(PROJECTS)) {
    const project = await get(`/v9/projects/${id}`);
    const { envs } = await get(`/v9/projects/${id}/env`);
    const deployment = await get(`/v13/deployments/${deploymentId}`);
    const scoped = envs.filter((e) => e.gitBranch === BRANCH);
    const productionUnchanged =
      before[name].productionFingerprint === fingerprint(envs) &&
      before[name].project.targets.production.id ===
        project.targets.production.id;
    const previewScopeSafe =
      scoped.length === 38 &&
      scoped.every((e) => e.target.length === 1 && e.target[0] === "preview");
    const deploymentMatches =
      deployment.target === null &&
      deployment.projectId === id &&
      deployment.meta.githubCommitRef === BRANCH &&
      deployment.readyState === "READY";
    projects.push({
      project: name,
      productionUnchanged,
      productionDeployment: project.targets.production.id,
      previewScopeSafe,
      previewOverrideCount: scoped.length,
      previewDeployment: deploymentId,
      previewUrl: `https://${deployment.url}`,
      deploymentMatches,
      protectionBypassCount: Object.keys(project.protectionBypass ?? {}).length,
      previewLegacyReferencesVisibleInMetadata: scoped
        .filter((e) => String(e.value ?? "").includes("wkclodjbrynerfgufmyb"))
        .map((e) => e.key),
    });
  }
  const report = {
    readOnly: true,
    checkedAt: new Date().toISOString(),
    projects,
    ok: projects.every(
      (p) =>
        p.productionUnchanged &&
        p.previewScopeSafe &&
        p.deploymentMatches &&
        p.previewLegacyReferencesVisibleInMetadata.length === 0
    ),
  };
  writeProtectedJson(
    path.join(secure, "green-preview-config-audit.dpapi"),
    report
  );
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (!report.ok) {
    process.exitCode = 1;
  }
};
main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ ok: false, error: error.message })}\n`
  );
  process.exitCode = 2;
});
