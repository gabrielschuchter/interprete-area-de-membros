#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SOURCE_REF = "wkclodjbrynerfgufmyb";
const PG_RESTORE = path.join(
  process.env.TEMP ?? "",
  "interprete-pgtools-17.11-5/full-extract/bin/pg_restore.exe"
);
const MAGIC = Buffer.from("INTERPRETE-SUPABASE-BACKUP-V1\n", "ascii");
const encryptedArchiveExtension = /\.pgdump\.aesgcm$/i;
const copyLineBreaks = /\r?\n/;
const copyStatementPattern =
  /^COPY\s+public\."?([A-Za-z_][\w$]*)"?\s+\((.+)\)\s+FROM stdin;$/;
const copyColumnSeparator = /,\s*/;
const copyColumnQuotes = /^"|"$/g;
const typeByTable = {
  Member: {
    onboardingStep: "number",
    onboardingVersion: "number",
    onboardingStartedAt: "date",
    onboardingCompletedAt: "date",
    deactivatedAt: "date",
    createdAt: "date",
    updatedAt: "date",
  },
  MutationRateLimit: {
    windowStart: "date",
    count: "number",
    updatedAt: "date",
  },
};

const fail = (message) => {
  throw new Error(message);
};

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const unprotect = (filePath) => {
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
      input: `${fs.readFileSync(filePath).toString("base64")}\n`,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    }
  );
  if (result.status !== 0 || !result.stdout?.trim()) {
    fail("Current-user DPAPI could not unwrap a backup artifact.");
  }
  return Buffer.from(result.stdout.trim(), "base64");
};

const decryptArchive = (archivePath) => {
  const manifestPath = archivePath.replace(
    encryptedArchiveExtension,
    ".manifest.json"
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (
    manifest.format !== "INTERPRETE-SUPABASE-BACKUP-V1" ||
    manifest.sourceProjectRef !== SOURCE_REF ||
    manifest.sourceSnapshotManifest == null
  ) {
    fail("Backup format or source-project guard failed.");
  }
  const snapshotBytes = unprotect(manifest.sourceSnapshotManifest);
  let snapshot;
  try {
    snapshot = JSON.parse(snapshotBytes.toString("utf8"));
  } finally {
    snapshotBytes.fill(0);
  }
  if (
    snapshot.format !== "INTERPRETE-SUPABASE-SOURCE-SNAPSHOT-V1" ||
    snapshot.sourceProjectRef !== SOURCE_REF ||
    snapshot.connection.snapshotIdSha256 !== manifest.export.snapshotIdSha256
  ) {
    fail("Backup and row manifest are not bound to the same source snapshot.");
  }

  const archive = fs.readFileSync(archivePath);
  if (
    archive.length !== manifest.encryptedArtifactBytes ||
    sha256(archive) !== manifest.encryptedArtifactSha256 ||
    !archive.subarray(0, MAGIC.length).equals(MAGIC)
  ) {
    fail("Encrypted backup integrity or header validation failed.");
  }
  const key = unprotect(
    path.join(path.dirname(archivePath), manifest.keyArtifact)
  );
  if (key.length !== 32) {
    key.fill(0);
    fail("Backup decryption key has an invalid length.");
  }
  const ivStart = MAGIC.length;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    archive.subarray(ivStart, ivStart + 12)
  );
  key.fill(0);
  decipher.setAuthTag(archive.subarray(-16));
  const plaintext = Buffer.concat([
    decipher.update(archive.subarray(ivStart + 12, -16)),
    decipher.final(),
  ]);
  if (
    plaintext.length !== manifest.payloadBytes ||
    sha256(plaintext) !== manifest.payloadSha256 ||
    plaintext.subarray(0, 5).toString("ascii") !== "PGDMP"
  ) {
    plaintext.fill(0);
    fail("Decrypted backup payload did not match its manifest.");
  }

  return { manifest, snapshot, plaintext };
};

