#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { reconcilePrismaMigrationLedger } from "../lib/postgres-archive-validation.mjs";
import { parseGreenSessionPoolerUrl } from "../lib/supabase-green-connection.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DATABASE_ROOT = path.join(ROOT, "packages/database");
const DATABASE_PACKAGE = path.join(DATABASE_ROOT, "package.json");
const MIGRATIONS_DIRECTORY = path.join(DATABASE_ROOT, "prisma/migrations");
const CA_FILE = path.join(DATABASE_ROOT, "certs/supabase-prod-ca-2021.crt");
const CREDENTIAL_FILE = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Codex/migrations/interprete-supabase/green-session-pooler-uri.dpapi"
);
const GREEN_REF = "qffqhilydtnrggbcnogh";
const REVIEWED_MIGRATION_COUNT = 48;
const CLERK_RECEIPT_MIGRATION = "20261004230000_clerk_webhook_receipts";
const PRISMA = "bun";

const fail = (message) => {
  throw new Error(message);
};

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const unprotectWithDpapi = (bytes) => {
  const command =
    "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; " +
    "$b=[Convert]::FromBase64String([Console]::In.ReadLine()); " +
    "$p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null," +
    "[Security.Cryptography.DataProtectionScope]::CurrentUser); " +
    "[Console]::Out.Write([Convert]::ToBase64String($p))";
  const result = spawnSync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
    {
      input: Buffer.from(`${bytes.toString("base64")}\n`),
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    }
  );
  if (result.status !== 0 || !result.stdout?.trim()) {
    fail("Current-user DPAPI could not open the protected green credential.");
  }
  return Buffer.from(result.stdout.trim(), "base64");
};

const localMigrations = () => {
  const migrations = fs
    .readdirSync(MIGRATIONS_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const migrationPath = path.join(
        MIGRATIONS_DIRECTORY,
        entry.name,
        "migration.sql"
      );
      if (!fs.existsSync(migrationPath)) {
        fail("A local Prisma migration has no migration.sql file.");
      }
      return {
        name: entry.name,
        checksum: sha256(fs.readFileSync(migrationPath)),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  if (migrations.length !== REVIEWED_MIGRATION_COUNT) {
    fail(
      `The reviewed migration set no longer contains exactly ${REVIEWED_MIGRATION_COUNT} migrations.`
    );
  }
  return migrations;
};

const sanitizedOutput = (value, url) =>
  String(value ?? "")
    .replaceAll(decodeURIComponent(url.password), "[redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[connection URI redacted]")
    .replace(/password\s*[:=]\s*[^\s]+/gi, "password=[redacted]")
    .replace(
      /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,
      "[Supabase key redacted]"
    )
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[JWT redacted]"
    )
    .slice(0, 3000);

const migrationStatus = async (url, migrations) => {
  const require = createRequire(DATABASE_PACKAGE);
  const { Client } = require("pg");
  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, ca: fs.readFileSync(CA_FILE, "utf8") },
    options: "-c default_transaction_read_only=on",
    connectionTimeoutMillis: 15_000,
  });
  let transactionOpen = false;
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;
    const facts = (
      await client.query(
        "SELECT current_setting('transaction_read_only') AS read_only," +
          "current_setting('server_version') AS server_version," +
          "current_setting('server_version_num') AS server_version_num," +
          "current_database() AS database_name"
      )
    ).rows[0];
    if (
      facts.read_only !== "on" ||
      facts.database_name !== "postgres" ||
      Math.floor(Number(facts.server_version_num) / 10_000) !== 17
    ) {
      fail(
        "Green read-only migration preflight failed its project, mode, or PostgreSQL-version guard."
      );
    }
    const records = (
      await client.query(
        "SELECT migration_name,checksum,finished_at::text,rolled_back_at::text," +
          'applied_steps_count::text FROM public."_prisma_migrations" ' +
          "ORDER BY migration_name,started_at"
      )
    ).rows.map((row) => ({
      migrationName: row.migration_name,
      checksum: row.checksum,
      finishedAt: row.finished_at,
      rolledBackAt: row.rolled_back_at,
      appliedStepsCount: row.applied_steps_count,
    }));
    const state = reconcilePrismaMigrationLedger(records, migrations);
    await client.query("ROLLBACK");
    transactionOpen = false;
    return { serverVersion: facts.server_version, state };
  } finally {
    if (transactionOpen) {
      await client.query("ROLLBACK").catch(() => undefined);
    }
    await client.end().catch(() => undefined);
  }
};

const runReadOnlyGate = (script, args, url, expectedStatus = 0) => {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== expectedStatus) {
    fail(
      `A required green validation gate failed. ${sanitizedOutput(`${result.stderr ?? ""}\n${result.stdout ?? ""}`, url)}`
    );
  }
  return result.stdout;
};

