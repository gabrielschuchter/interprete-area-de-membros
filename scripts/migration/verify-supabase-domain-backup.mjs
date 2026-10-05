#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
/**
 * Verifies one locally encrypted Interprete Supabase backup without writing
 * plaintext to disk. The small logical-domain archive is decrypted in memory
 * and passed to pg_restore --list through stdin.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  extractPrismaMigrationLedger,
  reconcilePrismaMigrationLedger,
  verifyCopyRowCounts,
  verifyTableDataEntries,
} from "../lib/postgres-archive-validation.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const EXPECTED_REF = "wkclodjbrynerfgufmyb";
const PG_RESTORE = path.join(
  os.tmpdir(),
  "interprete-pgtools-17.11-5/full-extract/bin/pg_restore.exe"
);
const ENCRYPTED_ARCHIVE_SUFFIX = /\.pgdump\.aesgcm$/i;
const NEWLINE = /\r?\n/;
const TOC_EVENT_TRIGGER = /^\s*\d+;\s+\d+\s+\d+\s+EVENT TRIGGER\s+/;
const TOC_PUBLICATION = /^\s*\d+;\s+\d+\s+\d+\s+PUBLICATION\s+/;
const TOC_ENTRY_TYPE =
  /^\s*\d+;\s+\d+\s+\d+\s+(DEFAULT ACL|CHECK CONSTRAINT|FK CONSTRAINT|TABLE DATA|MATERIALIZED VIEW DATA|EVENT TRIGGER|PUBLICATION|EXTENSION|FUNCTION|TRIGGER|CONSTRAINT|SEQUENCE|INDEX|SCHEMA|TABLE|TYPE|ACL|POLICY)\s+/;

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

const countRestoreEntryTypes = (toc) => {
  const counts = {};
  for (const line of toc.split(NEWLINE)) {
    const entryType = TOC_ENTRY_TYPE.exec(line)?.[1];
    if (entryType) {
      counts[entryType] = (counts[entryType] ?? 0) + 1;
    }
  }
  return counts;
};

function unprotectWithDpapi(bytes) {
  const command =
    "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; " +
    "$b=[Convert]::FromBase64String([Console]::In.ReadLine()); " +
    "$o=[Security.Cryptography.ProtectedData]::Unprotect($b,$null," +
    "[Security.Cryptography.DataProtectionScope]::CurrentUser); " +
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
    fail("Current-user DPAPI could not unwrap this backup key.");
  }
  return Buffer.from(result.stdout.trim(), "base64");
}

function main() {
  if (process.platform !== "win32") {
    fail("This verifier requires Windows DPAPI.");
  }
  const archivePath = process.argv[2];
  if (!archivePath) {
    fail("Pass the encrypted archive path; no secret is required.");
  }
  const manifestPath = archivePath.replace(
    ENCRYPTED_ARCHIVE_SUFFIX,
    ".manifest.json"
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (
    manifest.format !== "INTERPRETE-SUPABASE-BACKUP-V1" ||
    manifest.sourceProjectRef !== EXPECTED_REF
  ) {
    fail("Backup manifest format or source project guard does not match.");
  }
  if (!fs.existsSync(PG_RESTORE)) {
    fail("Verified pg_restore binary is missing.");
  }
  const sourceSnapshotPath = manifest.sourceSnapshotManifest;
  const sourceSnapshot = JSON.parse(
    unprotectWithDpapi(fs.readFileSync(sourceSnapshotPath)).toString("utf8")
  );
  if (
    sourceSnapshot.format !== "INTERPRETE-SUPABASE-SOURCE-SNAPSHOT-V1" ||
    sourceSnapshot.sourceProjectRef !== EXPECTED_REF ||
    !sourceSnapshot.connection.sharedSnapshot ||
    sourceSnapshot.connection.snapshotIdSha256 !==
      manifest.export.snapshotIdSha256 ||
    !sourceSnapshot.database.rowSnapshots.every(
      (table) => table.perRowHashes?.length === table.rowCount
    )
  ) {
    fail(
      "Backup archive and row/catalog manifest are not bound to the same exported PostgreSQL snapshot."
    );
  }
  const archive = fs.readFileSync(archivePath);
  if (
    archive.length !== manifest.encryptedArtifactBytes ||
    sha256(archive) !== manifest.encryptedArtifactSha256
  ) {
    fail("Encrypted archive size or SHA-256 does not match its manifest.");
  }
  const magic = Buffer.from("INTERPRETE-SUPABASE-BACKUP-V1\n", "ascii");
  if (!archive.subarray(0, magic.length).equals(magic)) {
    fail("Encrypted archive header is invalid.");
  }
  if (archive.length < magic.length + 12 + 16) {
    fail("Encrypted archive is truncated.");
  }

  const keyPath = path.join(path.dirname(archivePath), manifest.keyArtifact);
  const key = unprotectWithDpapi(fs.readFileSync(keyPath));
  if (key.length !== 32) {
    fail("Unwrapped AES key has an invalid length.");
  }
  const ivStart = magic.length;
  const iv = archive.subarray(ivStart, ivStart + 12);
  const tag = archive.subarray(archive.length - 16);
  const ciphertext = archive.subarray(ivStart + 12, archive.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  if (
    plaintext.length !== manifest.payloadBytes ||
    sha256(plaintext) !== manifest.payloadSha256
  ) {
    fail("Decrypted payload size or SHA-256 does not match its manifest.");
  }
  if (plaintext.subarray(0, 5).toString("ascii") !== "PGDMP") {
    fail("Decrypted payload is not a PostgreSQL custom-format archive.");
  }

  const restore = spawnSync(PG_RESTORE, ["--list"], {
    input: plaintext,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (restore.status !== 0) {
    const safeDetail = (restore.stderr ?? "")
      .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[connection URI redacted]")
      .slice(0, 1200);
    fail(
      "pg_restore --list rejected the decrypted PostgreSQL archive: " +
        safeDetail.trim()
    );
  }
  const entries = restore.stdout
    .split(NEWLINE)
    .filter((line) => line && !line.startsWith(";")).length;
  if (entries < 1) {
    fail("PostgreSQL archive has no restorable entries.");
  }
  const archiveEventTriggerEntries = restore.stdout
    .split(NEWLINE)
    .filter((line) => TOC_EVENT_TRIGGER.test(line)).length;
  const archivePublicationEntries = restore.stdout
    .split(NEWLINE)
    .filter((line) => TOC_PUBLICATION.test(line)).length;
  const restoreEntryTypeCounts = countRestoreEntryTypes(restore.stdout);
  const rowSnapshots = sourceSnapshot.database.rowSnapshots;
  const tableDataEntryCount = verifyTableDataEntries(
    restore.stdout,
    rowSnapshots
  );
  const copyRestore = spawnSync(PG_RESTORE, ["--data-only", "--file=-"], {
    input: plaintext,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (copyRestore.status !== 0) {
    fail("pg_restore could not decode the archive's table data section.");
  }
  const dataCounts = verifyCopyRowCounts(copyRestore.stdout, rowSnapshots);
  const sourceLedger = extractPrismaMigrationLedger(copyRestore.stdout);
  const migrationsDirectory = path.join(
    ROOT,
    "packages/database/prisma/migrations"
  );
  const localMigrations = fs
    .readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const migrationPath = path.join(
        migrationsDirectory,
        entry.name,
        "migration.sql"
      );
      if (!fs.existsSync(migrationPath)) {
        fail("A local Prisma migration directory has no migration.sql file.");
      }
      return {
        name: entry.name,
        checksum: sha256(fs.readFileSync(migrationPath)),
      };
    });
  const migrationReconciliation = reconcilePrismaMigrationLedger(
    sourceLedger,
    localMigrations
  );
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      archivePath,
      sourceProjectRef: manifest.sourceProjectRef,
      sharedSnapshot: true,
      manifestRowCount: sourceSnapshot.database.rowCount,
      manifestTableCount: rowSnapshots.length,
      tableDataEntryCount,
      tableDataRowsDecoded: dataCounts.rowCount,
      tableDataCountsMatchSnapshot: true,
      prismaMigrationAttemptCount: migrationReconciliation.attemptCount,
      prismaMigrationsApplied: migrationReconciliation.applied.length,
      prismaMigrationChecksumsMatch: true,
      prismaMigrationsPending: migrationReconciliation.pending,
      payloadBytes: plaintext.length,
      payloadSha256: manifest.payloadSha256,
      authenticatedEncryption: "AES-256-GCM",
      dpapiUserScope: "CurrentUser",
      pgRestoreList: "PASS",
      restoreEntries: entries,
      restoreEntryTypeCounts,
      eventTriggerEntries: archiveEventTriggerEntries,
      publicationEntries: archivePublicationEntries,
    })}\n`
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
    })}\n`
  );
  process.exitCode = 2;
}