const parseCopyFields = (line) => {
  const fields = [];
  let field = "";
  let escaped = false;
  for (const character of line) {
    if (character === "\\") {
      field += character;
      escaped = !escaped;
      continue;
    }
    if (character === "\t" && !escaped) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
    escaped = false;
  }
  fields.push(field);
  return fields;
};

const unescapeCopyField = (value) => {
  if (value === "\\N") {
    return null;
  }
  return value.replace(
    /\\(\\|[bfnrtv]|[0-7]{1,3}|x[0-9A-Fa-f]{2})/g,
    (_, code) => {
      const escapes = {
        "\\": "\\",
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
        v: "\v",
      };
      if (Object.hasOwn(escapes, code)) {
        return escapes[code];
      }
      if (code.startsWith("x")) {
        return String.fromCharCode(Number.parseInt(code.slice(1), 16));
      }
      return String.fromCharCode(Number.parseInt(code, 8));
    }
  );
};

const restoreRows = (plaintext) => {
  if (!fs.existsSync(PG_RESTORE)) {
    fail("The verified pg_restore executable is missing.");
  }
  const restored = spawnSync(
    PG_RESTORE,
    ["--data-only", "--table=Member", "--table=MutationRateLimit", "--file=-"],
    {
      input: plaintext,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    }
  );
  if (restored.status !== 0) {
    fail("pg_restore could not decode the two diagnostic table sections.");
  }

  const rows = new Map([
    ["Member", []],
    ["MutationRateLimit", []],
  ]);
  let columns = null;
  let activeTable = null;
  for (const line of restored.stdout.split(copyLineBreaks)) {
    const header = copyStatementPattern.exec(line);
    if (header) {
      activeTable = rows.has(header[1]) ? header[1] : null;
      columns = activeTable
        ? header[2]
            .split(copyColumnSeparator)
            .map((value) => value.replace(copyColumnQuotes, ""))
        : null;
      continue;
    }
    if (activeTable && line === "\\.") {
      activeTable = null;
      columns = null;
      continue;
    }
    if (activeTable && columns) {
      const values = parseCopyFields(line).map(unescapeCopyField);
      if (values.length !== columns.length) {
        fail(
          "A table row in the encrypted archive has an invalid field count."
        );
      }
      rows
        .get(activeTable)
        .push(
          Object.fromEntries(
            columns.map((column, index) => [column, values[index]])
          )
        );
    }
  }
  return rows;
};

const comparableValue = (table, column, value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const type = typeByTable[table][column];
  if (type === "date") {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? value : timestamp;
  }
  if (type === "number") {
    return Number(value);
  }
  return value;
};

const identityHash = (id) => sha256(JSON.stringify([id]));
const identityFingerprint = (id) => identityHash(id).slice(0, 12);

const tableDiff = (beforeRows, afterRows, table) => {
  const before = new Map(beforeRows.map((row) => [row.id, row]));
  const after = new Map(afterRows.map((row) => [row.id, row]));
  const added = [...after.keys()].filter((id) => !before.has(id));
  const removed = [...before.keys()].filter((id) => !after.has(id));
  const modified = [];
  for (const [id, oldRow] of before) {
    const newRow = after.get(id);
    if (!newRow) {
      continue;
    }
    const fields = [
      ...new Set([...Object.keys(oldRow), ...Object.keys(newRow)]),
    ]
      .filter(
        (key) =>
          comparableValue(table, key, oldRow[key]) !==
          comparableValue(table, key, newRow[key])
      )
      .sort();
    if (fields.length) {
      modified.push({ id, fields, before: oldRow, after: newRow });
    }
  }
  return { added, removed, modified };
};

const verifyManifestIdentities = (snapshot, tableName, rows) => {
  const manifest = snapshot.database.rowSnapshots.find(
    (table) => table.schema === "public" && table.table === tableName
  );
  if (!manifest || manifest.rowCount !== rows.length) {
    fail(`Backup rows do not match the ${tableName} snapshot count.`);
  }
  const actual = new Set(rows.map((row) => identityHash(row.id)));
  if (
    actual.size !== manifest.perRowHashes.length ||
    manifest.perRowHashes.some((row) => !actual.has(row.identitySha256))
  ) {
    fail(
      `Backup row identities do not match the ${tableName} snapshot manifest.`
    );
  }
};

