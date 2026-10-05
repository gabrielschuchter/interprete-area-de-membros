#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { prepareRestoreToc } from "../lib/postgres-archive-validation.mjs";
import { parseGreenSessionPoolerUrl } from "../lib/supabase-green-connection.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const PG_TOOLS = path.join(
  os.tmpdir(),
  "interprete-pgtools-17.11-5/full-extract/bin"
);
const PG_RESTORE = path.join(PG_TOOLS, "pg_restore.exe");
const PSQL = path.join(PG_TOOLS, "psql.exe");
const DATABASE_PACKAGE = path.join(ROOT, "packages/database/package.json");
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
const MAX_DATABASE_BYTES = 100_000_000;
const ARCHIVE_MAGIC = Buffer.from("INTERPRETE-SUPABASE-BACKUP-V1\n", "ascii");
const WINDOWS_SID = /S-1-[0-9-]+/i;
const DATABASE_PATH_PREFIX = /^\//;
const ENCRYPTED_ARCHIVE_SUFFIX = /\.pgdump\.aesgcm$/i;
const PSQL_SQLSTATE = /ERROR:\s+([A-Z0-9]{5}):/;
const PSQL_PERMISSION_DIAGNOSTIC =
  /(?:permission denied|must be (?:owner|member)|must have|only superuser|unrecognized configuration parameter)[^\r\n]*/;

const fail = (message) => {
  throw new Error(message);
};

const sha256 = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");

const unwrapDpapi = (bytes) => {
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
      maxBuffer: 64 * 1024 * 1024,
    }
  );
  if (result.status !== 0 || !result.stdout?.trim()) {
    fail("Current-user DPAPI could not open the protected migration artifact.");
  }
  return Buffer.from(result.stdout.trim(), "base64");
};

const loadCredential = () => {
  const protectedUri = unwrapDpapi(fs.readFileSync(CREDENTIAL_FILE));
  try {
    return parseGreenSessionPoolerUrl(protectedUri.toString("utf8"));
  } finally {
    protectedUri.fill(0);
  }
};

const readAndAuthenticateArchive = (archivePath, manifestPath) => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (
    manifest.format !== "INTERPRETE-SUPABASE-BACKUP-V1" ||
    manifest.sourceProjectRef !== SOURCE_REF ||
    manifest.export?.transactionReadOnly !== true ||
    manifest.export?.tls !== "verify-full" ||
    manifest.export?.schemas?.join(",") !== "public,supabase_migrations"
  ) {
    fail("Backup manifest failed the source, scope, or read-only guard.");
  }
  const archive = fs.readFileSync(archivePath);
  if (
    archive.length !== manifest.encryptedArtifactBytes ||
    sha256(archive) !== manifest.encryptedArtifactSha256 ||
    !archive.subarray(0, ARCHIVE_MAGIC.length).equals(ARCHIVE_MAGIC) ||
    archive.length < ARCHIVE_MAGIC.length + 12 + 16
  ) {
    fail("Encrypted backup integrity or archive header validation failed.");
  }
  const keyPath = path.join(path.dirname(archivePath), manifest.keyArtifact);
  const key = unwrapDpapi(fs.readFileSync(keyPath));
  if (key.length !== 32) {
    key.fill(0);
    fail("The protected backup key has an invalid length.");
  }
  const ivStart = ARCHIVE_MAGIC.length;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    archive.subarray(ivStart, ivStart + 12)
  );
  key.fill(0);
  decipher.setAuthTag(archive.subarray(archive.length - 16));
  const plaintext = Buffer.concat([
    decipher.update(archive.subarray(ivStart + 12, archive.length - 16)),
    decipher.final(),
  ]);
  if (
    plaintext.length !== manifest.payloadBytes ||
    sha256(plaintext) !== manifest.payloadSha256 ||
    plaintext.subarray(0, 5).toString("ascii") !== "PGDMP"
  ) {
    plaintext.fill(0);
    fail(
      "Decrypted archive authentication, size, or payload hash validation failed."
    );
  }
  return { manifest, plaintext };
};