const runPrisma = (args, url) => {
  const greenUrl = new URL(url);
  greenUrl.searchParams.set("sslmode", "verify-full");
  greenUrl.searchParams.set("sslrootcert", CA_FILE);
  const urlText = greenUrl.toString();
  const env = {
    ...process.env,
    DIRECT_URL: urlText,
    DATABASE_URL: urlText,
    POSTGRES_PRISMA_URL: urlText,
    POSTGRES_URL_NON_POOLING: urlText,
  };
  const result = spawnSync(PRISMA, ["x", "prisma", ...args], {
    cwd: DATABASE_ROOT,
    env,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = sanitizedOutput(
    `${result.stdout ?? ""}${result.stderr ?? ""}`,
    greenUrl
  );
  if (result.error) {
    fail(`Could not start the local Bun/Prisma CLI. ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`Green Prisma command failed with status ${result.status}. ${output}`);
  }
  return output;
};

const main = async () => {
  if (!(process.platform === "win32" && process.env.LOCALAPPDATA)) {
    fail(
      "This migration helper requires the Windows profile protected by DPAPI."
    );
  }
  const snapshotPath = process.argv[2];
  if (!(snapshotPath && fs.existsSync(snapshotPath))) {
    fail("Pass the paired DPAPI-protected source snapshot manifest.");
  }
  if (!(fs.existsSync(CREDENTIAL_FILE) && fs.existsSync(CA_FILE))) {
    fail(
      "The protected green credential or Supabase CA certificate is missing."
    );
  }
  const credential = unprotectWithDpapi(fs.readFileSync(CREDENTIAL_FILE));
  const directUrl = parseGreenSessionPoolerUrl(credential.toString("utf8"));
  credential.fill(0);
  const migrations = localMigrations();
  const state = await migrationStatus(directUrl, migrations);
  const validateScript = path.join(
    ROOT,
    "scripts/migration/validate-supabase-green.mjs"
  );
  const reconcileMediaScript = path.join(
    ROOT,
    "scripts/migration/reconcile-supabase-green-media.mjs"
  );

  let deployed = false;
  const repairMigration = "20261004210000_assignment_nullable_legacy_activity";
  if (
    state.state.applied.length === 30 &&
    state.state.pending.length === migrations.length - 30
  ) {
    runReadOnlyGate(validateScript, ["restored", snapshotPath], directUrl);
    runPrisma(
      ["migrate", "deploy", "--schema", "prisma/schema.prisma"],
      directUrl
    );
    deployed = true;
  } else if (
    state.state.applied.length === 46 &&
    state.state.pending.length === 2 &&
    state.state.pending[0] === repairMigration &&
    state.state.pending[1] === CLERK_RECEIPT_MIGRATION
  ) {
    runPrisma(
      ["migrate", "deploy", "--schema", "prisma/schema.prisma"],
      directUrl
    );
    deployed = true;
  } else if (
    state.state.applied.length === REVIEWED_MIGRATION_COUNT - 1 &&
    state.state.pending.length === 1 &&
    state.state.pending[0] === CLERK_RECEIPT_MIGRATION
  ) {
    runPrisma(
      ["migrate", "deploy", "--schema", "prisma/schema.prisma"],
      directUrl
    );
    deployed = true;
  } else if (
    state.state.applied.length !== migrations.length ||
    state.state.pending.length !== 0
  ) {
    fail(
      "Green migration history is neither the validated baseline, the reviewed pending migration set, nor the complete 48-applied target; inspect partial attempts without resolving them automatically."
    );
  }

  const afterDeploy = await migrationStatus(directUrl, migrations);
  if (
    afterDeploy.state.applied.length !== REVIEWED_MIGRATION_COUNT ||
    afterDeploy.state.pending.length !== 0
  ) {
    fail(
      `Green does not show all ${REVIEWED_MIGRATION_COUNT} reviewed migrations with matching checksums.`
    );
  }

  runPrisma(
    [
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      "prisma/schema.prisma",
      "--exit-code",
    ],
    directUrl
  );

  runReadOnlyGate(reconcileMediaScript, [snapshotPath], directUrl);
  const finalValidation = runReadOnlyGate(
    validateScript,
    ["migrated", snapshotPath],
    directUrl
  );
  let validation;
  try {
    validation = JSON.parse(finalValidation.trim());
  } catch {
    fail(
      "The final green validator did not emit its expected machine-readable result."
    );
  }
  if (validation.ok !== true) {
    fail("The final read-only green validation did not pass.");
  }
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      projectRef: GREEN_REF,
      serverVersion: afterDeploy.serverVersion,
      prismaMigrationsApplied: afterDeploy.state.applied.length,
      prismaMigrationsPending: afterDeploy.state.pending.length,
      migrationDeployExecuted: deployed,
      prismaSchemaDiff: "empty",
      mediaReconciliation: "completed",
      finalValidation: "PASS",
      productionChanged: false,
      sourceWrites: 0,
    })}\n`
  );
};

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown green migration failure";
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      projectRef: GREEN_REF,
      error: message
        .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[connection URI redacted]")
        .replace(/password\s*[:=]\s*[^\s]+/gi, "password=[redacted]")
        .replace(
          /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,
          "[Supabase key redacted]"
        )
        .replace(
          /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
          "[JWT redacted]"
        )
        .slice(0, 3000),
    })}\n`
  );
  process.exitCode = 2;
});