const [beforeArchive, afterArchive] = process.argv.slice(2);
if (process.platform !== "win32" || !beforeArchive || !afterArchive) {
  fail(
    "Usage: node diagnose-supabase-snapshot-divergence.mjs <before.pgdump.aesgcm> <after.pgdump.aesgcm>"
  );
}

let beforePayload;
let afterPayload;
try {
  beforePayload = decryptArchive(beforeArchive);
  afterPayload = decryptArchive(afterArchive);
  const beforeRows = restoreRows(beforePayload.plaintext);
  const afterRows = restoreRows(afterPayload.plaintext);
  for (const tableName of ["Member", "MutationRateLimit"]) {
    verifyManifestIdentities(
      beforePayload.snapshot,
      tableName,
      beforeRows.get(tableName)
    );
    verifyManifestIdentities(
      afterPayload.snapshot,
      tableName,
      afterRows.get(tableName)
    );
  }

  const member = tableDiff(
    beforeRows.get("Member"),
    afterRows.get("Member"),
    "Member"
  );
  const rateLimit = tableDiff(
    beforeRows.get("MutationRateLimit"),
    afterRows.get("MutationRateLimit"),
    "MutationRateLimit"
  );
  const afterTime = Date.parse(afterPayload.snapshot.createdAt);
  const addedRateLimit = rateLimit.added.map((id) =>
    afterRows.get("MutationRateLimit").find((row) => row.id === id)
  );
  const removedRateLimit = rateLimit.removed.map((id) =>
    beforeRows.get("MutationRateLimit").find((row) => row.id === id)
  );
  const cleanupMatches =
    addedRateLimit.length === 1 &&
    removedRateLimit.length > 0 &&
    removedRateLimit.every(
      (row) =>
        row.memberId === addedRateLimit[0].memberId &&
        row.action === addedRateLimit[0].action &&
        Date.parse(row.windowStart) < afterTime - 24 * 60 * 60 * 1000
    );

  const memberChange = member.modified.map(({ id, fields, before, after }) => ({
    idFingerprint: identityFingerprint(id),
    memberFingerprint: sha256(id).slice(0, 12),
    changedFields: fields,
    beforeUpdatedAt: before.updatedAt,
    afterUpdatedAt: after.updatedAt,
    roleChanged: fields.includes("role"),
    identityFieldsChanged: fields.some((field) =>
      ["displayName", "email", "avatarUrl"].includes(field)
    ),
  }));
  const output = {
    ok: true,
    beforeAt: beforePayload.snapshot.createdAt,
    afterAt: afterPayload.snapshot.createdAt,
    member: {
      beforeRows: beforeRows.get("Member").length,
      afterRows: afterRows.get("Member").length,
      added: member.added.map(identityFingerprint),
      removed: member.removed.map(identityFingerprint),
      modified: memberChange,
    },
    mutationRateLimit: {
      beforeRows: beforeRows.get("MutationRateLimit").length,
      afterRows: afterRows.get("MutationRateLimit").length,
      added: addedRateLimit.map((row) => ({
        idFingerprint: identityFingerprint(row.id),
        memberFingerprint: sha256(row.memberId).slice(0, 12),
        action: row.action,
        windowStart: row.windowStart,
        count: Number(row.count),
      })),
      removed: removedRateLimit.map((row) => ({
        idFingerprint: identityFingerprint(row.id),
        memberFingerprint: sha256(row.memberId).slice(0, 12),
        action: row.action,
        windowStart: row.windowStart,
        ageHoursAtAfterSnapshot:
          Math.round(
            ((afterTime - Date.parse(row.windowStart)) / 3_600_000) * 100
          ) / 100,
      })),
      removedByExpiredWindowCleanup: cleanupMatches,
    },
    rawIdentifiersEmitted: false,
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
    })}\n`
  );
  process.exitCode = 2;
} finally {
  beforePayload?.plaintext.fill(0);
  afterPayload?.plaintext.fill(0);
}