const getCurrentUserSid = () => {
  const result = spawnSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const sid = result.stdout?.match(WINDOWS_SID)?.[0];
  if (result.status !== 0 || !sid) {
    fail("Could not resolve the current Windows user for temporary ACLs.");
  }
  return sid;
};

const secureFile = (filePath, sid) => {
  const result = spawnSync(
    "icacls.exe",
    [filePath, "/inheritance:r", "/grant:r", `*${sid}:(F)`],
    { encoding: "utf8", windowsHide: true }
  );
  if (result.status !== 0) {
    fail(
      "Could not restrict the temporary restore list to the current Windows user."
    );
  }
};

const secureDirectory = (directoryPath, sid) => {
  const result = spawnSync(
    "icacls.exe",
    [directoryPath, "/inheritance:r", "/grant:r", `*${sid}:(OI)(CI)(F)`],
    { encoding: "utf8", windowsHide: true }
  );
  if (result.status !== 0) {
    fail(
      "Could not restrict temporary restore artifacts to the current Windows user."
    );
  }
};

const readGreenPreflight = async (url) => {
  const require = createRequire(DATABASE_PACKAGE);
  const { Client } = require("pg");
  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, ca: fs.readFileSync(CA_FILE, "utf8") },
    options: "-c default_transaction_read_only=on",
    connectionTimeoutMillis: 15_000,
  });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const result = await client.query(
      "SELECT current_setting('transaction_read_only') AS read_only," +
        "current_setting('server_version') AS server_version," +
        "current_setting('server_version_num') AS server_version_num," +
        "current_database() AS database_name," +
        "pg_database_size(current_database())::text AS database_bytes," +
        "to_regnamespace('public') IS NOT NULL AS public_schema_exists," +
        "(SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace " +
        "WHERE n.nspname IN ('public','supabase_migrations') AND c.relkind IN ('r','p','v','m','S','f')) AS relation_count," +
        "(SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace " +
        "WHERE n.nspname IN ('public','supabase_migrations')) AS routine_count," +
        "(SELECT count(*)::int FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace " +
        "WHERE n.nspname IN ('public','supabase_migrations') AND t.typtype IN ('e','d')) AS enum_domain_count"
    );
    const facts = result.rows[0];
    if (facts.read_only !== "on" || facts.database_name !== "postgres") {
      fail(
        "Restore preflight did not confirm a read-only green PostgreSQL session."
      );
    }
    const platformFunction = await client.query(
      "SELECT pg_get_functiondef(p.oid) AS definition FROM pg_proc p " +
        "JOIN pg_namespace n ON n.oid=p.pronamespace " +
        "WHERE n.nspname='public' AND p.proname='rls_auto_enable' " +
        "AND pg_get_function_identity_arguments(p.oid)=''"
    );
    const defaultPrivileges = (
      await client.query(
        "SELECT n.nspname AS schema_name,pg_get_userbyid(d.defaclrole) AS owner_name," +
          "d.defaclobjtype AS object_type,d.defaclacl::text AS acl " +
          "FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace " +
          "WHERE n.nspname='public' AND pg_get_userbyid(d.defaclrole)='supabase_admin' ORDER BY d.defaclobjtype"
      )
    ).rows;
    await client.query("ROLLBACK");
    return {
      serverVersion: facts.server_version,
      serverVersionNum: Number(facts.server_version_num),
      databaseBytes: Number(facts.database_bytes),
      publicSchemaExists: facts.public_schema_exists,
      domainObjectCount:
        facts.relation_count + facts.routine_count + facts.enum_domain_count,
      platformRlsFunctionSha256:
        platformFunction.rows.length === 1
          ? sha256(platformFunction.rows[0].definition)
          : null,
      managedDefaultPrivileges: defaultPrivileges,
    };
  } finally {
    await client.end();
  }
};

