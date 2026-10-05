#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { compareSnapshotManifests } from "../lib/snapshot-manifest-diff.mjs";

const EXPECTED_REF = "wkclodjbrynerfgufmyb";

const fail = (message) => {
  throw new Error(message);
};

const unprotect = (path) => {
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
      input: `${fs.readFileSync(path).toString("base64")}\n`,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    }
  );
  if (result.status !== 0 || !result.stdout?.trim()) {
    fail("Current-user DPAPI could not unwrap a snapshot manifest.");
  }
  return Buffer.from(result.stdout.trim(), "base64");
};

const readSnapshot = (path) => {
  const plaintext = unprotect(path);
  try {
    const snapshot = JSON.parse(plaintext.toString("utf8"));
    if (
      snapshot.format !== "INTERPRETE-SUPABASE-SOURCE-SNAPSHOT-V1" ||
      snapshot.sourceProjectRef !== EXPECTED_REF ||
      !Array.isArray(snapshot.database?.rowSnapshots)
    ) {
      fail("Snapshot format or source-project guard failed.");
    }
    return snapshot;
  } finally {
    plaintext.fill(0);
  }
};

const [beforePath, afterPath] = process.argv.slice(2);
if (process.platform !== "win32" || !beforePath || !afterPath) {
  fail(
    "Usage: node compare-supabase-snapshot-manifests.mjs <before.dpapi> <after.dpapi>"
  );
}

try {
  const before = readSnapshot(beforePath);
  const after = readSnapshot(afterPath);
  if (
    before.database.rowSnapshots.length !== after.database.rowSnapshots.length
  ) {
    fail("Snapshot table inventories differ; compare them before row hashes.");
  }
  const changes = compareSnapshotManifests(before, after);
  const beforeRows = before.database.rowSnapshots.reduce(
    (total, table) => total + table.rowCount,
    0
  );
  const afterRows = after.database.rowSnapshots.reduce(
    (total, table) => total + table.rowCount,
    0
  );
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      sourceProjectRef: EXPECTED_REF,
      beforeAt: before.createdAt,
      afterAt: after.createdAt,
      beforeRows,
      afterRows,
      changes,
      rawIdentifiersEmitted: false,
    })}\n`
  );
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
    })}\n`
  );
  process.exitCode = 2;
}
