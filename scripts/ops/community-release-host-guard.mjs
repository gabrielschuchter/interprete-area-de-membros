#!/usr/bin/env node
// Dry-run by default. Staging and activation are separate explicit operations.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { writeProtectedJson } from "../migration/green-qa-ledger.mjs";

const TEAM_ID = "team_CCjIuZlYnLPF0Bjgc74lGy9H";
const PROJECTS = {
  app: {
    id: "prj_bwG8vDd4x2flyPaRMq8HEvi7t5Lj",
    aliases: [
      "interprete-area-de-membros.vercel.app",
      "interprete-area-de-membros-app.vercel.app",
    ],
  },
  api: {
    id: "prj_LzsMnY95oPtOdp6KUwUaPRQ5lfh6",
    aliases: ["interprete-area-de-membros-api.vercel.app"],
    previewAlias:
      "interprete-area-de-membro-git-afba70-gabrielschuchters-projects.vercel.app",
  },
};
const RULE_NAME = "Community V2 compatible release hosts";
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const HOST_PATTERN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
const DEPLOYMENT_ID_PATTERN = /^dpl_[A-Za-z0-9]+$/;
const TIMESTAMP_PUNCTUATION = /[^0-9TZ]/g;
const configMetadata = new Set([
  "id",
  "version",
  "updatedAt",
  "ownerId",
  "projectKey",
  "changes",
  "rules",
  "firewallEnabled",
]);
const canonical = (value) => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    );
  }
  return value ?? null;
};
const digest = (value) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
const fail = (message) => {
  throw new Error(message);
};

const { values } = parseArgs({
  options: {
    project: { type: "string" },
    deployment: { type: "string", multiple: true },
    "preview-deployment": { type: "string" },
    sha: { type: "string" },
    mode: { type: "string", default: "maintenance" },
    stage: { type: "boolean", default: false },
    activate: { type: "boolean", default: false },
    "confirm-digest": { type: "string" },
  },
});
const project = PROJECTS[values.project];
if (
  !(project && values.deployment?.length) ||
  values.deployment.length > 4 ||
  !SHA_PATTERN.test(values.sha ?? "") ||
  !["maintenance", "release"].includes(values.mode) ||
  (values["preview-deployment"] && !project.previewAlias) ||
  (values.stage && values.activate)
) {
  fail(
    "Required: --project app|api --deployment dpl_PRODUCTION [repeat up to four] --sha SHA40 --mode maintenance|release. API may explicitly select --preview-deployment dpl_PREVIEW at the same SHA. Optional: --stage or --activate, with --confirm-digest from the dry-run."
  );
}
const auth = JSON.parse(
  fs.readFileSync(
    path.join(process.env.APPDATA ?? "", "com.vercel.cli/Data/auth.json"),
    "utf8"
  )
);
if (!auth.token) {
  fail("Authenticated Vercel CLI session required.");
}
const query = new URLSearchParams({ projectId: project.id, teamId: TEAM_ID });
const configPath = `/v1/security/firewall/config?${query}`;
const scopedPath = (suffix) => `/v1/security/firewall/config${suffix}?${query}`;
const request = async (apiPath, method = "GET", body = undefined) => {
  const response = await fetch(`https://api.vercel.com${apiPath}`, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    fail(`Vercel ${method} ${apiPath.split("?")[0]}: HTTP ${response.status}`);
  }
  return response.json();
};

const validateDeployment = async (id, preview = false) => {
  if (!DEPLOYMENT_ID_PATTERN.test(id)) {
    fail("Only exact deployment IDs are accepted.");
  }
  const deployment = await request(`/v13/deployments/${id}?teamId=${TEAM_ID}`);
  const sha = deployment.meta?.githubCommitSha ?? deployment.gitSource?.sha;
  if (
    deployment.projectId !== project.id ||
    deployment.readyState !== "READY" ||
    sha !== values.sha ||
    !HOST_PATTERN.test(deployment.url ?? "") ||
    !deployment.url.endsWith(".vercel.app")
  ) {
    fail(
      "Deployment project, readiness, exact SHA or immutable hostname mismatch."
    );
  }
  if (preview) {
    if (
      deployment.target != null ||
      deployment.meta?.githubCommitRef !== "codex/comunidade-v2" ||
      !["OUTBOX_QUEUE_NAMESPACE", "OUTBOX_PREVIEW_MEMBER_IDS"].every((key) =>
        deployment.env?.includes(key)
      )
    ) {
      fail("Preview must be the V2 branch deployment with QA isolation keys.");
    }
  } else if (deployment.target !== "production") {
    fail(
      "Public release and fallback artifacts must use Production configuration."
    );
  }
  return { id, host: deployment.url.toLowerCase(), sha };
};

const validateAlias = async (host, deployments) => {
  const alias = await request(`/v4/aliases/${host}?teamId=${TEAM_ID}`);
  const deploymentId = alias.deploymentId ?? alias.deployment?.id;
  if (
    alias.projectId !== project.id ||
    !deployments.some((item) => item.id === deploymentId)
  ) {
    fail(
      "Each allowed alias must resolve to its explicitly selected artifact."
    );
  }
  return { host, deploymentId };
};

const otherRules = (config) =>
  (config?.rules ?? []).filter((rule) => rule.name !== RULE_NAME);