const runReadOnlyValidator = (stage, snapshotPath) => {
  const script = path.join(
    ROOT,
    "scripts/migration/validate-supabase-green.mjs"
  );
  const result = spawnSync(process.execPath, [script, stage, snapshotPath], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status === 0) {
    try {
      const validation = JSON.parse(result.stdout.trim());
      return validation.ok === true ? validation : null;
    } catch {
      return null;
    }
  }
  return null;
};

const runProjectConfigReconciler = (snapshotPath) => {
  const script = path.join(
    ROOT,
    "scripts/migration/reconcile-supabase-green-config.mjs"
  );
  const result = spawnSync(process.execPath, [script, snapshotPath], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status === 0) {
    try {
      const reconciliation = JSON.parse(result.stdout.trim());
      return reconciliation.ok === true ? reconciliation : null;
    } catch {
      return null;
    }
  }
  return null;
};

const runPsqlRestore = (url, restoreSql) => {
  const args = [
    "--no-password",
    "--no-psqlrc",
    "--set=ON_ERROR_STOP=1",
    "--set=VERBOSITY=verbose",
    "--single-transaction",
    "--host",
    url.hostname,
    "--port",
    url.port,
    "--username",
    decodeURIComponent(url.username),
    "--dbname",
    decodeURIComponent(url.pathname.replace(DATABASE_PATH_PREFIX, "")),
    "--file=-",
  ];
  const env = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: CA_FILE,
  };
  env.PGPASSFILE = undefined;
  const result = spawnSync(PSQL, args, {
    input: restoreSql,
    encoding: "utf8",
    env,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const errorLine = result.stderr
      ?.split("\n")
      .find((line) => line.includes("ERROR:"));
    const sqlstate = errorLine?.match(PSQL_SQLSTATE)?.[1];
    const diagnostic = errorLine?.match(PSQL_PERMISSION_DIAGNOSTIC)?.[0];
    fail(
      "The green restore transaction failed and PostgreSQL rolled it back; SQL output was suppressed. " +
        JSON.stringify({
          sqlstate: sqlstate ?? null,
          diagnostic: diagnostic ?? null,
          processError: result.error?.code ?? null,
        })
    );
  }
};

const requireRestoreInputs = () => {
  if (!(process.platform === "win32" && process.env.LOCALAPPDATA)) {
    fail(
      "This restore helper requires the Windows profile protected by DPAPI."
    );
  }
  const [archiveArgument, snapshotArgument] = process.argv.slice(2);
  if (!(archiveArgument && snapshotArgument)) {
    fail(
      "Usage: bun run scripts/migration/restore-supabase-green.mjs <encrypted-archive> <DPAPI-source-snapshot>"
    );
  }
  if (
    ![PG_RESTORE, PSQL, CA_FILE, CREDENTIAL_FILE].every((item) =>
      fs.existsSync(item)
    )
  ) {
    fail(
      "Verified PostgreSQL tools, CA certificate, or green credential is missing."
    );
  }
  const archivePath = path.resolve(archiveArgument);
  const snapshotPath = path.resolve(snapshotArgument);
  const manifestPath = archivePath.replace(
    ENCRYPTED_ARCHIVE_SUFFIX,
    ".manifest.json"
  );
  if (manifestPath === archivePath || !fs.existsSync(snapshotPath)) {
    fail(
      "The encrypted source archive or paired source snapshot path is invalid."
    );
  }
  return { archivePath, manifestPath, snapshotPath };
};

