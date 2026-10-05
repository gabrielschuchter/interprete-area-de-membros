#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
/**
 * Read-only, encrypted export of Interprete's product schema and Supabase
 * migration ledger. The archive is written outside the repository.
 *
 * Windows safety: AES-256-GCM payload key is wrapped with CurrentUser DPAPI.
 * A short-lived pgpass file is ACL-restricted to the current Windows SID and
 * removed after pg_dump exits. The database session is forced read-only and
 * TLS hostname/certificate verification is required.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SOURCE_REF = "wkclodjbrynerfgufmyb";
const GREEN_REF = "qffqhilydtnrggbcnogh";
const DATABASE_PACKAGE = path.join(ROOT, "packages/database/package.json");
const CA_FILE = path.join(
  ROOT,
  "packages/database/certs/supabase-prod-ca-2021.crt"
);
const PG_DUMP = path.join(
  os.tmpdir(),
  "interprete-pgtools-17.11-5/full-extract/bin/pg_dump.exe"
);
const SOURCE_SNAPSHOT = path.join(
  ROOT,
  "scripts/migration/snapshot-supabase-source.mjs"
);
const BACKUP_VERIFIER = path.join(
  ROOT,
  "scripts/migration/verify-supabase-domain-backup.mjs"
);
const GREEN_SYNC = path.join(
  ROOT,
  "scripts/migration/sync-supabase-green-snapshot.mjs"
);
const ENV_FILE = path.join(ROOT, "packages/database/.env");
const BACKUP_ROOT = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Codex/migrations/interprete-supabase"
);
const DATABASE_PATH_PREFIX = /^\//;
const PASSWORD_LINE_BREAK = /[\r\n]/;
const WINDOWS_SID = /S-1-[0-9-]+/i;
const TIMESTAMP_SEPARATORS = /[-:]/g;
const TIMESTAMP_MILLISECONDS = /\.\d{3}Z$/;
const SNAPSHOT_ID = /^[A-Fa-f0-9-]+$/;
const CONNECTION_URI = /postgres(?:ql)?:\/\/[^\s]+/gi;
const PASSWORD_IN_ERROR = /password\s*[:=]\s*[^\s]+/gi;
const syncGreen = process.argv.includes("--sync-green");

function fail(message) {
  throw new Error(message);
}

function getDatabaseUrl() {
  if (!process.env.DIRECT_URL) {
    const require = createRequire(DATABASE_PACKAGE);
    const dotenv = require("dotenv");
    const values = dotenv.parse(fs.readFileSync(ENV_FILE));
    process.env.DIRECT_URL = values.DIRECT_URL ?? "";
  }
  if (!process.env.DIRECT_URL) {
    fail("DIRECT_URL is missing from the ignored database env file.");
  }
  return new URL(process.env.DIRECT_URL);
}

function escapePgpass(value) {
  return value.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
}

function secureAcl(target, rights) {
  const result = spawnSync(
    "icacls.exe",
    [target, "/inheritance:r", "/grant:r", rights],
    {
      encoding: "utf8",
      windowsHide: true,
    }
  );
  if (result.status !== 0) {
    fail("Could not restrict access to local migration artifacts.");
  }
}

function protectWithDpapi(bytes, operation) {
  const verb = operation === "protect" ? "Protect" : "Unprotect";
  const command =
    "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; " +
    "$b=[Convert]::FromBase64String([Console]::In.ReadLine()); " +
    "$o=[Security.Cryptography.ProtectedData]::" +
    verb +
    "($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); " +
    "[Console]::Out.Write([Convert]::ToBase64String($o))";
  const result = spawnSync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
    {
      input: Buffer.from(`${bytes.toString("base64")}\n`),
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    }
  );
  if (result.status !== 0 || !result.stdout?.trim()) {
    fail("Current-user Windows DPAPI key protection failed.");
  }
  return Buffer.from(result.stdout.trim(), "base64");
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

function pgDumpErrorDetail(stderr, url) {
  return stderr
    .replaceAll(decodeURIComponent(url.password), "[redacted]")
    .replaceAll(url.password, "[redacted]")
    .replace(CONNECTION_URI, "[connection URI redacted]")
    .replace(PASSWORD_IN_ERROR, "password=[redacted]")
    .slice(0, 1600);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This safety-gated, one-shot export keeps connection checks, snapshot ownership, encryption, and cleanup in one auditable sequence.
async function main() {
  if (process.platform !== "win32") {
    fail("This encrypted backup helper currently requires Windows DPAPI.");
  }
  if (!process.env.LOCALAPPDATA) {
    fail(
      "LOCALAPPDATA is unavailable; refusing to choose a different artifact location."
    );
  }
  if (!(fs.existsSync(PG_DUMP) && fs.existsSync(CA_FILE))) {
    fail("Verified pg_dump or Supabase CA certificate is missing.");
  }

  const url = getDatabaseUrl();
  const username = decodeURIComponent(url.username);
  const database = decodeURIComponent(
    url.pathname.replace(DATABASE_PATH_PREFIX, "")
  );
  const port = url.port || "5432";
  if (
    username !== `postgres.${SOURCE_REF}` ||
    url.hostname.includes(GREEN_REF)
  ) {
    fail(
      "Origin project guard failed; refusing to export an unexpected database."
    );
  }
  if (port !== "5432" || !url.hostname.endsWith(".pooler.supabase.com")) {
    fail("Expected the verified Supavisor session pooler on port 5432.");
  }
  const password = decodeURIComponent(url.password);
  if (!password || PASSWORD_LINE_BREAK.test(password)) {
    fail("The database credential is not usable in a temporary pgpass file.");
  }

  const sidText = execFileSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const sid = sidText.match(WINDOWS_SID)?.[0];
  if (!sid) {
    fail("Could not resolve the current Windows user SID.");
  }
  fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  secureAcl(BACKUP_ROOT, `*${sid}:(OI)(CI)(F)`);

  const stamp = new Date()
    .toISOString()
    .replace(TIMESTAMP_SEPARATORS, "")
    .replace(TIMESTAMP_MILLISECONDS, "Z");
  const archivePath = path.join(
    BACKUP_ROOT,
    `origin-domain-${stamp}.pgdump.aesgcm`
  );
  const keyPath = path.join(BACKUP_ROOT, `origin-domain-${stamp}.key.dpapi`);
  const manifestPath = path.join(
    BACKUP_ROOT,
    `origin-domain-${stamp}.manifest.json`
  );
  const passPath = path.join(
    BACKUP_ROOT,
    `.pgpass-${crypto.randomBytes(8).toString("hex")}`
  );
  if (
    [archivePath, keyPath, manifestPath].some((artifact) =>
      fs.existsSync(artifact)
    )
  ) {
    fail("Refusing to overwrite an existing backup artifact.");
  }

  const passLine =
    [url.hostname, port, database, username, password]
      .map(escapePgpass)
      .join(":") + os.EOL;
  fs.writeFileSync(passPath, passLine, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  secureAcl(passPath, `*${sid}:(F)`);

  let stderr = "";
  let snapshotOwner = null;
  let snapshotTransactionOpen = false;
  let sourceSnapshot = null;
  let artifactsComplete = false;
  let greenSync = null;
  try {
    const require = createRequire(DATABASE_PACKAGE);
    const { Client } = require("pg");
    const connectionUrl = new URL(url);
    for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
      connectionUrl.searchParams.delete(key);
    }
    snapshotOwner = new Client({
      connectionString: connectionUrl.toString(),
      ssl: { rejectUnauthorized: true, ca: fs.readFileSync(CA_FILE, "utf8") },
      options: "-c default_transaction_read_only=on",
      connectionTimeoutMillis: 15_000,
    });
    await snapshotOwner.connect();
    await snapshotOwner.query(
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"
    );
    snapshotTransactionOpen = true;
    const exported = (
      await snapshotOwner.query("SELECT pg_export_snapshot() AS snapshot_id")
    ).rows[0];
    const snapshotId = exported.snapshot_id;
    if (!SNAPSHOT_ID.test(snapshotId)) {
      fail("PostgreSQL returned an unexpected snapshot identifier.");
    }

    const inventory = spawnSync(
      process.execPath,
      [SOURCE_SNAPSHOT, snapshotId],
      {
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
      }
    );
    if (inventory.status !== 0 || !inventory.stdout?.trim()) {
      fail(
        "Read-only inventory could not import the exported source snapshot."
      );
    }
    sourceSnapshot = JSON.parse(inventory.stdout.trim());

    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const wrappedKey = protectWithDpapi(key, "protect");
    const unwrappedKey = protectWithDpapi(wrappedKey, "unprotect");
    if (!crypto.timingSafeEqual(key, unwrappedKey)) {
      fail("DPAPI round-trip verification failed.");
    }
    fs.writeFileSync(keyPath, wrappedKey, { flag: "wx", mode: 0o600 });
    secureAcl(keyPath, `*${sid}:(F)`);

    const payloadHash = crypto.createHash("sha256");
    let payloadBytes = 0;
    const tap = new Transform({
      transform(chunk, _encoding, callback) {
        payloadBytes += chunk.length;
        payloadHash.update(chunk);
        callback(null, chunk);
      },
    });
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const output = fs.createWriteStream(archivePath, {
      flags: "wx",
      mode: 0o600,
    });
    output.write(
      Buffer.concat([
        Buffer.from("INTERPRETE-SUPABASE-BACKUP-V1\n", "ascii"),
        iv,
      ])
    );

    const args = [
      "--format=custom",
      "--compress=6",
      "--no-password",
      `--snapshot=${snapshotId}`,
      "--host",
      url.hostname,
      "--port",
      port,
      "--username",
      username,
      "--dbname",
      database,
      "--schema=public",
      "--schema=supabase_migrations",
    ];
    const env = {
      ...process.env,
      PGPASSFILE: passPath,
      PGSSLMODE: "verify-full",
      PGSSLROOTCERT: CA_FILE,
      PGOPTIONS: "-c default_transaction_read_only=on",
    };
    env.PGPASSWORD = undefined;
    const child = spawn(PG_DUMP, args, {
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 16_000) {
        stderr += chunk;
      }
    });

    const streamDone = pipeline(child.stdout, tap, cipher, output);
    const processDone = new Promise((resolve, reject) => {
      child.once("close", (code, signal) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              "pg_dump exited with code " +
                code +
                ", signal " +
                (signal ?? "none")
            )
          );
        }
      });
      child.once("error", reject);
    });
    await Promise.all([streamDone, processDone]);
    fs.appendFileSync(archivePath, cipher.getAuthTag());

    const manifest = {
      format: "INTERPRETE-SUPABASE-BACKUP-V1",
      createdAt: new Date().toISOString(),
      sourceProjectRef: SOURCE_REF,
      export: {
        pgDumpVersion: "17.11",
        schemas: ["public", "supabase_migrations"],
        archiveFormat: "PostgreSQL custom",
        transactionReadOnly: true,
        tls: "verify-full",
        snapshotIdSha256: crypto
          .createHash("sha256")
          .update(snapshotId)
          .digest("hex"),
      },
      sourceSnapshotManifest: sourceSnapshot.manifestPath,
      payloadBytes,
      payloadSha256: payloadHash.digest("hex"),
      encryptedArtifactBytes: fs.statSync(archivePath).size,
      encryptedArtifactSha256: await sha256File(archivePath),
      encryption:
        "AES-256-GCM; random key protected by Windows DPAPI CurrentUser",
      keyArtifact: path.basename(keyPath),
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    secureAcl(manifestPath, `*${sid}:(F)`);

    const verification = spawnSync(
      process.execPath,
      [BACKUP_VERIFIER, archivePath],
      { encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024 }
    );
    if (verification.status !== 0 || !verification.stdout?.trim()) {
      fail(
        "The newly written final snapshot failed its encrypted-archive verifier."
      );
    }
    let verifiedBackup;
    try {
      verifiedBackup = JSON.parse(verification.stdout.trim());
    } catch {
      fail("The encrypted-archive verifier returned an invalid result.");
    }
    if (verifiedBackup.ok !== true) {
      fail("The newly written final snapshot did not pass integrity checks.");
    }
    artifactsComplete = true;

    if (syncGreen) {
      const synchronization = spawnSync(
        process.execPath,
        [
          GREEN_SYNC,
          "--apply",
          `--confirm-green=${GREEN_REF}`,
          `--snapshot-id=${snapshotId}`,
        ],
        { encoding: "utf8", windowsHide: true, maxBuffer: 8 * 1024 * 1024 }
      );
      if (synchronization.status !== 0 || !synchronization.stdout?.trim()) {
        fail(
          "The final snapshot was verified, but the transactional green sync failed. Preserve the encrypted backup and abort the cutover."
        );
      }
      try {
        greenSync = JSON.parse(synchronization.stdout.trim());
      } catch {
        fail(
          "The final snapshot was verified, but green sync returned an invalid result. Preserve the backup and abort the cutover."
        );
      }
      if (
        greenSync.ok !== true ||
        greenSync.mode !== "upsert-only-apply" ||
        greenSync.sourceProjectRef !== SOURCE_REF ||
        greenSync.destinationProjectRef !== GREEN_REF
      ) {
        fail(
          "The final snapshot was verified, but green sync did not attest the guarded source and destination. Preserve the backup and abort the cutover."
        );
      }
    }
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        archivePath,
        manifestPath,
        payloadBytes,
        encryptedArtifactBytes: manifest.encryptedArtifactBytes,
        payloadSha256: manifest.payloadSha256,
        encryptedArtifactSha256: manifest.encryptedArtifactSha256,
        schemas: manifest.export.schemas,
        sourceSnapshotManifest: sourceSnapshot.manifestPath,
        sourceSnapshotSummary: {
          databaseBytes: sourceSnapshot.databaseBytes,
          tableCount: sourceSnapshot.tableCount,
          columnCount: sourceSnapshot.columnCount,
          rowCount: sourceSnapshot.rowCount,
          storageObjectCount: sourceSnapshot.storageObjectCount,
          storageAllowlistCount: sourceSnapshot.storageAllowlistCount,
          storageAllowlistBytes: sourceSnapshot.storageAllowlistBytes,
        },
        transactionReadOnly: true,
        tls: manifest.export.tls,
        dpapiRoundTrip: true,
        backupIntegrity: verifiedBackup.ok ? "PASS" : "FAIL",
        greenSnapshotSync: greenSync
          ? {
              mode: greenSync.mode,
              sourceRows: greenSync.sourceRows,
              inserted: greenSync.inserted,
              updated: greenSync.updated,
              unchanged: greenSync.unchanged,
              destinationOnlyRows: greenSync.destinationOnlyRows,
              deletes: 0,
              productionChanged: false,
              sourceWrites: 0,
            }
          : "not-requested",
      })}\n`
    );
  } catch (error) {
    if (!artifactsComplete) {
      for (const artifact of [archivePath, keyPath, manifestPath]) {
        try {
          fs.rmSync(artifact, { force: true });
        } catch {
          // Preserve the original export failure if local cleanup also fails.
        }
      }
    }
    const detail = pgDumpErrorDetail(stderr, url);
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        operation: "read-only pg_dump",
        error: error instanceof Error ? error.message : "unknown error",
        sanitizedDetail: detail,
        backupPreserved: artifactsComplete,
        ...(artifactsComplete ? { archivePath, manifestPath } : {}),
      })}\n`
    );
    process.exitCode = 2;
  } finally {
    if (snapshotOwner) {
      if (snapshotTransactionOpen) {
        try {
          await snapshotOwner.query("ROLLBACK");
        } catch {
          // Closing the read-only snapshot remains best-effort during cleanup.
        }
      }
      await snapshotOwner.end().catch(() => undefined);
    }
    try {
      fs.rmSync(passPath, { force: true });
    } catch {
      // Do not replace the export result with a temporary passfile cleanup error.
    }
  }
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
    })}\n`
  );
  process.exitCode = 2;
});
