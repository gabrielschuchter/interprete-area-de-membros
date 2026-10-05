#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseGreenSessionPoolerUrl } from "../lib/supabase-green-connection.mjs";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const DATABASE_PACKAGE = path.join(ROOT, "packages/database/package.json");
const CA_FILE = path.join(
  ROOT,
  "packages/database/certs/supabase-prod-ca-2021.crt"
);
const CREDENTIAL_FILE = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Codex/migrations/interprete-supabase/green-session-pooler-uri.dpapi"
);

const unprotectCredential = (bytes) => {
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
    throw new Error("Current-user DPAPI could not open the green credential.");
  }
  return Buffer.from(result.stdout.trim(), "base64");
};

const sanitizeError = (error) => {
  const message =
    error instanceof Error ? error.message : "Unknown connection error";
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[connection URI redacted]")
    .replace(/password\s*[:=]\s*[^\s]+/gi, "password=[redacted]")
    .slice(0, 1000);
};

const fail = (message) => {
  throw new Error(message);
};

const main = async () => {
  if (!(process.platform === "win32" && process.env.LOCALAPPDATA)) {
    fail("The protected green credential requires this Windows user profile.");
  }
  if (!(fs.existsSync(CREDENTIAL_FILE) && fs.existsSync(CA_FILE))) {
    fail("Protected green credential or Supabase CA certificate is missing.");
  }

  const require = createRequire(DATABASE_PACKAGE);
  const { Client } = require("pg");
  const credential = unprotectCredential(fs.readFileSync(CREDENTIAL_FILE));
  const storedUri = credential.toString("utf8");
  parseGreenSessionPoolerUrl(storedUri);
  credential.fill(0);

  const client = new Client({
    connectionString: storedUri,
    ssl: { rejectUnauthorized: true, ca: fs.readFileSync(CA_FILE, "utf8") },
    options: "-c default_transaction_read_only=on",
    connectionTimeoutMillis: 15_000,
  });
  let transactionOpen = false;
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;
    const result = await client.query(
      "SELECT current_setting('server_version') AS server_version, " +
        "current_setting('transaction_read_only') AS transaction_read_only, " +
        "current_database() AS database_name, " +
        "pg_database_size(current_database())::text AS database_bytes, " +
        "(SELECT count(*)::text FROM information_schema.tables " +
        "WHERE table_schema='public' AND table_type='BASE TABLE') AS public_table_count, " +
        "(SELECT count(*)::text FROM auth.users) AS auth_user_count"
    );
    const facts = result.rows[0];
    if (
      facts.transaction_read_only !== "on" ||
      facts.database_name !== "postgres"
    ) {
      fail(
        "The green session did not confirm the expected read-only database."
      );
    }

    const domainObjects = process.argv.includes("--inventory")
      ? (
          await client.query(
            "SELECT n.nspname AS schema_name,c.relname AS name,c.relkind::text AS kind " +
              "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace " +
              "WHERE n.nspname IN ('public','supabase_migrations') AND c.relkind IN ('r','p','v','m','S','f') " +
              "UNION ALL SELECT n.nspname,p.proname,'function' FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace " +
              "WHERE n.nspname IN ('public','supabase_migrations') " +
              "UNION ALL SELECT n.nspname,t.typname,t.typtype::text FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace " +
              "WHERE n.nspname IN ('public','supabase_migrations') AND t.typtype IN ('e','d') ORDER BY 1,2"
          )
        ).rows
      : undefined;
    const defaultPrivileges = process.argv.includes("--inventory")
      ? (
          await client.query(
            "SELECT n.nspname AS schema_name,pg_get_userbyid(d.defaclrole) AS owner_name," +
              "d.defaclobjtype AS object_type,d.defaclacl::text AS acl," +
              "pg_has_role(current_user,d.defaclrole,'USAGE') AS can_alter " +
              "FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace " +
              "WHERE n.nspname IN ('public','supabase_migrations') ORDER BY 1,2,3"
          )
        ).rows
      : undefined;
    const snapshotArgument = process.argv.indexOf("--snapshot");
    let sourceDefaultPrivileges;
    if (snapshotArgument > -1) {
      const bytes = unprotectCredential(
        fs.readFileSync(process.argv[snapshotArgument + 1])
      );
      const snapshot = JSON.parse(bytes.toString("utf8"));
      bytes.fill(0);
      if (snapshot.sourceProjectRef !== "wkclodjbrynerfgufmyb") {
        fail("Source snapshot project mismatch.");
      }
      sourceDefaultPrivileges = snapshot.catalog.defaultAcls.filter((acl) =>
        ["public", "supabase_migrations"].includes(acl.schema_name)
      );
    }
    await client.query("ROLLBACK");
    transactionOpen = false;
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        projectRef: "qffqhilydtnrggbcnogh",
        serverVersion: facts.server_version,
        databaseName: facts.database_name,
        databaseBytes: Number(facts.database_bytes),
        publicTableCount: Number(facts.public_table_count),
        authUserCount: Number(facts.auth_user_count),
        transactionReadOnly: true,
        tls: "verify-full",
        domainObjects,
        defaultPrivileges,
        sourceDefaultPrivileges,
      })}\n`
    );
  } finally {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original probe error if rollback also fails.
      }
    }
    await client.end().catch(() => undefined);
  }
};

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ ok: false, sqlstate: error?.code ?? null, error: sanitizeError(error) })}\n`
  );
  process.exitCode = 2;
});