const finishIfAlreadyRestored = (snapshotPath) => {
  const alreadyMigrated = runReadOnlyValidator("migrated", snapshotPath);
  if (alreadyMigrated) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        status: "already-restored-and-migrated",
        projectRef: GREEN_REF,
        transactionReadOnly: true,
      })}\n`
    );
    return true;
  }
  const alreadyRestoredData = runReadOnlyValidator(
    "restored-data",
    snapshotPath
  );
  if (!alreadyRestoredData) {
    return false;
  }

  const existingFullState = runReadOnlyValidator("restored", snapshotPath);
  const reconciliation =
    existingFullState ?? runProjectConfigReconciler(snapshotPath);
  const validation = reconciliation
    ? runReadOnlyValidator("restored", snapshotPath)
    : null;
  if (!validation) {
    fail(
      "Green already contains the source rows, but project configuration is not reconciled; no data was overwritten."
    );
  }
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      status: "already-restored-and-reconciled",
      projectRef: GREEN_REF,
      transactionReadOnly: true,
      rowsVerified: validation.sourceRowsVerified,
    })}\n`
  );
  return true;
};

const readVerifiedSourceArchive = (archivePath, snapshotPath, preflight) => {
  const sourceSnapshotBytes = unwrapDpapi(fs.readFileSync(snapshotPath));
  const sourceSnapshot = JSON.parse(sourceSnapshotBytes.toString("utf8"));
  sourceSnapshotBytes.fill(0);
  const { manifest, plaintext } = readAndAuthenticateArchive(
    archivePath,
    archivePath.replace(ENCRYPTED_ARCHIVE_SUFFIX, ".manifest.json")
  );
  if (
    sourceSnapshot.format !== "INTERPRETE-SUPABASE-SOURCE-SNAPSHOT-V1" ||
    sourceSnapshot.sourceProjectRef !== SOURCE_REF ||
    sourceSnapshot.connection.snapshotIdSha256 !==
      manifest.export.snapshotIdSha256 ||
    manifest.sourceSnapshotManifest !== snapshotPath
  ) {
    plaintext.fill(0);
    fail(
      "The source archive and row-hash snapshot are not from the same PostgreSQL snapshot."
    );
  }
  const sourceRlsFunction = sourceSnapshot.catalog.functions.find(
    (fn) =>
      fn.schema_name === "public" &&
      fn.function_name === "rls_auto_enable" &&
      fn.identity_arguments === ""
  );
  const existingRlsFunction =
    preflight.domainObjectCount === 1 &&
    preflight.platformRlsFunctionSha256 !== null &&
    preflight.platformRlsFunctionSha256 ===
      sourceRlsFunction?.definition_sha256;
  if (preflight.domainObjectCount !== 0 && !existingRlsFunction) {
    plaintext.fill(0);
    fail(
      "Green contains domain objects that do not match the source baseline; refusing to overwrite or clean them."
    );
  }
  const sourceManagedDefaults = sourceSnapshot.catalog.defaultAcls
    .filter(
      (acl) =>
        acl.schema_name === "public" && acl.owner_name === "supabase_admin"
    )
    .sort((left, right) => left.object_type.localeCompare(right.object_type));
  const currentManagedDefaults = preflight.managedDefaultPrivileges.toSorted(
    (left, right) => left.object_type.localeCompare(right.object_type)
  );
  if (
    sourceManagedDefaults.length !== 3 ||
    currentManagedDefaults.length !== 3 ||
    !sourceManagedDefaults.every((source, index) => {
      const current = currentManagedDefaults[index];
      return (
        source.object_type === current.object_type && source.acl === current.acl
      );
    })
  ) {
    plaintext.fill(0);
    fail(
      "Managed default privileges differ from the source; no restore was attempted."
    );
  }
  const domainBytes = sourceSnapshot.database.relations
    .filter((relation) =>
      ["public", "supabase_migrations"].includes(relation.schema_name)
    )
    .reduce((sum, relation) => sum + Number(relation.total_bytes ?? 0), 0);
  const projectedBytes = preflight.databaseBytes + domainBytes + 10_000_000;
  if (projectedBytes > MAX_DATABASE_BYTES) {
    plaintext.fill(0);
    fail(
      "The conservative projected green database size exceeds the 100 MB operational gate."
    );
  }
  return { plaintext, domainBytes, projectedBytes, existingRlsFunction };
};

