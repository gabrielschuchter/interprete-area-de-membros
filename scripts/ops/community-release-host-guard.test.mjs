import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "community-host-guard-")
);
const preload = path.join(directory, "mock-api.mjs");
const script = fileURLToPath(
  new URL("./community-release-host-guard.mjs", import.meta.url)
);
const sha = "a".repeat(40);
const appId = "prj_bwG8vDd4x2flyPaRMq8HEvi7t5Lj";
const apiId = "prj_LzsMnY95oPtOdp6KUwUaPRQ5lfh6";
const appAliases = [
  "membros.escolainterprete.com.br",
  "interprete-area-de-membros.vercel.app",
  "interprete-area-de-membros-app.vercel.app",
];
const appCanonical = "membros.escolainterprete.com.br";
const appRollbackAliases = [
  "interprete-area-de-membros.vercel.app",
  "interprete-area-de-membros-app.vercel.app",
];
const previewAlias =
  "interprete-area-de-membro-git-afba70-gabrielschuchters-projects.vercel.app";

fs.writeFileSync(
  preload,
  `import fs from "node:fs";
const configuration = JSON.parse(process.env.GUARD_TEST_CASE);
const originalRead = fs.readFileSync;
fs.readFileSync = function(file, ...options) {
  if (String(file).replaceAll("\\\\", "/").endsWith("com.vercel.cli/Data/auth.json")) {
    return JSON.stringify({ token: "isolated-mock-token" });
  }
  return originalRead.call(fs, file, ...options);
};
globalThis.fetch = async (input, options) => {
  if (options.method !== "GET") throw new Error("Mutation forbidden in alias regression test");
  const url = new URL(input);
  let result;
  if (url.pathname.startsWith("/v13/deployments/")) {
    result = configuration.deployments[url.pathname.split("/").at(-1)];
  } else if (url.pathname.startsWith("/v4/aliases/")) {
    result = configuration.aliases[url.pathname.split("/").at(-1)];
  } else if (url.pathname === "/v1/security/firewall/config") {
    result = { active: null, draft: null };
  }
  if (!result) throw new Error("Unexpected isolated API request");
  return new Response(JSON.stringify(result), { status: 200 });
};
`
);

after(() => {
  fs.unlinkSync(preload);
  fs.rmdirSync(directory);
});

const deployment = (projectId, target = "production") => ({
  projectId,
  readyState: "READY",
  meta: { githubCommitSha: sha, githubCommitRef: "codex/comunidade-v2" },
  target,
  url: `${target === null ? "preview" : "production"}.vercel.app`,
  env: ["OUTBOX_QUEUE_NAMESPACE", "OUTBOX_PREVIEW_MEMBER_IDS"],
});
const alias = (projectId, deploymentId) => ({ projectId, deploymentId });
const run = (project, mode, configuration, additional = []) => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      pathToFileURL(preload).href,
      script,
      "--project",
      project,
      "--deployment",
      "dpl_Production",
      "--sha",
      sha,
      "--mode",
      mode,
      ...additional,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, GUARD_TEST_CASE: JSON.stringify(configuration) },
      timeout: 20_000,
      windowsHide: true,
    }
  );
  return {
    status: result.status,
    output: result.stdout.trim() ? JSON.parse(result.stdout.trim()) : undefined,
    failure: result.stderr,
  };
};

const appConfiguration = () => ({
  deployments: { dpl_Production: deployment(appId) },
  aliases: Object.fromEntries(
    appAliases.map((host) => [host, alias(appId, "dpl_Production")])
  ),
});
const apiConfiguration = () => ({
  deployments: {
    dpl_Production: deployment(apiId),
    dpl_Preview: deployment(apiId, null),
  },
  aliases: {
    "interprete-area-de-membros-api.vercel.app": alias(apiId, "dpl_Production"),
    [previewAlias]: alias(apiId, "dpl_Preview"),
  },
});

test("release keeps all verified App public aliases usable", () => {
  const result = run("app", "release", appConfiguration());
  assert.equal(result.status, 0, result.failure);
  assert.deepEqual(
    result.output.verifiedAliases.map((item) => item.host),
    appAliases
  );
  assert.deepEqual(
    result.output.rule.conditionGroup[0].conditions[0].value,
    [...appAliases, "production.vercel.app"].sort()
  );
});

test("one stale App public alias rejects the release instead of allowing an old reader", () => {
  const configuration = appConfiguration();
  configuration.aliases[appAliases[0]].deploymentId = "dpl_Old";
  const result = run("app", "release", configuration);
  assert.equal(result.status, 1);
  assert.ok(result.failure.includes("Each allowed alias"));
});

test("maintenance excludes all App public aliases", () => {
  const result = run("app", "maintenance", appConfiguration());
  assert.equal(result.status, 0, result.failure);
  assert.deepEqual(result.output.verifiedAliases, []);
  assert.deepEqual(result.output.rule.conditionGroup[0].conditions[0].value, [
    "production.vercel.app",
  ]);
});

test("transition keeps the previous App aliases while opening the canonical candidate", () => {
  const configuration = {
    deployments: {
      dpl_Production: deployment(appId),
      dpl_Rollback: {
        ...deployment(appId),
        meta: {
          githubCommitSha: "b".repeat(40),
          githubCommitRef: "main",
        },
        url: "previous-production.vercel.app",
      },
    },
    aliases: {
      [appCanonical]: alias(appId, "dpl_Production"),
      ...Object.fromEntries(
        appRollbackAliases.map((host) => [host, alias(appId, "dpl_Rollback")])
      ),
    },
  };
  const result = run("app", "transition", configuration, [
    "--rollback-deployment",
    "dpl_Rollback",
  ]);
  assert.equal(result.status, 0, result.failure);
  assert.deepEqual(
    result.output.verifiedAliases.map((item) => [item.host, item.deploymentId]),
    [
      [appCanonical, "dpl_Production"],
      ...appRollbackAliases.map((host) => [host, "dpl_Rollback"]),
    ]
  );
  assert.deepEqual(
    result.output.rule.conditionGroup[0].conditions[0].value,
    [
      appCanonical,
      ...appRollbackAliases,
      "production.vercel.app",
      "previous-production.vercel.app",
    ].sort()
  );
});