const ruleDefinition = ({
  name,
  description,
  active,
  conditionGroup,
  action,
}) => ({
  name,
  description,
  active,
  conditionGroup,
  action,
});
const verifyDraft = (active, draft, rule) => {
  const guards = (draft?.rules ?? []).filter((item) => item.name === RULE_NAME);
  if (
    !draft?.firewallEnabled ||
    guards.length !== 1 ||
    draft.rules[0]?.id !== guards[0].id ||
    digest(ruleDefinition(guards[0])) !== digest(rule) ||
    digest(otherRules(active)) !== digest(otherRules(draft))
  ) {
    fail("Draft does not contain the exact enabled first-priority host guard.");
  }
  for (const key of Object.keys(active ?? {})) {
    if (
      !configMetadata.has(key) &&
      digest(active[key]) !== digest(draft[key])
    ) {
      fail("Draft changes an unrelated existing firewall setting.");
    }
  }
};

const stageRule = async (configs, rule) => {
  if (configs.draft) {
    fail(
      "An existing draft must be reviewed separately; it will not be overwritten."
    );
  }
  const existing = configs.active?.rules.find(
    (item) => item.name === RULE_NAME
  );
  await request(scopedPath("/draft"), "PATCH", {
    action: existing ? "rules.update" : "rules.insert",
    id: existing?.id ?? null,
    value: rule,
  });
  let staged = await request(configPath);
  const guard = staged.draft?.rules?.find((item) => item.name === RULE_NAME);
  if (!guard?.id) {
    fail("Staged guard was not returned; nothing was activated.");
  }
  if (staged.draft.rules[0]?.id !== guard.id) {
    await request(scopedPath("/draft"), "PATCH", {
      action: "rules.priority",
      id: guard.id,
      value: 0,
    });
  }
  if (!staged.draft.firewallEnabled) {
    await request(scopedPath("/draft"), "PATCH", {
      action: "firewallEnabled",
      value: true,
    });
  }
  staged = await request(configPath);
  verifyDraft(configs.active, staged.draft, rule);
};

const main = async () => {
  const deployments = await Promise.all(
    [...new Set(values.deployment)].map((id) => validateDeployment(id))
  );
  const verifiedAliases = [];
  if (values["preview-deployment"]) {
    const preview = await validateDeployment(
      values["preview-deployment"],
      true
    );
    verifiedAliases.push(await validateAlias(project.previewAlias, [preview]));
    deployments.push(preview);
  }
  if (values.mode === "release") {
    verifiedAliases.push(
      ...(await Promise.all(
        project.aliases.map((host) =>
          validateAlias(
            host,
            deployments.filter(
              (item) => item.id !== values["preview-deployment"]
            )
          )
        )
      ))
    );
  }
  const hosts = [
    ...new Set([
      ...deployments.map((item) => item.host),
      ...verifiedAliases.map((item) => item.host),
    ]),
  ].sort();
  const rule = {
    name: RULE_NAME,
    description:
      "Release safety: reject all hosts except explicitly verified compatible artifacts.",
    active: true,
    conditionGroup: [
      { conditions: [{ type: "host", op: "ninc", value: hosts }] },
    ],
    action: { mitigate: { action: "deny" } },
  };
  const configs = await request(configPath);
  const active = configs.active;
  const rules = active?.rules ?? [];
  if (rules.filter((item) => item.name === RULE_NAME).length > 1) {
    fail("Duplicate host guard rules require review.");
  }
  if (otherRules(active).length >= 3) {
    fail("Hobby custom-rule capacity exhausted; preserve existing rules.");
  }
  const planDigest = digest({ project: project.id, active, rule });
  let operation = "dry-run";
  if (values.stage) {
    operation = "stage";
  } else if (values.activate) {
    operation = "activate";
  }
  console.log(
    JSON.stringify({
      project: project.id,
      mode: values.mode,
      operation,
      verifiedDeployments: deployments,
      verifiedAliases,
      rule,
      activeRules: rules.length,
      existingDraft: Boolean(configs.draft),
      planDigest,
      productionMutationRequested: values.activate,
      remoteMutationPerformed: false,
    })
  );
  if (!(values.stage || values.activate)) {
    return;
  }
  if (values["confirm-digest"] !== planDigest) {
    fail(
      "Reviewed dry-run digest differs; inspect the current plan before mutation."
    );
  }
  const secure = path.join(
    process.env.LOCALAPPDATA ?? "",
    "Codex/migrations/interprete-supabase"
  );
  const stamp = new Date().toISOString().replace(TIMESTAMP_PUNCTUATION, "");
  writeProtectedJson(
    path.join(secure, `community-host-guard-${values.project}-${stamp}.dpapi`),
    { project: project.id, configs, deployments, rule, planDigest }
  );
  if (values.stage) {
    await stageRule(configs, rule);
    console.log(JSON.stringify({ staged: true, activated: false, planDigest }));
    return;
  }
  verifyDraft(active, configs.draft, rule);
  const version = configs.draft.version;
  if (!Number.isInteger(version)) {
    fail("A stable numeric draft version is required for activation.");
  }
  await request(scopedPath(`/${version}/activate`), "POST", {});
  const activated = await request(configPath);
  verifyDraft(active, activated.active, rule);
  console.log(
    JSON.stringify({ activated: true, activeVersion: activated.active.version })
  );
};

main().catch((error) => {
  console.error(JSON.stringify({ failed: true, reason: error.message }));
  process.exitCode = 1;
});
