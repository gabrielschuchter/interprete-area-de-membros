#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { reconcilePrismaMigrationLedger } from "../lib/postgres-archive-validation.mjs";
import { parseGreenSessionPoolerUrl } from "../lib/supabase-green-connection.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DATABASE_PACKAGE = path.join(ROOT, "packages/database/package.json");
const MIGRATIONS_DIRECTORY = path.join(
  ROOT,
  "packages/database/prisma/migrations"
);
const CA_FILE = path.join(
  ROOT,
  "packages/database/certs/supabase-prod-ca-2021.crt"
);
const CREDENTIAL_DIRECTORY = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Codex/migrations/interprete-supabase"
);
const CREDENTIAL_FILE = path.join(
  CREDENTIAL_DIRECTORY,
  "green-session-pooler-uri.dpapi"
);
const GREEN_REF = "qffqhilydtnrggbcnogh";
const SOURCE_REF = "wkclodjbrynerfgufmyb";
const EXPECTED_VIDEO_COUNT = 99;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const WINDOWS_SID = /S-1-[0-9-]+/i;
const TIMESTAMP_SEPARATORS = /[-:]/g;
const TIMESTAMP_MILLISECONDS = /\.\d{3}Z$/;

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
    fail(
      "Current-user DPAPI could not open the green credential or source snapshot."
    );
  }
  return Buffer.from(result.stdout.trim(), "base64");
};

const readSnapshot = (snapshotPath) => {
  const bytes = unprotectWithDpapi(fs.readFileSync(snapshotPath));
  try {
    const snapshot = JSON.parse(bytes.toString("utf8"));
    if (
      snapshot.format !== "INTERPRETE-SUPABASE-SOURCE-SNAPSHOT-V1" ||
      snapshot.sourceProjectRef !== SOURCE_REF ||
      !snapshot.connection.sharedSnapshot
    ) {
      fail(
        "The protected source snapshot does not match the audited blue project."
      );
    }
    return snapshot;
  } finally {
    bytes.fill(0);
  }
};