const main = async () => {
  const { archivePath, snapshotPath } = requireRestoreInputs();

  const url = loadCredential();
  const preflight = await readGreenPreflight(url);
  if (!preflight.publicSchemaExists) {
    fail(
      "Green does not have its platform-provisioned public schema; no writes were attempted."
    );
  }
  if (Math.floor(preflight.serverVersionNum / 10_000) !== 17) {
    fail(
      `Green PostgreSQL ${preflight.serverVersion} does not match source major version 17; no writes were attempted.`
    );
  }

  if (finishIfAlreadyRestored(snapshotPath)) {
    return;
  }
  const { plaintext, domainBytes, projectedBytes, existingRlsFunction } =
    readVerifiedSourceArchive(archivePath, snapshotPath, preflight);

  const toc = spawnSync(PG_RESTORE, ["--list"], {
    input: plaintext,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (toc.status !== 0) {
    plaintext.fill(0);
    fail(
      "pg_restore rejected the authenticated source archive before any green write."
    );
  }
  const restorePlan = prepareRestoreToc(toc.stdout, {
    existingRlsFunction,
    existingManagedDefaults: true,
  });
  const sid = getCurrentUserSid();
  secureDirectory(CREDENTIAL_DIRECTORY, sid);
  const listPath = path.join(
    CREDENTIAL_DIRECTORY,
    `.green-restore-list-${crypto.randomBytes(8).toString("hex")}.txt`
  );
  try {
    fs.writeFileSync(listPath, restorePlan.list, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    secureFile(listPath, sid);
    const generated = spawnSync(
      PG_RESTORE,
      [
        "--no-owner",
        "--no-publications",
        "--exit-on-error",
        "--use-list",
        listPath,
        "--file=-",
      ],
      {
        input: plaintext,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
      }
    );
    plaintext.fill(0);
    if (generated.status !== 0 || !generated.stdout) {
      fail(
        "pg_restore could not generate a complete SQL stream for the green transaction: " +
          (generated.error?.code ??
            generated.stderr?.trim().slice(0, 500) ??
            "no diagnostic")
      );
    }
    const preamble =
      "CREATE SCHEMA IF NOT EXISTS public;\n" +
      "CREATE SCHEMA IF NOT EXISTS supabase_migrations;\n";
    runPsqlRestore(url, preamble + generated.stdout);
  } finally {
    fs.rmSync(listPath, { force: true });
  }

  const projectConfig = runProjectConfigReconciler(snapshotPath);
  if (!projectConfig) {
    fail(
      "Domain restore committed, but green project configuration reconciliation failed; rerun the reconciler before any migration or Preview."
    );
  }
  const validation = runReadOnlyValidator("restored", snapshotPath);
  if (!validation) {
    fail(
      "Restore committed, but the read-only baseline validator did not pass; green remains isolated for investigation."
    );
  }
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      status: "restored-and-validated",
      projectRef: GREEN_REF,
      sourceProjectRef: SOURCE_REF,
      serverVersion: preflight.serverVersion,
      databaseBytesBefore: preflight.databaseBytes,
      estimatedDomainBytes: domainBytes,
      conservativeProjectedDatabaseBytes: projectedBytes,
      excludedPreprovisionedSchemaCreateEntries:
        restorePlan.excludedSchemaEntries,
      excludedIdenticalPlatformFunctions: restorePlan.excludedFunctionEntries,
      excludedIdenticalManagedDefaults: restorePlan.excludedDefaultEntries,
      archiveEntriesRestored: restorePlan.remainingEntries,
      rowsVerified: validation.sourceRowsVerified,
      tls: "verify-full",
      sourceWrites: 0,
    })}\n`
  );
};

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown green restore failure";
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      projectRef: GREEN_REF,
      error: message
        .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[connection URI redacted]")
        .replace(
          /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,
          "[Supabase key redacted]"
        )
        .replace(
          /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
          "[JWT redacted]"
        )
        .slice(0, 1000),
    })}\n`
  );
  process.exitCode = 2;
});