test("transition rejects stale canonical or legacy alias assignments", () => {
  const configuration = {
    deployments: {
      dpl_Production: deployment(appId),
      dpl_Rollback: {
        ...deployment(appId),
        meta: { githubCommitSha: "b".repeat(40) },
        url: "previous-production.vercel.app",
      },
    },
    aliases: {
      [appCanonical]: alias(appId, "dpl_Production"),
      ...Object.fromEntries(
        appRollbackAliases.map((host) => [host, alias(appId, "dpl_Rollback")])
      ),
    },
  };
  configuration.aliases[appCanonical].deploymentId = "dpl_Rollback";
  const staleCanonical = run("app", "transition", configuration, [
    "--rollback-deployment",
    "dpl_Rollback",
  ]);
  assert.equal(staleCanonical.status, 1);
  assert.ok(staleCanonical.failure.includes("Each allowed alias"));

  configuration.aliases[appCanonical].deploymentId = "dpl_Production";
  configuration.aliases[appRollbackAliases[0]].deploymentId = "dpl_Production";
  const staleLegacy = run("app", "transition", configuration, [
    "--rollback-deployment",
    "dpl_Rollback",
  ]);
  assert.equal(staleLegacy.status, 1);
  assert.ok(staleLegacy.failure.includes("Each allowed alias"));
});

test("transition mode cannot be used for the API project", () => {
  const result = run("api", "transition", apiConfiguration(), [
    "--rollback-deployment",
    "dpl_Preview",
  ]);
  assert.equal(result.status, 1);
  assert.ok(result.failure.includes("Transition is App-only"));
});

test("the Preview hop alias requires an explicit compatible Preview selection", () => {
  const configuration = apiConfiguration();
  const withoutPreview = run("api", "release", configuration);
  assert.equal(withoutPreview.status, 0, withoutPreview.failure);
  assert.equal(
    withoutPreview.output.rule.conditionGroup[0].conditions[0].value.includes(
      previewAlias
    ),
    false
  );
  const withPreview = run("api", "release", configuration, [
    "--preview-deployment",
    "dpl_Preview",
  ]);
  assert.equal(withPreview.status, 0, withPreview.failure);
  assert.equal(
    withPreview.output.rule.conditionGroup[0].conditions[0].value.includes(
      previewAlias
    ),
    true
  );
});

test("maintenance can allow one verified App Preview without public aliases", () => {
  const configuration = appConfiguration();
  configuration.deployments.dpl_Preview = deployment(appId, null);
  const appPreviewAlias =
    "interprete-area-de-membro-git-553be9-gabrielschuchters-projects.vercel.app";
  configuration.aliases[appPreviewAlias] = alias(appId, "dpl_Preview");
  const result = run("app", "maintenance", configuration, [
    "--preview-deployment",
    "dpl_Preview",
  ]);
  assert.equal(result.status, 0, result.failure);
  assert.deepEqual(result.output.verifiedAliases, [
    { host: appPreviewAlias, deploymentId: "dpl_Preview" },
  ]);
  assert.deepEqual(result.output.rule.conditionGroup[0].conditions[0].value, [
    appPreviewAlias,
    "preview.vercel.app",
    "production.vercel.app",
  ]);
});

test("a stale Preview alias or different SHA never enters the host allowlist", () => {
  const configuration = apiConfiguration();
  configuration.aliases[previewAlias].deploymentId = "dpl_Old";
  const staleAlias = run("api", "maintenance", configuration, [
    "--preview-deployment",
    "dpl_Preview",
  ]);
  assert.equal(staleAlias.status, 1);
  configuration.aliases[previewAlias].deploymentId = "dpl_Preview";
  configuration.deployments.dpl_Preview.meta.githubCommitSha = "b".repeat(40);
  const differentSha = run("api", "maintenance", configuration, [
    "--preview-deployment",
    "dpl_Preview",
  ]);
  assert.equal(differentSha.status, 1);
  assert.ok(differentSha.failure.includes("exact SHA"));
});

test("public aliases cannot point to the selected Development-configured Preview", () => {
  const configuration = apiConfiguration();
  configuration.aliases[
    "interprete-area-de-membros-api.vercel.app"
  ].deploymentId = "dpl_Preview";
  const result = run("api", "release", configuration, [
    "--preview-deployment",
    "dpl_Preview",
  ]);
  assert.equal(result.status, 1);
  assert.ok(result.failure.includes("Each allowed alias"));
});

test("Preview selection rejects missing QA isolation keys and a Production target", () => {
  const configuration = apiConfiguration();
  configuration.deployments.dpl_Preview.env = [];
  const missingKeys = run("api", "maintenance", configuration, [
    "--preview-deployment",
    "dpl_Preview",
  ]);
  assert.equal(missingKeys.status, 1);
  assert.ok(missingKeys.failure.includes("QA isolation keys"));
  configuration.deployments.dpl_Preview = deployment(apiId);
  const production = run("api", "maintenance", configuration, [
    "--preview-deployment",
    "dpl_Preview",
  ]);
  assert.equal(production.status, 1);
  assert.ok(production.failure.includes("QA isolation keys"));
});