const localMigrations = () => {
  const files = fs
    .readdirSync(MIGRATIONS_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const file = path.join(MIGRATIONS_DIRECTORY, entry.name, "migration.sql");
      if (!fs.existsSync(file)) {
        fail("A local Prisma migration has no migration.sql file.");
      }
      return {
        name: entry.name,
        checksum: sha256(fs.readFileSync(file)),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  if (files.length !== 48) {
    fail(
      "The reviewed migration set no longer contains exactly 48 migrations."
    );
  }
  return files;
};

const persistReceipt = (receipt) => {
  const bytes = Buffer.from(JSON.stringify(receipt), "utf8");
  const protectedBytes = spawnSync(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; " +
        "$b=[Convert]::FromBase64String([Console]::In.ReadLine()); " +
        "$p=[Security.Cryptography.ProtectedData]::Protect($b,$null," +
        "[Security.Cryptography.DataProtectionScope]::CurrentUser); " +
        "[Console]::Out.Write([Convert]::ToBase64String($p))",
    ],
    {
      input: Buffer.from(`${bytes.toString("base64")}\n`),
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    }
  );
  bytes.fill(0);
  if (protectedBytes.status !== 0 || !protectedBytes.stdout?.trim()) {
    fail(
      "Could not protect the green media transformation receipt with DPAPI."
    );
  }
  const sidResult = spawnSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const sid = sidResult.stdout?.match(WINDOWS_SID)?.[0];
  if (sidResult.status !== 0 || !sid) {
    fail(
      "Could not resolve the current Windows user for the protected receipt."
    );
  }
  const stamp = new Date()
    .toISOString()
    .replace(TIMESTAMP_SEPARATORS, "")
    .replace(TIMESTAMP_MILLISECONDS, "Z");
  const filePath = path.join(
    CREDENTIAL_DIRECTORY,
    `media-reconcile-${stamp}-${crypto.randomBytes(4).toString("hex")}.json.dpapi`
  );
  fs.writeFileSync(
    filePath,
    Buffer.from(protectedBytes.stdout.trim(), "base64"),
    {
      flag: "wx",
      mode: 0o600,
    }
  );
  const acl = spawnSync(
    "icacls.exe",
    [filePath, "/inheritance:r", "/grant:r", `*${sid}:(F)`],
    { encoding: "utf8", windowsHide: true }
  );
  if (acl.status !== 0) {
    fs.rmSync(filePath, { force: true });
    fail(
      "Could not restrict the protected receipt to the current Windows user."
    );
  }
};

const main = async () => {
  if (!(process.platform === "win32" && process.env.LOCALAPPDATA)) {
    fail(
      "This green data reconciliation requires the Windows profile protected by DPAPI."
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
  const snapshot = readSnapshot(snapshotPath);
  const migrations = localMigrations();
  const credential = unprotectWithDpapi(fs.readFileSync(CREDENTIAL_FILE));
  const url = parseGreenSessionPoolerUrl(credential.toString("utf8"));
  credential.fill(0);
  const require = createRequire(DATABASE_PACKAGE);
  const { Client } = require("pg");
  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, ca: fs.readFileSync(CA_FILE, "utf8") },
    connectionTimeoutMillis: 15_000,
  });
  let transactionOpen = false;
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    transactionOpen = true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    const facts = (
      await client.query(
        "SELECT current_setting('transaction_read_only') AS read_only," +
          "current_setting('server_version_num') AS server_version_num," +
          "current_database() AS database_name"
      )
    ).rows[0];
    if (
      facts.read_only !== "off" ||
      facts.database_name !== "postgres" ||
      Math.floor(Number(facts.server_version_num) / 10_000) !== 17
    ) {
      fail("The green-only write guard failed; no media rows were changed.");
    }

    const migrationRows = (
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
    const migrationState = reconcilePrismaMigrationLedger(
      migrationRows,
      migrations
    );
    if (
      migrationState.applied.length !== migrations.length ||
      migrationState.pending.length !== 0
    ) {
      fail(
        "All 48 reviewed Prisma migrations must pass checksum validation before media reconciliation."
      );
    }

    const eligible = (
      await client.query(
        'SELECT id,"mediaProvider"::text AS provider,"mediaExternalId" AS external_id ' +
          'FROM public."LessonAsset" WHERE kind = \'VIDEO\'::"LessonAssetKind" ' +
          "AND \"storagePath\" IS NOT NULL AND COALESCE(btrim(\"externalUrl\"), '') = '' " +
          "ORDER BY id FOR UPDATE"
      )
    ).rows;
    if (eligible.length !== EXPECTED_VIDEO_COUNT) {
      fail(
        `Expected exactly ${EXPECTED_VIDEO_COUNT} inventoried video assets; found ${eligible.length}. No media rows were changed.`
      );
    }
    if (
      eligible.some(
        (asset) =>
          !["STORAGE", "YOUTUBE"].includes(asset.provider) ||
          (asset.external_id !== null && !YOUTUBE_ID.test(asset.external_id))
      )
    ) {
      fail(
        "A video asset has an unexpected provider or invalid external ID; no media rows were changed."
      );
    }

    const idSetSha256 = sha256(
      eligible
        .map((asset) => asset.id)
        .sort()
        .join("\n")
    );
    const updated = await client.query(
      'UPDATE public."LessonAsset" SET "mediaProvider" = \'YOUTUBE\'::"LessonAssetMediaProvider" ' +
        'WHERE kind = \'VIDEO\'::"LessonAssetKind" AND "storagePath" IS NOT NULL ' +
        "AND COALESCE(btrim(\"externalUrl\"), '') = '' " +
        'AND "mediaProvider" <> \'YOUTUBE\'::"LessonAssetMediaProvider" RETURNING id'
    );
    const readback = (
      await client.query(
        'SELECT "mediaProvider"::text AS provider,"mediaExternalId" AS external_id ' +
          'FROM public."LessonAsset" WHERE kind = \'VIDEO\'::"LessonAssetKind" ' +
          "AND \"storagePath\" IS NOT NULL AND COALESCE(btrim(\"externalUrl\"), '') = '' "
      )
    ).rows;
    const pendingCount = readback.filter(
      (asset) => asset.provider === "YOUTUBE" && asset.external_id === null
    ).length;
    const mappedCount = readback.filter(
      (asset) =>
        asset.provider === "YOUTUBE" &&
        typeof asset.external_id === "string" &&
        YOUTUBE_ID.test(asset.external_id)
    ).length;
    if (
      readback.length !== EXPECTED_VIDEO_COUNT ||
      readback.some((asset) => asset.provider !== "YOUTUBE") ||
      pendingCount + mappedCount !== EXPECTED_VIDEO_COUNT
    ) {
      fail(
        "Green media reconciliation did not pass its row and provider readback; the transaction was rolled back."
      );
    }
    await client.query("COMMIT");
    transactionOpen = false;

    const receipt = {
      format: "INTERPRETE-SUPABASE-GREEN-MEDIA-RECONCILIATION-V1",
      destinationProjectRef: GREEN_REF,
      sourceProjectRef: SOURCE_REF,
      sourceSnapshotIdSha256: snapshot.connection.snapshotIdSha256,
      eligibleVideoCount: eligible.length,
      eligibleIdSetSha256: idSetSha256,
      rowsUpdated: updated.rowCount,
      youtubeProviderCount: readback.length,
      mappedVideoIdCount: mappedCount,
      pendingVideoIdCount: pendingCount,
      storagePathPreserved: true,
      videoBytesCopied: 0,
      completedAt: new Date().toISOString(),
    };
    persistReceipt(receipt);
    process.stdout.write(`${JSON.stringify({ ok: true, ...receipt })}\n`);
  } finally {
    if (transactionOpen) {
      await client.query("ROLLBACK").catch(() => undefined);
    }
    await client.end().catch(() => undefined);
  }
};

main().catch((error) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown green media reconciliation error";
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      projectRef: GREEN_REF,
      error: message
        .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[connection URI redacted]")
        .replace(/password\s*[:=]\s*[^\s]+/gi, "password=[redacted]")
        .replace(
          /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
          "[JWT redacted]"
        )
        .slice(0, 1000),
    })}\n`
  );
  process.exitCode = 2;
});
